import { Hono } from 'hono';
import type { AppCtx } from '../types';
import { authenticate, logAction } from '../lib/auth';
import { readBody } from '../lib/body';

const r = new Hono<AppCtx>();

// Get all classes
r.get('/', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    let query = `
            SELECT c.*, t.full_name as teacher_name
            FROM classes c
            LEFT JOIN teachers t ON c.teacher_id = t.id
        `;
    const params: any[] = [];

    if (user.role === 'TEACHER') {
      query += ' WHERE c.teacher_id = $1';
      params.push(user.id);
    }

    query += ' ORDER BY c.class_name, c.section';

    const result = await db.query(query, params);
    return c.json(result.rows);
  } catch (error) {
    console.error('Get classes error:', error);
    return c.json({ error: 'Failed to fetch classes' }, 500);
  }
});

// Get class by ID
r.get('/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const id = c.req.param('id');
    const result = await db.query('SELECT * FROM classes WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Class not found' }, 404);
    }

    const course = result.rows[0];

    // RBAC check for Teachers
    if (user.role === 'TEACHER' && course.teacher_id !== user.id) {
      return c.json({ error: 'Access denied. You can only view your assigned course.' }, 403);
    }

    return c.json(course);
  } catch (error) {
    console.error('Get class error:', error);
    return c.json({ error: 'Failed to fetch class' }, 500);
  }
});

// Create new class
r.post('/', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const { className, section, monthlyFee, duration, startDate, tentativeEndDate, teacherId } = await readBody(c);

    if (!className || !section) {
      return c.json({ error: 'Class name and section are required' }, 400);
    }

    const result = await db.query(
      'INSERT INTO classes (class_name, section, monthly_fee, duration, start_date, tentative_end_date, teacher_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [className, section, monthlyFee || 0, duration, startDate, tentativeEndDate, teacherId || null]
    );

    await logAction(db, user.id, user.role, 'CREATE_COURSE', { className, section });

    return c.json(result.rows[0], 201);
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      return c.json({ error: 'Class with this name and section already exists' }, 409);
    }
    console.error('Create class error:', error);
    return c.json({ error: 'Failed to create class' }, 500);
  }
});

// Update class
r.put('/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const id = c.req.param('id');
    const { className, section, monthlyFee, duration, startDate, tentativeEndDate, teacherId } = await readBody(c);

    const result = await db.query(
      'UPDATE classes SET class_name = $1, section = $2, monthly_fee = $3, duration = $4, start_date = $5, tentative_end_date = $6, teacher_id = $7 WHERE id = $8 RETURNING *',
      [className, section, monthlyFee, duration, startDate, tentativeEndDate, teacherId || null, id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Class not found' }, 404);
    }

    await logAction(db, user.id, user.role, 'UPDATE_COURSE', { id, className, section });

    return c.json(result.rows[0]);
  } catch (error) {
    console.error('Update class error:', error);
    return c.json({ error: 'Failed to update class' }, 500);
  }
});

// Delete class
r.delete('/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const id = c.req.param('id');
    const result = await db.query('DELETE FROM classes WHERE id = $1 RETURNING class_name, section', [id]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Class not found' }, 404);
    }

    await logAction(db, user.id, user.role, 'DELETE_COURSE', { id, name: result.rows[0].class_name });

    return c.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    return c.json({ error: 'Failed to delete class' }, 500);
  }
});

export default r;
