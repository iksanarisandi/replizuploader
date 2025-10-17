# 🛠️ SECURITY FIXES - IMPLEMENTATION GUIDE

## 1. CSRF Protection Implementation

### Install Package
```bash
npm install csrf
```

### Create CSRF Middleware
```typescript
// src/middleware/csrf.ts
import type { Context, Next } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import Tokens from 'csrf';

const tokens = new Tokens();

export async function csrfProtection(c: Context, next: Next) {
  const method = c.req.method;
  
  // Skip CSRF for GET requests
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }
  
  // Get or create CSRF secret
  let secret = getCookie(c, 'csrf-secret');
  if (!secret) {
    secret = tokens.secretSync();
    setCookie(c, 'csrf-secret', secret, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/'
    });
  }
  
  // Verify token for state-changing requests
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    const token = c.req.header('X-CSRF-Token') || 
                  (await c.req.json().then(body => body.csrfToken).catch(() => null));
    
    if (!token || !tokens.verify(secret, token)) {
      return c.json({ error: 'Invalid CSRF token' }, 403);
    }
  }
  
  // Set token for response
  c.set('csrfToken', tokens.create(secret));
  
  return next();
}

// Helper to get CSRF token
export function getCsrfToken(c: Context): string {
  return c.get('csrfToken') || '';
}
```

### Apply to Routes
```typescript
// src/index.ts
import { csrfProtection } from './middleware/csrf';

// Apply CSRF protection to all state-changing routes
app.use('/api/*', csrfProtection);

// Endpoint to get CSRF token
app.get('/api/csrf-token', (c) => {
  return c.json({ token: getCsrfToken(c) });
});
```

---

## 2. CORS Configuration

```typescript
// src/middleware/cors.ts
import { cors } from 'hono/cors';

export const corsMiddleware = cors({
  origin: (origin, c) => {
    // Whitelist your domains
    const allowedOrigins = [
      'https://yourdomain.com',
      'https://www.yourdomain.com',
      process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin)) {
      return origin || allowedOrigins[0];
    }
    return null;
  },
  allowHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['X-CSRF-Token'],
  maxAge: 86400,
  credentials: true,
});

// src/index.ts
import { corsMiddleware } from './middleware/cors';
app.use('*', corsMiddleware);
```

---

## 3. XSS Protection & Input Sanitization

```typescript
// src/lib/sanitizer.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p'],
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  });
}

export function sanitizeText(text: string): string {
  // Remove all HTML tags and dangerous characters
  return text
    .replace(/<[^>]*>?/gm, '') // Remove HTML tags
    .replace(/[<>\"']/g, '') // Remove dangerous chars
    .trim();
}

// Update upload.ts
import { sanitizeText } from '../lib/sanitizer';

// In upload handler:
const title = sanitizeText(formData.get('title') as string);
const description = sanitizeText(formData.get('description') as string);
```

---

## 4. Security Headers Middleware

```typescript
// src/middleware/securityHeaders.ts
import type { Context, Next } from 'hono';

export async function securityHeaders(c: Context, next: Next) {
  await next();
  
  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  c.header('X-XSS-Protection', '1; mode=block');
  
  // Force HTTPS
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Restrict referrer information
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Adjust as needed
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' https://post.komen.autos",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  c.header('Content-Security-Policy', csp);
}

// Apply in index.ts
app.use('*', securityHeaders);
```

---

## 5. Session Regeneration Fix

```typescript
// src/lib/session.ts - Updated
export async function regenerateSession(
  db: DbClient,
  oldSessionId: string,
  userId: string
): Promise<string> {
  // Delete old session
  await deleteSession(db, oldSessionId);
  
  // Create new session
  return createSession(db, userId);
}

// src/routes/auth.ts - Updated login
auth.post('/login', loginRateLimit, async (c) => {
  // ... validation ...
  
  // Get old session if exists
  const oldSessionId = getSessionId(c);
  
  // Create new session (regenerate if exists)
  const sessionId = oldSessionId 
    ? await regenerateSession(db, oldSessionId, user.id)
    : await createSession(db, user.id);
    
  setSessionCookie(c, sessionId);
  
  // ...
});
```

---

## 6. Enhanced Rate Limiting

```typescript
// src/middleware/rateLimit.ts - Enhanced
import crypto from 'crypto';

// Generate fingerprint for better tracking
function getFingerprint(c: Context): string {
  const ip = getClientIP(c);
  const userAgent = c.req.header('User-Agent') || '';
  const acceptLang = c.req.header('Accept-Language') || '';
  
  // Create fingerprint hash
  const data = `${ip}:${userAgent}:${acceptLang}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

