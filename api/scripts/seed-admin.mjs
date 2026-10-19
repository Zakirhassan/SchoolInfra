#!/usr/bin/env node
// Create the first admin in a fresh database.
//
//   DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require' \
//   ADMIN_USERNAME=owner ADMIN_PASSWORD='a long passphrase' \
//   [ADMIN_FULL_NAME='System Administrator'] \
//   npm run seed:admin
//
// The hash comes from the Worker's own api/src/lib/password.ts (Node >= 22.18 loads the
// .ts file directly), so the stored format is exactly what POST /api/auth/login verifies.
// Never prints or stores the password. Refuses passwords shorter than 12 characters.
// If the username already exists nothing is changed (exit code 1) unless
// ADMIN_RESET_PASSWORD=1, which replaces that admin's password hash.
import { pathToFileURL } from 'node:url';
import { hashPassword } from '../src/lib/password.ts';

export const MIN_PASSWORD_LENGTH = 12;

/** Validate env and build the parameterised statement. Throws Error with a user-facing message. */
export async function buildAdminSeed(env) {
  const url = (env.DATABASE_URL || '').trim();
  const username = (env.ADMIN_USERNAME || '').trim();
  const password = env.ADMIN_PASSWORD || '';
  const fullName = (env.ADMIN_FULL_NAME || 'System Administrator').trim();
  const reset = env.ADMIN_RESET_PASSWORD === '1';

  if (!url) throw new Error('DATABASE_URL is required (use the Neon *direct* connection string).');
  if (!username) throw new Error('ADMIN_USERNAME is required.');
  if (username.length > 50) throw new Error('ADMIN_USERNAME must be at most 50 characters.');
  if (!password) throw new Error('ADMIN_PASSWORD is required (there is no default password).');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (!fullName || fullName.length > 100) throw new Error('ADMIN_FULL_NAME must be 1-100 characters.');

  const passwordHash = await hashPassword(password);
  const sql = reset
    ? `INSERT INTO admins (username, password_hash, full_name) VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, username`
    : `INSERT INTO admins (username, password_hash, full_name) VALUES ($1, $2, $3)
       ON CONFLICT (username) DO NOTHING
       RETURNING id, username`;
  return { url, username, sql, params: [username, passwordHash, fullName], reset };
}

async function main() {
  let seed;
  try {
    seed = await buildAdminSeed(process.env);
  } catch (e) {
    console.error(`seed-admin: ${e.message}`);
    process.exit(2);
  }
  // Loaded lazily so the tests can import buildAdminSeed without the driver installed.
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(seed.url);
  const rows = await sql.query(seed.sql, seed.params);
  if (rows.length === 0) {
    console.error(`seed-admin: admin "${seed.username}" already exists; nothing changed. ` +
      'Set ADMIN_RESET_PASSWORD=1 to replace its password.');
    process.exit(1);
  }
  console.log(`seed-admin: ${seed.reset ? 'upserted' : 'created'} admin "${rows[0].username}" (id ${rows[0].id}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('seed-admin failed:', e.message);
    process.exit(1);
  });
}
