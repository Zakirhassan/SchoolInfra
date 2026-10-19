import { Hono } from 'hono';
import type { AppCtx } from '../types';
import { generateToken } from '../lib/auth';
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
        if (user.status === 'ALUMNI') {
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

// Change password
r.post('/change-password', async (c) => {
  try {
    const db = c.get('db');
    const { username, oldPassword, newPassword } = await readBody(c);

    if (!username || !oldPassword || !newPassword) {
      return c.json({ error: 'All fields are required' }, 400);
    }

    const result = await db.query('SELECT * FROM admins WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    const admin = result.rows[0];

    const isValidPassword = await verifyPassword(oldPassword, admin.password_hash);
    if (!isValidPassword) {
      return c.json({ error: 'Invalid old password' }, 401);
    }

    const newPasswordHash = await hashPassword(newPassword);

    await db.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [newPasswordHash, admin.id]);

    return c.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return c.json({ error: 'Failed to change password' }, 500);
  }
});

export default r;
