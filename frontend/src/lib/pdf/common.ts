// Shared helpers for the browser port of backend/services/pdfGenerator.js.
// The Worker returns the same rows the old routes passed to the generators;
// the browser fills the PDF templates (served from /templates/) with pdf-lib.
import { PDFDocument, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import { API_ORIGIN, resolveAssetUrl } from '../assetUrl.ts';

export const CERTIFICATE_TEMPLATE = 'CERTIFICATE_TEMPLATE.pdf';
export const IDCARD_TEMPLATE = 'IDCARD_TEMPLATE.pdf';

// Where photo_url ("/uploads/photos/x.jpg") is served: the Worker origin (see ../assetUrl.ts).
export { API_ORIGIN };

// Byte sources. The browser uses fetch; tests inject a loader that reads from disk.
export type Bytes = ArrayBuffer | Uint8Array;
export type Loader = {
    template: (name: string) => Promise<Bytes>;
    photo: (photoUrl: string) => Promise<Bytes>;
};

export const browserLoader: Loader = {
    // Edit 1: fs.readFile(TEMPLATE) -> fetch('/templates/...'). A 404 stands in for the old fs.access check.
    template: async (name) => {
        const res = await fetch(`/templates/${name}`);
        if (!res.ok) throw new Error(`Template not found: /templates/${name}`);
        return res.arrayBuffer();
    },
    // Edit 2: fs.readFile(absPath) -> fetch(resolveAssetUrl(photoUrl)). A missing photo
    // gives bytes that fail to embed, and embedPhoto skips it silently as before.
    photo: async (photoUrl) => (await fetch(resolveAssetUrl(photoUrl))).arrayBuffer(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export async function loadTemplate(templateName: string, loader: Loader) {
    const bytes = await loader.template(templateName);
    return PDFDocument.load(bytes);
}

export function drawField(page: PDFPage, text: any, field: any, normalFont: PDFFont, boldFont: PDFFont) {
    page.drawText(String(text || ''), {
        x: field.x,
        y: field.y,
        size: field.size,
        font: field.bold ? boldFont : normalFont,
        color: rgb(0, 0, 0),
    });
}

// Over JSON a Postgres DATE arrives as an ISO string ("2010-01-15T00:00:00.000Z").
// The old server got a local-midnight Date from pg. Rebuild that local Date so the
// printed day is the stored day in every browser time zone (same as lib/excel/exportStudents.ts).
function toLocalDate(d: any) {
    if (typeof d !== 'string') return d;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : d;
}

export function fmtDate(d: any) {
    return d ? new Date(toLocalDate(d)).toLocaleDateString('en-GB') : '';
}

// Edit 3: generators return the Uint8Array from pdfDoc.save(); the page turns it into a download.
export function downloadPdf(bytes: Uint8Array, filename: string) {
    const url = window.URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
}
