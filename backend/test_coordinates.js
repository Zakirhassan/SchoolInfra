import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

async function getPageInfo(filename) {
    const templatePath = path.join(TEMPLATES_DIR, filename);
    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    console.log(`\n=== ${filename} ===`);
    console.log(`Width: ${width} pts (${(width / 72).toFixed(2)} inches)`);
    console.log(`Height: ${height} pts (${(height / 72).toFixed(2)} inches)`);
    console.log(`Orientation: ${width > height ? 'Landscape' : 'Portrait'}`);
    return { width, height, pdfDoc, firstPage };
}

async function createGridOverlay(filename, outputName, gridSpacing = 50) {
    const { width, height, pdfDoc, firstPage } = await getPageInfo(filename);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Draw vertical grid lines
    for (let x = 0; x <= width; x += gridSpacing) {
        firstPage.drawLine({ start: { x, y: 0 }, end: { x, y: height }, thickness: 0.3, color: rgb(0.7, 0.7, 0.9), opacity: 0.7 });
        if (x % (gridSpacing * 2) === 0) {
            firstPage.drawText(`${Math.round(x)}`, { x: x + 1, y: 8, size: 7, font, color: rgb(0.3, 0.3, 0.8) });
        }
    }
    // Draw horizontal grid lines
    for (let y = 0; y <= height; y += gridSpacing) {
        firstPage.drawLine({ start: { x: 0, y }, end: { x: width, y }, thickness: 0.3, color: rgb(0.7, 0.7, 0.9), opacity: 0.7 });
        if (y % (gridSpacing * 2) === 0) {
            firstPage.drawText(`${Math.round(y)}`, { x: 5, y: y + 1, size: 7, font, color: rgb(0.3, 0.3, 0.8) });
        }
    }

    // Draw center crosshair
    firstPage.drawLine({ start: { x: width / 2, y: 0 }, end: { x: width / 2, y: height }, thickness: 1, color: rgb(1, 0, 0), opacity: 0.5 });
    firstPage.drawLine({ start: { x: 0, y: height / 2 }, end: { x: width, y: height / 2 }, thickness: 1, color: rgb(1, 0, 0), opacity: 0.5 });
    firstPage.drawText(`CENTER (${Math.round(width / 2)}, ${Math.round(height / 2)})`, { x: width / 2 + 5, y: height / 2 + 5, size: 8, font: boldFont, color: rgb(1, 0, 0) });

    const outputPath = path.join(TEMPLATES_DIR, outputName);
    await fs.writeFile(outputPath, await pdfDoc.save());
    console.log(`✅ Grid overlay saved: ${outputName}`);
}

// Run
await createGridOverlay('CERTIFICATE_TEMPLATE.pdf', 'cert_grid.pdf', 50);
await createGridOverlay('IDCARD_TEMPLATE.pdf', 'idcard_grid.pdf', 25);
process.exit(0);
