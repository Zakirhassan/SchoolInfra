# Remaining items for the owner (status 2026-11-11)

## Live now
- API Worker: https://asdc-api.zakirhassan114.workers.dev (secrets set: JWT_SECRET, FRONTEND_URL; **DATABASE_URL not yet set**, so /api routes fail until it is)
- Frontend: https://asdc-web.zakirhassan114.workers.dev (Workers static assets, built with VITE_API_URL pointing at the API above)

## You do (in this order)
1. Save the Neon strings to `C:\Users\zakir\asdc-secrets\neon-direct.txt` (pooling off) and `neon-pooled.txt` (pooling on). Then ask Claude to: set Worker secret `DATABASE_URL` (pooled), GitHub secret `DATABASE_URL_DIRECT` (direct).
2. healthchecks.io: create check `asdc-db-backup` (period 1 day, grace 3 h); save ping URL to `C:\Users\zakir\asdc-secrets\hc-ping.txt`; Claude sets `HC_PING_URL`.
3. Decide on `AGE_SECRET_KEY` in GitHub (enables the automatic monthly restore test; lets GitHub decrypt backups). Otherwise restore-test is run by hand monthly.
4. Buy the domain (Cloudflare Registrar, same account). Then Claude attaches `api.<domain>` to the API Worker and `app.<domain>` to `asdc-web`, sets FRONTEND_URL to the app URL, rebuilds the frontend with VITE_API_URL=https://api.<domain>/api and redeploys.
5. UptimeRobot (free): HTTP checks on the API `/health` and the app URL, email alerts.
6. Rotate the Postgres/Neon password that was pasted in chat on 2026-10-18 (Neon console -> Roles -> reset password), then update both secrets from step 1.
7. Delete the stray Workers created by mistake during deploy (Cloudflare dashboard -> Workers & Pages): `asdc-app` (duplicate API code, no secrets) and `frontend` if it exists.
8. Neon login for the restore drill (scratch branch) when Claude asks.

## Claude does after the above
Run db-backup once and confirm; smoke-test login/student+photo/ID card; attendance-upload CPU check; restore drill; update docs.

## Known open items
- Attendance Excel upload does 1-2 queries per row; may exceed the free 10 ms CPU on big files.
- No Backblaze copy (R2 only).
- Redeploying the frontend is manual: `VITE_API_URL=... npm run build` in `frontend/`, delete `dist/_redirects`, then `wrangler deploy` with an assets config (`not_found_handling: single-page-application`).
