import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';
import { generateIDCard, generateBulkIDCards } from '../services/pdfGenerator.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const schoolInfo = {
    name: process.env.SCHOOL_NAME || 'ABC School',
    address: process.env.SCHOOL_ADDRESS || '123 Main Street',
    phone: process.env.SCHOOL_PHONE || '+1234567890',
    academicYear: process.env.CURRENT_ACADEMIC_YEAR || '2025-2026'
};

// Generate single student ID card
router.get('/student/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT s.*, c.class_name, c.section 
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const student = result.rows[0];
        const pdfBuffer = await generateIDCard(student, schoolInfo);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=id_card_${student.admission_number}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Generate ID card error:', error);
        res.status(500).json({ error: 'Failed to generate ID card' });
    }
});

// Generate bulk ID cards
router.post('/bulk', authenticateToken, async (req, res) => {
    try {
        const { classId, studentIds } = req.body;

        let query = `
      SELECT s.*, c.class_name, c.section 
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE 1=1
    `;
        const params = [];

        if (studentIds && studentIds.length > 0) {
            query += ' AND s.id = ANY($1)';
            params.push(studentIds);
        } else if (classId) {
            query += ' AND s.class_id = $1';
            params.push(classId);
        } else {
            return res.status(400).json({ error: 'Either classId or studentIds must be provided' });
        }

        query += ' ORDER BY c.class_name, c.section, s.roll_number';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No students found' });
        }

        const pdfBuffer = await generateBulkIDCards(result.rows, schoolInfo);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=id_cards_bulk.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Generate bulk ID cards error:', error);
        res.status(500).json({ error: 'Failed to generate ID cards' });
    }
});

export default router;
