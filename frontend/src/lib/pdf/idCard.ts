// ID cards (port of generateIDCard / generateBulkIDCards in backend/services/pdfGenerator.js).
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { browserLoader, drawField, fmtDate, IDCARD_TEMPLATE, loadTemplate } from './common.ts';
import type { Loader } from './common.ts';

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
export const IDCARD = {
    studentName: { x: 80, y: 98, size: 8, bold: true },
    fatherName: { x: 80, y: 89, size: 8, bold: true },
    courseName: { x: 60, y: 78, size: 8, bold: true },
    batchNo: { x: 50, y: 66, size: 8, bold: true },
    dob: { x: 60, y: 55, size: 8, bold: true },
    contactNo: { x: 80, y: 45, size: 8, bold: true },
};

// ─────────────────────────────────────────────────────────────────────────────
// Photo embedding helper
// photo_url is like "/uploads/photos/photo-xxx.jpg"
// ID card photo box: adjust x, y, width, height to match your template's
// rounded-rectangle placeholder.
// ─────────────────────────────────────────────────────────────────────────────
export const PHOTO_BOX = { x: 62, y: 120, width: 50, height: 50 }; // centered (126 pts is center)

// path.extname(photoUrl) without node:path
function extname(p: string) {
    const base = p.slice(p.lastIndexOf('/') + 1);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(dot) : '';
}

async function embedPhoto(pdfDoc: PDFDocument, page: PDFPage, photoUrl: string, loader: Loader) {
    if (!photoUrl) return;
    try {
        // photo_url looks like "/uploads/photos/filename.jpg" (served by the Worker from R2)
        const imgBytes = await loader.photo(photoUrl);
        const ext = extname(photoUrl).toLowerCase();

        let img;
        if (ext === '.png') {
            img = await pdfDoc.embedPng(imgBytes);
        } else {
            // treat everything else (jpg, jpeg, webp) as jpeg
            img = await pdfDoc.embedJpg(imgBytes);
        }

        const { x, y, width, height } = PHOTO_BOX;
        page.drawImage(img, { x, y, width, height });
    } catch (err: any) {
        // If photo doesn't exist or can't be embedded, skip silently
        console.warn('Could not embed student photo:', err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single ID Card
// ─────────────────────────────────────────────────────────────────────────────
export const generateIDCard = async (student: any, schoolInfo: any, loader: Loader = browserLoader) => {
    const pdfDoc = await loadTemplate(IDCARD_TEMPLATE, loader);
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
        await embedPhoto(pdfDoc, page, student.photo_url, loader);
    }

    return pdfDoc.save();
};

// ─────────────────────────────────────────────────────────────────────────────
// Bulk ID Cards (one page per student)
// ─────────────────────────────────────────────────────────────────────────────
export const generateBulkIDCards = async (students: any[], schoolInfo: any, loader: Loader = browserLoader) => {
    const templateBytes = await loader.template(IDCARD_TEMPLATE);
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
            await embedPhoto(srcDoc, page, student.photo_url, loader);
        }

        const [copied] = await merged.copyPages(srcDoc, [0]);
        merged.addPage(copied);
    }

    return merged.save();
};
