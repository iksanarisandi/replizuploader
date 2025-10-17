import { Hono } from 'hono';
import { getDb } from '../db/client';
import { replizKeys, uploads } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  uploadMetadataSchema,
  generateId,
  getExtensionFromMime,
  getCurrentTimestamp,
  MAX_FILE_SIZE,
  ALLOWED_VIDEO_TYPES,
} from '../lib/utils';
import { decrypt } from '../lib/crypto';
import { requireUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import { uploadRateLimit } from '../middleware/rateLimit';
import { checkQuota, incrementQuota, decrementQuota } from '../lib/quota';
import { calculateDeletionTime, deleteUpload } from '../lib/cleanup';
import { createLogger } from '../lib/logger';
import { sanitizeText } from '../lib/sanitizer';
import { getAccounts, createSchedule, type ReplizAccount } from '../lib/repliz';
import type { AppBindings } from '../index';

const upload = new Hono<AppBindings>();

// Apply auth middleware and rate limiting
upload.use('/*', requireAuth);
upload.use('/*', uploadRateLimit);

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
  const logger = createLogger(c.env);
  let uploadedFilename: string | null = null;
  let uploadId: string | null = null;

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
    const titleRaw = formData.get('title') as string | null;
    const descriptionRaw = formData.get('description') as string | null;

    if (!videoFile || !titleRaw || !descriptionRaw) {
      return c.json(
        { error: 'Missing required fields: video, title, description', statusCode: 400 },
        400
      );
    }

    // Sanitize input to prevent XSS
    const title = sanitizeText(titleRaw);
    const description = sanitizeText(descriptionRaw);

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

    // Check user quota before upload
    const quotaCheck = await checkQuota(db, user.id, videoFile.size);
    if (!quotaCheck.allowed) {
      logger.warn(`Upload blocked - quota exceeded for user ${user.id}`, {
        reason: quotaCheck.reason,
        current: quotaCheck.current,
      });
      
      return c.json(
        {
          error: quotaCheck.reason,
          statusCode: 429,
          quota: {
            current: quotaCheck.current,
            limits: quotaCheck.limits,
          },
        },
        429
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

    // Increment quota
    await incrementQuota(db, user.id, videoFile.size);

    // Track upload in database
    uploadId = generateId();
    const now = getCurrentTimestamp();
    const scheduledDeletion = calculateDeletionTime();
    
    await db.insert(uploads).values({
      id: uploadId,
      userId: user.id,
      filename,
      fileSizeBytes: videoFile.size,
      mimeType: videoFile.type,
      title: metadata.title,
      description: metadata.description,
      uploadedAt: now,
      scheduledDeletionAt: scheduledDeletion,
      isDeleted: false,
      deletedAt: null,
    }).run();

    // Get public URL using custom domain
    const videoUrl = `https://post.komen.autos/${filename}`;
    
    logger.info(`Video uploaded to R2: ${filename}`, {
      size: videoFile.size,
      type: videoFile.type,
      scheduledDeletion: scheduledDeletion.toISOString(),
    });
    logger.debug(`Video URL: ${videoUrl}`);

    // Get all connected Repliz accounts
    let accounts: ReplizAccount[];
    try {
      logger.debug('Fetching Repliz accounts...');
      accounts = await getAccounts(accessKey, secretKey);
      logger.info(`Found ${accounts.length} connected Repliz accounts`);
    } catch (error: any) {
      logger.error('Failed to get Repliz accounts', error);
      // Clean up uploaded file and rollback quota
      await deleteUpload(db, c.env.UPLOADS, filename, c.env);
      await decrementQuota(db, user.id, videoFile.size);
      return c.json(
        { error: `Failed to get Repliz accounts: ${error.message}`, statusCode: 400 },
        400
      );
    }

    if (accounts.length === 0) {
      // Clean up uploaded file and rollback quota
      await deleteUpload(db, c.env.UPLOADS, filename, c.env);
      await decrementQuota(db, user.id, videoFile.size);
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
    
    logger.info(`Scheduling to ${targetAccounts.length} platforms`);

    for (const account of targetAccounts) {
      try {
        logger.debug(`Scheduling to account ${account.name} (${account.type})...`);
        
        // TikTok requires type: "video", other platforms use "image"
        const scheduleType: 'video' | 'image' = account.type === 'tiktok' ? 'video' : 'image';
        
        const payload = {
          title: metadata.title,
          description: metadata.description,
          type: scheduleType,
          medias: [
            {
              type: 'video' as const,
              url: videoUrl,
              thumbnail: videoUrl,
            },
          ],
          scheduleAt,
          accountId: account._id,
        };
        
        logger.debug(`Payload for ${account.type}`, { payload });
        
        const scheduleResponse = await createSchedule(
          payload,
          accessKey,
          secretKey
        );
        logger.info(`Successfully scheduled to ${account.name}`);

        results.push({
          accountId: account._id,
          accountName: account.name,
          accountType: account.type,
          status: 'success',
        });
      } catch (error: any) {
        logger.error(`Failed to schedule for account ${account._id}`, error);
        results.push({
          accountId: account._id,
          accountName: account.name,
          accountType: account.type,
          status: 'error',
          error: error.message,
        });
      }
    }

    // File will be automatically deleted after 48 hours by the cleanup cron job
    logger.info(`File scheduled for cleanup at ${scheduledDeletion.toISOString()}`);

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
    logger.error('Upload error', error);

    // Clean up uploaded file if exists and rollback quota
    if (uploadedFilename) {
      try {
        const user = c.get('user');
        const db = getDb(c.env.DB);
        
        // Get file size for quota rollback
        const upload = await db
          .select()
          .from(uploads)
          .where(eq(uploads.filename, uploadedFilename))
          .get();
        
        // Delete from R2 and database
        await deleteUpload(db, c.env.UPLOADS, uploadedFilename, c.env);
        
        // Rollback quota if we have the upload record
        if (upload && user) {
          await decrementQuota(db, user.id, upload.fileSizeBytes);
        }
      } catch (cleanupError: any) {
        logger.error('Failed to cleanup after error', cleanupError);
      }
    }

    return c.json(
      { error: error.message || 'Upload failed', statusCode: 500 },
      500
    );
  }
});

export default upload;
