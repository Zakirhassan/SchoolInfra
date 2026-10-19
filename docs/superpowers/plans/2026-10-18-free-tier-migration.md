# ASDC-ZRM Free-Tier Production Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status (2026-10-19): code done (PR #4 + feat/fresh-start); for the remaining owner steps `docs/OWNER-TODO.md` supersedes this plan.** Changes since the plan was written:
> - **Fresh start, no data migration.** All existing data is scrap. Task 4 (Supabase -> Neon import, row counts), the cut-over re-import, the parity runs against the old backend and the 14-day Render/Supabase rollback are dropped. The database is created from `api/db/schema.sql` and the first admin from `api/scripts/seed-admin.mjs`. Rollback = previous Pages/Workers deployment + restore the latest backup (`docs/RUNBOOK.md`).
> - **Task 1 CPU gate resolved: PBKDF2.** A spike measured bcryptjs at ~155 ms CPU on Workers (free plan: 10 ms). `api/src/lib/password.ts` now uses WebCrypto PBKDF2-SHA256, 100000 iterations, stored as `pbkdf2$100000$<b64salt>$<b64hash>`; `bcryptjs` is removed. No forced password reset is needed because there are no existing users. The "existing bcrypt hashes must keep working" constraint below no longer applies.
> - **Student bulk upload/update removed** (`POST /students/bulk-upload`, `POST /students/bulk-update`, `GET /students/update-template/:classId`, `api/src/lib/studentRows.ts`, the ExcelUpload component), so the bulk CPU checks are gone. Attendance Excel upload stays (it is the only way to record attendance), as does student Excel export.
> - Owner order: (1) Neon project + schema + seed admin, (2) R2/B2 buckets, age key, GitHub secrets (`DATABASE_URL_DIRECT` = Neon direct from the start), run the 3 workflows, (3) deploy Worker/Pages/domain/monitoring, (4) smoke test + restore drill into a Neon branch.

**Goal:** Run the school system in production for ~$1/month (domain only), always on, with automated, encrypted, restore-tested backups of the database and uploaded files.

**Architecture:** Cloudflare Pages (React frontend) → Cloudflare Workers + Hono (API, ported from Express) → Neon Postgres (data) + Cloudflare R2 (photos/documents). GitHub Actions runs nightly `pg_dump` → `age` encryption → R2 + Backblaze B2 (two providers), plus a monthly automated restore test. PDF and Excel work moves to the browser because the Workers free plan allows 10 ms CPU per request.

**Tech Stack:** Hono, Wrangler, `@neondatabase/serverless`, R2, GitHub Actions, `age`, `rclone`, PostgreSQL 17 client, Healthchecks.io.

**Spec:** conversation of 2026-10-18 (no separate spec file). Source of truth for current behaviour: `backend/routes/*.js`, `backend/services/*.js`.

## Global Constraints

- Recurring cost target: $0/month (domain ≈ $10–12/year only). Workers Paid ($5/mo) is allowed ONLY if Task 1's spike fails and the owner approves.
- API behaviour must stay identical: same paths (`/api/...`), same JSON shapes, same status codes (401 no token, 403 bad token, 409 on unique violation).
- Stored upload URLs keep the format `/uploads/<folder>/<file>` so no DB data migration is needed; the Worker serves `/uploads/*` from R2.
- Existing JWT/password formats: HS256 with the same `JWT_SECRET` format; existing bcrypt hashes must keep working (see Task 1 gate).
- Backups are never stored unencrypted off the runner; the `age` private key is kept offline (password manager + paper) and is NEVER committed.
- Secrets live in Wrangler secrets / GitHub Actions secrets only. Rotate the Postgres password that was pasted in chat on 2026-10-18 before go-live.
- Every step is reversible until Task 13 (old Render + Supabase stay untouched until then).

## File Structure

```
.github/workflows/db-backup.yml        nightly dump → encrypt → R2 + B2
.github/workflows/restore-test.yml     monthly restore into throwaway Postgres + row-count asserts
.github/workflows/files-backup.yml     nightly R2 files bucket → B2 (copy, never delete)
api/                                   NEW Worker (Hono); replaces backend/ at cut-over
  wrangler.toml, package.json
  src/index.ts                         app, CORS, db middleware, /health, /uploads/*
  src/types.ts                         Env, User, AppCtx
  src/lib/{db,auth,body,uploads}.ts    pool-per-request, JWT + audit, JSON/multipart body, R2 helpers
  src/routes/{auth,students,teachers,classes,subjects,fees,attendance,reports,idcards,export,auditLogs}.ts
  scripts/parity.mjs                   compares Express vs Worker GET responses
frontend/src/lib/pdf/                  browser PDF generation (moved from backend/services/pdfGenerator.js)
frontend/src/lib/excel/                browser Excel parse/build (moved from backend/services/*)
frontend/public/templates/             CERTIFICATE_TEMPLATE.pdf, IDCARD_TEMPLATE.pdf (moved from backend/templates)
```

---

