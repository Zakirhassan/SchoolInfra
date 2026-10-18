// Row validation for the student bulk-Excel routes.
// The browser reads the workbook (XLSX.utils.sheet_to_json) and POSTs the rows;
// everything below is the part of the old backend that ran AFTER XLSX.readFile:
//   - validateStudentRows  <- backend/services/excelParser.js parseStudentExcel
//   - mapUpdateRows        <- backend/routes/students.js POST /bulk-update column mapping
//   - validateBulkUpdate   <- backend/services/bulkUpdateValidator.js validateBulkUpdate
// Keep messages and shapes identical to the old code.
// No imports besides types: this file is also run directly by node in tests.
import type { Pool } from '@neondatabase/serverless';

export type Row = Record<string, any>;
type Queryable = Pick<Pool, 'query'>;

/**
 * Date part of SheetJS 0.18.5 SSF.parse_date_code (1900 date system), copied so the
 * Worker does not have to bundle xlsx. Returns null for out-of-range serials, exactly
 * like the original (the old parser then threw on `.y`, which surfaced as an error).
 */
export function parseDateCode(v: number): { y: number; m: number; d: number } | null {
  if (v > 2958465 || v < 0) return null;
  let date = v | 0;
  let time = Math.floor(86400 * (v - date));
  let u = 86400 * (v - date) - time;
  if (Math.abs(u) < 1e-6) u = 0;
  if (u > 0.9999) {
    u = 0;
    if (++time == 86400) { time = 0; ++date; }
  }
  let dout: number[];
  if (date === 60) dout = [1900, 2, 29];
  else if (date === 0) dout = [1900, 1, 0];
  else {
    if (date > 60) --date;
    const d = new Date(1900, 0, 1);
    d.setDate(d.getDate() + date - 1);
    dout = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  }
  return { y: dout[0], m: dout[1], d: dout[2] };
}

export type StudentRowsResult =
  | { success: true; data: Row[] }
  | { success: false; errors: string[] };

/** Validate and format bulk-upload rows (old parseStudentExcel minus the file read). */
export const validateStudentRows = (rawData: Row[], classId: any): StudentRowsResult => {
  try {
    if (rawData.length === 0) {
      return { success: false, errors: ['Excel file is empty'] };
    }

    const requiredColumns = [
      'admission_number',
      'roll_number',
      'full_name',
      'father_name',
      'mother_name',
      'date_of_birth',
      'gender',
      'address',
      'phone_number'
    ];

    // Validate columns
    const firstRow = rawData[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));

    if (missingColumns.length > 0) {
      return {
        success: false,
        errors: [`Missing required columns: ${missingColumns.join(', ')}`]
      };
    }

    // Validate and format data
    const students: Row[] = [];
    const errors: string[] = [];
    const admissionNumbers = new Set();

    rawData.forEach((row, index) => {
      const rowNum = index + 2; // Excel row number (1-indexed + header)
      const rowErrors: string[] = [];

      // Check for duplicate admission number within the file
      if (admissionNumbers.has(row.admission_number)) {
        rowErrors.push(`Row ${rowNum}: Duplicate admission number ${row.admission_number}`);
      } else {
        admissionNumbers.add(row.admission_number);
      }

      // Validate required fields
      requiredColumns.forEach(col => {
        if (!row[col] || row[col].toString().trim() === '') {
          rowErrors.push(`Row ${rowNum}: Missing ${col}`);
        }
      });

      // Validate gender
      const validGenders = ['Male', 'Female', 'Other'];
      if (row.gender && !validGenders.includes(row.gender)) {
        rowErrors.push(`Row ${rowNum}: Invalid gender. Must be Male, Female, or Other`);
      }

      // Validate date of birth format (assuming YYYY-MM-DD or Excel date)
      let dob = row.date_of_birth;
      if (typeof dob === 'number') {
        // Excel serial date
        const p = parseDateCode(dob) as { y: number; m: number; d: number };
        dob = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
      }

      if (rowErrors.length === 0) {
        students.push({
          admission_number: row.admission_number.toString().trim(),
          roll_number: row.roll_number.toString().trim(),
          full_name: row.full_name.toString().trim(),
          father_name: row.father_name.toString().trim(),
          mother_name: row.mother_name.toString().trim(),
          date_of_birth: dob,
          gender: row.gender.toString().trim(),
          class_id: classId,
          address: row.address.toString().trim(),
          phone_number: row.phone_number.toString().trim(),
          fee_status: row.fee_status || 'Unpaid'
        });
      } else {
        errors.push(...rowErrors);
      }
    });

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: students };
  } catch (error: any) {
    console.error('Excel parsing error:', error);
    return { success: false, errors: [error.message] };
  }
};

