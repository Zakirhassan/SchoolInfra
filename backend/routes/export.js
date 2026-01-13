import express from 'express';
import XLSX from 'xlsx';
import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';

const router = express.Router();

// Export students to Excel
router.post('/students', authenticateToken, async (req, res) => {
    try {
        const { classId, section, feeStatus, gender } = req.body;

        let query = `
      SELECT 
        s.admission_number,
        s.roll_number,
        s.full_name,
        s.father_name,
        s.mother_name,
        s.date_of_birth,
        s.gender,
        c.class_name,
        c.section,
        s.address,
        s.phone_number,
        s.fee_status
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE 1=1
    `;
        const params = [];
        let paramCount = 1;

        if (classId) {
            query += ` AND s.class_id = $${paramCount}`;
            params.push(classId);
            paramCount++;
        }

        if (feeStatus) {
            query += ` AND s.fee_status = $${paramCount}`;
            params.push(feeStatus);
            paramCount++;
        }

        if (gender) {
            query += ` AND s.gender = $${paramCount}`;
            params.push(gender);
            paramCount++;
        }

        query += ' ORDER BY c.class_name, c.section, s.roll_number';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No students found matching the criteria' });
        }

        // Format data for Excel
        const excelData = result.rows.map(student => ({
            'Admission Number': student.admission_number,
            'Roll Number': student.roll_number,
            'Full Name': student.full_name,
            'Father Name': student.father_name,
            'Mother Name': student.mother_name,
            'Date of Birth': student.date_of_birth,
            'Gender': student.gender,
            'Class': student.class_name,
            'Section': student.section,
            'Address': student.address,
            'Phone Number': student.phone_number,
            'Fee Status': student.fee_status
        }));

        // Create workbook
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set headers and send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=students_export.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Export students error:', error);
        res.status(500).json({ error: 'Failed to export students' });
    }
});

export default router;
