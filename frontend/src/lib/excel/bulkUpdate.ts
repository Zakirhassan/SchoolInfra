// Student update template (moved from backend/services/bulkUpdateValidator.js).
// The rows come from GET /api/students/update-template/:classId (JSON); validation
// of uploaded update rows stays on the Worker (it needs the database).
import * as XLSX from 'xlsx';

export type StudentRecord = Record<string, any>;

/** Excel template with existing student data for updates (verbatim from
 *  generateUpdateTemplate; returns the workbook instead of a buffer). */
export function generateUpdateTemplate(students: StudentRecord[]): XLSX.WorkBook {
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

  return workbook;
}

/** Build and save the update template (was GET /students/update-template/:classId). */
export function downloadUpdateTemplate(students: StudentRecord[]): void {
  XLSX.writeFile(generateUpdateTemplate(students), 'student_update_template.xlsx');
}
