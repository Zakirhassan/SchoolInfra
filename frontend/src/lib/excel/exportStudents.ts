// Student export workbook (moved from backend/routes/export.js). The Worker returns
// the formatted rows as JSON; the browser builds and saves the workbook.
import * as XLSX from 'xlsx';

export type ExportRow = Record<string, any>;

// Over JSON, the Postgres DATE arrives as an ISO string. The old server handed
// json_to_sheet a Date (local midnight), which SheetJS stores as a date cell.
// Rebuild that local-midnight Date so the cell type and the day stay the same.
function toLocalDate(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : v;
}

export function buildStudentsWorkbook(excelData: ExportRow[]): XLSX.WorkBook {
  const rows = excelData.map(r => ({ ...r, 'Date of Birth': toLocalDate(r['Date of Birth']) }));

  // Create workbook
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  return workbook;
}

export function downloadStudentsExport(excelData: ExportRow[]): void {
  XLSX.writeFile(buildStudentsWorkbook(excelData), 'students_export.xlsx');
}
