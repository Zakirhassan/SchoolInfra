import { Hono } from 'hono';
import type { AppCtx } from '../types';
import { authenticate, logAction } from '../lib/auth';
import { readBody } from '../lib/body';
import { hashPassword } from '../lib/password';
import { putUpload, deleteUpload } from '../lib/uploads';
import { validateStudentRows, mapUpdateRows, validateBulkUpdate } from '../lib/studentRows';

const r = new Hono<AppCtx>();

// Get all students with filters
r.get('/', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const { classId, feeStatus, search, enrollmentStatus } = c.req.query();

    let query = `
      SELECT s.*, c.class_name, c.section
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (user.role === 'TEACHER') {
      query += ` AND c.teacher_id = $${paramCount}`;
      params.push(user.id);
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

    const result = await db.query(query, params);
    return c.json(result.rows);
  } catch (error) {
    console.error('Get students error:', error);
    return c.json({ error: 'Failed to fetch students' }, 500);
  }
});

// Get student by ID
r.get('/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const id = c.req.param('id');
    const result = await db.query(
      `SELECT s.*, c.class_name, c.section
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Student not found' }, 404);
    }

    const student = result.rows[0];

    // RBAC check for Teachers
    if (user.role === 'TEACHER') {
      const courseCheck = await db.query('SELECT teacher_id FROM classes WHERE id = $1', [student.class_id]);
      if (courseCheck.rows.length === 0 || courseCheck.rows[0].teacher_id !== user.id) {
        return c.json({ error: 'Access denied. You can only view your own students.' }, 403);
      }
    }

    return c.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    return c.json({ error: 'Failed to fetch student' }, 500);
  }
});

