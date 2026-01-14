import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';
import { uploadPhoto, uploadExcel } from '../middleware/upload.js';
import { parseStudentExcel, generateSampleTemplate } from '../services/excelParser.js';

const router = express.Router();

// Get all students with filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { classId, section, feeStatus, search } = req.query;

        let query = `
      SELECT s.*, c.class_name, c.section 
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

        if (search) {
            query += ` AND (s.full_name ILIKE $${paramCount} OR s.admission_number ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ' ORDER BY s.created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// Get student by ID
router.get('/:id', authenticateToken, async (req, res) => {
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

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get student error:', error);
        res.status(500).json({ error: 'Failed to fetch student' });
    }
});

// Create new student
router.post('/', authenticateToken, uploadPhoto.single('photo'), async (req, res) => {
    try {
        const {
            admissionNumber, rollNumber, fullName, fatherName, motherName,
            dateOfBirth, gender, classId, address, phoneNumber, feeStatus
        } = req.body;

        // Validate required fields
        if (!admissionNumber || !fullName || !fatherName || !motherName ||
            !dateOfBirth || !gender || !classId || !address || !phoneNumber) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }

        const photoUrl = req.file ? `/uploads/photos/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO students (
        admission_number, roll_number, full_name, father_name, mother_name,
        date_of_birth, gender, class_id, address, phone_number, photo_url, fee_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [admissionNumber, rollNumber, fullName, fatherName, motherName,
                dateOfBirth, gender, classId, address, phoneNumber, photoUrl, feeStatus || 'Unpaid']
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Student with this admission number already exists' });
        }
        console.error('Create student error:', error);
        res.status(500).json({ error: 'Failed to create student' });
    }
});

// Update student
router.put('/:id', authenticateToken, uploadPhoto.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            admissionNumber, rollNumber, fullName, fatherName, motherName,
            dateOfBirth, gender, classId, address, phoneNumber, feeStatus
        } = req.body;

        let photoUrl = req.body.photoUrl; // Keep existing photo if not uploading new one
        if (req.file) {
            photoUrl = `/uploads/photos/${req.file.filename}`;
        }

        const result = await pool.query(
            `UPDATE students SET 
        admission_number = $1, roll_number = $2, full_name = $3, father_name = $4,
        mother_name = $5, date_of_birth = $6, gender = $7, class_id = $8,
        address = $9, phone_number = $10, photo_url = $11, fee_status = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13 RETURNING *`,
            [admissionNumber, rollNumber, fullName, fatherName, motherName,
                dateOfBirth, gender, classId, address, phoneNumber, photoUrl, feeStatus, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ error: 'Failed to update student' });
    }
});

// Delete student
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ error: 'Failed to delete student' });
    }
});

// Bulk upload students from Excel
router.post('/bulk-upload', authenticateToken, uploadExcel.single('file'), async (req, res) => {
    try {
        const { classId } = req.body;

        if (!classId) {
            return res.status(400).json({ error: 'Class ID is required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Excel file is required' });
        }

        // Parse Excel file
        const parseResult = parseStudentExcel(req.file.path, classId);

        if (!parseResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: parseResult.errors
            });
        }

        // Check for duplicate admission numbers in database
        const admissionNumbers = parseResult.data.map(s => s.admission_number);
        const duplicateCheck = await pool.query(
            'SELECT admission_number FROM students WHERE admission_number = ANY($1)',
            [admissionNumbers]
        );

        if (duplicateCheck.rows.length > 0) {
            const duplicates = duplicateCheck.rows.map(r => r.admission_number);
            return res.status(409).json({
                error: 'Duplicate admission numbers found in database',
                duplicates
            });
        }

        // Insert all students
        const insertedStudents = [];
        for (const student of parseResult.data) {
            const result = await pool.query(
                `INSERT INTO students (
          admission_number, roll_number, full_name, father_name, mother_name,
          date_of_birth, gender, class_id, address, phone_number, fee_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                [
                    student.admission_number, student.roll_number, student.full_name,
                    student.father_name, student.mother_name, student.date_of_birth,
                    student.gender, student.class_id, student.address, student.phone_number,
                    student.fee_status
                ]
            );
            insertedStudents.push(result.rows[0]);
        }

        res.status(201).json({
            message: `Successfully uploaded ${insertedStudents.length} students`,
            count: insertedStudents.length,
            students: insertedStudents
        });
    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({ error: 'Failed to upload students' });
    }
});

// Download sample Excel template
router.get('/template/download', (req, res) => {
    try {
        const buffer = generateSampleTemplate();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=student_upload_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template download error:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Download update template with existing student data
router.get('/update-template/:classId', authenticateToken, async (req, res) => {
    try {
        const { classId } = req.params;

        // Fetch all students for the class
        const result = await pool.query(
            `SELECT * FROM students WHERE class_id = $1 ORDER BY roll_number`,
            [classId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'No students found for this class',
                message: 'Please add students to this class first before downloading the update template.'
            });
        }

        const { generateUpdateTemplate } = await import('../services/bulkUpdateValidator.js');
        const buffer = generateUpdateTemplate(result.rows);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=student_update_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Update template download error:', error);
        res.status(500).json({ error: 'Failed to generate update template' });
    }
});

// Bulk update students from Excel
router.post('/bulk-update', authenticateToken, uploadExcel.single('file'), async (req, res) => {
    try {
        const { classId } = req.body;

        if (!classId) {
            return res.status(400).json({ error: 'Class ID is required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Excel file is required' });
        }

        // Parse Excel file
        const XLSX = (await import('xlsx')).default;
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ error: 'Excel file is empty' });
        }

        // Convert Excel column names to database field names
        const students = data.map(row => ({
            student_id: row['Student ID'],
            admission_number: row['Admission Number'],
            roll_number: row['Roll Number'],
            full_name: row['Full Name'],
            father_name: row['Father Name'],
            mother_name: row['Mother Name'],
            date_of_birth: row['Date of Birth'],
            gender: row['Gender'],
            contact_number: row['Contact Number'],
            email: row['Email'] || null,
            address: row['Address'],
            blood_group: row['Blood Group'] || null,
            previous_school: row['Previous School'] || null,
            admission_date: row['Admission Date'] || null
        }));

        // Validate all students
        const { validateBulkUpdate } = await import('../services/bulkUpdateValidator.js');
        const validationResult = await validateBulkUpdate(students, classId);

        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validationResult.errors
            });
        }

        // Update all students in a transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let updatedCount = 0;
            for (const student of students) {
                const result = await client.query(
                    `UPDATE students SET 
                        admission_number = $1,
                        roll_number = $2,
                        full_name = $3,
                        father_name = $4,
                        mother_name = $5,
                        date_of_birth = $6,
                        gender = $7,
                        phone_number = $8,
                        email = $9,
                        address = $10,
                        blood_group = $11,
                        previous_school = $12,
                        admission_date = $13,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $14`,
                    [
                        student.admission_number,
                        student.roll_number,
                        student.full_name,
                        student.father_name,
                        student.mother_name,
                        student.date_of_birth,
                        student.gender,
                        student.contact_number,
                        student.email,
                        student.address,
                        student.blood_group,
                        student.previous_school,
                        student.admission_date,
                        student.student_id
                    ]
                );
                updatedCount += result.rowCount;
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: `Successfully updated ${updatedCount} students`,
                updated: updatedCount
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({ error: 'Failed to update students' });
    }
});

export default router;