/** Convert update-template column names to database field names (old POST /bulk-update). */
export const mapUpdateRows = (data: Row[]): Row[] =>
  data.map(row => ({
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

/** Validate bulk student updates (old validateBulkUpdate; `db` replaces the global pool). */
export async function validateBulkUpdate(db: Queryable, students: Row[], classId: any) {
  const errors: string[] = [];
  const studentIds: any[] = [];
  const admissionNumbers: { number: any; studentId: any; row: number }[] = [];

  // First pass: collect IDs and admission numbers
  students.forEach((student, index) => {
    const rowNum = index + 2; // Excel row number (header is row 1)

    if (!student.student_id) {
      errors.push(`Row ${rowNum}: Student ID is required`);
    } else {
      studentIds.push(student.student_id);
    }

    if (student.admission_number) {
      admissionNumbers.push({
        number: student.admission_number,
        studentId: student.student_id,
        row: rowNum
      });
    }
  });

  // Verify all student IDs exist and belong to the class
  if (studentIds.length > 0) {
    const studentCheck = await db.query(
      'SELECT id, class_id FROM students WHERE id = ANY($1)',
      [studentIds]
    );

    const existingIds = new Set(studentCheck.rows.map((r: any) => r.id));
    const classMap = new Map(studentCheck.rows.map((r: any) => [r.id, r.class_id]));

    students.forEach((student, index) => {
      const rowNum = index + 2;

      if (student.student_id && !existingIds.has(parseInt(student.student_id))) {
        errors.push(`Row ${rowNum}: Student ID ${student.student_id} not found`);
      } else if (student.student_id && classMap.get(parseInt(student.student_id)) !== parseInt(classId)) {
        errors.push(`Row ${rowNum}: Student ID ${student.student_id} does not belong to the selected class`);
      }
    });
  }

  // Check for duplicate admission numbers (excluding current student)
  if (admissionNumbers.length > 0) {
    for (const item of admissionNumbers) {
      const duplicateCheck = await db.query(
        'SELECT id FROM students WHERE admission_number = $1 AND id != $2',
        [item.number, item.studentId]
      );

      if (duplicateCheck.rows.length > 0) {
        errors.push(`Row ${item.row}: Admission number ${item.number} already exists for another student`);
      }
    }
  }

  // Validate each student's data
  students.forEach((student, index) => {
    const rowNum = index + 2;

    // Required fields
    if (!student.full_name || student.full_name.trim() === '') {
      errors.push(`Row ${rowNum}: Full name is required`);
    }

    if (!student.father_name || student.father_name.trim() === '') {
      errors.push(`Row ${rowNum}: Father name is required`);
    }

    if (!student.mother_name || student.mother_name.trim() === '') {
      errors.push(`Row ${rowNum}: Mother name is required`);
    }

    if (!student.date_of_birth) {
      errors.push(`Row ${rowNum}: Date of birth is required`);
    } else {
      // Validate date format
      const date = new Date(student.date_of_birth);
      if (isNaN(date.getTime())) {
        errors.push(`Row ${rowNum}: Invalid date of birth format`);
      }
    }

    if (!student.gender) {
      errors.push(`Row ${rowNum}: Gender is required`);
    } else if (!['Male', 'Female', 'Other'].includes(student.gender)) {
      errors.push(`Row ${rowNum}: Gender must be Male, Female, or Other`);
    }

    if (!student.address || student.address.trim() === '') {
      errors.push(`Row ${rowNum}: Address is required`);
    }

    if (!student.contact_number) {
      errors.push(`Row ${rowNum}: Contact number is required`);
    } else if (!/^\d{10}$/.test(student.contact_number.toString().replace(/\D/g, ''))) {
      errors.push(`Row ${rowNum}: Contact number must be 10 digits`);
    }

    // Optional field validations
    if (student.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) {
      errors.push(`Row ${rowNum}: Invalid email format`);
    }

    if (student.blood_group && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(student.blood_group)) {
      errors.push(`Row ${rowNum}: Invalid blood group`);
    }
  });

  return {
    success: errors.length === 0,
    errors
  };
}
