import type { Context, Next } from 'hono';
import { getDb } from '../db/client';
import { getSessionId, validateSession } from '../lib/session';
import type { AppBindings } from '../index';

/**
 * Auth middleware - validates session and attaches user to context
 */
export async function authMiddleware(c: Context<AppBindings>, next: Next) {
  const db = getDb(c.env.DB);
  const sessionId = getSessionId(c);

  if (sessionId) {
    const user = await validateSession(db, sessionId);
    if (user) {
      c.set('user', user);
    }
  }

  await next();
}

/**
 * Require auth middleware - throws 401 if not authenticated
 */
export async function requireAuth(c: Context<AppBindings>, next: Next) {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Unauthorized', statusCode: 401 }, 401);
  }

  await next();
}
