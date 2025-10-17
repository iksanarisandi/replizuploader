import { Hono } from 'hono';
import { hash, compare } from 'bcryptjs';
import { getDb } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authSchema, generateId, getCurrentTimestamp } from '../lib/utils';
import { createSession, setSessionCookie, clearSessionCookie, getSessionId, deleteSession } from '../lib/session';
import { loginRateLimit, registerRateLimit } from '../middleware/rateLimit';
import { createLogger } from '../lib/logger';
import type { AppBindings } from '../index';

const auth = new Hono<AppBindings>();

/**
 * POST /api/register
 * Register new user
 */
auth.post('/register', registerRateLimit, async (c) => {
  const logger = createLogger(c.env);
  
  try {
    const body = await c.req.json();
    const validated = authSchema.parse(body);

    const db = getDb(c.env.DB);

    // Check if email already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, validated.email))
      .get();

    if (existing) {
      return c.json({ error: 'Email already registered', statusCode: 400 }, 400);
    }

    // Hash password
    const passwordHash = await hash(validated.password, 10);

    // Create user
    const userId = generateId();
    await db.insert(users).values({
      id: userId,
      email: validated.email,
      passwordHash,
      createdAt: getCurrentTimestamp(),
    }).run();

    // Create session
    const sessionId = await createSession(db, userId);
    setSessionCookie(c, sessionId);

    logger.info(`New user registered: ${validated.email}`);
    
    return c.json({
      success: true,
      userId,
      email: validated.email,
    });
  } catch (error: any) {
    logger.error('Register error', error);
    return c.json(
      { error: error.message || 'Registration failed', statusCode: 400 },
      400
    );
  }
});

/**
 * POST /api/login
 * Login user
 */
auth.post('/login', loginRateLimit, async (c) => {
  const logger = createLogger(c.env);
  
  try {
    const body = await c.req.json();
    const validated = authSchema.parse(body);

    const db = getDb(c.env.DB);

    // Find user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, validated.email))
      .get();

    if (!user) {
      return c.json({ error: 'Invalid email or password', statusCode: 401 }, 401);
    }

    // Verify password
    const isValid = await compare(validated.password, user.passwordHash);
    if (!isValid) {
      return c.json({ error: 'Invalid email or password', statusCode: 401 }, 401);
    }

    // Create session
    const sessionId = await createSession(db, user.id);
    setSessionCookie(c, sessionId);

    logger.info(`User logged in: ${user.email}`);
    
    return c.json({
      success: true,
      userId: user.id,
      email: user.email,
    });
  } catch (error: any) {
    logger.error('Login error', error);
    return c.json(
      { error: error.message || 'Login failed', statusCode: 400 },
      400
    );
  }
});

/**
 * POST /api/logout
 * Logout user
 */
auth.post('/logout', async (c) => {
  const logger = createLogger(c.env);
  
  try {
    const db = getDb(c.env.DB);
    const sessionId = getSessionId(c);

    if (sessionId) {
      await deleteSession(db, sessionId);
    }

    clearSessionCookie(c);

    logger.info('User logged out');
    
    return c.json({ success: true });
  } catch (error: any) {
    logger.error('Logout error', error);
    return c.json(
      { error: error.message || 'Logout failed', statusCode: 400 },
      400
    );
  }
});

export default auth;
