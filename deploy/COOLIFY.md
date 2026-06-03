# Coolify setup — Menata Vendure (deploy/)

Goal: make Coolify build `deploy/Dockerfile` (minutes) instead of the old root
Dockerfile (~1h timeout).

## A. Simplest working setup (1 service)

Start here. One container runs the API **and** processes jobs (`RUN_JOB_QUEUE=1`).
Split into a separate worker later if you need scale (section D).

### 1. Point the existing app at deploy/
In your Coolify application → **Configuration → Build**:

| Setting | Value |
|---|---|
| Build Pack | `Dockerfile` |
| Base Directory | `/`  ← the build context must be the repo root |
| Dockerfile Location | `/deploy/Dockerfile` |
| Ports Exposes | `3000` |

Leave the start command empty (the image defaults to `npm run start:server`).

> Base Directory `/` (not `/deploy`) is required: the Dockerfile copies both
> `deploy/` and the shared `plugins/`, so it needs the repo root as context.

### 2. Health check
Path `/health`, port `3000`. (Returns 200 once booted.)

### 3. Environment variables
Set these (Configuration → Environment Variables). See `.env.example` for the full list.

Required (server refuses to boot without them):
```
COOKIE_SECRET=<long random string>
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=<strong password>
DB=mariadb
DB_HOST=<your mariadb host/service>
DB_PORT=3306
DB_NAME=vendure
DB_USERNAME=<db user>
DB_PASSWORD=<db password>
```

First deploy only — create the schema, then set back to false and redeploy:
```
DB_SYNCHRONIZE=true
```

Single-service job processing:
```
RUN_JOB_QUEUE=1
```

Redis (recommended in prod — enables BullMQ queue + Redis cache). Add a Redis
resource in Coolify, then point at it:
```
REDIS_HOST=<redis service name>
REDIS_PORT=6379
REDIS_PASSWORD=<if set>
```
(Leave REDIS_HOST empty to fall back to the DB job queue + in-memory cache.)

Email (optional — without SMTP, a dev mailbox is served at `/mailbox`):
```
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM="Menata" <noreply@menata.fr>
STOREFRONT_URL=https://shop.menata.fr
```

CORS (your storefront + dashboard origins):
```
CORS_ORIGIN=https://shop.menata.fr,https://admin.menata.fr
```

### 4. Persistent volume (assets survive redeploys)
Add a volume mount:
- Destination path in container: `/app/deploy/assets`
- And set env: `ASSET_UPLOAD_DIR=/app/deploy/assets`

### 5. Deploy
Redeploy. Build should finish in minutes. Then open:
- Dashboard: `https://<your-domain>/dashboard`
- Admin API: `https://<your-domain>/admin-api`

After the first successful boot, set `DB_SYNCHRONIZE=false` and redeploy.

## B. Order of operations vs git push
Pushing the branch triggers a Coolify deploy. So either:
1. Reconfigure Coolify (section A) **first**, then push — the push builds deploy/, or
2. Push now, then reconfigure and click Redeploy.

Until the Build settings above are changed, a push re-runs the old root Dockerfile
(the 1h timeout). The push alone does not switch Coolify to deploy/.

## C. First-deploy schema note
The store currently runs with `synchronize: true` in dev. For the first prod boot,
`DB_SYNCHRONIZE=true` creates the schema. Long term, generate migrations into
`deploy/migrations/` and keep `synchronize` off.

## D. Optional: separate worker (scale later)
Instead of `RUN_JOB_QUEUE=1`, run a dedicated worker:
1. Create a **second** Coolify resource from the same repo/branch, same Build
   settings (Base Directory `/`, Dockerfile `/deploy/Dockerfile`).
2. Set its **start command** to: `npm run start:worker`
3. No public port/domain for it.
4. Give it the same env vars (DB, Redis, secrets). Remove `RUN_JOB_QUEUE` from the
   API service so jobs aren't processed twice.

## E. Optional: faster build context
Once you retire the old root `Dockerfile`, add `packages` to the root
`.dockerignore` so the build context doesn't ship the whole monorepo source.
```

## Quick reference — validated locally
- `npm ci` install: ~1150 pkgs in ~22s
- dashboard `vite build`: 5074 modules in ~20s
- container boots: Vendure v3.5.7, `/health` 200, `/dashboard/` 200, `/admin-api` OK
