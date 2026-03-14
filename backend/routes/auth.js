import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { generateToken } from '../config/auth.js';

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password, role } = req.body; // role is optional, can be inferred but let's try to handle all

        if (!username || !password) {
            return res.status(400).json({ error: 'Username/Email and password are required' });
        }

        let user = null;
        let userRole = null;

        // 1. Try Admin (username)
        const adminResult = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (adminResult.rows.length > 0) {
            user = adminResult.rows[0];
            userRole = 'ADMIN';
        }

        // 2. Try Teacher if not Admin
        if (!user) {
            const teacherResult = await pool.query('SELECT * FROM teachers WHERE username = $1 OR email = $1', [username]);
            if (teacherResult.rows.length > 0) {
                user = teacherResult.rows[0];
                userRole = 'TEACHER';
            }
        }

        // 3. Try Student if not Admin or Teacher
        if (!user) {
            const studentResult = await pool.query('SELECT * FROM students WHERE email = $1', [username]);
            if (studentResult.rows.length > 0) {
                user = studentResult.rows[0];
                userRole = 'STUDENT';
                // Block alumni students from logging in
                if (user.status === 'ALUMNI') {
                    return res.status(403).json({ error: 'Alumni accounts cannot log in to the student portal. Please contact the administrator.' });
                }
            }
        }

        if (!user || !user.password_hash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = generateToken({
            id: user.id,
            username: user.username || user.email,
            role: userRole
        });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username || user.email,
                fullName: user.full_name,
                role: userRole
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
