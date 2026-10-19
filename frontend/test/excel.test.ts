// Run: npm test (node --test, Node >= 22.18 strips the TS types natively).
// Uses real in-memory workbooks: build -> XLSX.write -> Blob -> readRows.
// Student bulk upload/update was removed; attendance upload and student export remain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { readRows, generateAttendanceTemplate } from '../src/lib/excel/attendance.ts';
import { buildStudentsWorkbook } from '../src/lib/excel/exportStudents.ts';

// Node loads the CJS build, whose SSF export is only on the default object.
const SSF = XLSX.SSF ?? (XLSX as any).default.SSF;
const toBlob = (wb: XLSX.WorkBook) => new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]);

test('attendance template round-trips through readRows', async () => {
  const att = await readRows(toBlob(generateAttendanceTemplate([{ admission_number: 'ADM1', full_name: 'A' }])));
  assert.deepEqual(att, [{ 'Admission Number': 'ADM1', 'Student Name': 'A', Status: 'Present' }]);
});

test('student export workbook keeps Date of Birth as a date cell', () => {
  const wb = buildStudentsWorkbook([{ 'Admission Number': 'ADM1', 'Date of Birth': '2010-01-15T00:00:00.000Z', 'Fee Status': 'Paid' }]);
  const cell = wb.Sheets.Students.B2;
  assert.equal(cell.t, 'n'); // a real date cell, as when the server passed a Date
  assert.equal(SSF.format(cell.z as string, cell.v), '1/15/10');
});
