/**
 * Security Headers Middleware
 * Adds essential security headers to all responses
 */
import type { Context, Next } from 'hono';

export async function securityHeaders(c: Context, next: Next) {
  await next();
  
  // Prevent clickjacking attacks
  c.header('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');
  
  // Enable browser's XSS filter
  c.header('X-XSS-Protection', '1; mode=block');
  
  // Force HTTPS (only in production)
  if (c.env?.ENVIRONMENT === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Control referrer information
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Disable browser features we don't need
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Basic Content Security Policy
  // Start with a permissive policy to avoid breaking existing functionality
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Will tighten later
    "style-src 'self' 'unsafe-inline'", // Will tighten later
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' https://post.komen.autos",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  
  c.header('Content-Security-Policy', csp);
}
