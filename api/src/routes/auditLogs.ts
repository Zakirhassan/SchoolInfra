import { Hono } from 'hono';
import type { AppCtx } from '../types';
import { authenticate } from '../lib/auth';

const r = new Hono<AppCtx>();

// Get audit logs (Admin only)
r.get('/', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    if (user.role !== 'ADMIN') {
      return c.json({ error: 'Access denied. Admins only.' }, 403);
    }

    const result = await db.query(`
            SELECT a.*,
                   COALESCE(adm.full_name, t.full_name, 'System') as performer_name
            FROM audit_logs a
            LEFT JOIN admins adm ON a.user_id = adm.id AND a.user_role = 'ADMIN'
            LEFT JOIN teachers t ON a.user_id = t.id AND a.user_role = 'TEACHER'
            ORDER BY a.timestamp DESC
            LIMIT 100
        `);

    return c.json(result.rows);
  } catch (error) {
    console.error('Get audit logs error:', error);
    return c.json({ error: 'Failed to fetch audit logs' }, 500);
  }
});

export default r;
