import { Hono } from 'hono';
import type { AppCtx } from '../types';
import { authenticate, logAction } from '../lib/auth';
import { readBody } from '../lib/body';

const r = new Hono<AppCtx>();

// ===== SUBJECTS =====

// Get all subjects (optionally filter by class)
r.get('/', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const classId = c.req.query('classId');

    let query = `
      SELECT s.*, c.class_name, c.section
      FROM subjects s
      LEFT JOIN classes c ON s.class_id = c.id
    `;
    const params: any[] = [];

    if (classId) {
      query += ' WHERE s.class_id = $1';
      params.push(classId);

      if (user.role === 'TEACHER') {
        const courseCheck = await db.query('SELECT teacher_id FROM classes WHERE id = $1', [classId]);
        if (courseCheck.rows.length === 0 || courseCheck.rows[0].teacher_id !== user.id) {
          return c.json({ error: 'Access denied. You can only view subjects for your assigned courses.' }, 403);
        }
      }
    } else if (user.role === 'TEACHER') {
      query += ' WHERE c.teacher_id = $1';
      params.push(user.id);
    }

    query += ' ORDER BY c.class_name, c.section, s.subject_name';

    const result = await db.query(query, params);
    return c.json(result.rows);
  } catch (error) {
    console.error('Get subjects error:', error);
    return c.json({ error: 'Failed to fetch subjects' }, 500);
  }
});

// Create subject
r.post('/', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const { subjectName, classId, maxMarks } = await readBody(c);

    if (!subjectName || !classId) {
      return c.json({ error: 'Subject name and class ID are required' }, 400);
    }

    const result = await db.query(
      'INSERT INTO subjects (subject_name, class_id, max_marks) VALUES ($1, $2, $3) RETURNING *',
      [subjectName, classId, maxMarks || 100]
    );

    return c.json(result.rows[0], 201);
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ error: 'Subject already exists for this class' }, 409);
    }
    console.error('Create subject error:', error);
    return c.json({ error: 'Failed to create subject' }, 500);
  }
});

// Update subject
r.put('/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    const { subjectName, maxMarks } = await readBody(c);

    const result = await db.query(
      'UPDATE subjects SET subject_name = $1, max_marks = $2 WHERE id = $3 RETURNING *',
      [subjectName, maxMarks, id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Subject not found' }, 404);
    }

    return c.json(result.rows[0]);
  } catch (error) {
    console.error('Update subject error:', error);
    return c.json({ error: 'Failed to update subject' }, 500);
  }
});

// Delete subject
r.delete('/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    await db.query('DELETE FROM subjects WHERE id = $1', [id]);
    return c.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Delete subject error:', error);
    return c.json({ error: 'Failed to delete subject' }, 500);
  }
});

// ===== EXAMS =====

// Get all exams (optionally filter by class)
r.get('/exams', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const classId = c.req.query('classId');

    let query = `
      SELECT e.*, c.class_name, c.section
      FROM exams e
      LEFT JOIN classes c ON e.class_id = c.id
    `;
    const params: any[] = [];

    if (classId) {
      query += ' WHERE e.class_id = $1';
      params.push(classId);

      if (user.role === 'TEACHER') {
        const courseCheck = await db.query('SELECT teacher_id FROM classes WHERE id = $1', [classId]);
        if (courseCheck.rows.length === 0 || courseCheck.rows[0].teacher_id !== user.id) {
          return c.json({ error: 'Access denied. You can only view exams for your assigned courses.' }, 403);
        }
      }
    } else if (user.role === 'TEACHER') {
      query += ' WHERE c.teacher_id = $1';
      params.push(user.id);
    }

    query += ' ORDER BY e.exam_date DESC';

    const result = await db.query(query, params);
    return c.json(result.rows);
  } catch (error) {
    console.error('Get exams error:', error);
    return c.json({ error: 'Failed to fetch exams' }, 500);
  }
});

// Create exam
r.post('/exams', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const { examName, classId, examDate, academicYear, weightage } = await readBody(c);

    if (!examName || !classId || !academicYear) {
      return c.json({ error: 'Exam name, class ID, and academic year are required' }, 400);
    }

    const currentWeightage = weightage || 100;

    // Validation: Total weightage for a course must be <= 100
    const totalWeightResult = await db.query(
      'SELECT SUM(weightage) as total FROM exams WHERE class_id = $1',
      [classId]
    );
    const totalWeight = parseInt(totalWeightResult.rows[0].total || 0);

    if (totalWeight + currentWeightage > 100) {
      return c.json({
        error: `Total weightage for this course would exceed 100% (Current total: ${totalWeight}%)`
      }, 400);
    }

    const result = await db.query(
      'INSERT INTO exams (exam_name, class_id, exam_date, academic_year, weightage) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [examName, classId, examDate, academicYear, currentWeightage]
    );

    return c.json(result.rows[0], 201);
  } catch (error) {
    console.error('Create exam error:', error);
    return c.json({ error: 'Failed to create exam' }, 500);
  }
});

