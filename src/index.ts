import { Hono } from 'hono';
import { authMiddleware } from './middleware/auth';
import { generalRateLimit } from './middleware/rateLimit';
import { securityHeaders } from './middleware/securityHeaders';
import { corsMiddleware } from './middleware/cors';
import auth from './routes/auth';
import keys from './routes/keys';
import upload from './routes/upload';
import platforms from './routes/platforms';
import cleanup from './routes/cleanup';
import type { SessionUser } from './lib/session';
import { SafeError } from './lib/errorHandler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

const assetManifest: Record<string, string> = JSON.parse(manifestJSON || '{}');

// Cloudflare Workers environment bindings
export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  CF_SECRET: string;
  RATE_LIMIT_KV: KVNamespace; // For rate limiting
  UPLOADS_BUCKET_ID?: string; // Optional: for R2 public URL
  __STATIC_CONTENT: KVNamespace;
  ENVIRONMENT?: string; // 'production' or 'development'
}

export type AppBindings = {
  Bindings: Env;
  Variables: {
    user: SessionUser | null;
  };
};

const app = new Hono<AppBindings>();

// Apply CORS policy (FIRST - needs to handle preflight)
app.use('*', (c, next) => corsMiddleware(c.env)(c, next));

// Apply security headers to all responses
app.use('*', securityHeaders);

// Apply global rate limiting to all API routes
app.use('/api/*', generalRateLimit);

// Apply auth middleware globally to check session
app.use('*', authMiddleware);

// API Routes
app.route('/api', auth);
app.route('/api', keys);
app.route('/api', upload);
app.route('/api', platforms);
app.route('/api', cleanup);

// Serve static files from Workers KV
app.get('/*', async (c) => {
  const url = new URL(c.req.url);
  let path = url.pathname;
  
  // Default to index.html for root
  if (path === '/') {
    path = '/index.html';
  }
  
  try {
    const kvKey = path.startsWith('/') ? path.slice(1) : path;
    const assetKey = assetManifest[kvKey] ?? kvKey;

    // Try to get the asset from KV
    const asset = await c.env.__STATIC_CONTENT.get(assetKey, { type: 'arrayBuffer' });
    
    if (!asset) {
      return c.notFound();
    }
    
    // Determine content type based on file extension
    const ext = path.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'html': 'text/html; charset=utf-8',
      'css': 'text/css; charset=utf-8',
      'js': 'application/javascript; charset=utf-8',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
    };
    
    const contentType = ext ? (contentTypes[ext] || 'application/octet-stream') : 'text/html; charset=utf-8';
    
    return new Response(asset, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Error serving static file:', path, err);
    return c.notFound();
  }
});

// Fallback for not found
app.notFound((c) => {
  return c.json({ error: 'Not Found', statusCode: 404 }, 404);
});

// Error handler with safe error responses
app.onError((err, c) => {
  // Use SafeError to prevent information disclosure
  const safeResponse = SafeError.handle(err, 500, c.env);
  return c.json(safeResponse, safeResponse.statusCode as any);
});

// Export with scheduled handler for cron trigger
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Import cleanup function
    const { getDb } = await import('./db/client');
    const { cleanupExpiredFiles } = await import('./lib/cleanup');
    const { createLogger } = await import('./lib/logger');
    
    const logger = createLogger(env);
    logger.info('Scheduled cleanup triggered');
    
    try {
      const db = getDb(env.DB);
      const result = await cleanupExpiredFiles(db, env.UPLOADS, env);
      logger.info('Scheduled cleanup completed', result);
    } catch (error: any) {
      logger.error('Scheduled cleanup failed', error);
    }
  },
};