// Create new student
r.post('/', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const b = await readBody(c);
    const {
      admissionNumber, rollNumber, fullName, fatherName, motherName,
      dateOfBirth, gender, classId, address, phoneNumber, feeStatus,
      email, password, enrollmentStatus
    } = b;

    // Validate required fields
    if (!admissionNumber || !fullName || !fatherName || !motherName ||
      !dateOfBirth || !gender || !classId || !address || !phoneNumber) {
      return c.json({ error: 'All required fields must be provided' }, 400);
    }

    let photoUrl: string | null = null;
    if (b.photo instanceof File && b.photo.size > 0) {
      try { photoUrl = await putUpload(c.env, 'photos', b.photo, 'image'); }
      catch (e: any) { return c.json({ error: e.message }, 400); }
    }

    // Hash password if provided
    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await hashPassword(password);
    }

    const result = await db.query(
      `INSERT INTO students (
                admission_number, roll_number, full_name, father_name, mother_name,
                date_of_birth, gender, class_id, address, phone_number, photo_url, fee_status,
                email, password_hash, enrollment_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [admissionNumber, rollNumber, fullName, fatherName, motherName,
        dateOfBirth, gender, classId, address, phoneNumber, photoUrl, feeStatus || 'Unpaid',
        email, passwordHash, enrollmentStatus || 'ENTRANCE_EXAM']
    );

    await logAction(db, user.id, user.role, 'CREATE_STUDENT', { id: result.rows[0].id, name: fullName, status: result.rows[0].enrollment_status });

    return c.json(result.rows[0], 201);
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      return c.json({ error: 'Student with this admission number or email already exists' }, 409);
    }
    console.error('Create student error:', error);
    return c.json({ error: 'Failed to create student' }, 500);
  }
});

// Update student
r.put('/:id', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const id = c.req.param('id');
    const b = await readBody(c);
    const {
      admissionNumber, rollNumber, fullName, fatherName, motherName,
      dateOfBirth, gender, classId, address, phoneNumber, feeStatus,
      email, password, enrollmentStatus
    } = b;

    let photoUrl = b.photoUrl; // Keep existing photo if not uploading new one
    if (b.photo instanceof File && b.photo.size > 0) {
      try { photoUrl = await putUpload(c.env, 'photos', b.photo, 'image'); }
      catch (e: any) { return c.json({ error: e.message }, 400); }
    }

    // Handle password update if provided
    const queryParams: any[] = [
      admissionNumber, rollNumber, fullName, fatherName, motherName,
      dateOfBirth, gender, classId, address, phoneNumber, photoUrl, feeStatus, email, enrollmentStatus, id
    ];

    let query = `UPDATE students SET
admission_number = $1, roll_number = $2, full_name = $3, father_name = $4,
    mother_name = $5, date_of_birth = $6, gender = $7, class_id = $8,
    address = $9, phone_number = $10, photo_url = $11, fee_status = $12,
    email = $13, enrollment_status = $14, updated_at = CURRENT_TIMESTAMP`;

    if (password) {
      const hashedPassword = await hashPassword(password);
      query += `, password_hash = $${queryParams.length + 1} `;
      queryParams.push(hashedPassword);
    }

    query += ` WHERE id = $15 RETURNING *`;

    const result = await db.query(query, queryParams);

    if (result.rows.length === 0) {
      return c.json({ error: 'Student not found' }, 404);
    }

    await logAction(db, user.id, user.role, 'UPDATE_STUDENT', { id, name: fullName });

    return c.json(result.rows[0]);
  } catch (error) {
    console.error('Update student error:', error);
    return c.json({ error: 'Failed to update student' }, 500);
  }
});

// Update student enrollment status
r.patch('/:id/status', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const id = c.req.param('id');
    const { status } = await readBody(c);

    if (!['ENTRANCE_EXAM', 'ACTIVE', 'ALUMNI'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    const result = await db.query(
      'UPDATE students SET enrollment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Student not found' }, 404);
    }

    await logAction(db, user.id, user.role, 'UPDATE_STUDENT_STATUS', { id, status });

    return c.json(result.rows[0]);
  } catch (error) {
    console.error('Update status error:', error);
    return c.json({ error: 'Failed to update status' }, 500);
  }
});

// Bulk update status to ALUMNI for a course
r.patch('/bulk-status/course/:classId', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const classId = c.req.param('classId');
    const { status } = await readBody(c);

    if (status !== 'ALUMNI') {
      return c.json({ error: 'Only bulk ALUMNI update is supported via this route' }, 400);
    }

    const result = await db.query(
      'UPDATE students SET enrollment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE class_id = $2 RETURNING id',
      [status, classId]
    );

    await logAction(db, user.id, user.role, 'BULK_ALUMNI_UPDATE', { classId, count: result.rowCount });

    return c.json({ message: `Successfully marked ${result.rowCount} students as alumni`, count: result.rowCount });
  } catch (error) {
    console.error('Bulk status update error:', error);
    return c.json({ error: 'Failed to update course status' }, 500);
  }
});

// Bulk-Excel routes. The browser reads the workbook and sends the rows that
// XLSX.utils.sheet_to_json produced as JSON: { classId, rows }. No files reach the Worker.
// GET /template/download is gone: the browser builds the sample template itself
// (frontend/src/lib/excel/parseStudents.ts).

// Bulk upload students from Excel rows
r.post('/bulk-upload', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const { classId, rows } = await readBody(c);

    if (!classId) {
      return c.json({ error: 'Class ID is required' }, 400);
    }

    if (!Array.isArray(rows)) {
      return c.json({ error: 'Excel file is required' }, 400);
    }

    // Validate rows
    const parseResult = validateStudentRows(rows, classId);

    if (!parseResult.success) {
      return c.json({
        error: 'Validation failed',
        details: parseResult.errors
      }, 400);
    }

    // Check for duplicate admission numbers in database
    const admissionNumbers = parseResult.data.map(s => s.admission_number);
    const duplicateCheck = await db.query(
      'SELECT admission_number FROM students WHERE admission_number = ANY($1)',
      [admissionNumbers]
    );

    if (duplicateCheck.rows.length > 0) {
      const duplicates = duplicateCheck.rows.map((r: any) => r.admission_number);
      return c.json({
        error: 'Duplicate admission numbers found in database',
        duplicates
      }, 409);
    }

    // Insert all students
    const insertedStudents: any[] = [];
    for (const student of parseResult.data) {
      const result = await db.query(
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

    await logAction(db, user.id, user.role, 'BULK_UPLOAD_STUDENTS', { count: insertedStudents.length, classId });

    return c.json({
      message: `Successfully uploaded ${insertedStudents.length} students`,
      count: insertedStudents.length,
      students: insertedStudents
    }, 201);
  } catch (error) {
    console.error('Bulk upload error:', error);
    return c.json({ error: 'Failed to upload students' }, 500);
  }
});

// Student data for the update template. Returns JSON rows; the browser builds the
// workbook (frontend/src/lib/excel/bulkUpdate.ts generateUpdateTemplate).
r.get('/update-template/:classId', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const classId = c.req.param('classId');

    // Fetch all students for the class
    const result = await db.query(
      `SELECT * FROM students WHERE class_id = $1 ORDER BY roll_number`,
      [classId]
    );

    if (result.rows.length === 0) {
      return c.json({
        error: 'No students found for this class',
        message: 'Please add students to this class first before downloading the update template.'
      }, 404);
    }

    return c.json(result.rows);
  } catch (error) {
    console.error('Update template download error:', error);
    return c.json({ error: 'Failed to generate update template' }, 500);
  }
});

// Bulk update students from Excel rows
r.post('/bulk-update', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const { classId, rows } = await readBody(c);

    if (!classId) {
      return c.json({ error: 'Class ID is required' }, 400);
    }

    if (!Array.isArray(rows)) {
      return c.json({ error: 'Excel file is required' }, 400);
    }

    if (rows.length === 0) {
      return c.json({ error: 'Excel file is empty' }, 400);
    }

    // Convert Excel column names to database field names
    const students = mapUpdateRows(rows);

    // Validate all students
    const validationResult = await validateBulkUpdate(db, students, classId);

    if (!validationResult.success) {
      return c.json({
        error: 'Validation failed',
        details: validationResult.errors
      }, 400);
    }

    // Update all students in a transaction
    const client = await db.connect();
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
        updatedCount += result.rowCount ?? 0;
      }

      await client.query('COMMIT');

      return c.json({
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
    return c.json({ error: 'Failed to update students' }, 500);
  }
});

// Upload student document
r.post('/:id/documents', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    const b = await readBody(c);
    const file = b.file;

    if (!(file instanceof File) || file.size === 0) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    let documentUrl: string;
    try { documentUrl = await putUpload(c.env, 'documents', file, 'document'); }
    catch (e: any) { return c.json({ error: e.message }, 400); }

    const result = await db.query(
      'INSERT INTO student_documents (student_id, document_name, document_url) VALUES ($1, $2, $3) RETURNING *',
      [id, file.name, documentUrl]
    );

    return c.json(result.rows[0], 201);
  } catch (error) {
    console.error('Document upload error:', error);
    return c.json({ error: 'Failed to upload document' }, 500);
  }
});

// Get student documents
r.get('/:id/documents', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    const result = await db.query(
      'SELECT * FROM student_documents WHERE student_id = $1 ORDER BY created_at DESC',
      [id]
    );
    return c.json(result.rows);
  } catch (error) {
    console.error('Get documents error:', error);
    return c.json({ error: 'Failed to fetch documents' }, 500);
  }
});

// Delete student document
r.delete('/documents/:docId', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const docId = c.req.param('docId');
    const result = await db.query('DELETE FROM student_documents WHERE id = $1 RETURNING *', [docId]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Delete file from R2
    const doc = result.rows[0];
    if (doc.document_url) await deleteUpload(c.env, doc.document_url);

    return c.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    return c.json({ error: 'Failed to delete document' }, 500);
  }
});

export default r;
