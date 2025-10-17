import type { DbClient } from '../db/client';
import { userQuotas } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateId, getCurrentTimestamp } from './utils';
import { QUOTA_LIMITS } from './constants';

export interface QuotaStatus {
  allowed: boolean;
  reason?: string;
  current: {
    dailyUploads: number;
    monthlyUploads: number;
    dailyBytes: number;
    monthlyBytes: number;
  };
  limits: typeof QUOTA_LIMITS;
}

/**
 * Check if user has exceeded quota limits
 */
export async function checkQuota(
  db: DbClient,
  userId: string,
  fileSizeBytes: number
): Promise<QuotaStatus> {
  const now = getCurrentTimestamp();
  
  // Get or create user quota
  let quota = await db
    .select()
    .from(userQuotas)
    .where(eq(userQuotas.userId, userId))
    .get();

  if (!quota) {
    // Initialize quota for new user
    quota = {
      id: generateId(),
      userId,
      dailyUploads: 0,
      monthlyUploads: 0,
      dailyBytesUsed: 0,
      monthlyBytesUsed: 0,
      lastResetDaily: now,
      lastResetMonthly: now,
      updatedAt: now,
    };
    
    await db.insert(userQuotas).values(quota).run();
  }

  // Check if we need to reset daily quota (24 hours passed)
  const dayInMs = 24 * 60 * 60 * 1000;
  if (now.getTime() - quota.lastResetDaily.getTime() >= dayInMs) {
    quota.dailyUploads = 0;
    quota.dailyBytesUsed = 0;
    quota.lastResetDaily = now;
    
    await db
      .update(userQuotas)
      .set({
        dailyUploads: 0,
        dailyBytesUsed: 0,
        lastResetDaily: now,
        updatedAt: now,
      })
      .where(eq(userQuotas.userId, userId))
      .run();
  }

  // Check if we need to reset monthly quota (30 days passed)
  const monthInMs = 30 * 24 * 60 * 60 * 1000;
  if (now.getTime() - quota.lastResetMonthly.getTime() >= monthInMs) {
    quota.monthlyUploads = 0;
    quota.monthlyBytesUsed = 0;
    quota.lastResetMonthly = now;
    
    await db
      .update(userQuotas)
      .set({
        monthlyUploads: 0,
        monthlyBytesUsed: 0,
        lastResetMonthly: now,
        updatedAt: now,
      })
      .where(eq(userQuotas.userId, userId))
      .run();
  }

  const current = {
    dailyUploads: quota.dailyUploads,
    monthlyUploads: quota.monthlyUploads,
    dailyBytes: quota.dailyBytesUsed,
    monthlyBytes: quota.monthlyBytesUsed,
  };

  // Check daily upload count
  if (quota.dailyUploads >= QUOTA_LIMITS.MAX_DAILY_UPLOADS) {
    return {
      allowed: false,
      reason: `Daily upload limit exceeded (${QUOTA_LIMITS.MAX_DAILY_UPLOADS} uploads/day)`,
      current,
      limits: QUOTA_LIMITS,
    };
  }

  // Check monthly upload count
  if (quota.monthlyUploads >= QUOTA_LIMITS.MAX_MONTHLY_UPLOADS) {
    return {
      allowed: false,
      reason: `Monthly upload limit exceeded (${QUOTA_LIMITS.MAX_MONTHLY_UPLOADS} uploads/month)`,
      current,
      limits: QUOTA_LIMITS,
    };
  }

  // Check daily bytes
  if (quota.dailyBytesUsed + fileSizeBytes > QUOTA_LIMITS.MAX_DAILY_BYTES) {
    const limitMB = QUOTA_LIMITS.MAX_DAILY_BYTES / 1024 / 1024;
    return {
      allowed: false,
      reason: `Daily bandwidth limit exceeded (${limitMB}MB/day)`,
      current,
      limits: QUOTA_LIMITS,
    };
  }

  // Check monthly bytes
  if (quota.monthlyBytesUsed + fileSizeBytes > QUOTA_LIMITS.MAX_MONTHLY_BYTES) {
    const limitGB = QUOTA_LIMITS.MAX_MONTHLY_BYTES / 1024 / 1024 / 1024;
    return {
      allowed: false,
      reason: `Monthly bandwidth limit exceeded (${limitGB}GB/month)`,
      current,
      limits: QUOTA_LIMITS,
    };
  }

  // All checks passed
  return {
    allowed: true,
    current,
    limits: QUOTA_LIMITS,
  };
}

/**
 * Increment user quota after successful upload
 */
export async function incrementQuota(
  db: DbClient,
  userId: string,
  fileSizeBytes: number
): Promise<void> {
  const now = getCurrentTimestamp();
  
  const quota = await db
    .select()
    .from(userQuotas)
    .where(eq(userQuotas.userId, userId))
    .get();

  if (!quota) {
    throw new Error('Quota record not found');
  }

  await db
    .update(userQuotas)
    .set({
      dailyUploads: quota.dailyUploads + 1,
      monthlyUploads: quota.monthlyUploads + 1,
      dailyBytesUsed: quota.dailyBytesUsed + fileSizeBytes,
      monthlyBytesUsed: quota.monthlyBytesUsed + fileSizeBytes,
      updatedAt: now,
    })
    .where(eq(userQuotas.userId, userId))
    .run();
}

/**
 * Decrement quota on upload failure (rollback)
 */
export async function decrementQuota(
  db: DbClient,
  userId: string,
  fileSizeBytes: number
): Promise<void> {
  const now = getCurrentTimestamp();
  
  const quota = await db
    .select()
    .from(userQuotas)
    .where(eq(userQuotas.userId, userId))
    .get();

  if (!quota) {
    return;
  }

  await db
    .update(userQuotas)
    .set({
      dailyUploads: Math.max(0, quota.dailyUploads - 1),
      monthlyUploads: Math.max(0, quota.monthlyUploads - 1),
      dailyBytesUsed: Math.max(0, quota.dailyBytesUsed - fileSizeBytes),
      monthlyBytesUsed: Math.max(0, quota.monthlyBytesUsed - fileSizeBytes),
      updatedAt: now,
    })
    .where(eq(userQuotas.userId, userId))
    .run();
}
