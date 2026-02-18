import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';
import { uploadPhoto } from '../middleware/upload.js';
import { logAction } from '../config/audit.js';

const router = express.Router();

// Get all teachers
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, full_name, email, photo_url, created_at FROM teachers ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Get teachers error:', error);
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
});

// Create teacher
router.post('/', authenticateToken, uploadPhoto.single('photo'), async (req, res) => {
    try {
        const { username, password, fullName, email } = req.body;

        if (!username || !password || !fullName || !email) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const photoUrl = req.file ? `/uploads/photos/${req.file.filename}` : null;

        const result = await pool.query(
            'INSERT INTO teachers (username, password_hash, full_name, email, photo_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, email, photo_url',
            [username, passwordHash, fullName, email, photoUrl]
        );

        await logAction(req.user.id, req.user.role, 'CREATE_TEACHER', { username, fullName });

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Username or email already exists' });
        }
        console.error('Create teacher error:', error);
        res.status(500).json({ error: 'Failed to create teacher' });
    }
});

// Update teacher
router.put('/:id', authenticateToken, uploadPhoto.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, email, password } = req.body;

        let query = 'UPDATE teachers SET full_name = $1, email = $2';
        let params = [fullName, email, id];
        let paramCount = 4;

        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            query += `, password_hash = $${paramCount}`;
            params.push(passwordHash);
            paramCount++;
        }

        if (req.file) {
            const photoUrl = `/uploads/photos/${req.file.filename}`;
            query += `, photo_url = $${paramCount}`;
            params.push(photoUrl);
            paramCount++;
        }

        query += ' WHERE id = $3 RETURNING id, username, full_name, email, photo_url';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }

        await logAction(req.user.id, req.user.role, 'UPDATE_TEACHER', { id, fullName });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update teacher error:', error);
        res.status(500).json({ error: 'Failed to update teacher' });
    }
});

// Delete teacher
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM teachers WHERE id = $1 RETURNING username', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }

        await logAction(req.user.id, req.user.role, 'DELETE_TEACHER', { id, username: result.rows[0].username });

        res.json({ message: 'Teacher deleted successfully' });
    } catch (error) {
        console.error('Delete teacher error:', error);
        res.status(500).json({ error: 'Failed to delete teacher' });
    }
});

export default router;
