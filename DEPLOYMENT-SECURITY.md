# 🚀 Deployment Instructions - Security Updates

## ⚠️ IMPORTANT: Read Before Deploying

This application now includes comprehensive security features. Follow these steps carefully to deploy correctly.

---

## 📋 Prerequisites

- Cloudflare account with Workers & D1 enabled
- Wrangler CLI installed and authenticated
- Node.js and npm installed

---

## 🔧 Step-by-Step Deployment

### Step 1: Create KV Namespace for Rate Limiting

```bash
# Create production KV namespace
wrangler kv:namespace create "RATE_LIMIT_KV"
```

**Output example:**
```
🌀 Creating namespace with title "repliz-auto-uploader-RATE_LIMIT_KV"
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "abc123def456"
```

**Copy the ID** and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "abc123def456"  # ← Paste your actual ID here
```

---

### Step 2: Generate Encryption Secret

```bash
# Generate a secure 64-character hex string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Output example:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**IMPORTANT**: Save this key securely! You'll need it for the next step.

---

### Step 3: Set Cloudflare Secrets

```bash
# Set the encryption secret
wrangler secret put CF_SECRET
# Paste the key from Step 2 when prompted

# Optional: Set environment identifier
wrangler secret put ENVIRONMENT
# Enter: production
```

---

### Step 4: Run Database Migrations

```bash
# Generate migration files (already done if you pulled latest code)
npm run db:generate

# Apply migrations to production database
npm run db:migrate
```

**Expected output:**
```
Migrations to be applied:
- 0001_minor_agent_zero.sql
✔ Migrations applied successfully!
```

---

### Step 5: Review Configuration (Optional)

Edit `src/lib/constants.ts` if you want to adjust limits:

```typescript
export const QUOTA_LIMITS = {
  MAX_DAILY_UPLOADS: 10,        // Files per day per user
  MAX_MONTHLY_UPLOADS: 100,     // Files per month per user
  MAX_DAILY_BYTES: 500 * 1024 * 1024,    // 500MB per day
  MAX_MONTHLY_BYTES: 5 * 1024 * 1024 * 1024,  // 5GB per month
};

export const RATE_LIMITS = {
  LOGIN: { requests: 5, window: 3600 },        // 5 per hour
  REGISTER: { requests: 3, window: 3600 },     // 3 per hour
  UPLOAD: { requests: 20, window: 3600 },      // 20 per hour
};
```

---

### Step 6: Deploy to Cloudflare

```bash
# Build and deploy
npm run deploy
```

**Expected output:**
```
⛅️ wrangler 4.x.x
------------------
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded repliz-auto-uploader (X.XX sec)
Published repliz-auto-uploader (X.XX sec)
  https://repliz-auto-uploader.your-subdomain.workers.dev
```

---

### Step 7: Verify Deployment

Test critical endpoints:

```bash
# Test rate limiting
curl -I https://your-domain.com/api/platforms

# Should return headers:
# X-RateLimit-Limit: 60
# X-RateLimit-Remaining: 59
```

---

## ✅ Deployment Checklist

Before going live, verify:

- [ ] KV namespace created and ID updated in `wrangler.toml`
- [ ] `CF_SECRET` set with secure 64-character hex string
- [ ] Database migrations applied successfully
- [ ] Application deployed without errors
- [ ] Rate limit headers appear in API responses
- [ ] Can login/register (test accounts work)
- [ ] Upload quota enforced (test with multiple uploads)
- [ ] Cron trigger scheduled in Cloudflare dashboard

---

## 🔍 Post-Deployment Verification

### 1. Check Cron Trigger Status

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages → Your Worker
3. Click "Triggers" tab
4. Verify cron schedule shows: `0 */6 * * *`

### 2. Test Upload Flow

```bash
# 1. Register a test user
curl -X POST https://your-domain.com/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# 2. Login
curl -X POST https://your-domain.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' \
  -c cookies.txt

# 3. Check platforms (should be rate-limited after 60 requests)
curl https://your-domain.com/api/platforms \
  -b cookies.txt
```

### 3. Verify Database Tables

```bash
# List all tables
wrangler d1 execute repliz_db --command "SELECT name FROM sqlite_master WHERE type='table'"

# Should show:
# - users
# - user_sessions
# - repliz_keys
# - uploads (NEW)
# - user_quotas (NEW)
```

---

## 🚨 Troubleshooting

### Issue: "RATE_LIMIT_KV is not defined"

**Solution**:
1. Verify KV namespace ID in `wrangler.toml`
2. Redeploy: `npm run deploy`
3. Check Cloudflare dashboard → KV → verify namespace exists

### Issue: "CF_SECRET not set"

**Solution**:
```bash
wrangler secret put CF_SECRET
# Enter your 64-character hex key
```

### Issue: Database migration fails

**Solution**:
```bash
# Check migration status
wrangler d1 migrations list repliz_db

# If stuck, try manual migration
wrangler d1 execute repliz_db --file=drizzle/migrations/0001_minor_agent_zero.sql
```

### Issue: Rate limiting not working

**Solution**:
1. Check headers in response: `curl -I https://your-domain.com/api/platforms`
2. If no `X-RateLimit-*` headers, KV binding issue
3. Verify KV namespace: `wrangler kv:namespace list`
4. Ensure `binding = "RATE_LIMIT_KV"` in wrangler.toml

### Issue: Uploads don't cleanup

**Solution**:
1. Check cron trigger in dashboard
2. Manually trigger: `curl https://your-domain.com/api/cleanup`
3. Check logs for errors
4. Verify `uploads` table has `scheduledDeletionAt` values

---

## 📊 Monitoring After Deployment

### First 24 Hours:
- [ ] Check R2 storage usage (should be < 1GB)
- [ ] Monitor upload count per user
- [ ] Review rate limit 429 responses
- [ ] Verify cleanup job runs successfully

### First Week:
- [ ] Analyze quota usage patterns
- [ ] Check for abuse (users hitting limits repeatedly)
- [ ] Review average file sizes
- [ ] Adjust limits if needed

### Monthly:
- [ ] Review total R2 costs
- [ ] Backup D1 database
- [ ] Analyze user growth vs. storage usage
- [ ] Consider quota adjustments

---

## 🔐 Security Reminders

1. **Never commit** `CF_SECRET` to git
2. **Rotate secrets** every 90 days
3. **Monitor logs** for suspicious activity
4. **Backup database** before major changes
5. **Review quotas** based on actual usage

---

## 📞 Support Resources

- **Security Documentation**: `SECURITY.md`
- **Security Summary**: `SECURITY-SUMMARY.md`
- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Cloudflare KV Docs**: https://developers.cloudflare.com/kv/
- **Drizzle ORM Docs**: https://orm.drizzle.team/

---

## 🎉 Success!

If all checks pass, your secure deployment is complete! 

Your application now has:
- ✅ Rate limiting on all endpoints
- ✅ Per-user upload quotas
- ✅ Automatic file cleanup
- ✅ Encrypted credential storage
- ✅ Safe logging (no sensitive data exposed)
- ✅ 24-hour session duration
- ✅ Professional security posture

**Estimated Time**: 15-20 minutes for full deployment

---

**Last Updated**: [Current Date]
**Version**: 1.0.0
