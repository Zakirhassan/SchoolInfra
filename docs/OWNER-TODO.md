# Owner TODO (manual steps)

Items that only the repo owner can do: cloud accounts, keys, GitHub secrets, and manual workflow runs.

**Fresh start.** There is no production data to keep: the old Supabase database and Render service hold only scrap data. Nothing is migrated or imported, and there is no old stack to roll back to. You start with an empty Neon database, create its tables from `api/db/schema.sql`, and create the first admin with `api/scripts/seed-admin.mjs`. Passwords use PBKDF2-SHA256 (WebCrypto), which fits the Workers free plan's 10 ms CPU limit, so the old bcrypt CPU gate is resolved and no password reset is needed (there are no old users). Student bulk upload/update was removed; students are added one at a time.

Do the steps in this order: 1 -> 2 -> 3 -> 4.

## 1. Create the Neon database (~10 min)

1. Neon console -> New project (Postgres 17, region close to your users). Database `neondb` is fine.
2. Copy both connection strings from "Connection details":
   - **Direct** (host has no `-pooler`): for schema, seeding, backups and restores.
   - **Pooled** (host contains `-pooler`): only for the Worker secret `DATABASE_URL` in step 3.
3. Create the tables (idempotent; safe to run again). Needs `psql` 17 (Git Bash / WSL / macOS / Linux):
   ```bash
   export DATABASE_URL_DIRECT='postgresql://<user>:<password>@<host>.neon.tech/neondb?sslmode=require'
   psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 -f api/db/schema.sql
   psql "$DATABASE_URL_DIRECT" -c '\dt'      # expect 11 tables: admins, attendance, audit_logs, classes, exams,
                                             # fee_payments, marks, student_documents, students, subjects, teachers
   ```
   No `psql`? Paste the whole of `api/db/schema.sql` into Neon console -> SQL Editor and run it.
4. Create the first admin (Node >= 22.18). There is no default password; it must be at least 12 characters. `read -s` keeps it out of your shell history:
   ```bash
   cd api && npm ci
   read -rs ADMIN_PASSWORD && export ADMIN_PASSWORD     # type the password, press Enter
   DATABASE_URL="$DATABASE_URL_DIRECT" ADMIN_USERNAME=<your-admin-username> npm run seed:admin
   unset ADMIN_PASSWORD
   ```
   PowerShell equivalent: `$env:DATABASE_URL='<direct string>'; $env:ADMIN_USERNAME='<name>'; $env:ADMIN_PASSWORD=Read-Host; npm run seed:admin; Remove-Item Env:ADMIN_PASSWORD`.
   Expect `seed-admin: created admin "<name>" (id 1).` Optional: `ADMIN_FULL_NAME='...'`. If the username exists it changes nothing (exit 1); `ADMIN_RESET_PASSWORD=1` replaces that admin's password.
   Teachers and students are then created in the app (Teachers page, Students -> Add Student).

## 2. Backups: buckets, key, GitHub secrets, first runs (~20 min)

> **B2 skipped (owner decision).** Backups go to Cloudflare R2 only: no `B2_KEY_ID`/`B2_APP_KEY` secrets and no Backblaze bucket are needed (ignore those rows and step 3 of 2a). Files are copied nightly from `asdc-files` to `asdc-backups/files/` in the same account, so this protects against accidental deletes but NOT against losing the Cloudflare account. To add a second provider later, re-add the B2 upload to `db-backup.yml` and `files-backup.yml`.

### 2a. One-time setup

1. Cloudflare -> R2 -> create private buckets `asdc-backups` and `asdc-files`. On `asdc-backups` add lifecycle rules: delete under `daily/` after 30 days; under `weekly/` after 365 days.
2. R2 -> Manage API tokens -> token with Object Read & Write on both buckets. Note the Access Key ID, Secret, and endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. Backblaze B2 -> private bucket `asdc-backups-b2` + application key (second provider, so one account lockout cannot lose everything).
4. On your laptop: `age-keygen -o asdc-backup.key`. Keep the file offline (password manager attachment + printed copy). Copy only the `age1...` PUBLIC key.
5. healthchecks.io -> check "asdc-db-backup", period 1 day, grace 3 hours -> copy the ping URL.

### 2b. GitHub secrets (repo -> Settings -> Secrets and variables -> Actions)

| Secret | Used by | Value |
|---|---|---|
| `DATABASE_URL_DIRECT` | db-backup | The Neon **direct** (non-pooled) string from step 1 |
| `AGE_PUBLIC_KEY` | db-backup | The `age1...` public key from 2a step 4 |
| `R2_ACCESS_KEY_ID` | db-backup, restore-test, files-backup | R2 token access key ID |
| `R2_SECRET_ACCESS_KEY` | db-backup, restore-test, files-backup | R2 token secret |
| `R2_ENDPOINT` | db-backup, restore-test, files-backup | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `B2_KEY_ID` | db-backup, files-backup | B2 application key ID |
| `B2_APP_KEY` | db-backup, files-backup | B2 application key |
| `HC_PING_URL` | db-backup | healthchecks.io ping URL |
| `AGE_SECRET_KEY` | restore-test | Full contents of `asdc-backup.key` (the age private key) |

**Trade-off for `AGE_SECRET_KEY`:** storing the private key in GitHub lets GitHub Actions decrypt your backups, so GitHub becomes a party that could read the database dump. If you disagree, do not add this secret; instead run the restore test by hand once a month on your laptop (download the newest `daily/` object from R2, `age -d -i asdc-backup.key`, restore into a local Postgres, and check the counts).

### 2c. Run each workflow manually once

