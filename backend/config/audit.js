import pool from './database.js';

/**
 * Logs an action to the audit_logs table
 * @param {number} userId - ID of the user performing the action
 * @param {string} userRole - Role of the user (ADMIN, TEACHER)
 * @param {string} action - Action description (e.g., 'CREATE_STUDENT')
 * @param {object|string} details - Additional details about the action
 */
export const logAction = async (userId, userRole, action, details) => {
    try {
        const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;
        await pool.query(
            'INSERT INTO audit_logs (user_id, user_role, action, details) VALUES ($1, $2, $3, $4)',
            [userId, userRole, action, detailsStr]
        );
    } catch (error) {
        console.error('Failed to log audit action:', error);
        // We don't throw here to avoid failing the main request if logging fails
    }
};
