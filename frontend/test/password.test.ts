import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, PBKDF2_ITERATIONS } from '../../api/src/lib/password.ts';

test('hash has the pbkdf2$100000$salt$hash format and round-trips', async () => {
  const h = await hashPassword('correct horse battery staple');
  const parts = h.split('$');
  assert.equal(parts.length, 4);
  assert.equal(parts[0], 'pbkdf2');
  assert.equal(parts[1], String(PBKDF2_ITERATIONS));
  assert.equal(PBKDF2_ITERATIONS, 100000);
  assert.equal(Buffer.from(parts[2], 'base64').length, 16);
  assert.equal(Buffer.from(parts[3], 'base64').length, 32);
  assert.equal(await verifyPassword('correct horse battery staple', h), true);
});

test('wrong password is rejected', async () => {
  const h = await hashPassword('s3cret-password');
  assert.equal(await verifyPassword('s3cret-passwore', h), false);
  assert.equal(await verifyPassword('', h), false);
});

test('malformed and legacy hashes return false instead of throwing', async () => {
  const bad = [
    '', 'garbage', '$2a$10$abcdefghijklmnopqrstuuJ0Zq7lF0Xr1Z1h6m1yX7z8wqgk9l8hS', // bcrypt
    'pbkdf2$100000$', 'pbkdf2$abc$AAAA$AAAA', 'pbkdf2$0$AAAA$AAAA', 'pbkdf2$1000000$AAAA$AAAA',
    'pbkdf2$100000$!!!!$AAAA', 'pbkdf2$100000$AAAA$', 'pbkdf2$100000$AAAA$AAAA$extra', 'sha1$1$AAAA$AAAA',
  ];
  for (const h of bad) assert.equal(await verifyPassword('anything', h), false, h);
  assert.equal(await verifyPassword('anything', null as any), false);
  assert.equal(await verifyPassword('anything', undefined as any), false);
});

test('salts are unique per hash', async () => {
  const a = await hashPassword('same-password');
  const b = await hashPassword('same-password');
  assert.notEqual(a, b);
  assert.notEqual(a.split('$')[2], b.split('$')[2]);
  assert.equal(await verifyPassword('same-password', a), true);
  assert.equal(await verifyPassword('same-password', b), true);
});
