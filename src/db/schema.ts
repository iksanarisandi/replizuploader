import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Repliz Keys table (encrypted)
export const replizKeys = sqliteTable('repliz_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessKeyEncrypted: text('access_key_encrypted').notNull(),
  secretKeyEncrypted: text('secret_key_encrypted').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// User Sessions table (for Lucia Auth)
export const userSessions = sqliteTable('user_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
});

// Uploads table - track all uploads for cleanup
export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull().unique(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  mimeType: text('mime_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).notNull(),
  scheduledDeletionAt: integer('scheduled_deletion_at', { mode: 'timestamp' }).notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// User Quotas table - track daily/monthly usage
export const userQuotas = sqliteTable('user_quotas', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  dailyUploads: integer('daily_uploads').notNull().default(0),
  monthlyUploads: integer('monthly_uploads').notNull().default(0),
  dailyBytesUsed: integer('daily_bytes_used').notNull().default(0),
  monthlyBytesUsed: integer('monthly_bytes_used').notNull().default(0),
  lastResetDaily: integer('last_reset_daily', { mode: 'timestamp' }).notNull(),
  lastResetMonthly: integer('last_reset_monthly', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type User = typeof users.$inferSelect;
export type ReplizKey = typeof replizKeys.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type Upload = typeof uploads.$inferSelect;
export type UserQuota = typeof userQuotas.$inferSelect;
