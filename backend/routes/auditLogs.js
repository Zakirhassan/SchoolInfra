import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';

const router = express.Router();

// Get audit logs (Admin only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied. Admins only.' });
        }

        const result = await pool.query(`
            SELECT a.*, 
                   COALESCE(adm.full_name, t.full_name, 'System') as performer_name
            FROM audit_logs a
            LEFT JOIN admins adm ON a.user_id = adm.id AND a.user_role = 'ADMIN'
            LEFT JOIN teachers t ON a.user_id = t.id AND a.user_role = 'TEACHER'
            ORDER BY a.timestamp DESC
            LIMIT 100
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

export default router;
