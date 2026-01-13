import XLSX from 'xlsx';
import fs from 'fs';

/**
 * Parse Excel file and validate student data
 * @param {string} filePath - Path to the Excel file
 * @param {number} classId - Class ID for the students
 * @returns {Object} - { success: boolean, data: array, errors: array }
 */
export const parseStudentExcel = (filePath, classId) => {
    try {
        // Read the Excel file
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet);

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
        const students = [];
        const errors = [];
        const admissionNumbers = new Set();

        rawData.forEach((row, index) => {
            const rowNum = index + 2; // Excel row number (1-indexed + header)
            const rowErrors = [];

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
                dob = XLSX.SSF.parse_date_code(dob);
                dob = `${dob.y}-${String(dob.m).padStart(2, '0')}-${String(dob.d).padStart(2, '0')}`;
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

        // Clean up the uploaded file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        return { success: true, data: students };
    } catch (error) {
        console.error('Excel parsing error:', error);
        return { success: false, errors: [error.message] };
    }
};

/**
 * Generate sample Excel template for student upload
 * @returns {Buffer} - Excel file buffer
 */
export const generateSampleTemplate = () => {
    const sampleData = [
        {
            admission_number: 'ADM001',
            roll_number: '1',
            full_name: 'John Doe',
            father_name: 'Robert Doe',
            mother_name: 'Jane Doe',
            date_of_birth: '2010-01-15',
            gender: 'Male',
            address: '123 Main Street, City',
            phone_number: '+1234567890',
            fee_status: 'Unpaid'
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};