## Phase A — Protect the data first (works against today's Supabase DB)

### Task 1: Feasibility spike (decides free vs $5)

**Files:** Create `api-spike/` (throwaway Worker, deleted at the end).

- [ ] **Step 1:** `npm create cloudflare@latest api-spike -- --type hello-world --ts`, `cd api-spike && npm i bcryptjs`, then set `src/index.ts`:

```ts
import bcrypt from 'bcryptjs';
export default {
  async fetch(): Promise<Response> {
    const hash = bcrypt.hashSync('admin123', 10);   // same cost as backend/init-db.js
    bcrypt.compareSync('admin123', hash);           // what every login does
    return Response.json({ ok: true });
  },
};
```
- [ ] **Step 2:** `npx wrangler deploy`, call the URL 10 times, then read the real number in Dashboard → Workers → api-spike → Metrics → "CPU time" (p50/p99). Local `performance.now()` is not the billed figure.
- [ ] **Step 3: Decision gate.**
  - p99 CPU ≤ 10 ms → stay free; continue.
  - Otherwise pick ONE and write it at the top of this plan: (a) Workers Paid, $5/mo (30 s CPU); or (b) free plan + move passwords to PBKDF2 via WebCrypto (`crypto.subtle.deriveBits`) with a forced password reset for all users (adds a task before Task 6). bcrypt at cost 10 will very likely fail this gate on the free plan.
- [ ] **Step 4:** `npx wrangler delete`, remove `api-spike/`, commit the recorded decision: `git add docs && git commit -m "docs: record Workers CPU spike decision"`.

### Task 2: Nightly encrypted backup of the CURRENT database

**Files:** Create `.github/workflows/db-backup.yml`.

- [ ] **Step 1: One-time setup (manual, ~15 min).**
  1. Cloudflare → R2 → create private buckets `asdc-backups` and `asdc-files`. On `asdc-backups` add lifecycle rules: delete under `daily/` after 30 days; under `weekly/` after 365 days.
  2. R2 → Manage API tokens → token with Object Read & Write on both buckets. Note Access Key ID, Secret, and endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
  3. Backblaze B2 → private bucket `asdc-backups-b2` + application key (second provider, so one account lockout cannot lose everything).
  4. On YOUR laptop: `age-keygen -o asdc-backup.key`. Keep the file offline (password manager attachment + printed copy). Copy only the `age1...` PUBLIC key.
  5. healthchecks.io → check "asdc-db-backup", period 1 day, grace 3 hours → copy the ping URL.
  6. GitHub repo → Settings → Secrets → Actions: `DATABASE_URL_DIRECT` (Supabase direct/session string for now; later the NON-pooled Neon string), `AGE_PUBLIC_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `B2_KEY_ID`, `B2_APP_KEY`, `HC_PING_URL`.
- [ ] **Step 2: Write the workflow.**

```yaml
name: db-backup
on:
  schedule:
    - cron: '17 21 * * *'        # 02:47 IST daily
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      RCLONE_CONFIG_R2_TYPE: s3
      RCLONE_CONFIG_R2_PROVIDER: Cloudflare
      RCLONE_CONFIG_R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
      RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
      RCLONE_CONFIG_R2_ENDPOINT: ${{ secrets.R2_ENDPOINT }}
      RCLONE_CONFIG_B2_TYPE: b2
      RCLONE_CONFIG_B2_ACCOUNT: ${{ secrets.B2_KEY_ID }}
      RCLONE_CONFIG_B2_KEY: ${{ secrets.B2_APP_KEY }}
    steps:
      - name: Install tools (pg client 17, age, rclone)
        run: |
          sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
          wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc >/dev/null
          sudo apt-get update
          sudo apt-get install -y postgresql-client-17 age rclone

      - name: Dump
        run: |
          pg_dump "${{ secrets.DATABASE_URL_DIRECT }}" \
            --schema=public --format=custom --no-owner --no-privileges -f school.dump
          test "$(stat -c%s school.dump)" -gt 10000
          pg_restore --list school.dump > /dev/null     # proves the archive is readable

      - name: Encrypt
        run: age -r "${{ secrets.AGE_PUBLIC_KEY }}" -o school.dump.age school.dump && rm school.dump

      - name: Upload (R2 + B2)
        run: |
          STAMP=$(date -u +%Y-%m-%dT%H%MZ)
          rclone copyto school.dump.age "R2:asdc-backups/daily/school-$STAMP.dump.age"
          rclone copyto school.dump.age "B2:asdc-backups-b2/daily/school-$STAMP.dump.age"
          if [ "$(date -u +%u)" = "7" ]; then
            rclone copyto school.dump.age "R2:asdc-backups/weekly/school-$STAMP.dump.age"
          fi

      - name: Ping healthcheck
        if: success()
        run: curl -fsS -m 10 --retry 3 "${{ secrets.HC_PING_URL }}"
      - name: Ping failure
        if: failure()
        run: curl -fsS -m 10 --retry 3 "${{ secrets.HC_PING_URL }}/fail" || true
