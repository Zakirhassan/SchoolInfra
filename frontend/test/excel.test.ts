// Run: npm test (node --test, Node >= 22.18 strips the TS types natively).
// Uses real in-memory workbooks: build -> XLSX.write -> Blob -> readRows -> validators.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { readRows, generateSampleTemplate } from '../src/lib/excel/parseStudents.ts';
import { generateUpdateTemplate } from '../src/lib/excel/bulkUpdate.ts';
import { generateAttendanceTemplate } from '../src/lib/excel/attendance.ts';
import { buildStudentsWorkbook } from '../src/lib/excel/exportStudents.ts';
import { validateStudentRows, mapUpdateRows, validateBulkUpdate, parseDateCode } from '../../api/src/lib/studentRows.ts';

// Node loads the CJS build, whose SSF export is only on the default object.
const SSF = XLSX.SSF ?? (XLSX as any).default.SSF;
const toBlob = (wb: XLSX.WorkBook) => new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]);
const sheetToBlob = (rows: Record<string, unknown>[]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Students');
  return toBlob(wb);
};

const good = {
  admission_number: 'ADM001', roll_number: '1', full_name: 'John Doe', father_name: 'Robert Doe',
  mother_name: 'Jane Doe', date_of_birth: '2010-01-15', gender: 'Male', address: '123 Main Street, City',
  phone_number: '+1234567890', fee_status: 'Unpaid'
};

test('sample template round-trips through the parser and validator', async () => {
  const rows = await readRows(toBlob(generateSampleTemplate()));
  assert.deepEqual(rows, [good]);
  const res = validateStudentRows(rows, '7');
  assert.deepEqual(res, { success: true, data: [{ ...good, class_id: '7' }] });
});

test('Excel serial dates become YYYY-MM-DD (same as SSF.parse_date_code)', async () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([{ ...good, date_of_birth: new Date(2010, 0, 15) }]);
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  const rows = await readRows(toBlob(wb));
  assert.equal(typeof rows[0].date_of_birth, 'number');
  const res = validateStudentRows(rows, 1);
  assert.equal(res.success && res.data[0].date_of_birth, '2010-01-15');
  for (const v of [1, 59, 60, 61, 366, 40193, 40193.5, 45000.99999999, 2958465]) {
    const o = SSF.parse_date_code(v);
    assert.deepEqual(parseDateCode(v), { y: o.y, m: o.m, d: o.d }, `serial ${v}`);
  }
  assert.equal(parseDateCode(-1), null);
});

test('bad rows give the old validator messages', async () => {
  const rows = await readRows(sheetToBlob([
    good,
    { ...good, admission_number: 'ADM001', gender: 'M' },
    { ...good, admission_number: 'ADM003', full_name: '   ', phone_number: '' }
  ]));
  assert.deepEqual(validateStudentRows(rows, 1), {
    success: false,
    errors: [
      'Row 3: Duplicate admission number ADM001',
      'Row 3: Invalid gender. Must be Male, Female, or Other',
      'Row 4: Missing full_name',
      'Row 4: Missing phone_number'
    ]
  });
});

test('missing columns and empty sheet', async () => {
  const { address, ...noAddress } = good;
  void address;
  const rows = await readRows(sheetToBlob([noAddress]));
  assert.deepEqual(validateStudentRows(rows, 1), { success: false, errors: ['Missing required columns: address'] });
  assert.deepEqual(validateStudentRows([], 1), { success: false, errors: ['Excel file is empty'] });
});

test('200-row file validates', async () => {
  const many = Array.from({ length: 200 }, (_, i) => ({ ...good, admission_number: `ADM${i}`, roll_number: String(i + 1) }));
  const rows = await readRows(sheetToBlob(many));
  const res = validateStudentRows(rows, 1);
  assert.equal(res.success && res.data.length, 200);
});

test('update template round-trips and bulk-update validation keeps old messages', async () => {
  const dbRows = [
    { id: 11, admission_number: 'ADM011', roll_number: '1', full_name: 'A', father_name: 'B', mother_name: 'C',
      date_of_birth: '2010-01-15T00:00:00.000Z', gender: 'Female', phone_number: '0300-123456', email: 'a@b.co',
      address: 'X', blood_group: 'O+', previous_school: null, admission_date: null },
    { id: 12, admission_number: 'ADM012', roll_number: '2', full_name: 'D', father_name: 'E', mother_name: 'F',
      date_of_birth: null, gender: 'Boy', phone_number: '123', email: 'bad', address: 'Y', blood_group: 'Z' }
  ];
  const wb = generateUpdateTemplate(dbRows);
  assert.deepEqual(wb.Sheets.Students['!cols']?.length, 14);
  const rows = await readRows(toBlob(wb));
  assert.equal(rows[0]['Date of Birth'], '2010-01-15');
  const students = mapUpdateRows(rows);
  assert.equal(students[0].student_id, 11);

  const queries: unknown[][] = [];
  const db = {
    query: async (sql: string, params: unknown[]) => {
      queries.push([sql, params]);
      if (sql.startsWith('SELECT id, class_id')) return { rows: [{ id: 11, class_id: 5 }, { id: 12, class_id: 6 }] };
      return { rows: params[0] === 'ADM012' ? [{ id: 99 }] : [] };
    }
  };
  const res = await validateBulkUpdate(db as any, students, '5');
  assert.deepEqual(res, {
    success: false,
    errors: [
      'Row 3: Student ID 12 does not belong to the selected class',
      'Row 3: Admission number ADM012 already exists for another student',
      'Row 3: Date of birth is required',
      'Row 3: Gender must be Male, Female, or Other',
      'Row 3: Contact number must be 10 digits',
      'Row 3: Invalid email format',
      'Row 3: Invalid blood group'
    ]
  });
  assert.equal(queries.length, 3);
});

test('attendance template and export workbook', async () => {
  const att = await readRows(toBlob(generateAttendanceTemplate([{ admission_number: 'ADM1', full_name: 'A' }])));
  assert.deepEqual(att, [{ 'Admission Number': 'ADM1', 'Student Name': 'A', Status: 'Present' }]);

  const wb = buildStudentsWorkbook([{ 'Admission Number': 'ADM1', 'Date of Birth': '2010-01-15T00:00:00.000Z', 'Fee Status': 'Paid' }]);
  const cell = wb.Sheets.Students.B2;
  assert.equal(cell.t, 'n'); // a real date cell, as when the server passed a Date
  assert.equal(SSF.format(cell.z as string, cell.v), '1/15/10');
});
