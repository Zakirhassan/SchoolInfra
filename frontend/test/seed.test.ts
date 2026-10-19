import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain .mjs script
import { buildAdminSeed } from '../../api/scripts/seed-admin.mjs';
import { verifyPassword } from '../../api/src/lib/password.ts';

const base = { DATABASE_URL: 'postgresql://u:p@example.neon.tech/neondb?sslmode=require', ADMIN_USERNAME: 'owner' };

test('seeded admin hash is accepted by the Worker verifyPassword', async () => {
  const seed = await buildAdminSeed({ ...base, ADMIN_PASSWORD: 'a-long-passphrase-42' });
  const [username, hash, fullName] = seed.params;
  assert.equal(username, 'owner');
  assert.equal(fullName, 'System Administrator');
  assert.match(hash, /^pbkdf2\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.equal(await verifyPassword('a-long-passphrase-42', hash), true);
  assert.equal(await verifyPassword('wrong-passphrase-42', hash), false);
  assert.match(seed.sql, /ON CONFLICT \(username\) DO NOTHING/);
  assert.ok(!seed.sql.includes('a-long-passphrase-42'));
});

test('seed refuses missing or short passwords and missing env', async () => {
  await assert.rejects(buildAdminSeed({ ...base }), /ADMIN_PASSWORD is required/);
  await assert.rejects(buildAdminSeed({ ...base, ADMIN_PASSWORD: '12345678901' }), /at least 12/);
  await assert.rejects(buildAdminSeed({ ADMIN_USERNAME: 'x', ADMIN_PASSWORD: 'x'.repeat(12) }), /DATABASE_URL/);
  await assert.rejects(buildAdminSeed({ DATABASE_URL: base.DATABASE_URL, ADMIN_PASSWORD: 'x'.repeat(12) }), /ADMIN_USERNAME/);
  const ok = await buildAdminSeed({ ...base, ADMIN_PASSWORD: 'x'.repeat(12), ADMIN_RESET_PASSWORD: '1' });
  assert.match(ok.sql, /DO UPDATE SET password_hash/);
});
