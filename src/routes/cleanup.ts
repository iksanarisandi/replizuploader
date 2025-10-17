import { Hono } from 'hono';
import { getDb } from '../db/client';
import { cleanupExpiredFiles } from '../lib/cleanup';
import { createLogger } from '../lib/logger';
import type { AppBindings } from '../index';

const cleanup = new Hono<AppBindings>();

/**
 * GET /api/cleanup
 * Cleanup expired files (called by Cloudflare Cron Trigger)
 * This endpoint is automatically called every 6 hours by the cron trigger
 */
cleanup.get('/cleanup', async (c) => {
  const logger = createLogger(c.env);
  
  try {
    logger.info('Cleanup cron job triggered');
    
    const db = getDb(c.env.DB);
    const result = await cleanupExpiredFiles(db, c.env.UPLOADS, c.env);
    
    logger.info('Cleanup completed', result);
    
    return c.json({
      success: true,
      deleted: result.deleted,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error: any) {
    logger.error('Cleanup job failed', error);
    
    return c.json(
      { error: error.message || 'Cleanup failed', statusCode: 500 },
      500
    );
  }
});

export default cleanup;
