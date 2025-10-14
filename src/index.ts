import { Hono } from 'hono';
import { authMiddleware } from './middleware/auth';
import auth from './routes/auth';
import keys from './routes/keys';
import upload from './routes/upload';
import platforms from './routes/platforms';
import type { SessionUser } from './lib/session';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

const assetManifest: Record<string, string> = JSON.parse(manifestJSON || '{}');

// Cloudflare Workers environment bindings
export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  CF_SECRET: string;
  UPLOADS_BUCKET_ID?: string; // Optional: for R2 public URL
  __STATIC_CONTENT: KVNamespace;
}

export type AppBindings = {
  Bindings: Env;
  Variables: {
    user: SessionUser | null;
  };
};

const app = new Hono<AppBindings>();

// Apply auth middleware globally to check session
app.use('*', authMiddleware);

// API Routes
app.route('/api', auth);
app.route('/api', keys);
app.route('/api', upload);
app.route('/api', platforms);

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

// Error handler
app.onError((err, c) => {
  console.error('App error:', err);
  return c.json(
    { error: err.message || 'Internal Server Error', statusCode: 500 },
    500
  );
});

export default app;
