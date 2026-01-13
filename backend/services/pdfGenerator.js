import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate ID Card PDF for a student
 * @param {Object} student - Student data
 * @param {string} schoolInfo - School information
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateIDCard = (student, schoolInfo) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: [243, 153], margin: 10 }); // Credit card size in points
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });

            // Background with gradient effect
            doc.rect(0, 0, 243, 153).fill('#1e40af');
            doc.rect(0, 0, 243, 40).fill('#3b82f6');

            // School name header
            doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold');
            doc.text(schoolInfo.name || 'ABC School', 10, 10, { width: 223, align: 'center' });

            doc.fontSize(7).fillColor('#e0e7ff').font('Helvetica');
            doc.text('STUDENT ID CARD', 10, 28, { width: 223, align: 'center' });

            // Student photo placeholder (if photo exists, you'd draw it here)
            doc.rect(15, 50, 50, 60).fill('#ffffff');
            if (student.photo_url) {
                // In production, load and draw actual image
                doc.fontSize(6).fillColor('#666666');
                doc.text('PHOTO', 25, 75, { width: 30, align: 'center' });
            } else {
                doc.fontSize(6).fillColor('#666666');
                doc.text('NO PHOTO', 20, 75, { width: 40, align: 'center' });
            }

            // Student details
            const detailsX = 75;
            let detailsY = 50;
            const lineHeight = 12;

            doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
            doc.text(student.full_name.toUpperCase(), detailsX, detailsY, { width: 150 });
            detailsY += lineHeight;

            doc.fontSize(7).fillColor('#e0e7ff').font('Helvetica');
            doc.text(`Class: ${student.class_name}-${student.section}`, detailsX, detailsY);
            detailsY += lineHeight;

            doc.text(`Roll No: ${student.roll_number}`, detailsX, detailsY);
            detailsY += lineHeight;

            doc.text(`Adm No: ${student.admission_number}`, detailsX, detailsY);
            detailsY += lineHeight;

            doc.text(`DOB: ${new Date(student.date_of_birth).toLocaleDateString()}`, detailsX, detailsY);

            // Footer
            doc.fontSize(6).fillColor('#93c5fd');
            doc.text(schoolInfo.academicYear || '2025-2026', 10, 135, { width: 223, align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Generate multiple ID cards on A4 pages (8 cards per page)
 * @param {Array} students - Array of student data
 * @param {string} schoolInfo - School information
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateBulkIDCards = (students, schoolInfo) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 20 });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });

            const cardWidth = 243;
            const cardHeight = 153;
            const cardsPerRow = 2;
            const cardsPerColumn = 4;
            const cardsPerPage = cardsPerRow * cardsPerColumn;
            const horizontalSpacing = 30;
            const verticalSpacing = 20;

            students.forEach((student, index) => {
                if (index > 0 && index % cardsPerPage === 0) {
                    doc.addPage();
                }

                const cardIndex = index % cardsPerPage;
                const row = Math.floor(cardIndex / cardsPerRow);
                const col = cardIndex % cardsPerRow;

                const x = 20 + col * (cardWidth + horizontalSpacing);
                const y = 20 + row * (cardHeight + verticalSpacing);

                // Draw ID card
                doc.save();

                // Background
                doc.rect(x, y, cardWidth, cardHeight).fill('#1e40af');
                doc.rect(x, y, cardWidth, 40).fill('#3b82f6');

                // School name
                doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold');
                doc.text(schoolInfo.name || 'ABC School', x + 10, y + 10, { width: cardWidth - 20, align: 'center' });

                doc.fontSize(7).fillColor('#e0e7ff').font('Helvetica');
                doc.text('STUDENT ID CARD', x + 10, y + 28, { width: cardWidth - 20, align: 'center' });

                // Photo placeholder
                doc.rect(x + 15, y + 50, 50, 60).fill('#ffffff');
                doc.fontSize(6).fillColor('#666666');
                doc.text('PHOTO', x + 25, y + 75, { width: 30, align: 'center' });

                // Student details
                const detailsX = x + 75;
                let detailsY = y + 50;
                const lineHeight = 12;

                doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
                doc.text(student.full_name.toUpperCase(), detailsX, detailsY, { width: 150 });
                detailsY += lineHeight;

                doc.fontSize(7).fillColor('#e0e7ff').font('Helvetica');
                doc.text(`Class: ${student.class_name}-${student.section}`, detailsX, detailsY);
                detailsY += lineHeight;

                doc.text(`Roll No: ${student.roll_number}`, detailsX, detailsY);
                detailsY += lineHeight;

                doc.text(`Adm No: ${student.admission_number}`, detailsX, detailsY);
                detailsY += lineHeight;

                doc.text(`DOB: ${new Date(student.date_of_birth).toLocaleDateString()}`, detailsX, detailsY);

                // Footer
                doc.fontSize(6).fillColor('#93c5fd');
                doc.text(schoolInfo.academicYear || '2025-2026', x + 10, y + 135, { width: cardWidth - 20, align: 'center' });

                doc.restore();
            });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Generate Report Card PDF for a student
 * @param {Object} student - Student data
 * @param {Array} marks - Array of marks with subject details
 * @param {Object} examInfo - Exam information
 * @param {Object} schoolInfo - School information
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateReportCard = (student, marks, examInfo, schoolInfo) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });

            // Header
            doc.fontSize(20).fillColor('#1e40af').font('Helvetica-Bold');
            doc.text(schoolInfo.name || 'ABC School', { align: 'center' });

            doc.fontSize(10).fillColor('#666666').font('Helvetica');
            doc.text(schoolInfo.address || 'School Address', { align: 'center' });
            doc.moveDown(0.5);

            doc.fontSize(16).fillColor('#1e40af').font('Helvetica-Bold');
            doc.text('REPORT CARD', { align: 'center' });
            doc.moveDown(1);

            // Student Information
            doc.fontSize(11).fillColor('#000000').font('Helvetica');
            doc.text(`Student Name: ${student.full_name}`, 50, doc.y);
            doc.text(`Class: ${student.class_name}-${student.section}`, 350, doc.y - 11);
            doc.moveDown(0.5);

            doc.text(`Admission No: ${student.admission_number}`, 50, doc.y);
            doc.text(`Roll No: ${student.roll_number}`, 350, doc.y - 11);
            doc.moveDown(0.5);

            doc.text(`Exam: ${examInfo.exam_name}`, 50, doc.y);
            doc.text(`Academic Year: ${examInfo.academic_year}`, 350, doc.y - 11);
            doc.moveDown(1.5);

            // Marks Table
            const tableTop = doc.y;
            const tableLeft = 50;
            const colWidths = [40, 200, 100, 100, 100];

            // Table header
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
            doc.rect(tableLeft, tableTop, colWidths.reduce((a, b) => a + b), 25).fill('#3b82f6');

            doc.text('S.No', tableLeft + 5, tableTop + 8, { width: colWidths[0] });
            doc.text('Subject', tableLeft + colWidths[0] + 5, tableTop + 8, { width: colWidths[1] });
            doc.text('Max Marks', tableLeft + colWidths[0] + colWidths[1] + 5, tableTop + 8, { width: colWidths[2] });
            doc.text('Marks Obtained', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableTop + 8, { width: colWidths[3] });
            doc.text('Percentage', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, tableTop + 8, { width: colWidths[4] });

            // Table rows
            let currentY = tableTop + 25;
            let totalMarks = 0;
            let totalMaxMarks = 0;

            doc.fontSize(10).font('Helvetica').fillColor('#000000');

            marks.forEach((mark, index) => {
                const rowHeight = 25;
                const bgColor = index % 2 === 0 ? '#f3f4f6' : '#ffffff';

                doc.rect(tableLeft, currentY, colWidths.reduce((a, b) => a + b), rowHeight).fill(bgColor);

                doc.fillColor('#000000');
                doc.text((index + 1).toString(), tableLeft + 5, currentY + 8, { width: colWidths[0] });
                doc.text(mark.subject_name, tableLeft + colWidths[0] + 5, currentY + 8, { width: colWidths[1] });
                doc.text(mark.max_marks.toString(), tableLeft + colWidths[0] + colWidths[1] + 5, currentY + 8, { width: colWidths[2] });
                doc.text(mark.marks_obtained.toString(), tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, currentY + 8, { width: colWidths[3] });

                const percentage = ((mark.marks_obtained / mark.max_marks) * 100).toFixed(2);
                doc.text(`${percentage}%`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, currentY + 8, { width: colWidths[4] });

                totalMarks += parseFloat(mark.marks_obtained);
                totalMaxMarks += parseFloat(mark.max_marks);
                currentY += rowHeight;
            });

            // Total row
            doc.rect(tableLeft, currentY, colWidths.reduce((a, b) => a + b), 25).fill('#dbeafe');
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e40af');
            doc.text('TOTAL', tableLeft + 5, currentY + 8, { width: colWidths[0] + colWidths[1] });
            doc.text(totalMaxMarks.toString(), tableLeft + colWidths[0] + colWidths[1] + 5, currentY + 8, { width: colWidths[2] });
            doc.text(totalMarks.toString(), tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, currentY + 8, { width: colWidths[3] });

            const overallPercentage = ((totalMarks / totalMaxMarks) * 100).toFixed(2);
            doc.text(`${overallPercentage}%`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, currentY + 8, { width: colWidths[4] });

            currentY += 40;

            // Grade calculation
            let grade = 'F';
            if (overallPercentage >= 90) grade = 'A+';
            else if (overallPercentage >= 80) grade = 'A';
            else if (overallPercentage >= 70) grade = 'B+';
            else if (overallPercentage >= 60) grade = 'B';
            else if (overallPercentage >= 50) grade = 'C';
            else if (overallPercentage >= 40) grade = 'D';

            doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
            doc.text(`Overall Percentage: ${overallPercentage}%`, tableLeft, currentY);
            doc.text(`Grade: ${grade}`, tableLeft + 250, currentY);

            // Footer
            doc.fontSize(9).font('Helvetica').fillColor('#666666');
            doc.text('Principal Signature: _______________', tableLeft, 700);
            doc.text('Date: _______________', tableLeft + 300, 700);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};
