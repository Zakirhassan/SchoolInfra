import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBody } from '../../api/src/lib/body.ts';
import { contentTypeForName } from '../../api/src/lib/uploads.ts';

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