// Update exam
r.put('/exams/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    const { examName, examDate, academicYear, weightage } = await readBody(c);

    if (weightage !== undefined) {
      // Get class_id and current weightage
      const examInfo = await db.query('SELECT class_id, weightage FROM exams WHERE id = $1', [id]);
      if (examInfo.rows.length === 0) {
        return c.json({ error: 'Exam not found' }, 404);
      }
      const { class_id } = examInfo.rows[0];

      // Validation: Total weightage for a course must be <= 100
      const totalWeightResult = await db.query(
        'SELECT SUM(weightage) as total FROM exams WHERE class_id = $1 AND id != $2',
        [class_id, id]
      );
      const otherWeight = parseInt(totalWeightResult.rows[0].total || 0);

      if (otherWeight + weightage > 100) {
        return c.json({
          error: `Total weightage for this course would exceed 100% (Current total excluding this: ${otherWeight}%)`
        }, 400);
      }
    }

    const result = await db.query(
      'UPDATE exams SET exam_name = $1, exam_date = $2, academic_year = $3, weightage = COALESCE($5, weightage) WHERE id = $4 RETURNING *',
      [examName, examDate, academicYear, id, weightage]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Exam not found' }, 404);
    }

    return c.json(result.rows[0]);
  } catch (error) {
    console.error('Update exam error:', error);
    return c.json({ error: 'Failed to update exam' }, 500);
  }
});

// Delete exam
r.delete('/exams/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    await db.query('DELETE FROM exams WHERE id = $1', [id]);
    return c.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('Delete exam error:', error);
    return c.json({ error: 'Failed to delete exam' }, 500);
  }
});

// ===== MARKS =====

// Get all marks for a class and exam
r.get('/marks', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const classId = c.req.query('classId');
    const examId = c.req.query('examId');

    if (!classId || !examId) {
      return c.json({ error: 'Class ID and Exam ID are required' }, 400);
    }

    const result = await db.query(
      `SELECT m.student_id, m.subject_id, m.marks_obtained
             FROM marks m
             JOIN students s ON m.student_id = s.id
             WHERE s.class_id = $1 AND m.exam_id = $2`,
      [classId, examId]
    );

    return c.json(result.rows);
  } catch (error) {
    console.error('Get marks error:', error);
    return c.json({ error: 'Failed to fetch marks' }, 500);
  }
});

// Get marks for a student in an exam
r.get('/marks/student/:studentId/exam/:examId', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const studentId = c.req.param('studentId');
    const examId = c.req.param('examId');

    const result = await db.query(
      `SELECT m.*, s.subject_name, s.max_marks
       FROM marks m
       JOIN subjects s ON m.subject_id = s.id
       WHERE m.student_id = $1 AND m.exam_id = $2
       ORDER BY s.subject_name`,
      [studentId, examId]
    );

    return c.json(result.rows);
  } catch (error) {
    console.error('Get marks error:', error);
    return c.json({ error: 'Failed to fetch marks' }, 500);
  }
});

// Enter/update marks (bulk)
r.post('/marks', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const { marks } = await readBody(c); // Array of { studentId, subjectId, examId, marksObtained }

    if (!marks || !Array.isArray(marks)) {
      return c.json({ error: 'Marks array is required' }, 400);
    }

    // Verify teacher's access if not admin
    if (user.role === 'TEACHER') {
      const firstMark = marks[0];
      if (firstMark) {
        const courseResult = await db.query(
          'SELECT teacher_id FROM classes WHERE id = (SELECT class_id FROM exams WHERE id = $1)',
          [firstMark.examId]
        );
        if (courseResult.rows.length === 0 || courseResult.rows[0].teacher_id !== user.id) {
          return c.json({ error: 'Access denied. You can only update marks for your assigned courses.' }, 403);
        }
      }
    }

    const insertedMarks: any[] = [];

    for (const mark of marks) {
      const { studentId, subjectId, examId, marksObtained } = mark;

      // Validate marks against max marks
      const subjectResult = await db.query(
        'SELECT max_marks FROM subjects WHERE id = $1',
        [subjectId]
      );

      if (subjectResult.rows.length === 0) {
        continue; // Skip if subject not found
      }

      const maxMarks = subjectResult.rows[0].max_marks;
      if (marksObtained > maxMarks) {
        return c.json({
          error: `Marks obtained (${marksObtained}) cannot exceed max marks (${maxMarks})`
        }, 400);
      }

      // Upsert marks
      const result = await db.query(
        `INSERT INTO marks (student_id, subject_id, exam_id, marks_obtained)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, subject_id, exam_id)
         DO UPDATE SET marks_obtained = $4
         RETURNING *`,
        [studentId, subjectId, examId, marksObtained]
      );

      insertedMarks.push(result.rows[0]);
    }

    await logAction(db, user.id, user.role, 'UPDATE_MARKS', { count: insertedMarks.length, examId: marks[0]?.examId });

    return c.json({
      message: 'Marks saved successfully',
      count: insertedMarks.length,
      marks: insertedMarks
    }, 201);
  } catch (error) {
    console.error('Save marks error:', error);
    return c.json({ error: 'Failed to save marks' }, 500);
  }
});

export default r;
