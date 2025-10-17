/**
 * CORS Middleware Configuration
 * Configures Cross-Origin Resource Sharing policies
 */
import { cors } from 'hono/cors';

// Define allowed origins based on environment
const getAllowedOrigins = (env?: any): string[] => {
  const origins: string[] = [];
  
  // Add production domains
  origins.push(
    'https://replizauto.com',
    'https://www.replizauto.com'
  );
  
  // Add localhost for development
  if (env?.ENVIRONMENT !== 'production') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8787',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8787'
    );
  }
  
  return origins;
};

export const corsMiddleware = (env?: any) => cors({
  origin: (origin, c) => {
    const allowedOrigins = getAllowedOrigins(env || c.env);
    
    // Allow requests with no origin (e.g., mobile apps, Postman)
    if (!origin) {
      return null;
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      return origin;
    }
    
    // Block other origins
    return null;
  },
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-Token'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['X-CSRF-Token', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400, // 24 hours
  credentials: true,
});
