import { Hono } from 'hono';
import type { AppCtx } from '../types';
import { authenticate, logAction } from '../lib/auth';
import { readBody } from '../lib/body';

const r = new Hono<AppCtx>();

// Upload attendance rows. The browser reads the Excel file and sends
// { courseId, date, rows } where rows = XLSX.utils.sheet_to_json(firstSheet).
r.post('/upload', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const { courseId, date, rows } = await readBody(c);

    if (!Array.isArray(rows)) {
      return c.json({ error: 'Excel file is required' }, 400);
    }

    // Check course start date
    const courseCheck = await db.query('SELECT start_date, teacher_id FROM classes WHERE id = $1', [courseId]);
    if (courseCheck.rows.length === 0) {
      return c.json({ error: 'Course not found' }, 404);
    }

    const { start_date, teacher_id } = courseCheck.rows[0];

    // RBAC check
    if (user.role === 'TEACHER' && teacher_id !== user.id) {
      return c.json({ error: 'Access denied. You can only manage attendance for your assigned courses.' }, 403);
    }

    if (start_date && new Date(date) < new Date(start_date)) {
      return c.json({ error: `Cannot record attendance before course start date (${new Date(start_date).toLocaleDateString()})` }, 400);
    }

    const data = rows;

    if (data.length === 0) {
      return c.json({ error: 'Excel file is empty' }, 400);
    }

    // Expected columns: "Admission Number", "Status" (Present/Absent)
    // We need to map admission numbers to student IDs
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      let successCount = 0;
      for (const row of data) {
        const admissionNumber = row['Admission Number'];
        const status = row['Status'];

        if (!admissionNumber || !status) continue;

        // Find student
        const studentRes = await client.query('SELECT id FROM students WHERE admission_number = $1', [admissionNumber]);
        if (studentRes.rows.length === 0) continue;

        const studentId = studentRes.rows[0].id;

        // Upsert attendance
        await client.query(
          `INSERT INTO attendance (student_id, course_id, attendance_date, status)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (student_id, course_id, attendance_date)
                     DO UPDATE SET status = EXCLUDED.status`,
          [studentId, courseId, date, status]
        );
        successCount++;
      }

      await client.query('COMMIT');

      await logAction(db, user.id, user.role, 'UPLOAD_ATTENDANCE', { courseId, date, count: successCount });

      return c.json({ message: `Successfully uploaded attendance for ${successCount} students`, count: successCount });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Attendance upload error:', error);
    return c.json({ error: 'Failed to upload attendance' }, 500);
  }
});

// Get attendance stats for a course
r.get('/stats/:courseId', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const courseId = c.req.param('courseId');

    if (user.role === 'TEACHER') {
      const courseCheck = await db.query('SELECT teacher_id FROM classes WHERE id = $1', [courseId]);
      if (courseCheck.rows.length === 0 || courseCheck.rows[0].teacher_id !== user.id) {
        return c.json({ error: 'Access denied. You can only view stats for your assigned courses.' }, 403);
      }
    }

    const result = await db.query(
      `SELECT
                s.id as student_id,
                s.full_name,
                s.admission_number,
                COUNT(a.id) as total_days,
                COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as present_days,
                ROUND((COUNT(CASE WHEN a.status = 'Present' THEN 1 END)::numeric / NULLIF(COUNT(a.id), 0)) * 100, 2) as percentage
             FROM students s
             LEFT JOIN attendance a ON s.id = a.student_id AND a.course_id = $1
             WHERE s.class_id = $1
             GROUP BY s.id, s.full_name, s.admission_number
             ORDER BY s.full_name`,
      [courseId]
    );
    return c.json(result.rows);
  } catch (error) {
    console.error('Get attendance stats error:', error);
    return c.json({ error: 'Failed to fetch attendance stats' }, 500);
  }
});

// Get attendance percentage for a single student
r.get('/student/:studentId', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const studentId = c.req.param('studentId');
    const result = await db.query(
      `SELECT
COUNT(id) as total_days,
    COUNT(CASE WHEN status = 'Present' THEN 1 END) as present_days,
    ROUND((COUNT(CASE WHEN status = 'Present' THEN 1 END):: numeric / NULLIF(COUNT(id), 0)) * 100, 2) as percentage
             FROM attendance
             WHERE student_id = $1`,
      [studentId]
    );
    return c.json(result.rows[0]);
  } catch (error) {
    console.error('Get student attendance error:', error);
    return c.json({ error: 'Failed to fetch attendance' }, 500);
  }
});

export default r;
