# Repliz Auto Uploader

Aplikasi untuk mengupload video ke multiple social media platforms (TikTok, Facebook, Instagram, dll) secara otomatis menggunakan [Repliz API](https://repliz.com).

## 🚀 Features

- ✅ **Multi-Platform Upload**: Upload video ke TikTok, Facebook, Instagram, YouTube, LinkedIn, Twitter, Threads sekaligus
- ✅ **Platform Selection**: Pilih platform mana yang akan diupload (checkbox)
- ✅ **Secure Storage**: API keys dienkripsi di Cloudflare D1
- ✅ **Large Files**: Support video hingga 50MB
- ✅ **Real-time Results**: Lihat status upload untuk setiap platform
- ✅ **User Authentication**: Login system dengan bcrypt password hashing

## 📋 Prerequisites

- Node.js 18+
- Cloudflare account (free tier OK)
- Repliz account & API keys ([Get here](https://app.repliz.com/settings/api))

## 🛠️ Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd replizAuto
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Cloudflare

#### Login to Cloudflare
```bash
npx wrangler login
```

#### Create D1 Database
```bash
npx wrangler d1 create repliz_db
```

Copy the database ID dan update di `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "repliz_db"
database_id = "YOUR_DATABASE_ID"  # ← Ganti ini
```

#### Create R2 Bucket
```bash
npx wrangler r2 bucket create repliz-uploads
```

Update `wrangler.toml`:
```toml
[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "repliz-uploads"
```

#### Setup R2 Public Access

Follow guide di `SETUP-R2-PUBLIC-ACCESS.md` untuk membuat custom domain untuk R2 bucket.

#### Generate Secret
```bash
# Generate random secret key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Update `wrangler.toml`:
```toml
[vars]
CF_SECRET = "YOUR_GENERATED_SECRET"  # ← Paste secret di sini
```

### 4. Database Migration
```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate
```

### 5. Create Admin User

Edit `src/index.ts` atau buat script untuk insert admin user ke D1:

```sql
INSERT INTO users (id, email, password_hash, created_at, updated_at) 
VALUES (
  'admin-id', 
  'admin@example.com',
  '<bcrypt-hash-of-password>',
  datetime('now'),
  datetime('now')
);
```

Atau gunakan script helper (buat file `scripts/create-admin.ts`):
```typescript
import bcrypt from 'bcryptjs';

const email = 'admin@example.com';
const password = 'your-secure-password';
const passwordHash = await bcrypt.hash(password, 10);

console.log('Email:', email);
console.log('Password Hash:', passwordHash);
// Copy hash ini dan insert manual ke D1
```

## 🏃 Development

```bash
npm run dev
```

Open http://127.0.0.1:8787

## 🚀 Deployment

```bash
npm run deploy
```

App will be deployed to: `https://repliz-auto-uploader.YOUR_SUBDOMAIN.workers.dev`

## 📖 Usage

### 1. Login
- Buka aplikasi URL
- Login dengan email & password

### 2. Save Repliz API Keys
- Buka dashboard
- Masukkan **Access Key** dan **Secret Key** dari [Repliz API Settings](https://app.repliz.com/settings/api)
- Klik **Save Keys**

### 3. Upload Video
- Pilih file video (max 50MB)
- Isi **Title** dan **Description**
- **Pilih platform** yang ingin diupload (checkbox)
  - ✅ TikTok 🎵
  - ✅ Facebook 📘
  - ✅ Instagram 📷
  - ✅ YouTube 📺
  - dll
- Klik **Upload to Selected Platforms**
- Tunggu hingga selesai
- Lihat hasil upload untuk setiap platform

## 🐛 Troubleshooting

Lihat dokumentasi lengkap di:
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Solusi masalah umum
- **[BEST-PRACTICES.md](./BEST-PRACTICES.md)** - Best practices development

### Common Issues

#### 1. TikTok Upload Error: "invalid postID"
**Solusi:** Pastikan `type: 'video'` untuk TikTok (bukan `'image'`). Sudah diperbaiki di versi terbaru.

#### 2. Platform Checkbox Tidak Muncul
**Solusi:** Pastikan route `/api/platforms` sudah terdaftar di `src/index.ts`. Sudah diperbaiki.

#### 3. 401 Unauthorized
**Solusi:** API keys salah atau expired. Re-enter keys di dashboard.

## 📁 Project Structure

```
replizAuto/
├── src/
│   ├── db/
│   │   ├── client.ts          # D1 database client
│   │   └── schema.ts          # Database schema (users, replizKeys)
│   ├── lib/
│   │   ├── crypto.ts          # Encryption/decryption utilities
│   │   ├── repliz.ts          # Repliz API integration
│   │   ├── session.ts         # Session management
│   │   └── utils.ts           # Validation schemas & utilities
│   ├── middleware/
│   │   └── auth.ts            # Authentication middleware
│   ├── routes/
│   │   ├── auth.ts            # Login/logout endpoints
│   │   ├── keys.ts            # Save Repliz keys endpoint
│   │   ├── platforms.ts       # Get connected platforms
│   │   └── upload.ts          # Upload video endpoint
│   └── index.ts               # Main app entry point
├── public/
│   ├── index.html             # Login page
│   ├── dashboard.html         # Dashboard page
│   ├── app.js                 # Login page JS
│   ├── dashboard.js           # Dashboard page JS
│   └── style.css              # Global styles
├── drizzle/                   # Database migrations
├── wrangler.toml              # Cloudflare Workers config
├── package.json
├── tsconfig.json
├── TROUBLESHOOTING.md         # Troubleshooting guide
├── BEST-PRACTICES.md          # Best practices guide
└── README.md                  # This file
```

## 🔒 Security

- ✅ Passwords hashed dengan bcrypt (10 rounds)
- ✅ API keys encrypted dengan AES-256-GCM
- ✅ Session-based authentication
- ✅ HTTPS only (Cloudflare Workers)
- ✅ Input validation dengan Zod

## 🔧 Technologies

- **Backend**: [Hono](https://hono.dev/) (Fast web framework)
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Deployment**: Cloudflare Workers
- **Validation**: Zod
- **Encryption**: Web Crypto API

## 📝 API Endpoints

### Public Endpoints
- `GET /` - Login page
- `POST /api/login` - Login
- `POST /api/register` - Register (disabled by default)

### Protected Endpoints (requires authentication)
- `GET /dashboard.html` - Dashboard page
- `POST /api/logout` - Logout
- `POST /api/save-keys` - Save Repliz API keys
- `GET /api/platforms` - Get connected Repliz platforms
- `POST /api/upload` - Upload video to selected platforms

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [Repliz](https://repliz.com) - Social media management platform
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless platform
- [Hono](https://hono.dev/) - Web framework

## 📧 Support

Untuk issues atau questions, buka issue di GitHub repository.

---

**Made with ❤️ for easy social media management**
