import { Hono } from 'hono';
import type { AppCtx } from '../types';
import { generateToken, authenticate, logAction } from '../lib/auth';
import { validateNewPassword, passwordStatus } from '../lib/passwordPolicy';
import { readBody } from '../lib/body';
import { hashPassword, verifyPassword } from '../lib/password';

const r = new Hono<AppCtx>();

// Login
r.post('/login', async (c) => {
  try {
    const db = c.get('db');
    const { username, password } = await readBody(c);

    if (!username || !password) {
      return c.json({ error: 'Username/Email and password are required' }, 400);
    }

    let user: any = null;
    let userRole: 'ADMIN' | 'TEACHER' | 'STUDENT' | null = null;

    // 1. Try Admin (username)
    const adminResult = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (adminResult.rows.length > 0) {
      user = adminResult.rows[0];
      userRole = 'ADMIN';
    }

    // 2. Try Teacher if not Admin
    if (!user) {
      const teacherResult = await db.query('SELECT * FROM teachers WHERE username = $1 OR email = $1', [username]);
      if (teacherResult.rows.length > 0) {
        user = teacherResult.rows[0];
        userRole = 'TEACHER';
      }
    }

    // 3. Try Student if not Admin or Teacher
    if (!user) {
      const studentResult = await db.query('SELECT * FROM students WHERE email = $1', [username]);
      if (studentResult.rows.length > 0) {
        user = studentResult.rows[0];
        userRole = 'STUDENT';
        // Block alumni students from logging in
        if (user.enrollment_status === 'ALUMNI') {
          return c.json({ error: 'Alumni accounts cannot log in to the student portal. Please contact the administrator.' }, 403);
        }
      }
    }

    if (!user || !user.password_hash) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = await generateToken(c.env, {
      id: user.id,
      username: user.username || user.email,
      role: userRole!,
    });

    return c.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username || user.email,
        fullName: user.full_name,
        role: userRole,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// Change password (authenticated admin; username comes from the token, never the body)
r.post('/change-password', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    if (user.role !== 'ADMIN') return c.json({ error: 'Only administrators can change their password here' }, 403);

    const { oldPassword, newPassword } = await readBody(c);
    if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || !oldPassword || !newPassword) {
      return c.json({ error: 'Old password and new password are required' }, 400);
    }
    const problem = validateNewPassword(oldPassword, newPassword);
    if (problem) return c.json({ error: problem }, 400);

    const result = await db.query('SELECT id, password_hash FROM admins WHERE id = $1', [user.id]);
    if (result.rows.length === 0) return c.json({ error: 'Invalid old password' }, 401);
    const admin = result.rows[0];

    if (!(await verifyPassword(oldPassword, admin.password_hash))) {
      return c.json({ error: 'Invalid old password' }, 401);
    }

    const newPasswordHash = await hashPassword(newPassword);
    await db.query('UPDATE admins SET password_hash = $1, password_changed_at = NOW() WHERE id = $2', [newPasswordHash, admin.id]);
    await logAction(db, admin.id, 'ADMIN', 'CHANGE_PASSWORD', { username: user.username });

    return c.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return c.json({ error: 'Failed to change password' }, 500);
  }
});

// Password age, used by the frontend to nag admins monthly
r.get('/password-status', authenticate, async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);
    const result = await c.get('db').query('SELECT password_changed_at FROM admins WHERE id = $1', [user.id]);
    if (result.rows.length === 0) return c.json({ error: 'Admin not found' }, 404);
    return c.json(passwordStatus(result.rows[0].password_changed_at));
  } catch (error) {
    console.error('Password status error:', error);
    return c.json({ error: 'Failed to read password status' }, 500);
  }
});

export default r;
