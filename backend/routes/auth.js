import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { generateToken } from '../config/auth.js';

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find admin by username
        const result = await pool.query(
            'SELECT * FROM admins WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const admin = result.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, admin.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = generateToken({
            id: admin.id,
            username: admin.username,
            role: 'ADMIN'
        });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: admin.id,
                username: admin.username,
                fullName: admin.full_name
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Change password (requires authentication)
router.post('/change-password', async (req, res) => {
    try {
        const { username, oldPassword, newPassword } = req.body;

        if (!username || !oldPassword || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Find admin
        const result = await pool.query(
            'SELECT * FROM admins WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const admin = result.rows[0];

        // Verify old password
        const isValidPassword = await bcrypt.compare(oldPassword, admin.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid old password' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        // Update password
        await pool.query(
            'UPDATE admins SET password_hash = $1 WHERE id = $2',
            [newPasswordHash, admin.id]
        );

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

export default router;
