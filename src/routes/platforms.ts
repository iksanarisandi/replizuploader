import { Hono } from 'hono';
import { getDb } from '../db/client';
import { replizKeys } from '../db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';
import { requireUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import { getAccounts } from '../lib/repliz';
import type { AppBindings } from '../index';

const platforms = new Hono<AppBindings>();

// Apply auth middleware
platforms.use('/*', requireAuth);

/**
 * GET /api/platforms
 * Get all connected Repliz platforms/accounts for current user
 */
platforms.get('/platforms', async (c) => {
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
      return c.json({
        platforms: [],
        message: 'No Repliz keys saved yet',
      });
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

    // Get all connected Repliz accounts
    try {
      const accounts = await getAccounts(accessKey, secretKey);
      
      const platformsList = accounts.map((account) => ({
        id: account._id,
        name: account.name,
        type: account.type,
        username: account.username,
        picture: account.picture,
      }));

      return c.json({
        platforms: platformsList,
      });
    } catch (error: any) {
      console.error('Failed to get Repliz accounts:', error.message);
      return c.json(
        { error: `Failed to get Repliz accounts: ${error.message}`, statusCode: 400 },
        400
      );
    }
  } catch (error: any) {
    console.error('Platforms error:', error);
    return c.json(
      { error: error.message || 'Failed to fetch platforms', statusCode: 500 },
      500
    );
  }
});

export default platforms;
