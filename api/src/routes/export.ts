import { Hono } from 'hono';
import type { AppCtx } from '../types';
import { authenticate } from '../lib/auth';
import { readBody } from '../lib/body';

const r = new Hono<AppCtx>();

// Export students. Returns the rows that the old route passed to XLSX.utils.json_to_sheet;
// the browser builds and saves the workbook (frontend/src/lib/excel/exportStudents.ts).
r.post('/students', authenticate, async (c) => {
  try {
    const db = c.get('db');
    const { classId, feeStatus, gender } = await readBody(c);

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
    const params: any[] = [];
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

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return c.json({ error: 'No students found matching the criteria' }, 404);
    }

    // Format data for Excel
    const excelData = result.rows.map((student: any) => ({
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

    return c.json(excelData);
  } catch (error) {
    console.error('Export students error:', error);
    return c.json({ error: 'Failed to export students' }, 500);
  }
});

export default r;
