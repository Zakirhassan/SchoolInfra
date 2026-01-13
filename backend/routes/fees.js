import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';

const router = express.Router();

// Get fee history for a student
router.get('/student/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;

        const result = await pool.query(
            `SELECT * FROM fee_payments 
       WHERE student_id = $1 
       ORDER BY payment_date DESC`,
            [studentId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get fee history error:', error);
        res.status(500).json({ error: 'Failed to fetch fee history' });
    }
});

// Record fee payment
router.post('/payment', authenticateToken, async (req, res) => {
    try {
        const { studentId, amount, paymentDate, paymentMonth, paymentYear, remarks } = req.body;

        if (!studentId || !amount || !paymentDate || !paymentMonth || !paymentYear) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }

        // Insert payment record
        const result = await pool.query(
            `INSERT INTO fee_payments (student_id, amount, payment_date, payment_month, payment_year, remarks)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [studentId, amount, paymentDate, paymentMonth, paymentYear, remarks]
        );

        // Update student fee status
        // This is a simple logic - you can make it more sophisticated
        await pool.query(
            `UPDATE students SET fee_status = 'Paid' WHERE id = $1`,
            [studentId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Record payment error:', error);
        res.status(500).json({ error: 'Failed to record payment' });
    }
});

// Update fee status
router.put('/status/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;
        const { feeStatus } = req.body;

        if (!['Paid', 'Unpaid', 'Partial'].includes(feeStatus)) {
            return res.status(400).json({ error: 'Invalid fee status' });
        }

        const result = await pool.query(
            'UPDATE students SET fee_status = $1 WHERE id = $2 RETURNING *',
            [feeStatus, studentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update fee status error:', error);
        res.status(500).json({ error: 'Failed to update fee status' });
    }
});

// Get fee summary for a class
router.get('/summary/class/:classId', authenticateToken, async (req, res) => {
    try {
        const { classId } = req.params;

        const result = await pool.query(
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

        res.json(result.rows);
    } catch (error) {
        console.error('Get fee summary error:', error);
        res.status(500).json({ error: 'Failed to fetch fee summary' });
    }
});

export default router;