```
- [ ] **Step 3:** GitHub → Actions → db-backup → Run workflow. Expected: green; healthcheck shows "up"; `daily/school-*.dump.age` exists in both R2 and B2.
- [ ] **Step 4:** `git add .github/workflows/db-backup.yml && git commit -m "ci: nightly encrypted database backup to R2 and B2"`.

### Task 3: Automated restore test (a backup you never restored is not a backup)

**Files:** Create `.github/workflows/restore-test.yml`. Extra secret: `AGE_SECRET_KEY` (contents of `asdc-backup.key`). Trade-off: GitHub can then decrypt your backups; if you disagree, skip the secret and run this test by hand monthly.

- [ ] **Step 1: Write the workflow.**

```yaml
name: restore-test
on:
  schedule:
    - cron: '0 3 1 * *'          # 1st of every month
  workflow_dispatch:

jobs:
  restore:
    runs-on: ubuntu-latest
    services:
      pg:
        image: postgres:17
        env: { POSTGRES_PASSWORD: test }
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-retries 10
    env:
      RCLONE_CONFIG_R2_TYPE: s3
      RCLONE_CONFIG_R2_PROVIDER: Cloudflare
      RCLONE_CONFIG_R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
      RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
      RCLONE_CONFIG_R2_ENDPOINT: ${{ secrets.R2_ENDPOINT }}
      PGPASSWORD: test
    steps:
      - name: Install tools
        run: |
          sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
          wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc >/dev/null
          sudo apt-get update
          sudo apt-get install -y postgresql-client-17 age rclone

      - name: Fetch + decrypt newest daily backup
        run: |
          LATEST=$(rclone lsf R2:asdc-backups/daily/ | sort | tail -1)
          rclone copyto "R2:asdc-backups/daily/$LATEST" latest.age
          echo "${{ secrets.AGE_SECRET_KEY }}" > key.txt
          age -d -i key.txt -o latest.dump latest.age

      - name: Restore into throwaway Postgres
        run: |
          createdb -h localhost -U postgres restored
          pg_restore -h localhost -U postgres -d restored --no-owner latest.dump

      - name: Assert data is really there
        run: |
          q() { psql -h localhost -U postgres -d restored -tAc "$1"; }
          test "$(q 'select count(*) from admins')"  -ge 1
          test "$(q 'select count(*) from classes')" -ge 1
          echo "students=$(q 'select count(*) from students') teachers=$(q 'select count(*) from teachers')"
```
- [ ] **Step 2:** Run manually. Expected: green with row counts printed. If it fails, the backup is broken: fix before continuing.
- [ ] **Step 3:** `git add .github/workflows/restore-test.yml && git commit -m "ci: monthly automated restore test"`.

---

## Phase B — New database

### Task 4: Move data to Neon

**Files:** none (operational). Record counts in `docs/superpowers/plans/migration-log.md`.

- [ ] **Step 1:** Neon → new project `asdc`, region nearest your users, Postgres 17. Copy BOTH connection strings: pooled (`-pooler` host, used by the Worker) and direct (pg_dump/migrations).
- [ ] **Step 2: Capture Supabase row counts** (save the output):

```bash
for t in admins classes students subjects exams marks fee_payments teachers student_documents attendance audit_logs; do
  echo -n "$t "; psql "$SUPABASE_URL" -tAc "select count(*) from $t"; done
```
- [ ] **Step 3: Dump and restore.**

```bash
pg_dump "$SUPABASE_URL" --schema=public --format=custom --no-owner --no-privileges -f migrate.dump
pg_restore --no-owner --no-privileges -d "$NEON_DIRECT_URL" migrate.dump
```
- [ ] **Step 4:** Repeat the count loop against `$NEON_DIRECT_URL`; every number must match. If later inserts fail with duplicate keys, reset sequences: `select setval(pg_get_serial_sequence('students','id'), (select max(id) from students));` for each table with a serial id.
- [ ] **Step 5:** Point the existing Express backend at Neon (`backend/.env`: `DATABASE_URL=<neon pooled>`), run `npm run dev`, log in and click through Students/Fees. Expected: identical data.
- [ ] **Step 6:** Switch the GitHub secret `DATABASE_URL_DIRECT` to the Neon DIRECT string; run db-backup and restore-test manually. Expected: both green.

---

## Phase C — Port the API to Workers

### Task 5: Worker skeleton (db, auth, CORS, health, uploads serving)

**Files:** Create `api/package.json`, `api/wrangler.toml`, `api/src/{index,types}.ts`, `api/src/lib/{db,auth,body,uploads}.ts`, `api/scripts/parity.mjs`.

**Interfaces — Produces (used by every later task):**
- `Env { DATABASE_URL: string; JWT_SECRET: string; FRONTEND_URL: string; FILES: R2Bucket }`
- `AppCtx = { Bindings: Env; Variables: { db: Pool; user: User } }`, `User = { id: number; username: string; role: 'ADMIN'|'TEACHER'|'STUDENT' }`
- `authenticate: MiddlewareHandler<AppCtx>`; `generateToken(env: Env, p: User): Promise<string>`; `logAction(db: Pool, userId: number, role: string, action: string, details: unknown): Promise<void>`
- `readBody(c: Context): Promise<Record<string, any>>`
- `putUpload(env: Env, folder: 'photos'|'documents', file: File, kind: 'image'|'document'): Promise<string>` returns `/uploads/<folder>/<name>`; `deleteUpload(env: Env, url: string): Promise<void>`

- [ ] **Step 1:** `mkdir api && cd api && npm init -y && npm i hono @neondatabase/serverless bcryptjs && npm i -D wrangler typescript @cloudflare/workers-types`.
- [ ] **Step 2: `api/wrangler.toml`**

```toml
name = "asdc-api"
main = "src/index.ts"
compatibility_date = "2026-10-01"
compatibility_flags = ["nodejs_compat"]

