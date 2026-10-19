import { Hono } from 'hono';
import type { AppCtx, Env } from '../types';
import { authenticate } from '../lib/auth';
import { readBody } from '../lib/body';

const r = new Hono<AppCtx>();

// The old route turned s.* into a PDF; as JSON it would also hand out password_hash. The PDF never used it.
const withoutHash = ({ password_hash, ...s }: any) => s;

// Same defaults as backend/routes/idcards.js (process.env -> Worker vars).
const schoolInfo = (env: Env) => ({
  name: env.SCHOOL_NAME || 'ABC School',
  address: env.SCHOOL_ADDRESS || '123 Main Street',
  phone: env.SCHOOL_PHONE || '+1234567890',
  academicYear: env.CURRENT_ACADEMIC_YEAR || '2025-2026'
});

// Single student ID card. Returns what the old route passed to generateIDCard(student, schoolInfo);
// the browser builds the PDF (frontend/src/lib/pdf/idCard.ts).
r.get('/student/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');

    const result = await db.query(
      `SELECT s.*, c.class_name, c.section
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Student not found' }, 404);
    }

    const student = withoutHash(result.rows[0]);
    return c.json({ student, schoolInfo: schoolInfo(c.env) });
  } catch (error) {
    console.error('Generate ID card error:', error);
    return c.json({ error: 'Failed to generate ID card' }, 500);
  }
});

// Bulk ID cards. Returns what the old route passed to generateBulkIDCards(students, schoolInfo).
r.post('/bulk', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const { classId, studentIds } = await readBody(c);

    let query = `
      SELECT s.*, c.class_name, c.section
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (studentIds && studentIds.length > 0) {
      query += ' AND s.id = ANY($1)';
      params.push(studentIds);
    } else if (classId) {
      query += ' AND s.class_id = $1';
      params.push(classId);
    } else {
      return c.json({ error: 'Either classId or studentIds must be provided' }, 400);
    }

    query += ' ORDER BY c.class_name, c.section, s.roll_number';

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return c.json({ error: 'No students found' }, 404);
    }

    return c.json({ students: result.rows.map(withoutHash), schoolInfo: schoolInfo(c.env) });
  } catch (error) {
    console.error('Generate bulk ID cards error:', error);
    return c.json({ error: 'Failed to generate ID cards' }, 500);
  }
});

export default r;
