import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../config/auth.js';
import { uploadPhoto, uploadExcel, uploadDocument } from '../middleware/upload.js';
import { parseStudentExcel, generateSampleTemplate } from '../services/excelParser.js';
import { logAction } from '../config/audit.js';

const router = express.Router();

// Get all students with filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { classId, section, feeStatus, search, enrollmentStatus } = req.query;

        let query = `
      SELECT s.*, c.class_name, c.section 
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE 1=1
    `;
        const params = [];
        let paramCount = 1;

        if (req.user.role === 'TEACHER') {
            query += ` AND c.teacher_id = $${paramCount}`;
            params.push(req.user.id);
            paramCount++;
        }

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

        if (enrollmentStatus) {
            query += ` AND s.enrollment_status = $${paramCount}`;
            params.push(enrollmentStatus);
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

        const student = result.rows[0];

        // RBAC check for Teachers
        if (req.user.role === 'TEACHER') {
            const courseCheck = await pool.query('SELECT teacher_id FROM classes WHERE id = $1', [student.class_id]);
            if (courseCheck.rows.length === 0 || courseCheck.rows[0].teacher_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied. You can only view your own students.' });
            }
        }

        res.json(student);
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
            dateOfBirth, gender, classId, address, phoneNumber, feeStatus,
            email, password, enrollmentStatus
        } = req.body;

        // Validate required fields
        if (!admissionNumber || !fullName || !fatherName || !motherName ||
            !dateOfBirth || !gender || !classId || !address || !phoneNumber) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }

        const photoUrl = req.file ? `/uploads/photos/${req.file.filename}` : null;

        // Hash password if provided
        let passwordHash = null;
        if (password) {
            const salt = await (await import('bcryptjs')).default.genSalt(10);
            passwordHash = await (await import('bcryptjs')).default.hash(password, salt);
        }

        const result = await pool.query(
            `INSERT INTO students (
                admission_number, roll_number, full_name, father_name, mother_name,
                date_of_birth, gender, class_id, address, phone_number, photo_url, fee_status,
                email, password_hash, enrollment_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
            [admissionNumber, rollNumber, fullName, fatherName, motherName,
                dateOfBirth, gender, classId, address, phoneNumber, photoUrl, feeStatus || 'Unpaid',
                email, passwordHash, enrollmentStatus || 'ENTRANCE_EXAM']
        );

        await logAction(req.user.id, req.user.role, 'CREATE_STUDENT', { id: result.rows[0].id, name: fullName, status: result.rows[0].enrollment_status });

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Student with this admission number or email already exists' });
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
            dateOfBirth, gender, classId, address, phoneNumber, feeStatus,
            email, password, enrollmentStatus
        } = req.body;

        let photoUrl = req.body.photoUrl; // Keep existing photo if not uploading new one
        if (req.file) {
            photoUrl = `/uploads/photos/${req.file.filename}`;
        }

        // Handle password update if provided
        const queryParams = [
            admissionNumber, rollNumber, fullName, fatherName, motherName,
            dateOfBirth, gender, classId, address, phoneNumber, photoUrl, feeStatus, email, enrollmentStatus, id
        ];

        let query = `UPDATE students SET
admission_number = $1, roll_number = $2, full_name = $3, father_name = $4,
    mother_name = $5, date_of_birth = $6, gender = $7, class_id = $8,
    address = $9, phone_number = $10, photo_url = $11, fee_status = $12,
    email = $13, enrollment_status = $14, updated_at = CURRENT_TIMESTAMP`;

        if (password) {
            const salt = await (await import('bcryptjs')).default.genSalt(10);
            const hashedPassword = await (await import('bcryptjs')).default.hash(password, salt);
            query += `, password_hash = $${queryParams.length + 1} `;
            queryParams.push(hashedPassword);
        }

        query += ` WHERE id = $15 RETURNING *`;

        const result = await pool.query(query, queryParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        await logAction(req.user.id, req.user.role, 'UPDATE_STUDENT', { id, name: fullName });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ error: 'Failed to update student' });
    }
});

// Update student enrollment status
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['ENTRANCE_EXAM', 'ACTIVE', 'ALUMNI'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const result = await pool.query(
            'UPDATE students SET enrollment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        await logAction(req.user.id, req.user.role, 'UPDATE_STUDENT_STATUS', { id, status });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Bulk update status to ALUMNI for a course
router.patch('/bulk-status/course/:classId', authenticateToken, async (req, res) => {
    try {
        const { classId } = req.params;
        const { status } = req.body;

        if (status !== 'ALUMNI') {
            return res.status(400).json({ error: 'Only bulk ALUMNI update is supported via this route' });
        }

        const result = await pool.query(
            'UPDATE students SET enrollment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE class_id = $2 RETURNING id',
            [status, classId]
        );

        await logAction(req.user.id, req.user.role, 'BULK_ALUMNI_UPDATE', { classId, count: result.rowCount });

        res.json({ message: `Successfully marked ${result.rowCount} students as alumni`, count: result.rowCount });
    } catch (error) {
        console.error('Bulk status update error:', error);
        res.status(500).json({ error: 'Failed to update course status' });
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
                `INSERT INTO students(
        admission_number, roll_number, full_name, father_name, mother_name,
        date_of_birth, gender, class_id, address, phone_number, fee_status
    ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING * `,
                [
                    student.admission_number, student.roll_number, student.full_name,
                    student.father_name, student.mother_name, student.date_of_birth,
                    student.gender, student.class_id, student.address, student.phone_number,
                    student.fee_status
                ]
            );
            insertedStudents.push(result.rows[0]);
        }

        await logAction(req.user.id, req.user.role, 'BULK_UPLOAD_STUDENTS', { count: insertedStudents.length, classId });

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

// Upload student document
router.post('/:id/documents', authenticateToken, uploadDocument.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        const { documentName } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const documentUrl = `/uploads/documents/${req.file.filename}`.trim().replace(/\s+/g, '');

        const result = await pool.query(
            'INSERT INTO student_documents (student_id, document_name, document_url) VALUES ($1, $2, $3) RETURNING *',
            [id, req.file.originalname, documentUrl]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
});

// Get student documents
router.get('/:id/documents', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM student_documents WHERE student_id = $1 ORDER BY created_at DESC',
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Delete student document
router.delete('/documents/:docId', authenticateToken, async (req, res) => {
    try {
        const { docId } = req.params;
        const result = await pool.query('DELETE FROM student_documents WHERE id = $1 RETURNING *', [docId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Optional: Delete file from disk
        const doc = result.rows[0];
        const filePath = path.join(process.cwd(), doc.document_url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

export default router;