GitHub -> Actions -> select the workflow -> Run workflow. Run them in this order:

- **db-backup**: expect green; the healthchecks.io check shows "up"; `daily/school-*.dump.age` exists in both R2 (`asdc-backups`) and B2 (`asdc-backups-b2`).
- **restore-test**: expect green with counts printed (it needs at least the seeded admin; an empty `classes` table is fine). If it fails, the backup is broken: fix it before continuing.
- **files-backup**: expect green. `asdc-files` may still be empty; files show up under `asdc-backups-b2/files` once photos/documents are uploaded.

## 3. Deploy the Worker, Pages, domain and monitoring

`asdczrm.com` below is a placeholder: confirm the real domain and substitute it everywhere.

1. [ ] **Domain:** buy it (Cloudflare Registrar sells at cost and puts DNS on Cloudflare).
2. [ ] **Worker secrets + deploy:**
   ```bash
   cd api
   npx wrangler secret put DATABASE_URL     # Neon POOLED string
   npx wrangler secret put JWT_SECRET       # long random value, e.g. `openssl rand -base64 48`
   npx wrangler secret put FRONTEND_URL     # https://app.asdczrm.com (exact origin: NO trailing slash or path)
   npx wrangler deploy
   ```
   Dashboard -> Workers -> asdc-api -> Settings -> Domains & Routes -> add custom domain `api.asdczrm.com`.
3. [ ] **Cloudflare Pages:** Workers & Pages -> Create -> Pages -> connect GitHub `Zakirhassan/SchoolInfra`, root directory `frontend`, build command `npm run build`, output `dist`. Add build variable `VITE_API_URL=https://api.asdczrm.com/api` (`frontend/.env.production` is git-ignored; `frontend/.env.production.example` documents the value). Add custom domain `app.asdczrm.com`.
4. [ ] **Monitoring:** UptimeRobot (free) HTTP checks on `https://api.asdczrm.com/health` and `https://app.asdczrm.com`, email alerts.
5. [ ] **Gotchas:** `FRONTEND_URL` must have no trailing slash or path (CORS compares it exactly and asset URLs are built from it). `VITE_API_URL` is baked in at build time, so changing it requires a Pages redeploy.

## 4. Smoke test and restore drill

### 4a. Smoke test (deployed stack)

1. [ ] `curl https://api.asdczrm.com/health` -> `{"status":"OK"...}`. Log in at `https://app.asdczrm.com/login` with the seeded admin: no CORS error. Keep `npx wrangler tail` (in `api/`) running during the next steps and look for errors or "exceeded CPU" messages.
2. [ ] **Admin click-through:** create a teacher, a course (assign the teacher), a subject and an exam; create a student with a photo and a student login (email + password). The photo must show in the list, edit modal and dashboard. Upload, open and delete a student document; confirm the object appears/disappears in the R2 `asdc-files` bucket.
3. [ ] **Teacher and student logins:** log in as the teacher (sees only their courses) and as the student (dashboard, documents, ID card, report card once results are published).
4. [ ] **Attendance (Excel upload is the only way to record it):** Attendance -> pick the course -> Template -> Upload Excel with it unchanged: expect "Successfully uploaded attendance for N students" and the stats table updates.
5. [ ] **Export:** Export -> Export to Excel (no filters, then a filter that matches nothing). In `students_export.xlsx`, Date of Birth must be a real date showing the right day; the empty filter says "No students found matching the criteria".
6. [ ] **PDFs:** single ID card (as the student), bulk ID cards (as admin, ID Cards -> course -> Generate: one page per student; a student without a photo gets an empty photo box, not an error), certificate (enter marks, publish, generate; also download as the student). As a student, an unpublished result must show "Certificate not yet published by Admin". If the ID card has no photo, check `FRONTEND_URL` (CORS) and look for "Could not embed student photo" in the browser console.
7. [ ] Run **files-backup** again and confirm the photo/document are now under `asdc-backups-b2/files`.

### 4b. Restore drill (once, then whenever you change backups)

1. [ ] Run **db-backup** so the backup contains the smoke-test data.
2. [ ] Neon console -> create a NEW branch (not production). Follow "Restore the database" in `docs/RUNBOOK.md` into that branch's **direct** string.
3. [ ] Point `wrangler dev` (`api/.dev.vars`: `DATABASE_URL=<branch pooled string>`) at it, log in and open Students. Write down how long the drill took in the runbook, then delete the branch.

### 4c. Security pass

- [ ] Confirm `JWT_SECRET` is a long random value and `FRONTEND_URL` is exactly `https://app.asdczrm.com`.
- [ ] Use a fresh password for the Neon project; never reuse the Postgres password that was pasted in chat on 2026-10-18. The old Supabase project and Render service hold only scrap data: pause or delete them whenever you like.
- [ ] Fill in the age key holder/locations in `docs/RUNBOOK.md`.

## Security notes (existing behaviour)

Ported from the old Express backend. Fixed in this branch:

- `GET /api/students` and `GET /api/students/:id` (and the student create/update/status and fee-status responses) no longer return `password_hash`. Teacher lists already used explicit columns.

Still open; consider fixing after go-live:

- ID card endpoints (`/api/idcards/...`) have no ownership check: any logged-in user can read any student's card data.
- `/api/auth/change-password` is unauthenticated (it needs the old password but no token) and has no rate limiting.
- `/api/auth/login` has no rate limiting, so brute force is possible. A Cloudflare rate-limiting rule would address this.
- `/api/auth/login` blocks alumni via `user.status === 'ALUMNI'`, but the column is `enrollment_status`, so alumni students can still log in.
