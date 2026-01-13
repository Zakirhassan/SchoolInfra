import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';
import { generateReportCard } from '../services/pdfGenerator.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const schoolInfo = {
    name: process.env.SCHOOL_NAME || 'ABC School',
    address: process.env.SCHOOL_ADDRESS || '123 Main Street',
    phone: process.env.SCHOOL_PHONE || '+1234567890',
    academicYear: process.env.CURRENT_ACADEMIC_YEAR || '2025-2026'
};

// Generate report card for a student
router.get('/student/:studentId/exam/:examId', authenticateToken, async (req, res) => {
    try {
        const { studentId, examId } = req.params;

        // Get student details
        const studentResult = await pool.query(
            `SELECT s.*, c.class_name, c.section 
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.id = $1`,
            [studentId]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const student = studentResult.rows[0];

        // Get exam details
        const examResult = await pool.query(
            'SELECT * FROM exams WHERE id = $1',
            [examId]
        );

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

        const pdfBuffer = await generateReportCard(student, marksResult.rows, exam, schoolInfo);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report_card_${student.admission_number}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Generate report card error:', error);
        res.status(500).json({ error: 'Failed to generate report card' });
    }
});

// Generate bulk report cards for a class
router.post('/bulk', authenticateToken, async (req, res) => {
    try {
        const { classId, examId } = req.body;

        if (!classId || !examId) {
            return res.status(400).json({ error: 'Class ID and Exam ID are required' });
        }

        // Get all students in the class
        const studentsResult = await pool.query(
            `SELECT s.*, c.class_name, c.section 
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.class_id = $1
       ORDER BY s.roll_number`,
            [classId]
        );

        if (studentsResult.rows.length === 0) {
            return res.status(404).json({ error: 'No students found in this class' });
        }

        // Get exam details
        const examResult = await pool.query('SELECT * FROM exams WHERE id = $1', [examId]);
        if (examResult.rows.length === 0) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        const exam = examResult.rows[0];

        // For bulk generation, we'll create a merged PDF
        // For simplicity, we'll return an error suggesting individual downloads
        // In production, you'd merge multiple PDFs or create a zip file

        res.status(501).json({
            error: 'Bulk report card generation not yet implemented',
            message: 'Please generate report cards individually for each student'
        });
    } catch (error) {
        console.error('Generate bulk report cards error:', error);
        res.status(500).json({ error: 'Failed to generate report cards' });
    }
});

export default router;