[[r2_buckets]]
binding = "FILES"
bucket_name = "asdc-files"

[observability]
enabled = true
```
- [ ] **Step 3: `api/src/types.ts`**

```ts
import type { Pool } from '@neondatabase/serverless';
export type Env = { DATABASE_URL: string; JWT_SECRET: string; FRONTEND_URL: string; FILES: R2Bucket };
export type User = { id: number; username: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' };
export type AppCtx = { Bindings: Env; Variables: { db: Pool; user: User } };
```
- [ ] **Step 4: `api/src/lib/db.ts`** (a fresh pool per request is the documented Workers pattern)

```ts
import { Pool } from '@neondatabase/serverless';
import type { MiddlewareHandler } from 'hono';
import type { AppCtx } from '../types';

export const withDb: MiddlewareHandler<AppCtx> = async (c, next) => {
  const pool = new Pool({ connectionString: c.env.DATABASE_URL });
  c.set('db', pool);
  try { await next(); } finally { c.executionCtx.waitUntil(pool.end()); }
};
```
`pool.query(sql, params)` returns `{ rows, rowCount }` exactly like `pg`, so SQL strings are copied unchanged.
- [ ] **Step 5: `api/src/lib/auth.ts`** (status codes match `backend/config/auth.js`)

```ts
import { sign, verify } from 'hono/jwt';
import type { MiddlewareHandler } from 'hono';
import type { Pool } from '@neondatabase/serverless';
import type { AppCtx, Env, User } from '../types';

export const generateToken = (env: Env, p: User) => {
  const now = Math.floor(Date.now() / 1000);
  return sign({ ...p, iat: now, exp: now + 86400 }, env.JWT_SECRET, 'HS256');
};

export const authenticate: MiddlewareHandler<AppCtx> = async (c, next) => {
  const token = c.req.header('authorization')?.split(' ')[1];
  if (!token) return c.json({ error: 'Access token required' }, 401);
  try { c.set('user', (await verify(token, c.env.JWT_SECRET, 'HS256')) as unknown as User); }
  catch { return c.json({ error: 'Invalid or expired token' }, 403); }
  await next();
};

export async function logAction(db: Pool, userId: number, role: string, action: string, details: unknown) {
  try {
    await db.query('INSERT INTO audit_logs (user_id, user_role, action, details) VALUES ($1, $2, $3, $4)',
      [userId, role, action, typeof details === 'object' ? JSON.stringify(details) : details]);
  } catch (e) { console.error('Failed to log audit action:', e); }
}
```
- [ ] **Step 6: `api/src/lib/body.ts`**

```ts
import type { Context } from 'hono';
export async function readBody(c: Context): Promise<Record<string, any>> {
  const type = c.req.header('content-type') ?? '';
  return type.includes('application/json') ? await c.req.json() : await c.req.parseBody();
}
```
- [ ] **Step 7: `api/src/lib/uploads.ts`** (limits copied from `backend/middleware/upload.js`: 5 MB; photos jpeg/jpg/png; documents pdf/jpeg/jpg/png)

```ts
import type { Env } from '../types';

const RULES = {
  image:    { ext: /\.(jpe?g|png)$/i,     prefix: 'photo', max: 5 * 1024 * 1024 },
  document: { ext: /\.(pdf|jpe?g|png)$/i, prefix: 'doc',   max: 5 * 1024 * 1024 },
};

export async function putUpload(env: Env, folder: 'photos' | 'documents', file: File, kind: 'image' | 'document') {
  const r = RULES[kind];
  if (!r.ext.test(file.name)) throw new Error(kind === 'image'
    ? 'Only JPEG, JPG, and PNG images are allowed' : 'Only PDF, JPEG, JPG, and PNG files are allowed');
  if (file.size > r.max) throw new Error('File too large (max 5MB)');
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const name = `${r.prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  await env.FILES.put(`${folder}/${name}`, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return `/uploads/${folder}/${name}`;
}

export const deleteUpload = (env: Env, url: string) => env.FILES.delete(url.replace(/^\/uploads\//, ''));
```
- [ ] **Step 8: `api/src/index.ts`** (each later task adds its import + `app.route()` line)

```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppCtx } from './types';
import { withDb } from './lib/db';
import auth from './routes/auth';

const app = new Hono<AppCtx>();
app.use('*', (c, next) => cors({ origin: c.env.FRONTEND_URL || '*', credentials: true })(c, next));
app.get('/health', (c) => c.json({ status: 'OK', message: 'School Management System API is running' }));

app.get('/uploads/*', async (c) => {
  const obj = await c.env.FILES.get(c.req.path.replace(/^\/uploads\//, ''));
  if (!obj) return c.json({ error: 'Route not found' }, 404);
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream' } });
});

app.use('/api/*', withDb);
app.route('/api/auth', auth);

app.notFound((c) => c.json({ error: 'Route not found' }, 404));
app.onError((err, c) => { console.error(err); return c.json({ error: 'Something went wrong!' }, 500); });
export default app;
```
- [ ] **Step 9: `api/scripts/parity.mjs`** (the "test" for every ported route: logs into both servers, GETs the same paths, deep-compares JSON)

```js
const [,, OLD, NEW] = process.argv;            // e.g. http://localhost:5000 http://localhost:8787
const PATHS = (process.env.PATHS ?? '/health').split(',');
const login = async (base) => (await (await fetch(`${base}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: process.env.U, password: process.env.P }) })).json()).token;
const [a, b] = await Promise.all([login(OLD), login(NEW)]);
let bad = 0;
for (const p of PATHS) {
  const get = async (base, t) => { const r = await fetch(base + p, { headers: { authorization: `Bearer ${t}` } }); return [r.status, await r.text()]; };
  const [x, y] = await Promise.all([get(OLD, a), get(NEW, b)]);
  const same = x[0] === y[0] && JSON.stringify(JSON.parse(x[1] || 'null')) === JSON.stringify(JSON.parse(y[1] || 'null'));
  console.log(same ? 'OK  ' : 'DIFF', p, x[0], y[0]); if (!same) bad++;
}
process.exit(bad ? 1 : 0);
```
- [ ] **Step 10:** Create `api/.dev.vars` (git-ignored): `DATABASE_URL=<neon pooled>`, `JWT_SECRET=<same as backend/.env>`, `FRONTEND_URL=http://localhost:5173`. Run `npx wrangler dev`, then `curl localhost:8787/health`. Expected: `{"status":"OK",...}`. (Stub `routes/auth.ts` with an empty `new Hono()` export until Task 6.)
- [ ] **Step 11:** `echo "api/.dev.vars" >> .gitignore && git add api .gitignore && git commit -m "feat(api): Hono Worker skeleton with Neon, JWT auth, R2 uploads"`.

