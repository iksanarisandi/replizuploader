import { z } from 'zod';

// Constants
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];

// Zod Schemas
export const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const keysSchema = z.object({
  accessKey: z.string().min(1, 'Access Key is required'),
  secretKey: z.string().min(1, 'Secret Key is required'),
});

export const uploadMetadataSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description must be at most 2000 characters'),
});

// Utility functions
export function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/mpeg': '.mpeg',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
    'video/webm': '.webm',
  };
  return mimeMap[mimeType] || '.mp4';
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getCurrentTimestamp(): Date {
  return new Date();
}
