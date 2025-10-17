# Security Implementation Guide

## Overview

This document outlines all security measures implemented in the Repliz Auto Uploader application to protect against abuse, data breaches, and excessive resource usage.

---

## 🔒 Security Features Implemented

### 1. **Rate Limiting**

All API endpoints are protected with rate limiting to prevent abuse:

| Endpoint | Limit | Window | Type |
|----------|-------|--------|------|
| `/api/login` | 5 requests | 1 hour | IP-based |
| `/api/register` | 3 requests | 1 hour | IP-based |
| `/api/upload` | 20 requests | 1 hour | User-based |
| `/api/save-keys` | 10 requests | 1 hour | User-based |
| `/api/*` (general) | 60 requests | 1 minute | IP-based |

**Implementation**: Uses Cloudflare Workers KV for distributed rate limiting.

**Headers**:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Timestamp when limit resets

---

### 2. **Upload Quotas**

Per-user quotas prevent R2 storage abuse:

| Quota Type | Limit | Reset Period |
|------------|-------|--------------|
| Daily Uploads | 10 files | 24 hours |
| Monthly Uploads | 100 files | 30 days |
| Daily Bandwidth | 500 MB | 24 hours |
| Monthly Bandwidth | 5 GB | 30 days |

**Location**: `src/lib/constants.ts` - `QUOTA_LIMITS`

**Customization**: Edit these values based on your R2 plan and requirements.

---

### 3. **Automatic File Cleanup**

Files are automatically deleted after 48 hours to prevent storage buildup:

- **Retention Period**: 48 hours (configurable)
- **Cleanup Frequency**: Every 6 hours via Cloudflare Cron Trigger
- **Manual Cleanup**: Available via `/api/cleanup` endpoint

**Configuration**: `src/lib/constants.ts` - `CLEANUP_CONFIG`

---

### 4. **Session Security**

- **Duration**: 24 hours (reduced from 7 days)
- **Cookies**: HttpOnly, Secure, SameSite=Lax
- **Storage**: SQLite database with expiration tracking
- **Validation**: Automatic cleanup of expired sessions

---

### 5. **Credential Encryption**

- **Algorithm**: AES-GCM (256-bit)
- **Key Storage**: Environment variable (`CF_SECRET`)
- **Encrypted Fields**: Repliz Access Key, Repliz Secret Key
- **Rotation**: Change `CF_SECRET` to invalidate all stored credentials

---

### 6. **Logging & Privacy**

Smart logging system that protects sensitive data:

- **Production Mode**: Minimal logging, no verbose output
- **Sensitive Field Filtering**: Auto-redacts passwords, keys, secrets
- **Sanitization**: Recursive object sanitization before logging

**Sensitive fields never logged**:
- `password`, `passwordHash`
- `accessKey`, `secretKey`
- `CF_SECRET`

---

## 🚀 Deployment Setup

### Step 1: Create KV Namespace

```bash
# Create KV namespace for rate limiting
wrangler kv:namespace create "RATE_LIMIT_KV"

# For preview/dev
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
```

Copy the returned ID and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-id-here"  # Replace with actual ID
```

---

### Step 2: Set Environment Variables

```bash
# Generate a secure 32-byte hex key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set in Cloudflare Workers
wrangler secret put CF_SECRET
# Paste the generated key when prompted

# Optional: Set environment identifier
wrangler secret put ENVIRONMENT
# Enter: production
```

---

### Step 3: Run Database Migration

```bash
# Apply the new security tables
npm run db:migrate
```

This creates:
- `uploads` table - Track all file uploads
- `user_quotas` table - Track user quotas and limits

---

### Step 4: Deploy

```bash
# Deploy with all security features
npm run deploy
```

---

## 🔧 Configuration

### Adjust Quota Limits

Edit `src/lib/constants.ts`:

```typescript
export const QUOTA_LIMITS = {
  MAX_DAILY_UPLOADS: 10,      // Change as needed
  MAX_MONTHLY_UPLOADS: 100,   // Change as needed
  MAX_DAILY_BYTES: 500 * 1024 * 1024,    // 500MB
  MAX_MONTHLY_BYTES: 5 * 1024 * 1024 * 1024,  // 5GB
} as const;
```

### Adjust Rate Limits

Edit `src/lib/constants.ts`:

```typescript
export const RATE_LIMITS = {
  LOGIN: { requests: 5, window: 3600 },        // 5 per hour
  REGISTER: { requests: 3, window: 3600 },     // 3 per hour
  UPLOAD: { requests: 20, window: 3600 },      // 20 per hour
  SAVE_KEYS: { requests: 10, window: 3600 },   // 10 per hour
  GENERAL: { requests: 60, window: 60 },       // 60 per minute
} as const;
```

### Adjust Cleanup Timing

Edit `src/lib/constants.ts`:

```typescript
export const CLEANUP_CONFIG = {
  FILE_RETENTION_HOURS: 48,        // Keep files for 48 hours
  CLEANUP_INTERVAL_HOURS: 6,       // Run cleanup every 6 hours
} as const;
```

Also update `wrangler.toml` cron schedule:

```toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

