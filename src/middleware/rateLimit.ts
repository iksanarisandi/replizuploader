import type { Context, Next } from 'hono';
import type { AppBindings } from '../index';
import { RATE_LIMITS } from '../lib/constants';

interface RateLimitConfig {
  requests: number; // Max requests
  window: number; // Time window in seconds
}

/**
 * Get client IP address from request
 */
function getClientIP(c: Context): string {
  // Try Cloudflare headers first
  const cfIP = c.req.header('CF-Connecting-IP');
  if (cfIP) return cfIP;
  
  // Try X-Forwarded-For
  const forwarded = c.req.header('X-Forwarded-For');
  if (forwarded) {
    const ips = forwarded.split(',');
    return ips[0].trim();
  }
  
  // Fallback to X-Real-IP
  const realIP = c.req.header('X-Real-IP');
  if (realIP) return realIP;
  
  // Last resort
  return 'unknown';
}

/**
 * Rate limit middleware factory
 * Uses Cloudflare KV for distributed rate limiting
 */
export function rateLimit(config: RateLimitConfig, keyPrefix: string) {
  return async (c: Context<AppBindings>, next: Next) => {
    const ip = getClientIP(c);
    const kvKey = `ratelimit:${keyPrefix}:${ip}`;
    
    try {
      // Get current count from KV
      const stored = await c.env.RATE_LIMIT_KV.get(kvKey);
      const current = stored ? parseInt(stored, 10) : 0;
      
      // Check if rate limit exceeded
      if (current >= config.requests) {
        return c.json(
          {
            error: 'Rate limit exceeded. Please try again later.',
            statusCode: 429,
            retryAfter: config.window,
          },
          429
        );
      }
      
      // Increment counter
      const newCount = current + 1;
      await c.env.RATE_LIMIT_KV.put(
        kvKey,
        newCount.toString(),
        { expirationTtl: config.window }
      );
      
      // Set rate limit headers
      c.header('X-RateLimit-Limit', config.requests.toString());
      c.header('X-RateLimit-Remaining', (config.requests - newCount).toString());
      c.header('X-RateLimit-Reset', (Date.now() + config.window * 1000).toString());
      
      await next();
    } catch (error) {
      // If KV fails, allow the request but log error
      console.error('Rate limit KV error:', error);
      await next();
    }
  };
}

/**
 * User-based rate limit (requires authentication)
 */
export function userRateLimit(config: RateLimitConfig, keyPrefix: string) {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      // If not authenticated, fall back to IP-based rate limiting
      return rateLimit(config, keyPrefix)(c, next);
    }
    
    const kvKey = `ratelimit:${keyPrefix}:user:${user.id}`;
    
    try {
      const stored = await c.env.RATE_LIMIT_KV.get(kvKey);
      const current = stored ? parseInt(stored, 10) : 0;
      
      if (current >= config.requests) {
        return c.json(
          {
            error: 'Rate limit exceeded. Please try again later.',
            statusCode: 429,
            retryAfter: config.window,
          },
          429
        );
      }
      
      const newCount = current + 1;
      await c.env.RATE_LIMIT_KV.put(
        kvKey,
        newCount.toString(),
        { expirationTtl: config.window }
      );
      
      c.header('X-RateLimit-Limit', config.requests.toString());
      c.header('X-RateLimit-Remaining', (config.requests - newCount).toString());
      c.header('X-RateLimit-Reset', (Date.now() + config.window * 1000).toString());
      
      await next();
    } catch (error) {
      console.error('Rate limit KV error:', error);
      await next();
    }
  };
}

// Pre-configured rate limiters for common endpoints
export const loginRateLimit = rateLimit(RATE_LIMITS.LOGIN, 'login');
export const registerRateLimit = rateLimit(RATE_LIMITS.REGISTER, 'register');
export const uploadRateLimit = userRateLimit(RATE_LIMITS.UPLOAD, 'upload');
export const saveKeysRateLimit = userRateLimit(RATE_LIMITS.SAVE_KEYS, 'savekeys');
export const generalRateLimit = rateLimit(RATE_LIMITS.GENERAL, 'general');
