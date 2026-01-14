import XLSX from 'xlsx';
import pool from '../config/database.js';

/**
 * Validate bulk student updates from Excel
 * @param {Array} students - Array of student objects from Excel
 * @param {number} classId - Class ID for validation
 * @returns {Object} - {success: boolean, errors: Array}
 */
export async function validateBulkUpdate(students, classId) {
    const errors = [];
    const studentIds = [];
    const admissionNumbers = [];

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
        const studentCheck = await pool.query(
            'SELECT id, class_id FROM students WHERE id = ANY($1)',
            [studentIds]
        );

        const existingIds = new Set(studentCheck.rows.map(r => r.id));
        const classMap = new Map(studentCheck.rows.map(r => [r.id, r.class_id]));

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
            const duplicateCheck = await pool.query(
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

/**
 * Generate Excel template with existing student data for updates
 * @param {Array} students - Array of student records from database
 * @returns {Buffer} - Excel file buffer
 */
export function generateUpdateTemplate(students) {
    const data = students.map(student => ({
        'Student ID': student.id,
        'Admission Number': student.admission_number || '',
        'Roll Number': student.roll_number || '',
        'Full Name': student.full_name || '',
        'Father Name': student.father_name || '',
        'Mother Name': student.mother_name || '',
        'Date of Birth': student.date_of_birth ? new Date(student.date_of_birth).toISOString().split('T')[0] : '',
        'Gender': student.gender || '',
        'Contact Number': student.phone_number || '',
        'Email': student.email || '',
        'Address': student.address || '',
        'Blood Group': student.blood_group || '',
        'Previous School': student.previous_school || '',
        'Admission Date': student.admission_date ? new Date(student.admission_date).toISOString().split('T')[0] : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
        { wch: 12 }, // Student ID
        { wch: 18 }, // Admission Number
        { wch: 12 }, // Roll Number
        { wch: 25 }, // Full Name
        { wch: 25 }, // Father Name
        { wch: 25 }, // Mother Name
        { wch: 15 }, // Date of Birth
        { wch: 10 }, // Gender
        { wch: 15 }, // Contact Number
        { wch: 25 }, // Email
        { wch: 30 }, // Address
        { wch: 12 }, // Blood Group
        { wch: 25 }, // Previous School
        { wch: 15 }  // Admission Date
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
