# Runbook

One page for the school admin / developer. `asdczrm.com` is a placeholder domain; substitute the real one.
Never paste passwords, database URLs or the age private key into chat, tickets or git.

## Where things live

| What | Where | Notes |
|---|---|---|
| Website (React) | Cloudflare Pages, `app.asdczrm.com` | Builds from GitHub, root `frontend`. `VITE_API_URL` is baked in at build time: changing it needs a Pages redeploy. |
| API | Cloudflare Worker `asdc-api`, `api.asdczrm.com` | Secrets: `DATABASE_URL` (Neon POOLED), `JWT_SECRET`, `FRONTEND_URL` (exact origin, no trailing slash/path). Set with `npx wrangler secret put <NAME>` in `api/`. |
| Uploaded photos/documents | Cloudflare R2 bucket `asdc-files` | Served by the Worker at `/uploads/<folder>/<file>`. |
| Database | Neon Postgres | Use the POOLED string in the Worker, the DIRECT (non-pooled) string for backups and restores. |
| DB backups | R2 `asdc-backups` and Backblaze B2 `asdc-backups-b2` | Encrypted with `age`. |
| Scheduled jobs | GitHub Actions: `db-backup`, `files-backup`, `restore-test` | Secrets listed in `docs/OWNER-TODO.md`. |
| Backup alarm | healthchecks.io check "asdc-db-backup" | Alerts if no ping within 1 day + 3 h. |
| Uptime alarm | UptimeRobot on `/health` of the API and on the website | Email alerts. |
| Rollback (first 14 days only) | Render (old API) + Supabase (old DB) | Left untouched after cut-over, then paused/deleted. |

## Backup schedule and retention

- `db-backup`: daily 21:17 UTC (02:47 IST). Dump, verify, encrypt, then write `daily/school-<stamp>.dump.age` to R2 and B2. Sundays also write `weekly/` in R2.
- Retention (R2 lifecycle rules): `daily/` 30 days, `weekly/` 365 days. B2 `daily/` is not auto-pruned.
- `files-backup`: daily 21:47 UTC. `rclone copy` from R2 `asdc-files` to B2 `asdc-backups-b2/files`. It is a copy, not a sync: deleting a file in R2 does not delete the backup.
- `restore-test`: 1st of each month; restores the newest daily backup into a throwaway Postgres and checks row counts.

## Restore the database

Needs: `age`, `rclone`, `pg_restore` (v17) and the age PRIVATE key file (see below). Do a drill into a NEW Neon branch first; only restore over production when you mean to.

1. Configure rclone (env vars, no file needed):
   ```bash
   export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
     RCLONE_CONFIG_R2_ACCESS_KEY_ID=... RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=... \
     RCLONE_CONFIG_R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   # If R2 is unavailable use B2 instead:
   export RCLONE_CONFIG_B2_TYPE=b2 RCLONE_CONFIG_B2_ACCOUNT=<B2_KEY_ID> RCLONE_CONFIG_B2_KEY=<B2_APP_KEY>
   ```
2. Find the newest backup (names sort by date):
   ```bash
   LATEST=$(rclone lsf R2:asdc-backups/daily/ | sort | tail -1)    # or B2:asdc-backups-b2/daily/
   rclone copyto "R2:asdc-backups/daily/$LATEST" backup.age
   ```
   For an older point, list `rclone lsf R2:asdc-backups/daily/` (or `weekly/`) and pick a name.
3. Decrypt and restore into the Neon DIRECT connection string:
   ```bash
   age -d -i key.txt -o x.dump backup.age
   pg_restore --list x.dump > /dev/null            # sanity check
   pg_restore -d "<neon direct url>" --clean --if-exists x.dump
   ```
4. Check: log in, open Students, compare counts. If you restored into a branch, point `DATABASE_URL` (that branch's pooled string) at it with `wrangler secret put DATABASE_URL`, then switch back afterwards.

## Restore uploaded files

```bash
export RCLONE_CONFIG_B2_TYPE=b2 RCLONE_CONFIG_B2_ACCOUNT=<B2_KEY_ID> RCLONE_CONFIG_B2_KEY=<B2_APP_KEY>
# plus the R2 variables from step 1 above
rclone lsf B2:asdc-backups-b2/files --max-depth 1            # expect photos/ and documents/
rclone copy B2:asdc-backups-b2/files R2:asdc-files --checksum
```

## Who holds the age key

The private key (file `asdc-backup.key`, starts `AGE-SECRET-KEY-`) decrypts every backup. Without it backups are unreadable.

- Holder(s): **__________ (OWNER TO FILL IN: names)**
- Locations: **__________ (OWNER TO FILL IN: e.g. password manager entry, printed copy in safe)**
- GitHub holds a copy only if the optional `AGE_SECRET_KEY` secret was added (see the trade-off in OWNER-TODO).
- Never commit it or paste it in chat.

## Roll back to Render (within 14 days of cut-over)

Render + Supabase still hold the pre-cut-over data, so anything entered on the new system since then will be missing; export or note it first.

1. Render dashboard: make sure the old service is running (open its `/health` to wake it).
2. In Cloudflare Pages set `VITE_API_URL=https://<render-service>.onrender.com/api` and redeploy (it is baked in at build time). The old backend's `FRONTEND_URL`/CORS must allow `https://app.asdczrm.com`.
3. Tell users to log in again. To go forward again, reverse step 2.

## Rotate JWT_SECRET

```bash
cd api
npx wrangler secret put JWT_SECRET      # paste a new long random value (e.g. from `openssl rand -base64 48`)
npx wrangler deploy
```
Everyone is logged out and must sign in again; nothing else changes.

## If an alert fires

- **healthchecks.io "no ping / fail"**: GitHub, Actions, `db-backup`, read the red step. Usual causes: expired R2/B2 key, wrong `DATABASE_URL_DIRECT`, Neon unreachable. Fix, then Run workflow manually.
- **UptimeRobot: API down**: check Cloudflare status and Workers, `asdc-api`, Logs; then `curl https://api.asdczrm.com/health`. If caused by a bad deploy, redeploy the previous commit. If Neon, check the Neon console.
- **UptimeRobot: website down**: Cloudflare Pages, Deployments; roll back to the last good deployment.
- **Users report login/CORS errors**: `FRONTEND_URL` must equal `https://app.asdczrm.com` exactly; `VITE_API_URL` must be the API URL.
- **`restore-test` red**: treat backups as broken until fixed; run `db-backup` again and re-check.
- **Data deleted or corrupted**: stop edits, restore into a NEW Neon branch, verify, then switch `DATABASE_URL` or restore over production.
