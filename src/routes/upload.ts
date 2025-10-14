import { Hono } from 'hono';
import { getDb } from '../db/client';
import { replizKeys } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  uploadMetadataSchema,
  generateId,
  getExtensionFromMime,
  MAX_FILE_SIZE,
  ALLOWED_VIDEO_TYPES,
} from '../lib/utils';
import { decrypt } from '../lib/crypto';
import { requireUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import { getAccounts, createSchedule, type ReplizAccount } from '../lib/repliz';
import type { AppBindings } from '../index';

const upload = new Hono<AppBindings>();

// Apply auth middleware
upload.use('/*', requireAuth);

interface UploadResult {
  accountId: string;
  accountName: string;
  accountType: string;
  status: 'success' | 'error';
  error?: string;
}

/**
 * POST /api/upload
 * Upload video to R2 and schedule to all connected Repliz accounts
 */
upload.post('/upload', async (c) => {
  let uploadedFilename: string | null = null;

  try {
    const user = requireUser(c);
    const db = getDb(c.env.DB);

    // Get encrypted keys from database
    const userKeys = await db
      .select()
      .from(replizKeys)
      .where(eq(replizKeys.userId, user.id))
      .get();

    if (!userKeys) {
      return c.json(
        {
          error: 'Repliz keys not found. Please save your keys first.',
          statusCode: 400,
        },
        400
      );
    }

    // Decrypt keys
    const secret = c.env.CF_SECRET;
    if (!secret) {
      return c.json(
        { error: 'Server configuration error: CF_SECRET not set', statusCode: 500 },
        500
      );
    }

    const accessKey = await decrypt(userKeys.accessKeyEncrypted, secret);
    const secretKey = await decrypt(userKeys.secretKeyEncrypted, secret);

    // Parse multipart form data
    const formData = await c.req.formData();
    const videoFile = formData.get('video') as File | null;
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;

    if (!videoFile || !title || !description) {
      return c.json(
        { error: 'Missing required fields: video, title, description', statusCode: 400 },
        400
      );
    }

    // Validate metadata
    const metadata = uploadMetadataSchema.parse({ title, description });

    // Validate video file
    if (!videoFile.type.startsWith('video/')) {
      return c.json(
        { error: 'Invalid file type. Only video files are allowed.', statusCode: 400 },
        400
      );
    }

    if (!ALLOWED_VIDEO_TYPES.includes(videoFile.type)) {
      return c.json(
        {
          error: `Unsupported video type: ${videoFile.type}. Allowed: ${ALLOWED_VIDEO_TYPES.join(', ')}`,
          statusCode: 400,
        },
        400
      );
    }

    if (videoFile.size > MAX_FILE_SIZE) {
      return c.json(
        {
          error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          statusCode: 400,
        },
        400
      );
    }

    // Generate unique filename
    const extension = getExtensionFromMime(videoFile.type);
    const filename = `${generateId()}${extension}`;
    uploadedFilename = filename;

    // Upload to R2
    await c.env.UPLOADS.put(filename, videoFile.stream(), {
      httpMetadata: {
        contentType: videoFile.type,
      },
    });

    // Get public URL using custom domain
    const videoUrl = `https://post.komen.autos/${filename}`;
    
    console.log('Video uploaded to R2:', filename);
    console.log('Video URL:', videoUrl);
    console.log('Decrypted Repliz credentials - Access Key length:', accessKey.length);

    // Get all connected Repliz accounts
    let accounts: ReplizAccount[];
    try {
      console.log('Fetching Repliz accounts...');
      accounts = await getAccounts(accessKey, secretKey);
      console.log('Found accounts:', accounts.length, accounts.map(a => ({ id: a._id, name: a.name, type: a.type })));
    } catch (error: any) {
      console.error('Failed to get Repliz accounts:', error.message);
      // Clean up uploaded file
      await c.env.UPLOADS.delete(filename);
      return c.json(
        { error: `Failed to get Repliz accounts: ${error.message}`, statusCode: 400 },
        400
      );
    }

    if (accounts.length === 0) {
      // Clean up uploaded file
      await c.env.UPLOADS.delete(filename);
      return c.json(
        {
          error: 'No connected accounts found. Please connect at least one account in Repliz.',
          statusCode: 400,
        },
        400
      );
    }

    // Schedule to all accounts
    const results: UploadResult[] = [];
    const scheduleAt = new Date().toISOString();

    // Parse selected platforms from form (optional)
    const selectedPlatforms = formData.get('platforms') as string | null;
    const platformsList = selectedPlatforms ? selectedPlatforms.split(',') : null;
    
    // Filter accounts based on selection
    const targetAccounts = platformsList 
      ? accounts.filter(acc => platformsList.includes(acc.type))
      : accounts;
    
    console.log('Target platforms:', targetAccounts.map(a => a.type));

    for (const account of targetAccounts) {
      try {
        console.log(`Scheduling to account ${account.name} (${account.type})...`);
        
        // TikTok requires type: "video", other platforms use "image"
        const scheduleType = account.type === 'tiktok' ? 'video' : 'image';
        
        const payload = {
          title: metadata.title,
          description: metadata.description,
          type: scheduleType,
          medias: [
            {
              type: 'video',
              url: videoUrl,
              thumbnail: videoUrl,
            },
          ],
          scheduleAt,
          accountId: account._id,
        };
        
        console.log(`Payload for ${account.type}:`, JSON.stringify(payload, null, 2));
        
        const scheduleResponse = await createSchedule(
          payload,
          accessKey,
          secretKey
        );
        console.log(`Successfully scheduled to ${account.name}:`, JSON.stringify(scheduleResponse, null, 2));

        results.push({
          accountId: account._id,
          accountName: account.name,
          accountType: account.type,
          status: 'success',
        });
      } catch (error: any) {
        console.error(`Failed to schedule for account ${account._id}:`, error.message);
        results.push({
          accountId: account._id,
          accountName: account.name,
          accountType: account.type,
          status: 'error',
          error: error.message,
        });
      }
    }

    // NOTE: Keep file in R2 so Repliz can download it
    // Repliz needs to access the video URL to download and process
    // TODO: Implement cleanup after 24 hours or use Repliz webhooks
    console.log('Video kept in R2 for Repliz to download:', filename);

    // Check if all failed
    const successCount = results.filter((r) => r.status === 'success').length;
    if (successCount === 0) {
      return c.json(
        {
          error: 'Failed to schedule to any account',
          statusCode: 500,
          results,
        },
        500
      );
    }

    return c.json({
      success: true,
      message: `Successfully scheduled to ${successCount} out of ${results.length} accounts`,
      results,
    });
  } catch (error: any) {
    console.error('Upload error:', error);

    // Clean up uploaded file if exists
    if (uploadedFilename) {
      try {
        await c.env.UPLOADS.delete(uploadedFilename);
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError);
      }
    }

    return c.json(
      { error: error.message || 'Upload failed', statusCode: 500 },
      500
    );
  }
});

export default upload;
