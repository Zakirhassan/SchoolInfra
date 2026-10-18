import { Pool } from '@neondatabase/serverless';
import type { MiddlewareHandler } from 'hono';
import type { AppCtx } from '../types';

export const withDb: MiddlewareHandler<AppCtx> = async (c, next) => {
  const pool = new Pool({ connectionString: c.env.DATABASE_URL });
  c.set('db', pool);
  try { await next(); } finally { c.executionCtx.waitUntil(pool.end()); }
};
