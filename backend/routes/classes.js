import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';

const router = express.Router();

// Get all classes
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM classes ORDER BY class_name, section'
        );
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

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get class error:', error);
        res.status(500).json({ error: 'Failed to fetch class' });
    }
});

// Create new class
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { className, section, monthlyFee } = req.body;

        if (!className || !section) {
            return res.status(400).json({ error: 'Class name and section are required' });
        }

        const result = await pool.query(
            'INSERT INTO classes (class_name, section, monthly_fee) VALUES ($1, $2, $3) RETURNING *',
            [className, section, monthlyFee || 0]
        );

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
        const { className, section, monthlyFee } = req.body;

        const result = await pool.query(
            'UPDATE classes SET class_name = $1, section = $2, monthly_fee = $3 WHERE id = $4 RETURNING *',
            [className, section, monthlyFee, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

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
        const result = await pool.query('DELETE FROM classes WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({ error: 'Failed to delete class' });
    }
});

export default router;