---

## 📊 Monitoring

### Check Quota Usage

Query the database:

```sql
-- View user quotas
SELECT * FROM user_quotas;

-- View uploads
SELECT userId, COUNT(*) as total_uploads, SUM(fileSizeBytes) as total_bytes
FROM uploads
WHERE isDeleted = 0
GROUP BY userId;
```

### Monitor Rate Limits

Check Cloudflare KV dashboard for rate limit keys:
- Format: `ratelimit:{type}:{identifier}`
- Example: `ratelimit:upload:user:abc123`

### View Cleanup Logs

Check Workers logs in Cloudflare dashboard for cleanup job results.

---

## 🛡️ Security Best Practices

### 1. **Rotate Secrets Regularly**

```bash
# Generate new CF_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update secret
wrangler secret put CF_SECRET

# Note: This will invalidate all stored Repliz credentials
# Users will need to re-enter their API keys
```

### 2. **Monitor for Abuse**

- Check D1 database for unusual patterns
- Review Cloudflare Analytics for traffic spikes
- Set up alerts for R2 storage usage

### 3. **Backup Database**

```bash
# Export D1 database regularly
wrangler d1 export repliz_db --output=backup.sql
```

### 4. **Review Access Logs**

- Check Cloudflare Workers logs regularly
- Look for repeated 429 (rate limit) responses
- Investigate suspicious IP addresses

---

## 🚨 Incident Response

### If Credentials Leaked

1. Immediately rotate `CF_SECRET`:
   ```bash
   wrangler secret put CF_SECRET
   ```

2. All encrypted credentials become invalid

3. Notify users to re-enter API keys

### If Storage Quota Exceeded

1. Manual cleanup of old files:
   ```bash
   curl https://your-domain.com/api/cleanup
   ```

2. Reduce quota limits temporarily

3. Review and remove abusive users from database

### If Rate Limits Bypassed

1. Check KV namespace is properly configured

2. Verify `RATE_LIMIT_KV` binding in `wrangler.toml`

3. Add IP-based blocking in Cloudflare firewall rules

---

## 📝 Audit Checklist

- [ ] KV namespace created and configured
- [ ] `CF_SECRET` set and secure (32+ bytes)
- [ ] Database migrations applied successfully
- [ ] Cron trigger configured for cleanup
- [ ] Quota limits appropriate for your R2 plan
- [ ] Rate limits tested and working
- [ ] Logging configured (no sensitive data exposed)
- [ ] Backup strategy in place
- [ ] Monitoring dashboard set up
- [ ] Team trained on incident response

---

## 📚 References

- **Constants**: `src/lib/constants.ts`
- **Rate Limiting**: `src/middleware/rateLimit.ts`
- **Quota Management**: `src/lib/quota.ts`
- **Cleanup Logic**: `src/lib/cleanup.ts`
- **Logging**: `src/lib/logger.ts`
- **Database Schema**: `src/db/schema.ts`

---

## 🆘 Troubleshooting

### Rate limiting not working

**Symptom**: No rate limit headers, unlimited requests

**Solution**:
1. Check KV namespace is bound: `wrangler kv:namespace list`
2. Verify `wrangler.toml` has correct KV ID
3. Redeploy: `npm run deploy`

### Quota not enforced

**Symptom**: Users can upload beyond quota limits

**Solution**:
1. Check migrations applied: `wrangler d1 migrations list repliz_db`
2. Verify `user_quotas` table exists
3. Check logs for quota validation errors

### Files not cleaning up

**Symptom**: Old files remain in R2 after 48 hours

**Solution**:
1. Verify cron trigger is active in Cloudflare dashboard
2. Check `/api/cleanup` endpoint manually
3. Review cleanup logs for errors
4. Ensure `uploads` table has correct `scheduledDeletionAt` values

---

## 💡 Tips

- Start with conservative quota limits, increase gradually
- Monitor first week closely after deployment
- Consider A/B testing rate limit values
- Document any custom changes to constants
- Keep backups before major security updates

---

**Last Updated**: [Current Date]
**Version**: 1.0.0
