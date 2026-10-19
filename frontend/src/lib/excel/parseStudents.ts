// Browser-side Excel reading for student bulk upload, plus the sample template
// (moved from backend/services/excelParser.js). The Worker only receives JSON rows.
import * as XLSX from 'xlsx';

export type Row = Record<string, unknown>;

/** Read the first sheet of an Excel file into rows, exactly like the old server did
 *  (XLSX.readFile + sheet_to_json with default options). */
export async function readRows(file: Blob): Promise<Row[]> {
  const wb = XLSX.read(await file.arrayBuffer());
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
}

/** Sample Excel template for student upload (verbatim from generateSampleTemplate;
 *  returns the workbook instead of a buffer). */
export const generateSampleTemplate = (): XLSX.WorkBook => {
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

  return workbook;
};

/** Build and save the sample template (was GET /students/template/download). */
export function downloadSampleTemplate(): void {
  XLSX.writeFile(generateSampleTemplate(), 'student_upload_template.xlsx');
}
