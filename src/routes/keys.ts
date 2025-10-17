import { Hono } from 'hono';
import { getDb } from '../db/client';
import { replizKeys } from '../db/schema';
import { eq } from 'drizzle-orm';
import { keysSchema, generateId, getCurrentTimestamp } from '../lib/utils';
import { encrypt } from '../lib/crypto';
import { requireUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import { saveKeysRateLimit } from '../middleware/rateLimit';
import { createLogger } from '../lib/logger';
import type { AppBindings } from '../index';

const keys = new Hono<AppBindings>();

// Apply auth middleware
keys.use('/*', requireAuth);

/**
 * POST /api/save-keys
 * Save Repliz access key and secret key (encrypted)
 */
keys.post('/save-keys', saveKeysRateLimit, async (c) => {
  const logger = createLogger(c.env);
  
  try {
    const body = await c.req.json();
    const validated = keysSchema.parse(body);
    const user = requireUser(c);

    const db = getDb(c.env.DB);
    const secret = c.env.CF_SECRET;

    if (!secret) {
      return c.json(
        { error: 'Server configuration error: CF_SECRET not set', statusCode: 500 },
        500
      );
    }

    // Encrypt keys
    const accessKeyEncrypted = await encrypt(validated.accessKey, secret);
    const secretKeyEncrypted = await encrypt(validated.secretKey, secret);

    // Check if user already has keys
    const existing = await db
      .select()
      .from(replizKeys)
      .where(eq(replizKeys.userId, user.id))
      .get();

    const now = getCurrentTimestamp();

    if (existing) {
      // Update existing keys
      await db
        .update(replizKeys)
        .set({
          accessKeyEncrypted,
          secretKeyEncrypted,
          updatedAt: now,
        })
        .where(eq(replizKeys.userId, user.id))
        .run();
    } else {
      // Insert new keys
      await db.insert(replizKeys).values({
        id: generateId(),
        userId: user.id,
        accessKeyEncrypted,
        secretKeyEncrypted,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    logger.info(`API keys saved for user ${user.id}`);
    
    return c.json({ success: true });
  } catch (error: any) {
    logger.error('Save keys error', error);
    return c.json(
      { error: error.message || 'Failed to save keys', statusCode: 400 },
      400
    );
  }
});

export default keys;
