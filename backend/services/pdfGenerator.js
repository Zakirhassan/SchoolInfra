import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const CERTIFICATE_TEMPLATE = path.join(TEMPLATES_DIR, 'CERTIFICATE_TEMPLATE.pdf');
const IDCARD_TEMPLATE = path.join(TEMPLATES_DIR, 'IDCARD_TEMPLATE.pdf');

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
const CERT = {
    studentName: { x: 310, y: 315, size: 18, bold: true },
    courseName: { x: 425, y: 288, size: 13, bold: true },
    startDate: { x: 400, y: 248, size: 12, bold: true },
    endDate: { x: 580, y: 248, size: 12, bold: true },
    grade: { x: 470, y: 208, size: 13, bold: true },
    studentId: { x: 78, y: 98, size: 11, bold: true },
};

// ─────────────────────────────────────────────────────────────────────────────
// ID CARD FIELD POSITIONS
// Template is portrait (approx 252 x 396 pts)
// Y=0 is at the BOTTOM of the page
//
// From the screenshot the label lines are:
//   Student Name :  ___
//   Father's Name : ___
//   Course :        ___
//   Batch No :___  Time ___
//   D.O.B. :        ___
//   Contact No :    ___
//
// The text should appear AFTER the colon on each line.
// ─────────────────────────────────────────────────────────────────────────────
const IDCARD = {
    studentName: { x: 80, y: 98, size: 8, bold: true },
    fatherName: { x: 80, y: 89, size: 8, bold: true },
    courseName: { x: 60, y: 78, size: 8, bold: true },
    batchNo: { x: 50, y: 66, size: 8, bold: true },
    dob: { x: 60, y: 55, size: 8, bold: true },
    contactNo: { x: 80, y: 45, size: 8, bold: true },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function loadTemplate(templatePath) {
    try {
        await fs.access(templatePath);
    } catch {
        throw new Error(`Template not found: ${templatePath}`);
    }
    const bytes = await fs.readFile(templatePath);
    return PDFDocument.load(bytes);
}

function drawField(page, text, field, normalFont, boldFont) {
    page.drawText(String(text || ''), {
        x: field.x,
        y: field.y,
        size: field.size,
        font: field.bold ? boldFont : normalFont,
        color: rgb(0, 0, 0),
    });
}

function calcGrade(marks) {
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

function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('en-GB') : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo embedding helper
// photo_url is like "/uploads/photos/photo-xxx.jpg"
// ID card photo box: adjust x, y, width, height to match your template's
// rounded-rectangle placeholder.
// ─────────────────────────────────────────────────────────────────────────────
const PHOTO_BOX = { x: 62, y: 120, width: 50, height: 50 }; // centered (126 pts is center)

async function embedPhoto(pdfDoc, page, photoUrl) {
    if (!photoUrl) return;
    try {
        // Convert URL path → absolute file path
        // photo_url looks like "/uploads/photos/filename.jpg"
        const relPath = photoUrl.startsWith('/') ? photoUrl.slice(1) : photoUrl;
        const absPath = path.join(__dirname, '..', relPath);

        const imgBytes = await fs.readFile(absPath);
        const ext = path.extname(absPath).toLowerCase();

        let img;
        if (ext === '.png') {
            img = await pdfDoc.embedPng(imgBytes);
        } else {
            // treat everything else (jpg, jpeg, webp) as jpeg
            img = await pdfDoc.embedJpg(imgBytes);
        }

        const { x, y, width, height } = PHOTO_BOX;
        page.drawImage(img, { x, y, width, height });
    } catch (err) {
        // If photo doesn't exist or can't be embedded, skip silently
        console.warn('Could not embed student photo:', err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificate
// ─────────────────────────────────────────────────────────────────────────────
export const generateReportCard = async (student, marks, examInfo, schoolInfo) => {
    const pdfDoc = await loadTemplate(CERTIFICATE_TEMPLATE);
    const page = pdfDoc.getPages()[0];
    const normal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    drawField(page, student.full_name, CERT.studentName, normal, bold);
    drawField(page, student.course_name || student.class_name, CERT.courseName, normal, bold);
    drawField(page, fmtDate(student.start_date), CERT.startDate, normal, bold);
    drawField(page, fmtDate(student.tentative_end_date), CERT.endDate, normal, bold);
    drawField(page, calcGrade(marks), CERT.grade, normal, bold);
    drawField(page, student.admission_number, CERT.studentId, normal, bold);

    return Buffer.from(await pdfDoc.save());
};

// ─────────────────────────────────────────────────────────────────────────────
// Single ID Card
// ─────────────────────────────────────────────────────────────────────────────
export const generateIDCard = async (student, schoolInfo) => {
    const pdfDoc = await loadTemplate(IDCARD_TEMPLATE);
    const page = pdfDoc.getPages()[0];
    const normal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    drawField(page, student.full_name, IDCARD.studentName, normal, bold);
    drawField(page, student.father_name, IDCARD.fatherName, normal, bold);
    drawField(page, student.class_name, IDCARD.courseName, normal, bold);
    drawField(page, student.roll_number, IDCARD.batchNo, normal, bold);
    drawField(page, fmtDate(student.date_of_birth), IDCARD.dob, normal, bold);
    drawField(page, student.phone_number, IDCARD.contactNo, normal, bold);

    if (student.photo_url) {
        await embedPhoto(pdfDoc, page, student.photo_url);
    }

    return Buffer.from(await pdfDoc.save());
};

// ─────────────────────────────────────────────────────────────────────────────
// Bulk ID Cards (one page per student)
// ─────────────────────────────────────────────────────────────────────────────
export const generateBulkIDCards = async (students, schoolInfo) => {
    const templateBytes = await fs.readFile(IDCARD_TEMPLATE);
    const merged = await PDFDocument.create();

    for (const student of students) {
        const srcDoc = await PDFDocument.load(templateBytes);
        const normal = await srcDoc.embedFont(StandardFonts.Helvetica);
        const bold = await srcDoc.embedFont(StandardFonts.HelveticaBold);
        const page = srcDoc.getPages()[0];

        drawField(page, student.full_name, IDCARD.studentName, normal, bold);
        drawField(page, student.father_name, IDCARD.fatherName, normal, bold);
        drawField(page, student.class_name, IDCARD.courseName, normal, bold);
        drawField(page, student.roll_number, IDCARD.batchNo, normal, bold);
        drawField(page, fmtDate(student.date_of_birth), IDCARD.dob, normal, bold);
        drawField(page, student.phone_number, IDCARD.contactNo, normal, bold);

        if (student.photo_url) {
            await embedPhoto(srcDoc, page, student.photo_url);
        }

        const [copied] = await merged.copyPages(srcDoc, [0]);
        merged.addPage(copied);
    }

    return Buffer.from(await merged.save());
};
