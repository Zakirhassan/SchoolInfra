import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';
import { generateReportCard } from '../services/pdfGenerator.js';
import { logAction } from '../config/audit.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const schoolInfo = {
    name: process.env.SCHOOL_NAME || 'ASDC - Advance Skill Development Center',
    address: process.env.SCHOOL_ADDRESS || 'Kanpur',
    phone: process.env.SCHOOL_PHONE || '+1234567890',
    academicYear: process.env.CURRENT_ACADEMIC_YEAR || '2025-2026'
};

// Generate certificate for a student
router.get('/student/:studentId/exam/:examId', authenticateToken, async (req, res) => {
    try {
        const { studentId, examId } = req.params;
        const userRole = req.user.role;

        // Get student details
        const studentResult = await pool.query(
            `SELECT s.*, c.class_name as course_name, c.section, c.start_date, c.tentative_end_date
             FROM students s
             LEFT JOIN classes c ON s.class_id = c.id
             WHERE s.id = $1`,
            [studentId]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const student = studentResult.rows[0];

        // Security Check: If Student role, they can only see their own certificate and only if published
        if (userRole === 'STUDENT') {
            if (parseInt(studentId) !== req.user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (!student.is_published) {
                return res.status(403).json({ error: 'Certificate not yet published by Admin' });
            }
        }

        // Security Check: If Teacher role, they can only see certificates for students in their assigned courses
        if (userRole === 'TEACHER') {
            const courseCheck = await pool.query('SELECT teacher_id FROM classes WHERE id = $1', [student.class_id]);
            if (courseCheck.rows.length === 0 || courseCheck.rows[0].teacher_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied. You can only view certificates for your assigned courses.' });
            }
        }

        // Get exam (Exam/Assessment) details
        const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [examId]);
        if (examResult.rows.length === 0) {
            return res.status(404).json({ error: 'Exam not found' });
        }
        const exam = examResult.rows[0];

        // Get marks
        const marksResult = await pool.query(
            `SELECT m.*, s.subject_name, s.max_marks
             FROM marks m
             JOIN subjects s ON m.subject_id = s.id
             WHERE m.student_id = $1 AND m.exam_id = $2
             ORDER BY s.subject_name`,
            [studentId, examId]
        );

        if (marksResult.rows.length === 0) {
            return res.status(404).json({ error: 'No marks found for this student and exam' });
        }

        // Update PDF generation call (PDF Generator might need rebranding too)
        const pdfBuffer = await generateReportCard(student, marksResult.rows, exam, schoolInfo);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=ASDC_Certificate_${student.admission_number}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Generate certificate error:', error);
        res.status(500).json({ error: 'Failed to generate certificate' });
    }
});

// Publish/Unpublish student results
router.post('/publish', authenticateToken, async (req, res) => {
    try {
        const { studentId, isPublished } = req.body;
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Only admins can publish results' });
        }

        await pool.query(
            'UPDATE students SET is_published = $1 WHERE id = $2',
            [isPublished, studentId]
        );

        await logAction(req.user.id, req.user.role, isPublished ? 'PUBLISH_CERTIFICATE' : 'HIDE_CERTIFICATE', { studentId });

        res.json({ message: `Results ${isPublished ? 'published' : 'unpublished'} successfully` });
    } catch (error) {
        console.error('Publish results error:', error);
        res.status(500).json({ error: 'Failed to update publication status' });
    }
});

// Publish results for entire class/course
router.post('/publish/course', authenticateToken, async (req, res) => {
    try {
        const { courseId, isPublished } = req.body;
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Only admins can publish results' });
        }

        await pool.query(
            'UPDATE students SET is_published = $1 WHERE class_id = $2',
            [isPublished, courseId]
        );

        await logAction(req.user.id, req.user.role, isPublished ? 'PUBLISH_COURSE_CERTIFICATES' : 'HIDE_COURSE_CERTIFICATES', { courseId });

        res.json({ message: `Course results ${isPublished ? 'published' : 'unpublished'} successfully` });
    } catch (error) {
        console.error('Publish course results error:', error);
        res.status(500).json({ error: 'Failed to update publication status' });
    }
});

export default router;
