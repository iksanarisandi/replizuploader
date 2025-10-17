import type { DbClient } from '../db/client';
import { uploads } from '../db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { CLEANUP_CONFIG } from './constants';
import type { R2Bucket } from '@cloudflare/workers-types';
import { createLogger } from './logger';

/**
 * Delete expired files from R2 and mark as deleted in database
 * This should be called periodically (e.g., via Cloudflare Cron Trigger)
 */
export async function cleanupExpiredFiles(
  db: DbClient,
  r2Bucket: R2Bucket,
  env?: any
): Promise<{ deleted: number; failed: number; errors: string[] }> {
  const logger = createLogger(env);
  const now = new Date();
  
  logger.info('Starting cleanup process for expired files');
  
  // Find all files that should be deleted (not already deleted and past scheduled deletion time)
  const expiredUploads = await db
    .select()
    .from(uploads)
    .where(
      and(
        eq(uploads.isDeleted, false),
        lte(uploads.scheduledDeletionAt, now)
      )
    )
    .all();
  
  if (expiredUploads.length === 0) {
    logger.info('No expired files found');
    return { deleted: 0, failed: 0, errors: [] };
  }
  
  logger.info(`Found ${expiredUploads.length} files to cleanup`);
  
  let deleted = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (const upload of expiredUploads) {
    try {
      // Delete from R2
      await r2Bucket.delete(upload.filename);
      
      // Mark as deleted in database
      await db
        .update(uploads)
        .set({
          isDeleted: true,
          deletedAt: now,
        })
        .where(eq(uploads.id, upload.id))
        .run();
      
      logger.debug(`Deleted file: ${upload.filename}`);
      deleted++;
    } catch (error: any) {
      logger.error(`Failed to delete file: ${upload.filename}`, error);
      failed++;
      errors.push(`${upload.filename}: ${error.message}`);
    }
  }
  
  logger.info(`Cleanup completed: ${deleted} deleted, ${failed} failed`);
  
  return { deleted, failed, errors };
}

/**
 * Calculate scheduled deletion time for a new upload
 */
export function calculateDeletionTime(): Date {
  const now = new Date();
  const deletionTime = new Date(
    now.getTime() + CLEANUP_CONFIG.FILE_RETENTION_HOURS * 60 * 60 * 1000
  );
  return deletionTime;
}

/**
 * Manually delete a specific upload (for immediate cleanup on error)
 */
export async function deleteUpload(
  db: DbClient,
  r2Bucket: R2Bucket,
  filename: string,
  env?: any
): Promise<void> {
  const logger = createLogger(env);
  
  try {
    // Delete from R2
    await r2Bucket.delete(filename);
    
    // Mark as deleted in database (if exists)
    const upload = await db
      .select()
      .from(uploads)
      .where(eq(uploads.filename, filename))
      .get();
    
    if (upload) {
      await db
        .update(uploads)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
        })
        .where(eq(uploads.id, upload.id))
        .run();
    }
    
    logger.debug(`Manually deleted upload: ${filename}`);
  } catch (error: any) {
    logger.error(`Failed to manually delete upload: ${filename}`, error);
    throw error;
  }
}
