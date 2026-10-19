import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBody } from '../../api/src/lib/body.ts';
import { contentTypeForName } from '../../api/src/lib/uploads.ts';
import { withoutPasswordHash, rowsWithoutPasswordHash } from '../../api/src/lib/redact.ts';
import { readFile } from 'node:fs/promises';

const ctx = (type: string, body: string) => ({
  req: {
    header: () => type,
    json: async () => JSON.parse(body),
    parseBody: async () => ({ form: true }),
  },
}) as any;

test('readBody returns {} for empty or malformed JSON', async () => {
  assert.deepEqual(await readBody(ctx('application/json', '')), {});
  assert.deepEqual(await readBody(ctx('application/json', '{bad')), {});
  assert.deepEqual(await readBody(ctx('application/json', 'null')), {});
  assert.deepEqual(await readBody(ctx('application/json', '{"a":1}')), { a: 1 });
  assert.deepEqual(await readBody(ctx('multipart/form-data', '')), { form: true });
});

test('contentTypeForName derives type from extension', () => {
  assert.equal(contentTypeForName('a.JPG'), 'image/jpeg');
  assert.equal(contentTypeForName('a.jpeg'), 'image/jpeg');
  assert.equal(contentTypeForName('a.png'), 'image/png');
  assert.equal(contentTypeForName('a.pdf'), 'application/pdf');
  assert.equal(contentTypeForName('a.html'), 'application/octet-stream');
});

test('withoutPasswordHash strips password_hash and keeps everything else', () => {
  assert.deepEqual(withoutPasswordHash({ id: 1, full_name: 'A', password_hash: 'pbkdf2$...' }), { id: 1, full_name: 'A' });
  assert.deepEqual(rowsWithoutPasswordHash([{ id: 1, password_hash: 'x' }, { id: 2 }]), [{ id: 1 }, { id: 2 }]);
  assert.equal(withoutPasswordHash(undefined), undefined);
});

test('student-returning routes never send raw student rows', async () => {
  // Every route that SELECTs s.* or RETURNING * from students must wrap the rows.
  const src = (f: string) => readFile(new URL(`../../api/src/routes/${f}`, import.meta.url), 'utf8');
  const students = await src('students.ts');
  const fees = await src('fees.ts');
  const studentHandlers = students.split(/\nr\.(?:get|post|put|patch|delete)\(/).slice(1)
    .filter((h) => /FROM students|UPDATE students|INSERT INTO students/.test(h) && /RETURNING \*|s\.\*/.test(h));
  assert.ok(studentHandlers.length >= 5, `found ${studentHandlers.length} handlers`);
  for (const h of studentHandlers) {
    assert.doesNotMatch(h, /c\.json\((result\.rows(\[0\])?|student)\s*[,)]/, h.slice(0, 80));
  }
  assert.match(fees, /UPDATE students SET fee_status = \$1 WHERE id = \$2 RETURNING \*[\s\S]*withoutPasswordHash\(result\.rows\[0\]\)/);
  const teachers = await src('teachers.ts');
  assert.doesNotMatch(teachers, /RETURNING \*|SELECT \* FROM teachers ORDER/);
});
