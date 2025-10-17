/**
 * CSRF Protection Middleware
 * Validates CSRF tokens on state-changing requests
 */

import type { Context, Next } from 'hono';
import {
  getCSRFCookie,
  getCSRFFromRequest,
  validateCSRFToken,
  createAndSetCSRFToken,
} from '../lib/csrf';
import { createLogger } from '../lib/logger';

/**
 * CSRF protection middleware
 * Applies to POST, PUT, DELETE, PATCH requests
 */
export async function csrfProtection(c: Context, next: Next) {
  const method = c.req.method.toUpperCase();
  const logger = createLogger(c.env);
  
  // Skip CSRF for safe methods
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  // Skip CSRF for login and register endpoints (they don't have session yet)
  const path = new URL(c.req.url).pathname;
  const skipPaths = ['/api/login', '/api/register', '/api/logout'];
  if (skipPaths.includes(path)) {
    return next();
  }

  // Get tokens
  const cookieToken = getCSRFCookie(c);
  const requestToken = await getCSRFFromRequest(c);

  // Log for debugging (without exposing actual tokens)
  logger.debug('CSRF check', {
    path,
    method,
    hasCookieToken: !!cookieToken,
    hasRequestToken: !!requestToken,
  });

  // Validate tokens
  if (!validateCSRFToken(cookieToken, requestToken)) {
    logger.warn('CSRF token validation failed', {
      path,
      method,
      ip: c.req.header('CF-Connecting-IP') || 'unknown',
    });

    return c.json(
      {
        error: 'Invalid or missing CSRF token',
        statusCode: 403,
      },
      403
    );
  }

  // Tokens are valid, proceed
  return next();
}

/**
 * CSRF token generator endpoint middleware
 * Generates and returns a new CSRF token
 */
export function csrfTokenEndpoint(c: Context) {
  const token = createAndSetCSRFToken(c);
  
  return c.json({
    csrfToken: token,
    message: 'Include this token in X-CSRF-Token header or csrfToken field',
  });
}