### Task 6: Port auth routes

**Files:** Create `api/src/routes/auth.ts`.

**Interfaces — Consumes:** `AppCtx`, `generateToken`, `readBody`. **Produces:** every endpoint currently in `backend/routes/auth.js` (128 lines: read it; port all, not only login).

- [ ] **Step 1: Failing check.** `U=admin P=admin123 PATHS=<a GET path from backend/routes/auth.js> node api/scripts/parity.mjs http://localhost:5000 http://localhost:8787`. Expected: login fails on the Worker (route missing).
- [ ] **Step 2: Port mechanically.** This conversion table applies to EVERY route file in Tasks 6–11:

| Express | Hono |
|---|---|
| `import pool from '../config/database.js'` | `const db = c.get('db')` inside the handler |
| `router.post('/x', authenticateToken, async (req,res)=>…)` | `r.post('/x', authenticate, async (c)=>…)` |
| `req.body` | `await readBody(c)` |
| `req.params.id` / `req.query.q` | `c.req.param('id')` / `c.req.query('q')` |
| `req.user` | `c.get('user')` |
| `res.status(n).json(x)` / `res.json(x)` | `return c.json(x, n)` / `return c.json(x)` |
| `bcrypt.compare/hash` | unchanged (`bcryptjs`), unless Task 1 chose PBKDF2 |
| SQL strings and params | **copy unchanged** |

Login handler, as the pattern:

```ts
import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import type { AppCtx } from '../types';
import { generateToken } from '../lib/auth';
import { readBody } from '../lib/body';

const r = new Hono<AppCtx>();
r.post('/login', async (c) => {
  const db = c.get('db');
  const { username, password } = await readBody(c);
  if (!username || !password) return c.json({ error: 'Username/Email and password are required' }, 400);
  // the admins → teachers → students lookups and the ALUMNI 403 block: copy backend/routes/auth.js:16-50, pool → db
  // bcrypt.compare, 401 { error: 'Invalid credentials' } on failure
  // const token = await generateToken(c.env, { id: user.id, username: user.username ?? user.email, role: userRole });
  // respond with the identical { message, token, user: {...} } object from backend/routes/auth.js:60-80
});
export default r;
```
The commented lines are copies of existing code, not new logic.
- [ ] **Step 3:** Rerun the parity script → `OK`. Then point the frontend at the Worker (`VITE_API_URL=http://localhost:8787/api`) and log in at `localhost:5173`.
- [ ] **Step 4:** `git add api && git commit -m "feat(api): port auth routes"`.

