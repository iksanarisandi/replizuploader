import { LOGGING_CONFIG } from './constants';

/**
 * Determine if we're in production based on environment
 */
function isProduction(env?: any): boolean {
  // Check if ENVIRONMENT is set to 'production'
  if (env?.ENVIRONMENT === 'production') return true;
  
  // In Cloudflare Workers, we can also check the hostname
  // But for safety, we default to production mode (less verbose)
  return true;
}

/**
 * Safe logger that removes sensitive information
 */
export class Logger {
  private verbose: boolean;
  
  constructor(env?: any) {
    // Only enable verbose logging in development
    this.verbose = !isProduction(env) && LOGGING_CONFIG.VERBOSE;
  }
  
  /**
   * Remove sensitive fields from objects
   */
  private sanitize(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Check if key contains sensitive field names
      const isSensitive = LOGGING_CONFIG.SENSITIVE_FIELDS.some(
        field => key.toLowerCase().includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  /**
   * Log info messages (always logged)
   */
  info(message: string, data?: any) {
    if (data) {
      console.log(`[INFO] ${message}`, this.sanitize(data));
    } else {
      console.log(`[INFO] ${message}`);
    }
  }
  
  /**
   * Log error messages (always logged)
   */
  error(message: string, error?: any) {
    if (error) {
      console.error(`[ERROR] ${message}`, {
        message: error.message,
        stack: this.verbose ? error.stack : undefined,
      });
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }
  
  /**
   * Log debug messages (only in development)
   */
  debug(message: string, data?: any) {
    if (!this.verbose) return;
    
    if (data) {
      console.log(`[DEBUG] ${message}`, this.sanitize(data));
    } else {
      console.log(`[DEBUG] ${message}`);
    }
  }
  
  /**
   * Log warning messages (always logged)
   */
  warn(message: string, data?: any) {
    if (data) {
      console.warn(`[WARN] ${message}`, this.sanitize(data));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  }
}

/**
 * Create a logger instance
 */
export function createLogger(env?: any): Logger {
  return new Logger(env);
}
