import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { DbClient } from '../db/client';
import { users, userSessions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from './utils';
import { SESSION_CONFIG } from './constants';

export interface SessionUser {
  id: string;
  email: string;
}

/**
 * Create a new session for user
 */
export async function createSession(
  db: DbClient,
  userId: string
): Promise<string> {
  const sessionId = generateId();
  const expiresAt = Date.now() + SESSION_CONFIG.DURATION_MS;

  await db.insert(userSessions).values({
    id: sessionId,
    userId,
    expiresAt,
  }).run();

  return sessionId;
}

/**
 * Validate session and return user
 */
export async function validateSession(
  db: DbClient,
  sessionId: string
): Promise<SessionUser | null> {
  const result = await db
    .select({
      session: userSessions,
      user: users,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(eq(userSessions.id, sessionId))
    .get();

  if (!result) {
    return null;
  }

  // Check if session expired
  if (result.session.expiresAt < Date.now()) {
    await deleteSession(db, sessionId);
    return null;
  }

  return {
    id: result.user.id,
    email: result.user.email,
  };
}

/**
 * Delete a session
 */
export async function deleteSession(db: DbClient, sessionId: string): Promise<void> {
  await db.delete(userSessions).where(eq(userSessions.id, sessionId)).run();
}

/**
 * Set session cookie
 */
export function setSessionCookie(c: Context, sessionId: string): void {
  const expiresAt = new Date(Date.now() + SESSION_CONFIG.DURATION_MS);
  
  setCookie(c, SESSION_CONFIG.COOKIE_NAME, sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    expires: expiresAt,
  });
}

/**
 * Get session ID from cookie
 */
export function getSessionId(c: Context): string | undefined {
  return getCookie(c, SESSION_CONFIG.COOKIE_NAME);
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_CONFIG.COOKIE_NAME, {
    path: '/',
  });
}

/**
 * Get current user from context (set by auth middleware)
 */
export function getCurrentUser(c: Context): SessionUser | null {
  return c.get('user') || null;
}

/**
 * Require authenticated user (throw if not authenticated)
 */
export function requireUser(c: Context): SessionUser {
  const user = getCurrentUser(c);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
