/**
 * Input Sanitizer
 * Sanitizes user input to prevent XSS attacks
 * Workers-compatible implementation (no DOM dependencies)
 */

/**
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };
  
  return str.replace(/[&<>"'\/]/g, (match) => htmlEscapes[match]);
}

/**
 * Sanitize HTML input (allows safe HTML tags)
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  
  // For Workers, we'll just escape HTML entities
  // This is safer and doesn't require DOM
  return escapeHtml(dirty);
}

/**
 * Sanitize plain text (removes all HTML and dangerous characters)
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  // Remove HTML tags and dangerous characters
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags
    .replace(/<[^>]+>/g, '') // Remove all HTML tags
    .replace(/[<>]/g, '') // Remove any remaining angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
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
