# Best Practices - Repliz Auto Uploader

## 1. Development Workflow

### Local Development
```bash
# Selalu test local sebelum deploy
npm run dev

# Test di http://127.0.0.1:8787
# Buka Developer Console untuk monitoring
```

### Pre-Deploy Checklist
- [ ] Test semua fitur di local
- [ ] Check TypeScript types
- [ ] Review console logs
- [ ] Test dengan real Repliz API (jangan gunakan mock)
- [ ] Verify video upload & scheduling works

### Deployment
```bash
# Deploy ke production
npm run deploy

# Immediately test production
# Open Cloudflare Logs to monitor
```

### Post-Deploy Monitoring
- [ ] Test upload ke semua platforms
- [ ] Monitor Cloudflare logs selama 5-10 menit
- [ ] Check error rate di Cloudflare Analytics
- [ ] Verify user dapat login & save keys

---

## 2. Code Organization

### Route Registration Pattern

**❌ SALAH - Route tidak terdaftar:**
```typescript
// File: src/routes/newfeature.ts exists
// But NOT imported in index.ts
```

**✅ BENAR - Selalu register route:**
```typescript
// File: src/index.ts
import newFeature from './routes/newfeature';

app.route('/api', newFeature);
```

### TypeScript Types

**❌ SALAH - Type terlalu strict:**
```typescript
interface SchedulePayload {
  type: 'image'; // Hanya image
}
```

**✅ BENAR - Type yang flexible:**
```typescript
interface SchedulePayload {
  type: 'image' | 'video'; // Support multiple
}
```

**💡 TIPS:** Selalu sesuaikan TypeScript types dengan API requirements dari pihak ketiga (seperti Repliz).

---

## 3. Error Handling

### Always Log Full Error Details

**❌ SALAH - Error tidak informatif:**
```typescript
if (!response.ok) {
  throw new Error('Failed');
}
```

**✅ BENAR - Log detail error:**
```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error('API Error Response:', errorText);
  
  let errorData: { message?: string } | null = null;
  try {
    errorData = JSON.parse(errorText);
  } catch (e) {
    // Not JSON - use raw text
  }
  
  const message = errorData?.message ?? errorText ?? response.statusText;
  throw new Error(`Failed: ${message}`);
}
```

### Log Important Operations

**Tambahkan logging untuk:**
- API calls (request & response)
- File uploads
- Schedule creation
- Platform selection
- Authentication

**Contoh:**
```typescript
console.log('Calling Repliz API: POST /public/schedule');
console.log('Payload:', JSON.stringify(payload, null, 2));
console.log('Response status:', response.status);
console.log('Response body:', await response.text());
```

---

## 4. Frontend Best Practices

### Always Check API Responses

**❌ SALAH - Tidak check error:**
```typescript
const response = await fetch('/api/platforms');
const data = await response.json();
// Langsung pakai data
```

**✅ BENAR - Check status & handle error:**
```typescript
const response = await fetch('/api/platforms');

if (!response.ok) {
  const errorText = await response.text();
  console.error('Failed:', errorText);
  // Show error to user
  return;
}

const data = await response.json();
// Process data
```

### Use Console Logging for Development

```javascript
async function fetchPlatforms() {
  console.log('Fetching platforms...');
  const response = await fetch('/api/platforms');
  console.log('Response status:', response.status);
  
  if (response.ok) {
    const data = await response.json();
    console.log('Platforms data:', data);
    // Continue...
  }
}
```

---

## 5. Security Best Practices

### Never Expose Secrets

**❌ SALAH:**
```typescript
console.log('Secret Key:', secretKey); // JANGAN!
console.log('Access Key:', accessKey); // JANGAN!
```

**✅ BENAR:**
```typescript
console.log('Access Key length:', accessKey.length); // OK
console.log('Secret Key exists:', !!secretKey); // OK
```

### Always Validate User Input

```typescript
// Validate metadata
const metadata = uploadMetadataSchema.parse({ title, description });

// Validate file type
if (!ALLOWED_VIDEO_TYPES.includes(videoFile.type)) {
  throw new Error('Invalid file type');
}

// Validate file size
if (videoFile.size > MAX_FILE_SIZE) {
  throw new Error('File too large');
}
```

