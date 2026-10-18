// Run: npm test. Fills the real templates in public/templates with pdf-lib
// (disk loader instead of fetch) and checks the output PDF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { generateIDCard, generateBulkIDCards, IDCARD, PHOTO_BOX } from '../src/lib/pdf/idCard.ts';
import { generateCertificate, calcGrade, CERT } from '../src/lib/pdf/certificate.ts';
import { generateReportCardFromData } from '../src/lib/pdf/reportCard.ts';
import { fmtDate } from '../src/lib/pdf/common.ts';
import type { Loader } from '../src/lib/pdf/common.ts';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const photos: Record<string, string> = {
  '/uploads/photos/photo-1.jpg': here('./fixtures/photo.jpg'),
  '/uploads/photos/photo-2.PNG': here('./fixtures/photo.png'),
};
const photoRequests: string[] = [];
const loader: Loader = {
  template: (name) => readFile(here(`../public/templates/${name}`)),
  photo: async (url) => {
    photoRequests.push(url);
    if (!photos[url]) throw new Error('404');
    return readFile(photos[url]);
  },
};

const student = {
  id: 1, admission_number: 'ADM001', roll_number: '12', full_name: 'John Doe', father_name: 'Robert Doe',
  class_name: 'Web Development', section: 'A', course_name: 'Web Development',
  date_of_birth: '2010-01-15T00:00:00.000Z', start_date: '2026-01-05T00:00:00.000Z',
  tentative_end_date: '2026-06-30T00:00:00.000Z', phone_number: '+1234567890', photo_url: null as string | null,
};
const longName = 'Muhammad Abdul Rahman Siddiqui Al-Hashimi Bin Zakir Hassan Khan';
const schoolInfo = { name: 'ABC School', address: '123 Main Street', phone: '+1234567890', academicYear: '2025-2026' };
const marks = [{ marks_obtained: '45', max_marks: 50 }, { marks_obtained: '40', max_marks: 50 }];

const hex = (s: string) => '<' + Buffer.from(s, 'latin1').toString('hex').toUpperCase() + '>';

async function pageInfo(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map(p => {
    const contents = p.node.Contents();
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    const text = refs.map(r => {
      const s = doc.context.lookup(r as any);
      return s instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(s).decode()).toString('latin1') : '';
    }).join('\n');
    const xobj = p.node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict);
    const images = (xobj?.keys() ?? []).filter(k => {
      const o = doc.context.lookup(xobj!.get(k)) as any;
      return o?.dict?.get(PDFName.of('Subtype'))?.toString() === '/Image';
    }).length;
    return { size: p.getSize(), text, images };
  });
}

async function template(name: string) {
  const doc = await PDFDocument.load(await loader.template(name));
  return { pages: doc.getPageCount(), size: doc.getPages()[0].getSize(), info: (await pageInfo(await doc.save()))[0] };
}

test('ID card without photo: valid PDF, template size, fields at the old positions', async () => {
  const tpl = await template('IDCARD_TEMPLATE.pdf');
  const out = await generateIDCard(student, schoolInfo, loader);
  assert.ok(out instanceof Uint8Array);
  assert.equal(Buffer.from(out.subarray(0, 5)).toString(), '%PDF-');
  const pages = await pageInfo(out);
  assert.equal(pages.length, tpl.pages);
  assert.deepEqual(pages[0].size, tpl.size);
  assert.equal(pages[0].images, tpl.info.images);
  const t = pages[0].text;
  assert.ok(t.includes(`${IDCARD.studentName.x} ${IDCARD.studentName.y} Tm`));
  assert.ok(t.includes(hex('John Doe')));
  assert.ok(t.includes(hex('Robert Doe')));
  assert.ok(t.includes(hex('Web Development')));
  assert.ok(t.includes(hex('12')));
  assert.ok(t.includes(hex(fmtDate(student.date_of_birth))));
  assert.ok(t.includes(hex('+1234567890')));
});

