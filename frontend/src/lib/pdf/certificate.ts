// Certificate (port of generateReportCard in backend/services/pdfGenerator.js).
import { StandardFonts } from 'pdf-lib';
import { browserLoader, CERTIFICATE_TEMPLATE, drawField, fmtDate, loadTemplate } from './common.ts';
import type { Loader } from './common.ts';

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATE FIELD POSITIONS
// Based on landscape A4 template (approx 841 x 595 pts)
// Y=0 is at the BOTTOM of the page in pdf-lib
//
// From the screenshot:
//  • Student name  → on the line below "This Certificate is proudly presented to"
//  • Course name   → 2nd blank (after "completed a ___ training course")
//  • Start date    → 4th blank (after "from ___")
//  • End date      → 5th blank (after "to ___")
//  • Grade         → 6th blank (after "awarded grade ___")
//  • Student ID    → bottom-left (bold)
// ─────────────────────────────────────────────────────────────────────────────
export const CERT = {
    studentName: { x: 310, y: 315, size: 18, bold: true },
    courseName: { x: 425, y: 288, size: 13, bold: true },
    startDate: { x: 400, y: 248, size: 12, bold: true },
    endDate: { x: 580, y: 248, size: 12, bold: true },
    grade: { x: 470, y: 208, size: 13, bold: true },
    studentId: { x: 78, y: 98, size: 11, bold: true },
};

export function calcGrade(marks: any[]) {
    let total = 0, max = 0;
    marks.forEach(m => { total += parseFloat(m.marks_obtained || 0); max += parseFloat(m.max_marks || 0); });
    const pct = max > 0 ? (total / max) * 100 : 0;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificate
// ─────────────────────────────────────────────────────────────────────────────
export const generateCertificate = async (student: any, marks: any[], examInfo: any, schoolInfo: any, loader: Loader = browserLoader) => {
    const pdfDoc = await loadTemplate(CERTIFICATE_TEMPLATE, loader);
    const page = pdfDoc.getPages()[0];
    const normal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    drawField(page, student.full_name, CERT.studentName, normal, bold);
    drawField(page, student.course_name || student.class_name, CERT.courseName, normal, bold);
    drawField(page, fmtDate(student.start_date), CERT.startDate, normal, bold);
    drawField(page, fmtDate(student.tentative_end_date), CERT.endDate, normal, bold);
    drawField(page, calcGrade(marks), CERT.grade, normal, bold);
    drawField(page, student.admission_number, CERT.studentId, normal, bold);

    return pdfDoc.save();
};
