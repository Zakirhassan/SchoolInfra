import { Hono } from 'hono';
import type { AppCtx } from '../types';
import { authenticate } from '../lib/auth';
import { readBody } from '../lib/body';
import { withoutPasswordHash } from '../lib/redact';

const r = new Hono<AppCtx>();

// Get fee history for a student
r.get('/student/:studentId', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const studentId = c.req.param('studentId');

    const result = await db.query(
      `SELECT * FROM fee_payments
       WHERE student_id = $1
       ORDER BY payment_date DESC`,
      [studentId]
    );

    return c.json(result.rows);
  } catch (error) {
    console.error('Get fee history error:', error);
    return c.json({ error: 'Failed to fetch fee history' }, 500);
  }
});

// Record fee payment
r.post('/payment', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const { studentId, amount, paymentDate, paymentMonth, paymentYear, remarks } = await readBody(c);

    if (!studentId || !amount || !paymentDate || !paymentMonth || !paymentYear) {
      return c.json({ error: 'All required fields must be provided' }, 400);
    }

    // Insert payment record
    const result = await db.query(
      `INSERT INTO fee_payments (student_id, amount, payment_date, payment_month, payment_year, remarks)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [studentId, amount, paymentDate, paymentMonth, paymentYear, remarks]
    );

    // Update student fee status
    await db.query(`UPDATE students SET fee_status = 'Paid' WHERE id = $1`, [studentId]);

    return c.json(result.rows[0], 201);
  } catch (error) {
    console.error('Record payment error:', error);
    return c.json({ error: 'Failed to record payment' }, 500);
  }
});

// Update fee status
r.put('/status/:studentId', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const studentId = c.req.param('studentId');
    const { feeStatus } = await readBody(c);

    if (!['Paid', 'Unpaid', 'Partial'].includes(feeStatus)) {
      return c.json({ error: 'Invalid fee status' }, 400);
    }

    const result = await db.query(
      'UPDATE students SET fee_status = $1 WHERE id = $2 RETURNING *',
      [feeStatus, studentId]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Student not found' }, 404);
    }

    return c.json(withoutPasswordHash(result.rows[0]));
  } catch (error) {
    console.error('Update fee status error:', error);
    return c.json({ error: 'Failed to update fee status' }, 500);
  }
});

// Get fee summary for a class
r.get('/summary/class/:classId', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const classId = c.req.param('classId');

    const result = await db.query(
      `SELECT
        fee_status,
        COUNT(*) as count,
        SUM(CASE WHEN fee_status = 'Paid' THEN c.monthly_fee ELSE 0 END) as total_collected
       FROM students s
       JOIN classes c ON s.class_id = c.id
       WHERE s.class_id = $1
       GROUP BY fee_status`,
      [classId]
    );

    return c.json(result.rows);
  } catch (error) {
    console.error('Get fee summary error:', error);
    return c.json({ error: 'Failed to fetch fee summary' }, 500);
  }
});

export default r;
