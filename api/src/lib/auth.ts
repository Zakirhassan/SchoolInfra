import { sign, verify } from 'hono/jwt';
import type { MiddlewareHandler } from 'hono';
import type { Pool } from '@neondatabase/serverless';
import type { AppCtx, Env, User } from '../types';

export const generateToken = (env: Env, p: User) => {
  const now = Math.floor(Date.now() / 1000);
  return sign({ ...p, iat: now, exp: now + 86400 }, env.JWT_SECRET, 'HS256');
};

export const authenticate: MiddlewareHandler<AppCtx> = async (c, next) => {
  const token = c.req.header('authorization')?.split(' ')[1];
  if (!token) return c.json({ error: 'Access token required' }, 401);
  try { c.set('user', (await verify(token, c.env.JWT_SECRET, 'HS256')) as unknown as User); }
  catch { return c.json({ error: 'Invalid or expired token' }, 403); }
  await next();
};

export async function logAction(db: Pool, userId: number, role: string, action: string, details: unknown) {
  try {
    await db.query('INSERT INTO audit_logs (user_id, user_role, action, details) VALUES ($1, $2, $3, $4)',
      [userId, role, action, typeof details === 'object' ? JSON.stringify(details) : details]);
  } catch (e) { console.error('Failed to log audit action:', e); }
}
