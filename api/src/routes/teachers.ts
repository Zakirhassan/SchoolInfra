import { Hono } from 'hono';
import type { AppCtx } from '../types';
import { authenticate, logAction } from '../lib/auth';
import { readBody } from '../lib/body';
import { hashPassword } from '../lib/password';
import { putUpload } from '../lib/uploads';

const r = new Hono<AppCtx>();

// Get all teachers
r.get('/', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const result = await db.query('SELECT id, username, full_name, email, photo_url, created_at FROM teachers ORDER BY created_at DESC');
    return c.json(result.rows);
  } catch (error) {
    console.error('Get teachers error:', error);
    return c.json({ error: 'Failed to fetch teachers' }, 500);
  }
});

// Create teacher
r.post('/', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const b = await readBody(c);
    const { username, password, fullName, email } = b;

    if (!username || !password || !fullName || !email) {
      return c.json({ error: 'All fields are required' }, 400);
    }

    const passwordHash = await hashPassword(password);
    let photoUrl: string | null = null;
    if (b.photo instanceof File && b.photo.size > 0) {
      try { photoUrl = await putUpload(c.env, 'photos', b.photo, 'image'); }
      catch (e: any) { return c.json({ error: e.message }, 400); }
    }

    const result = await db.query(
      'INSERT INTO teachers (username, password_hash, full_name, email, photo_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, email, photo_url',
      [username, passwordHash, fullName, email, photoUrl]
    );

    await logAction(db, user.id, user.role, 'CREATE_TEACHER', { username, fullName });

    return c.json(result.rows[0], 201);
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ error: 'Username or email already exists' }, 409);
    }
    console.error('Create teacher error:', error);
    return c.json({ error: 'Failed to create teacher' }, 500);
  }
});

// Update teacher
r.put('/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const id = c.req.param('id');
    const b = await readBody(c);
    const { fullName, email, password } = b;

    let query = 'UPDATE teachers SET full_name = $1, email = $2';
    const params: any[] = [fullName, email, id];
    let paramCount = 4;

    if (password) {
      const passwordHash = await hashPassword(password);
      query += `, password_hash = $${paramCount}`;
      params.push(passwordHash);
      paramCount++;
    }

    if (b.photo instanceof File && b.photo.size > 0) {
      let photoUrl: string;
      try { photoUrl = await putUpload(c.env, 'photos', b.photo, 'image'); }
      catch (e: any) { return c.json({ error: e.message }, 400); }
      query += `, photo_url = $${paramCount}`;
      params.push(photoUrl);
      paramCount++;
    }

    query += ' WHERE id = $3 RETURNING id, username, full_name, email, photo_url';

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return c.json({ error: 'Teacher not found' }, 404);
    }

    await logAction(db, user.id, user.role, 'UPDATE_TEACHER', { id, fullName });

    return c.json(result.rows[0]);
  } catch (error) {
    console.error('Update teacher error:', error);
    return c.json({ error: 'Failed to update teacher' }, 500);
  }
});

// Delete teacher
r.delete('/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const id = c.req.param('id');
    const result = await db.query('DELETE FROM teachers WHERE id = $1 RETURNING username', [id]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Teacher not found' }, 404);
    }

    await logAction(db, user.id, user.role, 'DELETE_TEACHER', { id, username: result.rows[0].username });

    return c.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    return c.json({ error: 'Failed to delete teacher' }, 500);
  }
});

export default r;