// Add progressive delays for repeated violations
export function advancedRateLimit(config: RateLimitConfig, keyPrefix: string) {
  return async (c: Context<AppBindings>, next: Next) => {
    const fingerprint = getFingerprint(c);
    const kvKey = `ratelimit:${keyPrefix}:${fingerprint}`;
    const blockKey = `blocked:${keyPrefix}:${fingerprint}`;
    
    // Check if blocked
    const isBlocked = await c.env.RATE_LIMIT_KV.get(blockKey);
    if (isBlocked) {
      return c.json({
        error: 'Too many requests. You have been temporarily blocked.',
        statusCode: 429,
        retryAfter: 3600 // 1 hour block
      }, 429);
    }
    
    // Check rate limit
    const stored = await c.env.RATE_LIMIT_KV.get(kvKey);
    const current = stored ? parseInt(stored, 10) : 0;
    
    if (current >= config.requests) {
      // Block if excessive violations
      if (current > config.requests * 2) {
        await c.env.RATE_LIMIT_KV.put(blockKey, '1', { expirationTtl: 3600 });
      }
      
      return c.json({
        error: 'Rate limit exceeded',
        statusCode: 429
      }, 429);
    }
    
    // Increment with exponential backoff
    const newCount = current + 1;
    const ttl = current > config.requests / 2 
      ? config.window * 2 // Double TTL if halfway to limit
      : config.window;
      
    await c.env.RATE_LIMIT_KV.put(kvKey, newCount.toString(), { expirationTtl: ttl });
    
    await next();
  };
}
```

---

## 7. File Validation Enhancement

```typescript
// src/lib/fileValidator.ts
const FILE_SIGNATURES = {
  'video/mp4': [
    [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70], // ftyp
    [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp
    [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70], // ftyp
  ],
  'video/webm': [
    [0x1A, 0x45, 0xDF, 0xA3] // EBML header
  ]
};

export async function validateFileSignature(
  file: File,
  expectedType: string
): Promise<boolean> {
  const signatures = FILE_SIGNATURES[expectedType];
  if (!signatures) return false;
  
  // Read first 32 bytes
  const buffer = await file.slice(0, 32).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // Check against known signatures
  for (const signature of signatures) {
    let match = true;
    for (let i = 0; i < signature.length; i++) {
      if (bytes[i] !== signature[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  
  return false;
}

// Use in upload.ts:
const isValidFile = await validateFileSignature(videoFile, videoFile.type);
if (!isValidFile) {
  return c.json({ error: 'Invalid file format' }, 400);
}
```

---

## 8. Improved Encryption with Key Derivation

```typescript
// src/lib/crypto-enhanced.ts
export async function deriveKey(
  masterSecret: string,
  salt: string,
  iterations: number = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterSecret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptWithDerivedKey(
  data: string,
  masterSecret: string,
  userId: string // Use as salt
): Promise<string> {
  const key = await deriveKey(masterSecret, userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}
```

---

## 9. Account Lockout Mechanism

```typescript
// src/middleware/accountLockout.ts
export async function checkAccountLockout(
  c: Context<AppBindings>,
  email: string
): Promise<boolean> {
  const lockoutKey = `lockout:${email}`;
  const attemptKey = `attempts:${email}`;
  
  // Check if locked out
  const lockedUntil = await c.env.RATE_LIMIT_KV.get(lockoutKey);
  if (lockedUntil && Date.now() < parseInt(lockedUntil)) {
    return true; // Account is locked
  }
  
  return false;
}

export async function recordFailedAttempt(
  c: Context<AppBindings>,
  email: string
): Promise<void> {
  const attemptKey = `attempts:${email}`;
  const lockoutKey = `lockout:${email}`;
  
  // Get current attempts
  const attempts = await c.env.RATE_LIMIT_KV.get(attemptKey);
  const count = attempts ? parseInt(attempts) + 1 : 1;
  
  if (count >= 5) {
    // Lock account for 30 minutes
    const lockUntil = Date.now() + 30 * 60 * 1000;
    await c.env.RATE_LIMIT_KV.put(lockoutKey, lockUntil.toString(), {
      expirationTtl: 1800 // 30 minutes
    });
    // Reset attempts
    await c.env.RATE_LIMIT_KV.delete(attemptKey);
  } else {
    // Record attempt
    await c.env.RATE_LIMIT_KV.put(attemptKey, count.toString(), {
      expirationTtl: 900 // 15 minutes
    });
  }
}

export async function clearFailedAttempts(
  c: Context<AppBindings>,
  email: string
): Promise<void> {
  const attemptKey = `attempts:${email}`;
  await c.env.RATE_LIMIT_KV.delete(attemptKey);
}
```

---

## 10. Generic Error Messages

```typescript
// src/lib/errorHandler.ts
export class SafeError {
  private static genericMessages = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    429: 'Too Many Requests',
    500: 'Internal Server Error'
  };
  
  static handle(error: any, statusCode: number = 500): { message: string; code: number } {
    // Log actual error internally
    console.error('[ERROR]', error);
    
    // Return generic message to client
    return {
      message: this.genericMessages[statusCode] || 'An error occurred',
      code: statusCode
    };
  }
}

// Usage in routes:
catch (error) {
  const { message, code } = SafeError.handle(error, 400);
  return c.json({ error: message }, code);
}
```

---

## Testing Security Fixes

```bash
# Test CSRF
curl -X POST http://localhost:8787/api/upload \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' \
  # Should fail without CSRF token

# Test Rate Limiting
for i in {1..20}; do
  curl http://localhost:8787/api/login
done
# Should block after limit

# Test XSS Prevention
curl -X POST http://localhost:8787/api/upload \
  -F 'title=<script>alert(1)</script>' \
  # Should sanitize the input

# Test Security Headers
curl -I http://localhost:8787
# Should show security headers
```
