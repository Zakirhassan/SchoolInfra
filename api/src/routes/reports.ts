import { Hono } from 'hono';
import type { AppCtx, Env } from '../types';
import { authenticate, logAction } from '../lib/auth';
import { readBody } from '../lib/body';

const r = new Hono<AppCtx>();

// Same defaults as backend/routes/reports.js (process.env -> Worker vars).
const schoolInfo = (env: Env) => ({
  name: env.SCHOOL_NAME || 'ASDC - Advance Skill Development Center',
  address: env.SCHOOL_ADDRESS || 'Kanpur',
  phone: env.SCHOOL_PHONE || '+1234567890',
  academicYear: env.CURRENT_ACADEMIC_YEAR || '2025-2026'
});

// Certificate for a student. Returns what the old route passed to
// generateReportCard(student, marks, exam, schoolInfo); the browser builds the PDF
// (frontend/src/lib/pdf/reportCard.ts).
r.get('/student/:studentId/exam/:examId', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const studentId = c.req.param('studentId');
    const examId = c.req.param('examId');
    const userRole = user.role;

    // Get student details
    const studentResult = await db.query(
      `SELECT s.*, c.class_name as course_name, c.section, c.start_date, c.tentative_end_date
             FROM students s
             LEFT JOIN classes c ON s.class_id = c.id
             WHERE s.id = $1`,
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return c.json({ error: 'Student not found' }, 404);
    }

    const student = studentResult.rows[0];

    // Security Check: If Student role, they can only see their own certificate and only if published
    if (userRole === 'STUDENT') {
      if (parseInt(studentId) !== user.id) {
        return c.json({ error: 'Access denied' }, 403);
      }
      if (!student.is_published) {
        return c.json({ error: 'Certificate not yet published by Admin' }, 403);
      }
    }

    // Security Check: If Teacher role, they can only see certificates for students in their assigned courses
    if (userRole === 'TEACHER') {
      const courseCheck = await db.query('SELECT teacher_id FROM classes WHERE id = $1', [student.class_id]);
      if (courseCheck.rows.length === 0 || courseCheck.rows[0].teacher_id !== user.id) {
        return c.json({ error: 'Access denied. You can only view certificates for your assigned courses.' }, 403);
      }
    }

    // Get exam (Exam/Assessment) details
    const examResult = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
    if (examResult.rows.length === 0) {
      return c.json({ error: 'Exam not found' }, 404);
    }
    const exam = examResult.rows[0];

    // Get marks
    const marksResult = await db.query(
      `SELECT m.*, s.subject_name, s.max_marks
             FROM marks m
             JOIN subjects s ON m.subject_id = s.id
             WHERE m.student_id = $1 AND m.exam_id = $2
             ORDER BY s.subject_name`,
      [studentId, examId]
    );

    if (marksResult.rows.length === 0) {
      return c.json({ error: 'No marks found for this student and exam' }, 404);
    }

    return c.json({ student, marks: marksResult.rows, exam, schoolInfo: schoolInfo(c.env) });
  } catch (error) {
    console.error('Generate certificate error:', error);
    return c.json({ error: 'Failed to generate certificate' }, 500);
  }
});

// Publish/Unpublish student results
r.post('/publish', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const { studentId, isPublished } = await readBody(c);
    if (user.role !== 'ADMIN') {
      return c.json({ error: 'Only admins can publish results' }, 403);
    }

    await db.query(
      'UPDATE students SET is_published = $1 WHERE id = $2',
      [isPublished, studentId]
    );

    await logAction(db, user.id, user.role, isPublished ? 'PUBLISH_CERTIFICATE' : 'HIDE_CERTIFICATE', { studentId });

    return c.json({ message: `Results ${isPublished ? 'published' : 'unpublished'} successfully` });
  } catch (error) {
    console.error('Publish results error:', error);
    return c.json({ error: 'Failed to update publication status' }, 500);
  }
});

// Publish results for entire class/course
r.post('/publish/course', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const { courseId, isPublished } = await readBody(c);
    if (user.role !== 'ADMIN') {
      return c.json({ error: 'Only admins can publish results' }, 403);
    }

    await db.query(
      'UPDATE students SET is_published = $1 WHERE class_id = $2',
      [isPublished, courseId]
    );

    await logAction(db, user.id, user.role, isPublished ? 'PUBLISH_COURSE_CERTIFICATES' : 'HIDE_COURSE_CERTIFICATES', { courseId });

    return c.json({ message: `Course results ${isPublished ? 'published' : 'unpublished'} successfully` });
  } catch (error) {
    console.error('Publish course results error:', error);
    return c.json({ error: 'Failed to update publication status' }, 500);
  }
});

export default r;
