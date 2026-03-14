import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';
import { logAction } from '../config/audit.js';
import express from 'express';

const router = express.Router();

// ===== SUBJECTS =====

// Get all subjects (optionally filter by class)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { classId } = req.query;

        let query = `
      SELECT s.*, c.class_name, c.section 
      FROM subjects s
      LEFT JOIN classes c ON s.class_id = c.id
    `;
        const params = [];

        if (classId) {
            query += ' WHERE s.class_id = $1';
            params.push(classId);

            if (req.user.role === 'TEACHER') {
                const courseCheck = await pool.query('SELECT teacher_id FROM classes WHERE id = $1', [classId]);
                if (courseCheck.rows.length === 0 || courseCheck.rows[0].teacher_id !== req.user.id) {
                    return res.status(403).json({ error: 'Access denied. You can only view subjects for your assigned courses.' });
                }
            }
        } else if (req.user.role === 'TEACHER') {
            query += ' WHERE c.teacher_id = $1';
            params.push(req.user.id);
        }

        query += ' ORDER BY c.class_name, c.section, s.subject_name';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get subjects error:', error);
        res.status(500).json({ error: 'Failed to fetch subjects' });
    }
});

// Create subject
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { subjectName, classId, maxMarks } = req.body;

        if (!subjectName || !classId) {
            return res.status(400).json({ error: 'Subject name and class ID are required' });
        }

        const result = await pool.query(
            'INSERT INTO subjects (subject_name, class_id, max_marks) VALUES ($1, $2, $3) RETURNING *',
            [subjectName, classId, maxMarks || 100]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Subject already exists for this class' });
        }
        console.error('Create subject error:', error);
        res.status(500).json({ error: 'Failed to create subject' });
    }
});

// Update subject
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { subjectName, maxMarks } = req.body;

        const result = await pool.query(
            'UPDATE subjects SET subject_name = $1, max_marks = $2 WHERE id = $3 RETURNING *',
            [subjectName, maxMarks, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subject not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update subject error:', error);
        res.status(500).json({ error: 'Failed to update subject' });
    }
});

// Delete subject
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM subjects WHERE id = $1', [id]);
        res.json({ message: 'Subject deleted successfully' });
    } catch (error) {
        console.error('Delete subject error:', error);
        res.status(500).json({ error: 'Failed to delete subject' });
    }
});

// ===== EXAMS =====

// Get all exams (optionally filter by class)
router.get('/exams', authenticateToken, async (req, res) => {
    try {
        const { classId } = req.query;

        let query = `
      SELECT e.*, c.class_name, c.section 
      FROM exams e
      LEFT JOIN classes c ON e.class_id = c.id
    `;
        const params = [];

        if (classId) {
            query += ' WHERE e.class_id = $1';
            params.push(classId);

            if (req.user.role === 'TEACHER') {
                const courseCheck = await pool.query('SELECT teacher_id FROM classes WHERE id = $1', [classId]);
                if (courseCheck.rows.length === 0 || courseCheck.rows[0].teacher_id !== req.user.id) {
                    return res.status(403).json({ error: 'Access denied. You can only view exams for your assigned courses.' });
                }
            }
        } else if (req.user.role === 'TEACHER') {
            query += ' WHERE c.teacher_id = $1';
            params.push(req.user.id);
        }

        query += ' ORDER BY e.exam_date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get exams error:', error);
        res.status(500).json({ error: 'Failed to fetch exams' });
    }
});

// Create exam
router.post('/exams', authenticateToken, async (req, res) => {
    try {
        const { examName, classId, examDate, academicYear, weightage } = req.body;

        if (!examName || !classId || !academicYear) {
            return res.status(400).json({ error: 'Exam name, class ID, and academic year are required' });
        }

        const currentWeightage = weightage || 100;

        // Validation: Total weightage for a course must be <= 100
        const totalWeightResult = await pool.query(
            'SELECT SUM(weightage) as total FROM exams WHERE class_id = $1',
            [classId]
        );
        const totalWeight = parseInt(totalWeightResult.rows[0].total || 0);

        if (totalWeight + currentWeightage > 100) {
            return res.status(400).json({
                error: `Total weightage for this course would exceed 100% (Current total: ${totalWeight}%)`
            });
        }

        const result = await pool.query(
            'INSERT INTO exams (exam_name, class_id, exam_date, academic_year, weightage) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [examName, classId, examDate, academicYear, currentWeightage]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({ error: 'Failed to create exam' });
    }
});

// Update exam
router.put('/exams/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { examName, examDate, academicYear, weightage } = req.body;

        if (weightage !== undefined) {
            // Get class_id and current weightage
            const examInfo = await pool.query('SELECT class_id, weightage FROM exams WHERE id = $1', [id]);
            if (examInfo.rows.length === 0) {
                return res.status(404).json({ error: 'Exam not found' });
            }
            const { class_id, weightage: oldWeightage } = examInfo.rows[0];

            // Validation: Total weightage for a course must be <= 100
            const totalWeightResult = await pool.query(
                'SELECT SUM(weightage) as total FROM exams WHERE class_id = $1 AND id != $2',
                [class_id, id]
            );
            const otherWeight = parseInt(totalWeightResult.rows[0].total || 0);

            if (otherWeight + weightage > 100) {
                return res.status(400).json({
                    error: `Total weightage for this course would exceed 100% (Current total excluding this: ${otherWeight}%)`
                });
            }
        }

        const result = await pool.query(
            'UPDATE exams SET exam_name = $1, exam_date = $2, academic_year = $3, weightage = COALESCE($5, weightage) WHERE id = $4 RETURNING *',
            [examName, examDate, academicYear, id, weightage]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update exam error:', error);
        res.status(500).json({ error: 'Failed to update exam' });
    }
});

