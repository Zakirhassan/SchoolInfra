# Owner TODO (manual steps)

Items that only the repo owner can do: cloud accounts, keys, GitHub secrets, and manual workflow runs.

## Backups

### 1. One-time setup (~15 min)

1. Cloudflare -> R2 -> create private buckets `asdc-backups` and `asdc-files`. On `asdc-backups` add lifecycle rules: delete under `daily/` after 30 days; under `weekly/` after 365 days.
2. R2 -> Manage API tokens -> token with Object Read & Write on both buckets. Note the Access Key ID, Secret, and endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. Backblaze B2 -> private bucket `asdc-backups-b2` + application key (second provider, so one account lockout cannot lose everything).
4. On your laptop: `age-keygen -o asdc-backup.key`. Keep the file offline (password manager attachment + printed copy). Copy only the `age1...` PUBLIC key.
5. healthchecks.io -> check "asdc-db-backup", period 1 day, grace 3 hours -> copy the ping URL.

### 2. GitHub secrets (repo -> Settings -> Secrets and variables -> Actions)

| Secret | Used by | Value |
|---|---|---|
| `DATABASE_URL_DIRECT` | db-backup | Supabase direct/session connection string for now; later the NON-pooled Neon string |
| `AGE_PUBLIC_KEY` | db-backup | The `age1...` public key from step 4 |
| `R2_ACCESS_KEY_ID` | db-backup, restore-test, files-backup | R2 token access key ID |
| `R2_SECRET_ACCESS_KEY` | db-backup, restore-test, files-backup | R2 token secret |
| `R2_ENDPOINT` | db-backup, restore-test, files-backup | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `B2_KEY_ID` | db-backup, files-backup | B2 application key ID |
| `B2_APP_KEY` | db-backup, files-backup | B2 application key |
| `HC_PING_URL` | db-backup | healthchecks.io ping URL |
| `AGE_SECRET_KEY` | restore-test | Full contents of `asdc-backup.key` (the age private key) |

**Trade-off for `AGE_SECRET_KEY`:** storing the private key in GitHub lets GitHub Actions decrypt your backups, so GitHub becomes a party that could read the database dump. If you disagree, do not add this secret; instead run the restore test by hand once a month on your laptop (download the newest `daily/` object from R2, `age -d -i asdc-backup.key`, restore into a local Postgres, and check the counts).

### 3. Run each workflow manually once

GitHub -> Actions -> select the workflow -> Run workflow.

- **db-backup**: expect green; the healthchecks.io check shows "up"; `daily/school-*.dump.age` exists in both R2 (`asdc-backups`) and B2 (`asdc-backups-b2`).
- **restore-test**: expect green with row counts printed. If it fails, the backup is broken: fix it before continuing.
- **files-backup**: expect green; uploads are visible in B2 under `asdc-backups-b2/files`.

## Task 8: students + teachers (R2 uploads)

1. **Parity runs** (once the Worker is deployed/`wrangler dev` and the old backend is reachable): run the parity script against `/api/students`, `/api/students/<id>` (pick a real student id) and `/api/teachers`. Expect identical JSON.
2. **Migrate existing files from Render (plan Step 4):** Render free disks are wiped on redeploy, so many `/uploads/...` rows may already be dead links. For each `photo_url` / `document_url` that still resolves on the old Render service: `curl -O <url>` then `npx wrangler r2 object put asdc-files/<folder>/<name> --file <name>` (folder is `photos` or `documents`). Log dead links in the migration log; those users must re-upload.
3. **Browser test (plan Step 5):** create a student with a photo (image should display via `/uploads/photos/...`); upload and delete a document; confirm the object appears/disappears in the R2 dashboard.

## Task 9: Excel in the browser

Needs a deployed (or `wrangler dev`) Worker with a real database, and the frontend pointed at it (`VITE_API_URL`). The frontend now only works against the new JSON endpoints, not the old Express backend.

1. **Sample template:** Students -> Download Template. Open it in Excel (one row, John Doe). Pick a class, Upload Template with that file unchanged: expect "Successfully uploaded 1 students!".
2. **200-row file:** fill the template with 200 rows (unique `admission_number`s) and upload: expect "Successfully uploaded 200 students!" and no Worker CPU-limit error in `wrangler tail`.
3. **Bad file:** duplicate an admission number, set a gender to `M`, blank a `full_name`: expect the toast "Upload failed with N error(s)" listing e.g. `Row 3: Duplicate admission number ...`, `Row 3: Invalid gender. Must be Male, Female, or Other`, `Row 4: Missing full_name` (same text as the old backend). Upload the same good file twice: expect "Duplicate admission numbers found in database".
4. **Attendance:** Attendance -> pick a course -> Template -> Upload Excel with it: expect "Successfully uploaded attendance for N students".
5. **Export:** Export -> Export to Excel (no filters, then with a filter that matches nothing). Open `students_export.xlsx` in Excel: Date of Birth must be a real date showing the right day. The empty filter should now say "No students found matching the criteria" (before, the blob response hid that message).
6. **Bulk update (API only; no button in the UI):** `GET /api/students/update-template/<classId>` returns JSON rows now; `POST /api/students/bulk-update` takes `{ classId, rows }`. Optional: smoke-test with curl.

## Task 10: PDFs in the browser (visual check, plan Step 3)

Needs the old stack (Express backend + its frontend) and the new stack (Worker + this frontend) pointed at the **same database**, and one student who has a photo (in R2 for the new stack and on disk for the old one), marks for an exam, and `is_published = true`.

1. **Single ID card:** as that student, Dashboard -> Download ID Card on both stacks. Open the two PDFs side by side: same page size, every text field at the same spot after the labels, photo inside the rounded box. Dates must match (D.O.B. as DD/MM/YYYY).
2. **Bulk ID cards:** as admin, ID Cards -> pick that student's course -> Generate on both stacks. Same page count and order. A student whose photo is missing should get a card with an empty photo box, not an error.
3. **Certificate:** as admin, Certificates -> Generate tab -> same student + exam on both stacks; also download it as the student from the dashboard. Compare the name, course, from/to dates, grade and Student ID positions.
4. **Errors still show:** as a student, try to download a certificate for an unpublished result: the toast must read "Certificate not yet published by Admin" (before, the blob response hid the server message).
5. **Photo CORS:** the photo is fetched by the browser from `<Worker origin>/uploads/...`. If the ID card on the new stack has no photo but the old one does, check `FRONTEND_URL` on the Worker matches the site origin exactly (CORS), and look for "Could not embed student photo" in the browser console.

Local evidence already gathered (no DB): the browser generator produced byte-identical PDFs to `backend/services/pdfGenerator.js` (creation/modification dates masked) for 12 cases incl. photos, long names and bulk, in UTC, Asia/Kolkata, America/New_York and Pacific/Honolulu.
