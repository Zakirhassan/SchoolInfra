import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';
import { uploadExcel } from '../middleware/upload.js';
import XLSX from 'xlsx';
import { logAction } from '../config/audit.js';

const router = express.Router();

// Upload attendance Excel
router.post('/upload', authenticateToken, uploadExcel.single('file'), async (req, res) => {
    try {
        const { courseId, date } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'Excel file is required' });
        }

        // Check course start date
        const courseCheck = await pool.query('SELECT start_date, teacher_id FROM classes WHERE id = $1', [courseId]);
        if (courseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const { start_date, teacher_id } = courseCheck.rows[0];

        // RBAC check
        if (req.user.role === 'TEACHER' && teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied. You can only manage attendance for your assigned courses.' });
        }

        if (start_date && new Date(date) < new Date(start_date)) {
            return res.status(400).json({ error: `Cannot record attendance before course start date (${new Date(start_date).toLocaleDateString()})` });
        }

        // Parse Excel
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ error: 'Excel file is empty' });
        }

        // Expected columns: "Admission Number", "Status" (Present/Absent)
        // We need to map admission numbers to student IDs
        const client = await pool.connect();
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

            await logAction(req.user.id, req.user.role, 'UPLOAD_ATTENDANCE', { courseId, date, count: successCount });

            res.json({ message: `Successfully uploaded attendance for ${successCount} students`, count: successCount });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Attendance upload error:', error);
        res.status(500).json({ error: 'Failed to upload attendance' });
    }
});

// Get attendance stats for a course
router.get('/stats/:courseId', authenticateToken, async (req, res) => {
    try {
        const { courseId } = req.params;

        if (req.user.role === 'TEACHER') {
            const courseCheck = await pool.query('SELECT teacher_id FROM classes WHERE id = $1', [courseId]);
            if (courseCheck.rows.length === 0 || courseCheck.rows[0].teacher_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied. You can only view stats for your assigned courses.' });
            }
        }

        const result = await pool.query(
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
        res.json(result.rows);
    } catch (error) {
        console.error('Get attendance stats error:', error);
        res.status(500).json({ error: 'Failed to fetch attendance stats' });
    }
});

// Get attendance percentage for a single student
router.get('/student/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;
        const result = await pool.query(
            `SELECT
COUNT(id) as total_days,
    COUNT(CASE WHEN status = 'Present' THEN 1 END) as present_days,
    ROUND((COUNT(CASE WHEN status = 'Present' THEN 1 END):: numeric / NULLIF(COUNT(id), 0)) * 100, 2) as percentage
             FROM attendance
             WHERE student_id = $1`,
            [studentId]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get student attendance error:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

export default router;
