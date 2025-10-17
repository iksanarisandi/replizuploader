/**
 * Safe Error Handler
 * Returns generic error messages to prevent information disclosure
 */
import { createLogger } from './logger';

interface SafeErrorResponse {
  error: string;
  statusCode: number;
  requestId?: string;
}

export class SafeError {
  private static readonly genericMessages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };

  /**
   * Generate a request ID for error tracking
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Handle error and return safe response
   */
  static handle(
    error: any,
    statusCode: number = 500,
    env?: any
  ): SafeErrorResponse {
    const logger = createLogger(env);
    const requestId = this.generateRequestId();

    // Log the actual error internally with request ID
    logger.error(`[${requestId}] Error occurred`, error);

    // Special handling for specific error types
    if (statusCode === 401) {
      // Authentication errors - always generic
      return {
        error: 'Invalid credentials',
        statusCode: 401,
        requestId,
      };
    }

    if (statusCode === 429) {
      // Rate limit errors - can be slightly more specific
      return {
        error: 'Rate limit exceeded. Please try again later.',
        statusCode: 429,
        requestId,
      };
    }

    // For validation errors (400), we can be a bit more specific
    if (statusCode === 400 && error?.message?.includes('validation')) {
      return {
        error: 'Invalid input provided',
        statusCode: 400,
        requestId,
      };
    }

    // Return generic message for everything else
    return {
      error: this.genericMessages[statusCode] || 'An error occurred',
      statusCode,
      requestId,
    };
  }

  /**
   * Create a safe error response for known business logic errors
   * These are errors we want to show to the user
   */
  static businessError(message: string, statusCode: number = 400): SafeErrorResponse {
    return {
      error: message,
      statusCode,
    };
  }
}