// Delete exam
router.delete('/exams/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM exams WHERE id = $1', [id]);
        res.json({ message: 'Exam deleted successfully' });
    } catch (error) {
        console.error('Delete exam error:', error);
        res.status(500).json({ error: 'Failed to delete exam' });
    }
});

// ===== MARKS =====

// Get all marks for a class and exam
router.get('/marks', authenticateToken, async (req, res) => {
    try {
        const { classId, examId } = req.query;

        if (!classId || !examId) {
            return res.status(400).json({ error: 'Class ID and Exam ID are required' });
        }

        const result = await pool.query(
            `SELECT m.student_id, m.subject_id, m.marks_obtained
             FROM marks m
             JOIN students s ON m.student_id = s.id
             WHERE s.class_id = $1 AND m.exam_id = $2`,
            [classId, examId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get marks error:', error);
        res.status(500).json({ error: 'Failed to fetch marks' });
    }
});

// Get marks for a student in an exam
router.get('/marks/student/:studentId/exam/:examId', authenticateToken, async (req, res) => {
    try {
        const { studentId, examId } = req.params;

        const result = await pool.query(
            `SELECT m.*, s.subject_name, s.max_marks
       FROM marks m
       JOIN subjects s ON m.subject_id = s.id
       WHERE m.student_id = $1 AND m.exam_id = $2
       ORDER BY s.subject_name`,
            [studentId, examId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get marks error:', error);
        res.status(500).json({ error: 'Failed to fetch marks' });
    }
});

// Enter/update marks (bulk)
router.post('/marks', authenticateToken, async (req, res) => {
    try {
        const { marks } = req.body; // Array of { studentId, subjectId, examId, marksObtained }

        if (!marks || !Array.isArray(marks)) {
            return res.status(400).json({ error: 'Marks array is required' });
        }

        // Verify teacher's access if not admin
        if (req.user.role === 'TEACHER') {
            const firstMark = marks[0];
            if (firstMark) {
                const courseResult = await pool.query(
                    'SELECT teacher_id FROM classes WHERE id = (SELECT class_id FROM exams WHERE id = $1)',
                    [firstMark.examId]
                );
                if (courseResult.rows.length === 0 || courseResult.rows[0].teacher_id !== req.user.id) {
                    return res.status(403).json({ error: 'Access denied. You can only update marks for your assigned courses.' });
                }
            }
        }

        const insertedMarks = [];

        for (const mark of marks) {
            const { studentId, subjectId, examId, marksObtained } = mark;

            // Validate marks against max marks
            const subjectResult = await pool.query(
                'SELECT max_marks FROM subjects WHERE id = $1',
                [subjectId]
            );

            if (subjectResult.rows.length === 0) {
                continue; // Skip if subject not found
            }

            const maxMarks = subjectResult.rows[0].max_marks;
            if (marksObtained > maxMarks) {
                return res.status(400).json({
                    error: `Marks obtained (${marksObtained}) cannot exceed max marks (${maxMarks})`
                });
            }

            // Upsert marks
            const result = await pool.query(
                `INSERT INTO marks (student_id, subject_id, exam_id, marks_obtained)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, subject_id, exam_id)
         DO UPDATE SET marks_obtained = $4
         RETURNING *`,
                [studentId, subjectId, examId, marksObtained]
            );

            insertedMarks.push(result.rows[0]);
        }

        await logAction(req.user.id, req.user.role, 'UPDATE_MARKS', { count: insertedMarks.length, examId: marks[0]?.examId });

        res.status(201).json({
            message: 'Marks saved successfully',
            count: insertedMarks.length,
            marks: insertedMarks
        });
    } catch (error) {
        console.error('Save marks error:', error);
        res.status(500).json({ error: 'Failed to save marks' });
    }
});

export default router;
