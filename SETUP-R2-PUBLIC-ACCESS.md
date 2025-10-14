# Setup R2 Public Access - Final Step

## 🎉 Aplikasi Sudah Deploy!

**Worker URL**: https://repliz-auto-uploader.threadsauto.workers.dev

Namun, untuk upload video berfungsi penuh, Anda perlu mengaktifkan R2 Public Access.

---

## 📋 Langkah-langkah Setup R2 Public Access:

### 1. Buka Cloudflare Dashboard
```
https://dash.cloudflare.com
```

### 2. Navigate ke R2
```
Dashboard → R2 Object Storage → Buckets
```

### 3. Pilih Bucket `repliz-uploads`
Klik pada bucket `repliz-uploads` yang sudah dibuat

### 4. Enable Public Access
```
Settings tab → Public Access → Allow Public Access
```

Atau bisa juga via:
```
Settings → R2.dev subdomain → Enable
```

### 5. Copy Public URL
Setelah enabled, Anda akan mendapat URL seperti:
```
https://pub-XXXXXXXXXXXXX.r2.dev
```

**PENTING**: Catat bagian `XXXXXXXXXXXXX` (bucket ID)

### 6. Set UPLOADS_BUCKET_ID (Optional tapi Recommended)

Buka terminal dan jalankan:
```powershell
npx wrangler secret put UPLOADS_BUCKET_ID
```

Lalu paste bucket ID (bagian `XXXXXXXXXXXXX` dari URL pub-XXXXXXXXXXXXX.r2.dev)

---

## 🧪 Testing Aplikasi

### 1. Buka aplikasi di browser:
```
https://repliz-auto-uploader.threadsauto.workers.dev
```

### 2. Register akun baru
- Email: test@example.com
- Password: (min 8 karakter)

### 3. Save Repliz API Keys
Di dashboard, input:
- Access Key: (dari Repliz dashboard)
- Secret Key: (dari Repliz dashboard)

### 4. Upload Test Video
- Pilih video (max 50MB)
- Input title & description
- Klik "Upload ke Semua Channel"

### 5. Verifikasi
- Cek hasil upload per channel
- Video akan otomatis dihapus dari R2 setelah scheduling
- Cek di Repliz dashboard apakah video sudah terjadwal

---

## 🐛 Troubleshooting

### Video URL tidak accessible
**Masalah**: R2 public access belum enabled
**Solusi**: Pastikan langkah 4 di atas sudah dilakukan

### "No connected accounts"
**Masalah**: Tidak ada channel connected di Repliz
**Solusi**: Connect minimal 1 channel (Facebook/Instagram/TikTok) di Repliz dashboard

### Upload gagal dengan error 401
**Masalah**: Repliz API keys salah
**Solusi**: Cek dan re-input Access Key & Secret Key

### File size error
**Masalah**: Video lebih dari 50MB
**Solusi**: Compress video atau ubah MAX_FILE_SIZE di `src/lib/utils.ts`

---

## 📊 Monitor Aplikasi

### View Worker Logs
```powershell
npx wrangler tail
```

### Check D1 Database
```powershell
npx wrangler d1 execute repliz_db --command "SELECT * FROM users"
npx wrangler d1 execute repliz_db --command "SELECT * FROM user_sessions"
```

### Check R2 Files (should be empty after successful upload)
```powershell
npx wrangler r2 object list repliz-uploads
```

---

## 🔧 Maintenance

### Update Code
```powershell
# Make changes to code
npm run deploy
```

### Rollback to Previous Version
```
Dashboard → Workers & Pages → repliz-auto-uploader → Deployments → Rollback
```

### View Metrics
```
Dashboard → Workers & Pages → repliz-auto-uploader → Metrics
```

---

## ✅ Checklist Deploy Complete

- [x] D1 Database created & migrated
- [x] R2 Bucket created
- [ ] R2 Public Access enabled ⚠️ **DO THIS NOW**
- [ ] UPLOADS_BUCKET_ID set (optional)
- [x] CF_SECRET set
- [x] Worker deployed
- [ ] Tested login/register
- [ ] Tested save Repliz keys
- [ ] Tested upload video

---

## 🎯 Next Steps

1. ✅ Enable R2 Public Access (langkah 1-5 di atas)
2. ✅ Set UPLOADS_BUCKET_ID (langkah 6)
3. ✅ Test aplikasi end-to-end
4. ✅ Connect Repliz channels jika belum
5. ✅ Upload test video
6. ✅ Monitor logs untuk ensure semuanya berjalan

---

**Need Help?** Check README.md for detailed documentation or Worker logs for debugging.
