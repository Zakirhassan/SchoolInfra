import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';
import { logAction } from '../config/audit.js';
import express from 'express';

const router = express.Router();

// Get all classes
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT c.*, t.full_name as teacher_name 
            FROM classes c
            LEFT JOIN teachers t ON c.teacher_id = t.id
        `;
        const params = [];

        if (req.user.role === 'TEACHER') {
            query += ' WHERE c.teacher_id = $1';
            params.push(req.user.id);
        }

        query += ' ORDER BY c.class_name, c.section';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ error: 'Failed to fetch classes' });
    }
});

// Get class by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM classes WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

        const course = result.rows[0];

        // RBAC check for Teachers
        if (req.user.role === 'TEACHER' && course.teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied. You can only view your assigned course.' });
        }

        res.json(course);
    } catch (error) {
        console.error('Get class error:', error);
        res.status(500).json({ error: 'Failed to fetch class' });
    }
});

// Create new class
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { className, section, monthlyFee, duration, startDate, tentativeEndDate, teacherId } = req.body;

        if (!className || !section) {
            return res.status(400).json({ error: 'Class name and section are required' });
        }

        const result = await pool.query(
            'INSERT INTO classes (class_name, section, monthly_fee, duration, start_date, tentative_end_date, teacher_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [className, section, monthlyFee || 0, duration, startDate, tentativeEndDate, teacherId || null]
        );

        await logAction(req.user.id, req.user.role, 'CREATE_COURSE', { className, section });

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Class with this name and section already exists' });
        }
        console.error('Create class error:', error);
        res.status(500).json({ error: 'Failed to create class' });
    }
});

// Update class
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { className, section, monthlyFee, duration, startDate, tentativeEndDate, teacherId } = req.body;

        const result = await pool.query(
            'UPDATE classes SET class_name = $1, section = $2, monthly_fee = $3, duration = $4, start_date = $5, tentative_end_date = $6, teacher_id = $7 WHERE id = $8 RETURNING *',
            [className, section, monthlyFee, duration, startDate, tentativeEndDate, teacherId || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

        await logAction(req.user.id, req.user.role, 'UPDATE_COURSE', { id, className, section });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update class error:', error);
        res.status(500).json({ error: 'Failed to update class' });
    }
});

// Delete class
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM classes WHERE id = $1 RETURNING class_name, section', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

        await logAction(req.user.id, req.user.role, 'DELETE_COURSE', { id, name: result.rows[0].class_name });

        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({ error: 'Failed to delete class' });
    }
});

export default router;