### Task 7: Port plain-data routes (no files)

**Files:** Create `api/src/routes/{classes,subjects,fees,auditLogs}.ts`; modify `api/src/index.ts` (`app.route('/api/classes', …)`, `/api/subjects`, `/api/fees`, `/api/audit`).

- [ ] **Step 1 (per file, one at a time):** run parity for that file's GET paths first. Expected: DIFF until ported.
- [ ] **Step 2:** Port with the Task 6 table. These four files contain no multer/xlsx/pdf (checked by grep), so it is mechanical. Mutating routes keep their audit calls: `await logAction(db, user.id, user.role, 'ACTION', {...})`.
- [ ] **Step 3:** Parity → all `OK`. Hand-test one create + update + delete per module in the UI against the Worker and confirm the row in Neon.
- [ ] **Step 4:** One commit per file, e.g. `git commit -m "feat(api): port classes routes"`.

### Task 8: Uploads → R2 (students, teachers, documents)

**Files:** Create `api/src/routes/{students,teachers}.ts` (students.js is 538 lines: port CRUD + documents now; bulk Excel routes in Task 9); modify `api/src/index.ts`.

**Interfaces — Consumes:** `putUpload`, `deleteUpload`, `readBody`.

- [ ] **Step 1:** Parity for `/api/students`, `/api/students/<id>`, `/api/teachers` → fails until ported.
- [ ] **Step 2: Port reads + create/update/delete.** The only non-mechanical change is the photo (replaces `uploadPhoto.single('photo')` and `req.file.filename`):

```ts
r.post('/', authenticate, async (c) => {
  const db = c.get('db'); const user = c.get('user');
  const b = await readBody(c);
  const { admissionNumber, fullName /* same destructure as backend/routes/students.js:98-102 */ } = b;
  if (!admissionNumber || !fullName /* same required-field list */)
    return c.json({ error: 'All required fields must be provided' }, 400);

  let photoUrl: string | null = null;
  if (b.photo instanceof File && b.photo.size > 0) {
    try { photoUrl = await putUpload(c.env, 'photos', b.photo, 'image'); }
    catch (e: any) { return c.json({ error: e.message }, 400); }
  }
  // password hashing + INSERT … RETURNING * copied unchanged; $11 = photoUrl
  // pg error 23505 → c.json({ error: 'Student with this admission number or email already exists' }, 409)
});
```
Update route: replace the photo only when a new `File` is present (matches `backend/routes/students.js:155`). Teachers: same pattern (`backend/routes/teachers.js:31,67-68`).
- [ ] **Step 3: Documents.** `POST /:id/documents`: `putUpload(c.env, 'documents', file, 'document')`, then `INSERT INTO student_documents` with `file.name` as the name (`backend/routes/students.js:481-489`). `DELETE /documents/:docId`: after `DELETE … RETURNING *`, call `await deleteUpload(c.env, doc.document_url)` (replaces the `fs.unlinkSync` block at `:524-529`).
- [ ] **Step 4: Existing files.** Check whether any survive: Render free disks are wiped on redeploy, so many `/uploads/...` rows may already be dead links. For each URL that still resolves on the old Render service, `curl -O` it and `npx wrangler r2 object put asdc-files/<folder>/<name> --file <name>`. Log dead links in the migration log (those users must re-upload).
- [ ] **Step 5: Browser test:** create a student with a photo (image shows via `/uploads/photos/...`); upload and delete a document; see the object appear/disappear in the R2 dashboard.
- [ ] **Step 6:** `git add api && git commit -m "feat(api): port students and teachers with R2 uploads"`.

### Task 9: Excel moves to the browser

**Files:** Create `frontend/src/lib/excel/{parseStudents,bulkUpdate,attendance,exportStudents}.ts`; modify `frontend/src/components/ExcelUpload.jsx`, `frontend/src/pages/{Students,Export,Attendance}.jsx`, `api/src/routes/{students,attendance,export}.ts`.

Why: `xlsx` parsing is CPU-heavy (10 ms free limit) and `multer` + `fs` do not exist on Workers. The frontend already depends on `xlsx`.

- [ ] **Step 1: Inventory (all server-side Excel logic):** `backend/services/excelParser.js` (`parseStudentExcel(path, classId)`, `generateSampleTemplate`), `backend/services/bulkUpdateValidator.js` (`generateUpdateTemplate`, `validateBulkUpdate`), `backend/routes/students.js:256-262, 347, 368-402`, `backend/routes/attendance.js:37-40`, `backend/routes/export.js:77-82`.
- [ ] **Step 2: Split "read file" from "validate rows".** Worker routes accept JSON rows instead of a file:
  - `POST /api/students/bulk` body `{ classId, rows }`; `rows` is what `XLSX.utils.sheet_to_json` produces. Run the existing validation + INSERT logic on `rows` (copy the part of `parseStudentExcel` after its `readFile` line into `api/src/lib/studentRows.ts`).
  - Same for bulk update (`validateBulkUpdate(rows, …)`) and attendance upload.
