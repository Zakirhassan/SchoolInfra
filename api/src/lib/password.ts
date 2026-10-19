// PBKDF2-SHA256 password hashing via WebCrypto (crypto.subtle).
// bcryptjs cost 10 took ~155 ms CPU on Workers; the free plan allows 10 ms per request.
// Stored format: pbkdf2$<iterations>$<base64 salt>$<base64 hash>
// 100000 iterations is the maximum Cloudflare Workers' WebCrypto PBKDF2 accepts.
// No imports and only erasable TS syntax: this file is also loaded directly by Node
// (api/scripts/seed-admin.mjs and the tests), so the seed script and the Worker share it.

export const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const PREFIX = 'pbkdf2';

const enc = new TextEncoder();

const toB64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

const fromB64 = (b64: string): Uint8Array<ArrayBuffer> | null => {
  try {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
};

const derive = async (plain: string, salt: Uint8Array<ArrayBuffer>, iterations: number, bits: number): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey('raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits']);
  const buf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    bits
  );
  return new Uint8Array(buf);
};

/** Constant-time comparison (length is not secret: it is fixed by the format). */
const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

export const hashPassword = async (plain: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(plain, salt, PBKDF2_ITERATIONS, HASH_BITS);
  return `${PREFIX}$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
};

/** Returns false (never throws) for a wrong password or a malformed/legacy (e.g. bcrypt) hash. */
export const verifyPassword = async (plain: string, hash: string): Promise<boolean> => {
  try {
    if (typeof plain !== 'string' || typeof hash !== 'string') return false;
    const parts = hash.split('$');
    if (parts.length !== 4 || parts[0] !== PREFIX) return false;
    if (!/^\d+$/.test(parts[1])) return false;
    const iterations = Number(parts[1]);
    // Workers rejects > 100000; anything outside 1..100000 would throw in deriveBits.
    if (iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
    const salt = fromB64(parts[2]);
    const expected = fromB64(parts[3]);
    if (!salt || !expected || salt.length === 0 || expected.length === 0 || expected.length > 64) return false;
    const actual = await derive(plain, salt, iterations, expected.length * 8);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};
