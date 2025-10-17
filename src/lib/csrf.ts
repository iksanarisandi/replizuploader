/**
 * CSRF Protection Utilities
 * Implements double-submit cookie pattern for CSRF protection
 * Works with stateless architecture (no server-side session storage needed)
 */

import { getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure random token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Set CSRF token cookie
 */
export function setCSRFCookie(c: Context, token: string): void {
  // Set cookie with same security settings as session
  setCookie(c, CSRF_COOKIE_NAME, token, {
    path: '/',
    httpOnly: false, // Must be false so JavaScript can read it
    secure: true,
    sameSite: 'Strict', // Strict for CSRF cookie
    maxAge: 3600, // 1 hour
  });
}

/**
 * Get CSRF token from cookie
 */
export function getCSRFCookie(c: Context): string | undefined {
  return getCookie(c, CSRF_COOKIE_NAME);
}

/**
 * Get CSRF token from request (header or body)
 */
export async function getCSRFFromRequest(c: Context): Promise<string | undefined> {
  // Check header first
  const headerToken = c.req.header(CSRF_HEADER_NAME);
  if (headerToken) {
    return headerToken;
  }

  // Check body if it's JSON
  if (c.req.header('Content-Type')?.includes('application/json')) {
    try {
      const body = await c.req.json();
      return body.csrfToken || body.csrf_token || body._csrf;
    } catch {
      // Body is not JSON or parsing failed
    }
  }

  // Check form data if it's form submission
  if (c.req.header('Content-Type')?.includes('multipart/form-data') ||
      c.req.header('Content-Type')?.includes('application/x-www-form-urlencoded')) {
    try {
      const formData = await c.req.formData();
      return formData.get('csrfToken')?.toString() || 
             formData.get('csrf_token')?.toString() ||
             formData.get('_csrf')?.toString();
    } catch {
      // Form data parsing failed
    }
  }

  return undefined;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(cookieToken: string | undefined, requestToken: string | undefined): boolean {
  // Both must exist
  if (!cookieToken || !requestToken) {
    return false;
  }

  // Both must match exactly
  if (cookieToken !== requestToken) {
    return false;
  }

  // Token must have correct length
  if (cookieToken.length !== CSRF_TOKEN_LENGTH * 2) {
    return false;
  }

  return true;
}

/**
 * Create new CSRF token and set cookie
 */
export function createAndSetCSRFToken(c: Context): string {
  const token = generateCSRFToken();
  setCSRFCookie(c, token);
  return token;
}