test('ID card with JPEG and PNG photos: image drawn in PHOTO_BOX', async () => {
  const tpl = await template('IDCARD_TEMPLATE.pdf');
  for (const url of ['/uploads/photos/photo-1.jpg', '/uploads/photos/photo-2.PNG']) {
    const out = await generateIDCard({ ...student, photo_url: url }, schoolInfo, loader);
    const [p] = await pageInfo(out);
    assert.deepEqual(p.size, tpl.size);
    assert.equal(p.images, tpl.info.images + 1, url);
    const { x, y, width, height } = PHOTO_BOX;
    assert.ok(p.text.includes(`1 0 0 1 ${x} ${y} cm`) && p.text.includes(`${width} 0 0 ${height} 0 0 cm`), url);
  }
});

test('ID card with a missing or broken photo is still generated (photo skipped silently)', async () => {
  const tpl = await template('IDCARD_TEMPLATE.pdf');
  const out = await generateIDCard({ ...student, photo_url: '/uploads/photos/gone.jpg' }, schoolInfo, loader);
  const [p] = await pageInfo(out);
  assert.equal(p.images, tpl.info.images);
  assert.ok(photoRequests.includes('/uploads/photos/gone.jpg'));
});

test('ID card with a long name and missing fields', async () => {
  const out = await generateIDCard({ ...student, full_name: longName, father_name: null, date_of_birth: null }, schoolInfo, loader);
  const [p] = await pageInfo(out);
  assert.ok(p.text.includes(hex(longName)));
});

test('bulk ID cards: one template-sized page per student, in order', async () => {
  const tpl = await template('IDCARD_TEMPLATE.pdf');
  const list = [
    { ...student, full_name: 'Alice', photo_url: '/uploads/photos/photo-1.jpg' },
    { ...student, full_name: longName, photo_url: null },
    { ...student, full_name: 'Carol', photo_url: '/uploads/photos/photo-2.PNG' },
  ];
  const pages = await pageInfo(await generateBulkIDCards(list, schoolInfo, loader));
  assert.equal(pages.length, 3);
  pages.forEach(p => assert.deepEqual(p.size, tpl.size));
  assert.ok(pages[0].text.includes(hex('Alice')));
  assert.ok(pages[1].text.includes(hex(longName)));
  assert.ok(pages[2].text.includes(hex('Carol')));
  assert.deepEqual(pages.map(p => p.images), [tpl.info.images + 1, tpl.info.images, tpl.info.images + 1]);
});

test('certificate / report card: valid PDF, template size, fields at the old positions', async () => {
  const tpl = await template('CERTIFICATE_TEMPLATE.pdf');
  const out = await generateReportCardFromData({ student: { ...student, full_name: longName }, marks, exam: { id: 3 }, schoolInfo }, loader);
  const pages = await pageInfo(out);
  assert.equal(pages.length, tpl.pages);
  assert.deepEqual(pages[0].size, tpl.size);
  const t = pages[0].text;
  for (const f of Object.values(CERT)) assert.ok(t.includes(`${f.x} ${f.y} Tm`), JSON.stringify(f));
  assert.ok(t.includes(hex(longName)));
  assert.ok(t.includes(hex('Web Development')));
  assert.ok(t.includes(hex(fmtDate(student.start_date))));
  assert.ok(t.includes(hex(fmtDate(student.tentative_end_date))));
  assert.ok(t.includes(hex('A')));
  assert.ok(t.includes(hex('ADM001')));
  // course_name falls back to class_name
  const out2 = await generateCertificate({ ...student, course_name: null, class_name: 'Fallback' }, marks, {}, schoolInfo, loader);
  assert.ok((await pageInfo(out2))[0].text.includes(hex('Fallback')));
});

test('calcGrade and fmtDate behave like the originals', () => {
  assert.equal(calcGrade(marks), 'A');
  assert.equal(calcGrade([]), 'F');
  assert.equal(calcGrade([{ marks_obtained: 39, max_marks: 100 }]), 'F');
  assert.equal(calcGrade([{ marks_obtained: 90, max_marks: 100 }]), 'A+');
  assert.equal(fmtDate(null), '');
  // ISO date string from JSON prints the stored day in any zone
  assert.equal(fmtDate('2010-01-15T00:00:00.000Z'), '15/01/2010');
});