---

## 6. Database Best Practices

### Always Encrypt Sensitive Data

**✅ Repliz API Keys harus dienkripsi:**
```typescript
import { encrypt, decrypt } from '../lib/crypto';

// Saat menyimpan
const accessKeyEncrypted = await encrypt(accessKey, secret);
const secretKeyEncrypted = await encrypt(secretKey, secret);

// Saat mengambil
const accessKey = await decrypt(userKeys.accessKeyEncrypted, secret);
const secretKey = await decrypt(userKeys.secretKeyEncrypted, secret);
```

---

## 7. API Integration Best Practices

### Understand Third-Party API Requirements

Untuk Repliz API:

1. **Read API Documentation:**
   - Buka https://api.repliz.com/public
   - Pahami payload structure untuk setiap platform
   - Perhatikan field `type` untuk TikTok vs platform lain

2. **TikTok Special Requirements:**
   - TikTok membutuhkan `type: 'video'`
   - Platform lain (Facebook, Instagram, dll) menggunakan `type: 'image'` meskipun content-nya video

3. **Test dengan Real API:**
   - Jangan hanya mock/simulasi
   - Test dengan account real di setiap platform
   - Verify post muncul di dashboard Repliz

### Handle Platform-Specific Logic

```typescript
// Good approach: Platform-specific configuration
const scheduleType = account.type === 'tiktok' ? 'video' : 'image';

const payload = {
  title: metadata.title,
  description: metadata.description,
  type: scheduleType, // Platform-specific
  medias: [...],
  scheduleAt,
  accountId: account._id,
};
```

---

## 8. File Upload Best Practices

### R2 Bucket Management

**✅ Use Public URL:**
```typescript
// Generate public URL dengan custom domain
const videoUrl = `https://post.komen.autos/${filename}`;
```

**⚠️ File Cleanup:**
```typescript
// PENTING: Jangan delete file dari R2 sebelum Repliz download
// Repliz butuh waktu untuk download video dari URL

// TODO: Implement cleanup setelah 24 jam atau gunakan R2 lifecycle rules
```

### File Validation

```typescript
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
];

// Validate
if (!ALLOWED_VIDEO_TYPES.includes(videoFile.type)) {
  throw new Error('Unsupported video type');
}

if (videoFile.size > MAX_FILE_SIZE) {
  throw new Error('File too large');
}
```

---

## 9. User Experience Best Practices

### Progressive Enhancement

1. **Show Loading States:**
```javascript
uploadProgress.classList.remove('hidden');
progressText.textContent = 'Uploading video...';
```

2. **Display Detailed Results:**
```javascript
// Show success/error for each platform
results.forEach((result) => {
  // Display: ✓ Facebook - Success
  // Display: ✗ TikTok - Error: invalid postID
});
```

3. **Keep Users Informed:**
   - Show file size validation
   - Show upload progress
   - Show per-platform results

### Platform Selection UX

```javascript
// Default: All platforms checked
checkbox.checked = true;