- [ ] **Step 3: Browser side** (`frontend/src/lib/excel/parseStudents.ts`):

```ts
import * as XLSX from 'xlsx';
export async function readRows(file: File): Promise<Record<string, unknown>[]> {
  const wb = XLSX.read(await file.arrayBuffer());
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
}
```
`ExcelUpload.jsx` calls `readRows(file)` then `api.post('/students/bulk', { classId, rows })`.
- [ ] **Step 4: Downloads.** Student export: `GET /api/export/students` returns the array that is now passed to `json_to_sheet` (`backend/routes/export.js:77`); the browser builds the workbook (`XLSX.utils.json_to_sheet`, `book_new`, `book_append_sheet`) and saves with `XLSX.writeFile(wb, 'students.xlsx')`. Sample/update template generators move verbatim into `frontend/src/lib/excel/`.
- [ ] **Step 5: Test with real files:** the sample template, a 200-row file, and a bad file (expect the same error messages the old validator gave); download the export and open it in Excel.
- [ ] **Step 6:** `git add api frontend && git commit -m "feat: move Excel parsing and building to the browser"`.

### Task 10: PDFs move to the browser

**Files:** Move `backend/templates/*.pdf` → `frontend/public/templates/`; create `frontend/src/lib/pdf/{idCard,certificate,reportCard}.ts` (port of `backend/services/pdfGenerator.js`, 205 lines); modify `frontend/src/pages/{IDCards,ReportCards,StudentDashboard,Students}.jsx`; modify `api/src/routes/{idcards,reports}.ts` to return JSON only.

- [ ] **Step 1: Worker returns data, not PDFs.** `GET /api/idcards/:id` → `{ student, schoolInfo }` (what `generateIDCard` receives at `backend/routes/idcards.js:36`); `POST /api/idcards/bulk` → `{ students, schoolInfo }`; reports → `{ student, marks, exam, schoolInfo }` (`backend/routes/reports.js:80`). Parity-check the shapes.
- [ ] **Step 2: Port `pdfGenerator.js` to the browser.** `pdf-lib` is pure JS and runs unchanged in browsers. Three edits only:
  1. `fs.readFile(TEMPLATE)` → `await (await fetch('/templates/IDCARD_TEMPLATE.pdf')).arrayBuffer()`.
  2. In `embedPhoto`, `fs.readFile(absPath)` → `await (await fetch(API_ORIGIN + photoUrl)).arrayBuffer()`, keeping the same try/catch that skips silently.
  3. Return the `Uint8Array` from `pdfDoc.save()`; the page makes a Blob and triggers the download (replaces the `responseType: 'blob'` calls in the pages listed above).
  Keep all coordinate constants (`CERT`, the ID-card positions) byte-for-byte identical.
- [ ] **Step 3: Visual check:** generate an ID card, a bulk set, a certificate and a report card for the same student on old and new stack; compare text positions and the photo box side by side.
- [ ] **Step 4:** `git add api frontend && git commit -m "feat: generate ID cards, certificates and report cards in the browser"`.

### Task 11: Remaining routes + full parity

**Files:** Create `api/src/routes/{attendance,export,reports,idcards}.ts` (JSON-only versions from Tasks 9–10); modify `api/src/index.ts`.

- [ ] **Step 1:** Port any route still missing (attendance mark/list, export data, reports, idcard data) with the Task 6 table.
- [ ] **Step 2: Full parity:** `PATHS=<every GET path used by frontend/src/pages/*.jsx, comma-separated> U=admin P=<password> node api/scripts/parity.mjs http://localhost:5000 http://localhost:8787`. Expected: all `OK`, exit 0.
- [ ] **Step 3:** Click through every sidebar page as admin, teacher and student; create/edit/delete one record per module.
- [ ] **Step 4:** `git add api && git commit -m "feat(api): complete route port; parity passes"`.

---

## Phase D — Deploy, domain, cut-over

### Task 12: Deploy API + frontend, connect the domain

**Files:** Create `frontend/.env.production`, `frontend/public/_redirects`; delete `frontend/vercel.json`.

- [ ] **Step 1:** Buy the domain (e.g. `asdczrm.com`; check availability first; Cloudflare Registrar sells at cost and puts DNS on Cloudflare automatically).
- [ ] **Step 2: Secrets + deploy the Worker.**

