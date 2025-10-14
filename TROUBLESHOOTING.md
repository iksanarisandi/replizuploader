# Troubleshooting Guide - Repliz Auto Uploader

## Masalah yang Pernah Terjadi dan Solusinya

### 1. TikTok Upload Error: "invalid postID"

#### **Penyebab:**
- **TypeScript Interface Salah**: Interface `SchedulePayload` di `src/lib/repliz.ts` hanya mengizinkan `type: 'image'`, padahal TikTok membutuhkan `type: 'video'`.
- **Kesalahan Implementasi**: Kode sudah benar menggunakan `type: 'video'` untuk TikTok, tapi TypeScript interface tidak mengizinkannya, sehingga menyebabkan inconsistency.
- **Error Message Tidak Informatif**: Error dari Repliz API tidak ter-log dengan baik, sehingga sulit di-debug.

#### **Gejala:**
```
Failed to create schedule: invalid postID
```

#### **Solusi:**
1. **Perbaiki TypeScript Interface** (`src/lib/repliz.ts`):
```typescript
// SALAH - Hanya image
export interface SchedulePayload {
  type: 'image';
  // ...
}

// BENAR - Support image dan video
export interface SchedulePayload {
  type: 'image' | 'video'; // TikTok requires "video", other platforms use "image"
  // ...
}
```

2. **Pastikan Logic Upload Benar** (`src/routes/upload.ts`):
```typescript
// TikTok requires type: "video", other platforms use "image"
const scheduleType = account.type === 'tiktok' ? 'video' : 'image';
```

3. **Tambahkan Better Error Logging** (`src/lib/repliz.ts`):
```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error('Repliz API Error Response:', errorText);
  
  let errorData: { message?: string } | null = null;
  try {
    errorData = JSON.parse(errorText);
  } catch (e) {
    // Not JSON
  }
  
  const message = errorData?.message ?? errorText ?? response.statusText;
  throw new Error(`Failed to create schedule: ${message}`);
}
```

---

### 2. Platform Checkbox Tidak Muncul (Stuck di "Loading platforms...")

#### **Penyebab:**
- **Route Tidak Terdaftar**: File `src/routes/platforms.ts` sudah ada, tapi tidak di-import dan register di `src/index.ts`.
- **404 Error**: Request ke `/api/platforms` mengembalikan 404 karena route tidak ada.

#### **Gejala:**
- Checkbox platform tidak muncul
- Stuck di "Loading platforms..."
- Console browser menunjukkan: `404 Not Found /api/platforms`

#### **Solusi:**
1. **Import Route** di `src/index.ts`:
```typescript
import platforms from './routes/platforms';
```

2. **Register Route**:
```typescript
app.route('/api', platforms);
```

**File lengkap `src/index.ts`:**
```typescript
import { Hono } from 'hono';
import { authMiddleware } from './middleware/auth';
import auth from './routes/auth';
import keys from './routes/keys';
import upload from './routes/upload';
import platforms from './routes/platforms';  // ← TAMBAHKAN INI
import type { SessionUser } from './lib/session';

// ...

// API Routes
app.route('/api', auth);
app.route('/api', keys);
app.route('/api', upload);
app.route('/api', platforms);  // ← TAMBAHKAN INI
```

---

## Debugging Checklist

### Frontend Issues

1. **Buka Developer Console** (F12) di browser
2. Cek tab **Console** untuk errors
3. Cek tab **Network** untuk failed requests
4. Lihat response status dan body

### Backend Issues (Cloudflare Workers)

1. Buka **Cloudflare Dashboard** → Workers & Pages
2. Pilih worker Anda
3. Buka tab **Logs** untuk real-time logging
4. Upload/test, lalu lihat log yang muncul

### Common Checks

- [ ] Apakah semua routes sudah di-register di `index.ts`?
- [ ] Apakah TypeScript types sudah sesuai dengan API requirements?
- [ ] Apakah error logging sudah cukup informatif?
- [ ] Apakah sudah test di production setelah deploy?
- [ ] Apakah Repliz API keys masih valid?

---

## Error Messages Reference

### Repliz API Errors

| Error | Penyebab | Solusi |
|-------|----------|--------|
| `invalid authorization header` (401) | API keys salah atau expired | Re-enter API keys di dashboard |
| `invalid plan` (402) | Repliz plan tidak support API | Upgrade Repliz plan |
| `invalid postID` | Payload structure salah (biasanya `type` field) | Pastikan TikTok menggunakan `type: 'video'` |
| `Failed to get Repliz accounts` | Network error atau API down | Cek koneksi dan status Repliz API |

### Application Errors

| Error | Penyebab | Solusi |
|-------|----------|--------|
| `404 Not Found` | Route tidak terdaftar | Import dan register route di `index.ts` |
| `Repliz keys not found` | User belum save API keys | Save keys di dashboard |
| `File too large` | Video > 50MB | Compress video atau split |
| `Invalid file type` | Bukan video file | Upload file video saja |

---

## Testing Guide

### 1. Test Platform Selection
```bash
# Buka dashboard
# Cek console: should see "Fetching platforms..." dan list platforms
# Checkbox untuk setiap platform harus muncul
```

### 2. Test Upload ke Platform Tertentu
```bash
# Pilih satu platform (e.g., TikTok)
# Upload video
# Cek Cloudflare logs untuk melihat payload
```

### 3. Test Upload ke Multiple Platforms
```bash
# Pilih beberapa platform
# Upload video
# Verify semua platform menerima post
```

---

## Rollback Procedure

Jika terjadi masalah setelah deploy:

1. **Rollback via Wrangler:**
```bash
wrangler rollback
```

2. **Manual Rollback:**
```bash
# Deploy version sebelumnya yang stabil
git checkout <previous-commit>
npm run deploy
git checkout main
```

3. **Cek Status:**
```bash
wrangler deployments list
```
