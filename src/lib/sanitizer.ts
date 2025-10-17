/**
 * Input Sanitizer
 * Sanitizes user input to prevent XSS attacks
 */
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML input (allows safe HTML tags)
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p'],
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  });
}

/**
 * Sanitize plain text (removes all HTML and dangerous characters)
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  // First, remove all HTML tags using DOMPurify
  const cleaned = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
  
  // Additional cleaning for extra safety
  return cleaned
    .replace(/[<>]/g, '') // Remove any remaining angle brackets
    .trim();
}

/**
 * Sanitize filename (removes path traversal and dangerous characters)
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  
  // Remove path traversal attempts
  return filename
    .replace(/\.\./g, '')
    .replace(/[\/\\]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .substring(0, 255); // Limit length
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  // Basic email sanitization
  return email
    .toLowerCase()
    .trim()
    .substring(0, 255);
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}
