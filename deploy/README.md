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
| `package.json` | Only the `@vendure/*` packages actually used, pinned to `~3.7.3` (auto-tracks upstream patches). Sentry comes from `@vendure-community/sentry-plugin` (removed from core in 3.7). |
| `vendure-config.ts` | Production config, fully env-driven. Exports `config: VendureConfig`. |
| `index.ts` / `index-worker.ts` | API server / worker bootstraps (run via `ts-node`). |
| `vite.config.mts` | Builds the dashboard SPA (with the 5 plugin extensions) into `./dist`. |
| `Dockerfile` | Multi-stage build; compiles only the dashboard. |
| `.env.example` | All supported environment variables. |

## The 5 shared plugins

Every plugin in `../plugins` is wired here (see `vendure-config.ts` → `plugins: [...]`):

| Plugin | Registered as | Env vars |
|---|---|---|
| `menata-branding` | `MenataBrandingPlugin` | — |
| `cms-plugin` | `CmsPlugin` | — |
| `audit-log-plugin` | `AuditLogPlugin.init({ retentionDays })` | `AUDIT_LOG_RETENTION_DAYS` (default 90) |
| `translation-plugin` | `TranslationPlugin.init({ languages })` | — (languages are set in `vendure-config.ts`) |
| `diagnostics-plugin` | `DiagnosticsPlugin.init({ ... })` — **conditional** | `MENATA_DIAGNOSTIC_API_KEY`, `MENATA_API_BASE_URL`, `MENATA_CLIENT_ID`, `DIAGNOSTICS_CTA_URL`, `DIAGNOSTICS_CACHE_TTL_MS` |

Diagnostics registers only when `MENATA_DIAGNOSTIC_API_KEY` is set. Once it is set, the
other two `MENATA_*` vars become **required** — `requireEnv()` throws at boot without them.

They all import `@vendure/*` cleanly, so they work unchanged against the npm packages.
To run them in a fresh, independent Vendure project, see `../ADD-PLUGINS-TO-NEW-VENDURE.md`.

## Why the build is still not instant

All 5 plugins inject **dashboard UI** (`dashboard: './dashboard/index.tsx'`), so
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
Plugin vars (`AUDIT_LOG_RETENTION_DAYS`, the `MENATA_*` diagnostics set) are in the
plugin table above and in `.env.example`.

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
2. If the major/minor changed (e.g. 3.7 → 3.8), bump the `~3.7.3` ranges in
   `deploy/package.json` to `~3.8.0`.
3. Refresh the lockfile **inside the builder image**, then commit the updated
   `package-lock.json` (the deliberate "take the update" step). A lock written by npm
   on Windows can fail the container's `npm ci` ("lock file ... does not satisfy"):

   ```bash
   docker run --rm -v "$PWD/deploy:/w" -w /w node:20-bookworm \
     npm install --package-lock-only --no-audit --no-fund
   ```
4. Rebuild locally once (`docker build -f deploy/Dockerfile -t menata .` from the
   repo root) to confirm green, then push. The plugins are shared — nothing else to sync.

> **Why the `overrides` block exists:** newer `@tanstack/router-*` releases tighten
> route-id parsing and break the dashboard's bundled routes. The overrides pin that
> family to the exact versions upstream Vendure 3.7.3 locks in its `bun.lock`
> (react-router 1.168.1). 1.170.x also breaks the dashboard **dev** server (blank page
> after login: a replaced router is never loaded). When bumping Vendure, copy the
> versions from the monorepo `bun.lock`.

## Notes
- DB stays MariaDB/MySQL per request. Vendure recommends PostgreSQL; switch any
  time with `DB=postgres` + Postgres creds **after adding the `pg` driver** to
  `deploy/package.json` (only `mysql2` is installed today).
- Once you retire the old root `Dockerfile`, you can add `packages` to the root
  `.dockerignore` to make the build context smaller/faster.