```bash
cd api
npx wrangler secret put DATABASE_URL     # Neon POOLED string
npx wrangler secret put JWT_SECRET       # NEW strong random value; everyone must log in again
npx wrangler secret put FRONTEND_URL     # https://app.asdczrm.com
npx wrangler deploy
```
Dashboard → Workers → asdc-api → Settings → Domains & Routes → add custom domain `api.asdczrm.com`.
- [ ] **Step 3: Frontend.** `frontend/.env.production`: `VITE_API_URL=https://api.asdczrm.com/api`. `frontend/public/_redirects`: `/* /index.html 200`. Cloudflare → Workers & Pages → Create → Pages → connect GitHub `Zakirhassan/SchoolInfra`, root `frontend`, build `npm run build`, output `dist`. Add custom domain `app.asdczrm.com`.
- [ ] **Step 4: Photo URLs.** Wherever the UI renders `photo_url`/`document_url`, prefix `https://api.asdczrm.com` if it does not already (`grep -rn photo_url frontend/src`).
- [ ] **Step 5: Smoke test on the real domain:** `curl https://api.asdczrm.com/health` → `{"status":"OK"…}`; log in at `https://app.asdczrm.com/login` with no CORS error; create a student with a photo and generate their ID card.
- [ ] **Step 6: Monitoring.** UptimeRobot (free): HTTP checks on `https://api.asdczrm.com/health` and `https://app.asdczrm.com`, email alerts.
- [ ] **Step 7:** `git rm frontend/vercel.json && git add frontend api && git commit -m "chore: production config for Cloudflare Pages and Workers"`.

### Task 13: Files backup, hardening, cut-over

**Files:** Create `.github/workflows/files-backup.yml`, `docs/RUNBOOK.md`.

- [ ] **Step 1: Nightly copy of uploads to B2** (`copy`, never `sync`, so an accidental R2 delete cannot propagate):

```yaml
name: files-backup
on:
  schedule: [{ cron: '47 21 * * *' }]
  workflow_dispatch:
jobs:
  files:
    runs-on: ubuntu-latest
    env:
      RCLONE_CONFIG_R2_TYPE: s3
      RCLONE_CONFIG_R2_PROVIDER: Cloudflare
      RCLONE_CONFIG_R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
      RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
      RCLONE_CONFIG_R2_ENDPOINT: ${{ secrets.R2_ENDPOINT }}
      RCLONE_CONFIG_B2_TYPE: b2
      RCLONE_CONFIG_B2_ACCOUNT: ${{ secrets.B2_KEY_ID }}
      RCLONE_CONFIG_B2_KEY: ${{ secrets.B2_APP_KEY }}
    steps:
      - run: sudo apt-get update && sudo apt-get install -y rclone
      - run: rclone copy R2:asdc-files B2:asdc-backups-b2/files --checksum
```
Run once manually. Expected: files visible in B2.
- [ ] **Step 2: Security pass.** Change the `admin` password from `admin123`; rotate the Postgres password shared in chat; confirm `JWT_SECRET` is the new random one; confirm `FRONTEND_URL` is exactly `https://app.asdczrm.com`.
- [ ] **Step 3: Write `docs/RUNBOOK.md`** (one page): where each service lives; restore = `age -d -i key.txt -o x.dump backup.age` then `pg_restore -d <neon direct> --clean --if-exists x.dump`; who holds the age key; how to roll back to Render.
- [ ] **Step 4: Real restore drill** once into a NEW Neon branch (not production) following the runbook; confirm the app works against it; time it.
- [ ] **Step 5: Cut-over.** Announce a short freeze; run db-backup one last time; re-run the Neon import (Task 4 Steps 3–4) from Supabase so Neon has the latest data; send users to `app.asdczrm.com`. Keep Render + Supabase UNTOUCHED for 14 days as rollback, then pause/delete them.
- [ ] **Step 6:** `git add .github docs && git commit -m "ci: nightly files backup; docs: runbook"`.

---

## Backup coverage summary

| Risk | Protection |
|---|---|
| Accidental delete / bad migration | Nightly dump; 30 daily + 52 weekly copies in R2 |
| Cloudflare or Neon account problem | Same dump + files also in Backblaze B2 (different company) |
| Backup silently broken | Dump validated with `pg_restore --list`; Healthchecks alerts if no ping; monthly automated restore test |
| Backups leaked | `age` encryption; private key kept offline |
| Uploaded photos/documents lost | R2 → B2 nightly `copy` (deletes do not propagate) |
| Workers limits wrong for this app | Task 1 spike gates the whole approach before any porting |

## Self-Review

- **Coverage:** domain (12), always-on API (5–11), data backups (2, 3, 13), DB move (4), uploads (8), PDF/Excel limits (9, 10), CORS/`FRONTEND_URL` (12), security rotation (13), cost target (Task 1 gate).
- **Known soft spots:** Tasks 6, 8, 9, 10 say "copy the existing logic unchanged" with file/line references instead of pasting ~1,500 lines of unchanged code, so the executor must read those files. If Task 1 chooses free plan + PBKDF2, add a password-migration task before Task 6.
- **Type consistency:** `AppCtx`, `authenticate`, `generateToken(env, user)`, `logAction(db, id, role, action, details)`, `readBody`, `putUpload`, `deleteUpload` use the same signatures everywhere.
