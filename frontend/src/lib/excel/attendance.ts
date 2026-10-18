// Attendance Excel: template building (moved from pages/Attendance.jsx) and
// reading an uploaded sheet into rows for POST /api/attendance/upload.
import * as XLSX from 'xlsx';
import { readRows } from './parseStudents.ts';

export { readRows };

export type AttendanceStat = { admission_number: string; full_name: string } & Record<string, unknown>;

/** Template with the course's current students, status defaulted to Present. */
export function generateAttendanceTemplate(attendanceData: AttendanceStat[]): XLSX.WorkBook {
  const studentInfo = attendanceData.map(s => ({
    'Admission Number': s.admission_number,
    'Student Name': s.full_name,
    'Status': 'Present' // Default status
  }));

  const ws = XLSX.utils.json_to_sheet(studentInfo);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  return wb;
}

export function downloadAttendanceTemplate(attendanceData: AttendanceStat[], date: string): void {
  XLSX.writeFile(generateAttendanceTemplate(attendanceData), `Attendance_Template_${date}.xlsx`);
}