// But allow users to deselect
// Validate: At least one platform must be selected
if (selectedPlatforms.length === 0) {
  throw new Error('Please select at least one platform');
}
```

---

## 10. Testing Strategy

### Unit Testing Areas

1. **Crypto Functions** (`src/lib/crypto.ts`)
   - Test encryption/decryption
   - Test with different secrets

2. **Validation** (`src/lib/utils.ts`)
   - Test schema validation
   - Test file type/size validation

3. **API Integration** (`src/lib/repliz.ts`)
   - Test with mock Repliz API
   - Test error handling

### Integration Testing

1. **Full Upload Flow:**
   - Login → Save Keys → Upload Video → Verify Schedule

2. **Error Scenarios:**
   - Invalid API keys
   - File too large
   - Network error
   - Repliz API down

3. **Platform-Specific:**
   - Test each platform individually
   - Test TikTok specifically (different payload)

---

## 11. Monitoring & Observability

### Cloudflare Logs

**Always monitor:**
- API request/response logs
- Error rates
- Upload success rates
- Per-platform success rates

### Key Metrics to Track

1. **Upload Success Rate:** Berapa persen upload yang berhasil?
2. **Per-Platform Success Rate:** Platform mana yang sering error?
3. **Error Types:** Error apa yang paling sering terjadi?
4. **Response Times:** Berapa lama proses upload rata-rata?

### Cloudflare Analytics

- Monitor Worker invocations
- Track error rate trends
- Set up alerts untuk error rate > threshold

---

## 12. Documentation Standards

### Code Comments

**❌ SALAH - Comment yang tidak berguna:**
```typescript
// Upload video
await uploadVideo();
```

**✅ BENAR - Comment yang menjelaskan "why":**
```typescript
// TikTok requires type: "video", other platforms use "image"
// This is a Repliz API requirement, not our choice
const scheduleType = account.type === 'tiktok' ? 'video' : 'image';
```

### API Documentation

Selalu dokumentasikan:
- Endpoint path & method
- Request body structure
- Response structure
- Error codes & messages
- Authentication requirements

**Contoh:**
```typescript
/**
 * POST /api/upload
 * Upload video to R2 and schedule to all connected Repliz accounts
 * 
 * @body FormData
 *   - video: File (max 50MB)
 *   - title: string (max 200 chars)
 *   - description: string (max 2000 chars)
 *   - platforms: string (comma-separated platform types)
 * 
 * @returns { success: boolean, results: UploadResult[] }
 * 
 * @throws 400 - Missing required fields
 * @throws 400 - Invalid file type/size
 * @throws 400 - Repliz keys not found
 * @throws 500 - Upload failed
 */
```

---

## 13. Git & Version Control

### Commit Messages

**❌ SALAH:**
```bash
git commit -m "fix bug"
git commit -m "update"
```

**✅ BENAR:**
```bash
git commit -m "fix: TikTok upload error - change type from 'image' to 'video'"
git commit -m "feat: add platform selection checkboxes"
git commit -m "docs: add troubleshooting guide"
```

### Branch Strategy

```bash
main          # Production
├── develop   # Development
└── feature/xxx  # Feature branches
```

### Before Deploy

```bash
# Commit changes
git add .
git commit -m "feat: add feature X"

# Deploy
npm run deploy

# Tag release (optional)
git tag -a v1.2.0 -m "Release v1.2.0 - TikTok support"
git push origin v1.2.0
```

---

## 14. Performance Optimization

### File Upload

- Validate file size on client-side (sebelum upload)
- Show file size to user
- Compress video jika terlalu besar (optional)

### API Calls

- Fetch platforms only once (cache di client)
- Parallelize schedule creation (jangan sequential)

### Cloudflare Workers

- Keep Worker lightweight
- Minimize external API calls
- Use R2 for file storage (bukan D1 blob)

---

## 15. Maintenance Schedule

### Weekly

- [ ] Check Cloudflare logs untuk errors
- [ ] Review error rate trends
- [ ] Test upload ke setiap platform

### Monthly

- [ ] Update dependencies: `npm outdated` → `npm update`
- [ ] Review Repliz API changelog
- [ ] Backup D1 database

### Quarterly

- [ ] Security audit (check for vulnerabilities)
- [ ] Performance review
- [ ] Clean up old R2 files (if needed)

---

## Summary Checklist

Sebelum setiap deployment, pastikan:

- [ ] ✅ Semua routes sudah di-register
- [ ] ✅ TypeScript types sesuai dengan API requirements
- [ ] ✅ Error logging cukup informatif
- [ ] ✅ Test di local dulu
- [ ] ✅ Test dengan real Repliz API
- [ ] ✅ Monitor Cloudflare logs setelah deploy
- [ ] ✅ Test upload ke semua platforms
- [ ] ✅ Dokumentasi sudah up-to-date

---

**Remember:** Prevention is better than debugging. Spend time on:
1. Understanding API requirements
2. Adding proper logging
3. Testing thoroughly
4. Documenting well

This will save hours of debugging later! 🚀
