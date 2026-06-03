# Menata Vendure — Deployment Project

Minimal **production** deploy for the Menata store. It consumes `@vendure/*` from
npm (precompiled) instead of building the whole monorepo fork, so the Coolify
build drops from **~1 hour (timeout)** to **a few minutes**.

The monorepo at the repo root is **untouched** — keep using it for development and
for pulling updates from upstream Vendure. This `deploy/` folder is a separate,
self-contained app that **shares the same plugins** from `../plugins` (single
source of truth, no duplication).

## What it contains

| File | Purpose |
|------|---------|
| `package.json` | Only the `@vendure/*` packages actually used, pinned to `~3.5.0` (auto-tracks upstream patch/minor). |
| `vendure-config.ts` | Production config, fully env-driven. Exports `config: VendureConfig`. |
| `index.ts` / `index-worker.ts` | API server / worker bootstraps (run via `ts-node`). |
| `vite.config.mts` | Builds the dashboard SPA (with the 4 plugin extensions) into `./dist`. |
| `Dockerfile` | Multi-stage build; compiles only the dashboard. |
| `.env.example` | All supported environment variables. |

The 4 plugins (`audit-log`, `cms`, `menata-branding`, `translation`) already import
`@vendure/*` cleanly, so they work unchanged against the npm packages.

## Why the build is still not instant

Your 4 plugins inject **dashboard UI** (`dashboard: './dashboard/index.tsx'`), so
the dashboard SPA (`vite build`) must be compiled. That is the only meaningful
build step here, and it's a few minutes — versus the old setup which also did a
full monorepo `npm ci` + Lerna build of ~19 packages (incl. the Angular admin-ui).

## Local test

```bash
cd deploy
cp .env.example .env        # fill in DB creds, COOKIE_SECRET, SUPERADMIN_PASSWORD
npm install
npm run build:dashboard     # compiles ./dist (the dashboard SPA)
DB_SYNCHRONIZE=true npm run start:server   # first boot only: creates schema
# in another terminal:
npm run start:worker
```

API: http://localhost:3000/admin-api · Dashboard: http://localhost:3000/dashboard

### Local Docker build (from the repo root, NOT from deploy/)

```bash
docker build -f deploy/Dockerfile -t menata-vendure .
docker run --rm -p 3000:3000 --env-file deploy/.env menata-vendure
```

## Coolify setup

Create **two services** from the same repo (API + worker), both using:

- **Build Pack:** Dockerfile
- **Base Directory:** `/`  ← important: the build context must be the repo root
- **Dockerfile Location:** `/deploy/Dockerfile`
- **Port:** `3000` (API service)

**API service** — default command (`npm run start:server`).
**Worker service** — override the start command with `npm run start:worker`.

### Environment variables
Set everything from `.env.example` in Coolify (both services need the DB + secrets).
Required or the server won't boot: `COOKIE_SECRET`, `SUPERADMIN_PASSWORD`, and DB creds.

### Persistent volume
Mount a volume at `ASSET_UPLOAD_DIR` (default `/app/deploy/assets`) so uploaded
assets survive redeploys. If you use the local email mailbox or SQLite, persist
those paths too.

### First boot
Set `DB_SYNCHRONIZE=true` once to create the schema, then set it back to `false`.
(Long term, generate proper migrations into `deploy/migrations/`.)

## Updating from upstream Vendure

The build uses `npm ci` against the committed `package-lock.json`, so every Coolify
build installs the exact versions tested locally (no surprise transitive drift).
To pull in upstream updates:

1. Pull upstream into the monorepo as usual.
2. If the major/minor changed (e.g. 3.5 → 3.6), bump the `~3.5.0` ranges in
   `deploy/package.json` to `~3.6.0`.
3. Refresh the lockfile: `cd deploy && npm install`, then commit the updated
   `package-lock.json`. (This is the deliberate "take the update" step.)
4. Rebuild locally once (`docker build -f deploy/Dockerfile -t menata .` from the
   repo root) to confirm green, then push. The plugins are shared — nothing else to sync.

> **Why the `overrides` block exists:** newer `@tanstack/router-*` releases tighten
> route-id parsing and break the dashboard's bundled routes. The overrides pin that
> family to the versions Vendure 3.5 expects. If you bump Vendure's minor, check
> whether these pins still match (compare against the monorepo's resolved versions).

## Notes
- DB stays MariaDB/MySQL per request. Vendure recommends PostgreSQL; switch any
  time with `DB=postgres` + Postgres creds.
- Once you retire the old root `Dockerfile`, you can add `packages` to the root
  `.dockerignore` to make the build context smaller/faster.
