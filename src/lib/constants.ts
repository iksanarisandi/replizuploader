/**
 * Security and quota constants
 */

// Quota Limits
export const QUOTA_LIMITS = {
  // Maximum uploads per user per day
  MAX_DAILY_UPLOADS: 10,
  
  // Maximum uploads per user per month
  MAX_MONTHLY_UPLOADS: 100,
  
  // Maximum bytes per user per day (500MB)
  MAX_DAILY_BYTES: 500 * 1024 * 1024,
  
  // Maximum bytes per user per month (5GB)
  MAX_MONTHLY_BYTES: 5 * 1024 * 1024 * 1024,
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  // Login attempts per IP per hour
  LOGIN: { requests: 5, window: 3600 },
  
  // Register attempts per IP per hour
  REGISTER: { requests: 3, window: 3600 },
  
  // Upload attempts per user per hour
  UPLOAD: { requests: 20, window: 3600 },
  
  // API key save attempts per user per hour
  SAVE_KEYS: { requests: 10, window: 3600 },
  
  // General API requests per IP per minute
  GENERAL: { requests: 60, window: 60 },
} as const;

// R2 Cleanup
export const CLEANUP_CONFIG = {
  // Delete files after 48 hours
  FILE_RETENTION_HOURS: 48,
  
  // Cleanup check interval (for cron)
  CLEANUP_INTERVAL_HOURS: 6,
} as const;

// Session
export const SESSION_CONFIG = {
  // Session duration: 24 hours (reduced from 7 days)
  DURATION_MS: 24 * 60 * 60 * 1000,
  
  COOKIE_NAME: 'session_id',
} as const;

// Logging
export const LOGGING_CONFIG = {
  // Enable verbose logging in development only
  VERBOSE: false, // Will be set based on environment
  
  // Never log these fields
  SENSITIVE_FIELDS: ['password', 'passwordHash', 'accessKey', 'secretKey', 'CF_SECRET'],
} as const;
