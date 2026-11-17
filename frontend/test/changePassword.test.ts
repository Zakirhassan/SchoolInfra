import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from '../../api/node_modules/hono/dist/index.js';
import { sign } from '../../api/node_modules/hono/dist/middleware/jwt/index.js';
import authRoutes from '../../api/src/routes/auth.ts';
import { hashPassword, verifyPassword } from '../../api/src/lib/password.ts';
import { validateNewPassword, passwordStatus } from '../../api/src/lib/passwordPolicy.ts';
import { shouldShowBanner, validatePasswordForm } from '../src/lib/passwordReminder.ts';

const SECRET = 'test-secret';
const OLD = 'old-passphrase-123';

// Minimal in-memory stand-in for the Neon pool (only the admins queries these routes issue).
async function makeApp() {
  const admin: any = { id: 1, password_hash: await hashPassword(OLD), password_changed_at: new Date('2020-01-01T00:00:00Z') };
  const db: any = {
    query: async (sql: string, params: any[] = []) => {
      if (/^SELECT id, password_hash FROM admins/.test(sql)) return { rows: params[0] === admin.id ? [{ id: admin.id, password_hash: admin.password_hash }] : [] };
      if (/^SELECT password_changed_at FROM admins/.test(sql)) return { rows: params[0] === admin.id ? [{ password_changed_at: admin.password_changed_at }] : [] };
      if (/^UPDATE admins SET password_hash = \$1, password_changed_at = NOW\(\)/.test(sql)) {
        admin.password_hash = params[0]; admin.password_changed_at = new Date(); return { rows: [] };
      }
      if (/^INSERT INTO audit_logs/.test(sql)) return { rows: [] };
      throw new Error('unexpected query: ' + sql);
    },
  };
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('db' as never, db as never); await next(); });
  app.route('/auth', authRoutes as any);
  const call = async (path: string, role: string | null, body?: unknown) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (role) headers.authorization = 'Bearer ' + await sign({ id: 1, username: 'owner', role, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET);
    return app.request('/auth' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }, { JWT_SECRET: SECRET });
  };
  return { admin, call };
}

test('change-password requires authentication and admin role', async () => {
  const { call } = await makeApp();
  assert.equal((await call('/change-password', null, { oldPassword: OLD, newPassword: 'x'.repeat(14) })).status, 401);
  assert.equal((await call('/change-password', 'TEACHER', { oldPassword: OLD, newPassword: 'x'.repeat(14) })).status, 403);
  assert.equal((await call('/password-status', 'STUDENT')).status, 403);
});

test('change-password validation and wrong old password', async () => {
  const { call, admin } = await makeApp();
  assert.equal((await call('/change-password', 'ADMIN', { oldPassword: OLD, newPassword: 'short' })).status, 400);
  assert.equal((await call('/change-password', 'ADMIN', { oldPassword: OLD, newPassword: OLD })).status, 400);
  assert.equal((await call('/change-password', 'ADMIN', { newPassword: 'x'.repeat(14) })).status, 400);
  const wrong = await call('/change-password', 'ADMIN', { oldPassword: 'not-the-password', newPassword: 'x'.repeat(14) });
  assert.equal(wrong.status, 401);
  assert.equal(((await wrong.json()) as any).error, 'Invalid old password');
  assert.equal(await verifyPassword(OLD, admin.password_hash), true);
});

test('change-password success updates hash and timestamp; status reflects it', async () => {
  const { call, admin } = await makeApp();
  const before = await (await call('/password-status', 'ADMIN')).json() as any;
  assert.equal(before.changeRequired, true);
  const res = await call('/change-password', 'ADMIN', { username: 'ignored', oldPassword: OLD, newPassword: 'brand-new-passphrase' });
  assert.equal(res.status, 200);
  assert.equal(await verifyPassword('brand-new-passphrase', admin.password_hash), true);
  assert.equal(await verifyPassword(OLD, admin.password_hash), false);
  const after = await (await call('/password-status', 'ADMIN')).json() as any;
  assert.equal(after.changeRequired, false);
  assert.equal(after.daysSinceChange, 0);
});

test('password policy helpers', () => {
  assert.match(validateNewPassword('a', 'short')!, /at least 12/);
  assert.match(validateNewPassword('x'.repeat(12), 'x'.repeat(12))!, /different/);
  assert.equal(validateNewPassword('a', 'x'.repeat(12)), null);
  const now = new Date('2026-02-01T00:00:00Z');
  assert.equal(passwordStatus('2026-01-03T00:00:00Z', now).changeRequired, false);
  assert.equal(passwordStatus('2026-01-02T00:00:00Z', now).changeRequired, true);
  assert.equal(passwordStatus('2026-01-02T00:00:00Z', now).daysSinceChange, 30);
  assert.equal(passwordStatus(null, now).changeRequired, true);
});

test('banner visibility and form validation', () => {
  const due = { changeRequired: true };
  assert.equal(shouldShowBanner('ADMIN', due, false), true);
  assert.equal(shouldShowBanner('ADMIN', due, true), false);
  assert.equal(shouldShowBanner('ADMIN', { changeRequired: false }, false), false);
  assert.equal(shouldShowBanner('TEACHER', due, false), false);
  assert.equal(shouldShowBanner('ADMIN', null, false), false);
  assert.equal(shouldShowBanner('ADMIN', due, false, '/change-password'), false);
  assert.ok(validatePasswordForm('', 'x'.repeat(12), 'x'.repeat(12)));
  assert.ok(validatePasswordForm('old', 'short', 'short'));
  assert.ok(validatePasswordForm('old', 'x'.repeat(12), 'y'.repeat(12)));
  assert.equal(validatePasswordForm('old', 'x'.repeat(12), 'x'.repeat(12)), null);
});
