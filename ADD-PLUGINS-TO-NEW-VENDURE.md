# Adding the Menata Plugins to a New Vendure

How to take the 5 plugins in this repo's `plugins/` folder and run them in a
**fresh, separate Vendure project**.

The plugins are written to be portable: they import only `@vendure/*` packages
(plus one small extra lib), so they drop into any Vendure 3.5.x install without
touching the core packages.

---

## The 5 plugins

| Folder | Plugin export | Init? | What it does |
|--------|---------------|-------|--------------|
| `plugins/menata-branding/` | `MenataBrandingPlugin` | no | Branding / theming, dashboard UI |
| `plugins/cms-plugin/` | `CmsPlugin` | no | CMS content, dashboard UI |
| `plugins/audit-log-plugin/` | `AuditLogPlugin.init({...})` | yes | Audit log of admin actions |
| `plugins/translation-plugin/` | `TranslationPlugin.init({...})` | yes | Multi-language content |
| `plugins/diagnostics-plugin/` | `DiagnosticsPlugin.init({...})` | yes | Menata web-diagnostic in admin |

All 5 add **dashboard UI** (a `dashboard/index.tsx` extension). That one fact
drives most of this guide — see step 4.

---

## What the plugins need

**Runtime deps (npm):**

- `@vendure/core`, `@vendure/common` — always required by Vendure anyway.
- `sanitize-html` — only the **cms-plugin** uses it. `npm i sanitize-html` plus
  its types `npm i -D @types/sanitize-html` (ships no bundled types; a
  type-checked `ts-node`/`tsc` build fails without them — `deploy/` dodges this
  only because it runs `ts-node ... transpile-only`).

Everything else the dashboard UIs import (`react`, `lucide-react`,
`@tanstack/react-router`, `@lingui/*`, `sonner`) is provided by
`@vendure/dashboard` as a peer dep. The server-side imports (`@nestjs/*`,
`typeorm`, `rxjs`, `graphql-tag`) come from `@vendure/core`. Nothing else to add.

**Version:** plugins are built against Vendure `~3.5.0`. Match that minor in the
new project, or bump plugins + project together.

---

## Database — required `DB` env var

The plugins are cross-DB compatible (MariaDB/MySQL, Postgres, SQLite), but **one
column type is dialect-specific**: `ContentBlock.dateValue` in the cms-plugin.
Postgres has no `datetime` type, and MySQL/MariaDB `timestamp` caps at year 2038.
So the entity picks its date column type at import time from `process.env.DB`:

```ts
// plugins/cms-plugin/entities/content-block.entity.ts
const dateColumnType: ColumnType =
    (process.env.DB ?? 'mariadb') === 'postgres' ? 'timestamp' : 'datetime';
```

**This means the `DB` env var must be set** (and your `vendure-config.ts` must read
the same var to choose the connection). If it's missing it defaults to `mariadb`
→ `datetime`, which **breaks on Postgres**. So in the new project, add it:

```env
# .env
DB=postgres          # or: mariadb | mysql | sqlite
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vendure
DB_USERNAME=men_prod
DB_PASSWORD=men_test
DB_SCHEMA=public     # postgres only
```

…and make `vendure-config.ts` read `process.env.DB` to pick the TypeORM `type`
(see how `deploy/vendure-config.ts` → `getDbConfig()` does it). Set the **same**
value the entity sees — both read `process.env.DB`.

> If you add more date columns in any plugin later, reuse `dateColumnType` instead
> of hardcoding `'datetime'`. Every other column type the plugins use
> (`simple-json`, `varchar`, `text`, `float`, `int`) is already DB-portable.

---

## Step-by-step

### 1. Create the new Vendure project

```bash
npx @vendure/create my-new-shop
cd my-new-shop
```

This gives you `src/vendure-config.ts`, `src/index.ts`, `src/index-worker.ts`.

### 2. Copy the plugins in

Copy the 5 folders into the new project, e.g. into `src/plugins/`:

```
my-new-shop/
  src/
    plugins/
      menata-branding/
      cms-plugin/
      audit-log-plugin/
      translation-plugin/
      diagnostics-plugin/
    vendure-config.ts
```

> Tip: copy whole folders. Each plugin is self-contained (`api/`, `entities/`,
> `services/`, `dashboard/`). Don't cherry-pick files.

### 3. Install the extra dep

```bash
npm i sanitize-html
# only needed if you keep cms-plugin
```

If you drop a plugin, you also drop its extra dep (only cms needs one).

### 4. Register plugins in `vendure-config.ts`

Add the imports (adjust the path to where you copied them):

```ts
import { MenataBrandingPlugin } from './plugins/menata-branding/menata-branding.plugin';
import { CmsPlugin } from './plugins/cms-plugin/cms.plugin';
import { AuditLogPlugin } from './plugins/audit-log-plugin/audit-log.plugin';
import { TranslationPlugin } from './plugins/translation-plugin/translation.plugin';
import { DiagnosticsPlugin } from './plugins/diagnostics-plugin/diagnostics.plugin';
```

Then add them to the `plugins: [ ... ]` array:

```ts
plugins: [
    // ... existing plugins (AssetServerPlugin, EmailPlugin, etc.) ...

    MenataBrandingPlugin,
    CmsPlugin,
    AuditLogPlugin.init({
        retentionDays: Number(process.env.AUDIT_LOG_RETENTION_DAYS) || 90,
    }),
    TranslationPlugin.init({
        languages: [
            { code: 'en', name: 'English' },
            { code: 'fr', name: 'French' },
        ],
    }),

    // Diagnostics: only register when this client has a Menata key.
    ...(process.env.MENATA_DIAGNOSTIC_API_KEY
        ? [
              DiagnosticsPlugin.init({
                  apiBaseUrl: process.env.MENATA_API_BASE_URL!,
                  apiKey: process.env.MENATA_DIAGNOSTIC_API_KEY!,
                  clientId: process.env.MENATA_CLIENT_ID!,
                  ctaUrl: process.env.DIAGNOSTICS_CTA_URL,
              }),
          ]
        : []),

    // The dashboard MUST come after the plugins above so it picks up their UI.
    DashboardPlugin.init({
        route: 'dashboard',
        appDir: path.join(__dirname, 'dist'),
    }),
],
```

> You can drop any plugin you don't want — just remove its import + array entry
> (and its env vars / extra dep). They're independent of each other.

### 5. Wire up the dashboard build (the important part)

The plugins inject admin **dashboard UI**, so the dashboard SPA must be compiled
with the plugins baked in. You need a Vite config that points at your
`vendure-config.ts`. The smallest version:

```ts
// vite.config.mts
import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import path from 'path';
import { pathToFileURL } from 'url';
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/dashboard/',
    plugins: [
        vendureDashboardPlugin({
            vendureConfigPath: pathToFileURL('./src/vendure-config.ts'),
            gqlOutputPath: path.resolve(__dirname, './src/graphql/'),
        }),
    ],
});
```

Build it (outputs to `./dist`, which `DashboardPlugin` serves at `/dashboard`):

```bash
npx vite build
```

> Copy the full `vite.config.mts` from `deploy/` in this repo if you also want
> the Menata theme colors and the TanStack Router version pins (see note below).

### 6. Run it

```bash
# first boot only — creates the plugins' DB tables:
DB_SYNCHRONIZE=true npm run start:server
npm run start:worker
```

Open `http://localhost:3000/dashboard`. The plugin UIs appear in the admin.

---

## Production schema: `synchronize` vs migrations (Coolify)

For a real deploy you have a **separate, empty Postgres** and two ways to create
its schema. Pick one:

### Option A — keep `synchronize: true` (quick, risky)

Vendure auto-creates/updates tables to match the entities on every boot.

- ✅ Zero extra work.
- ❌ **Not recommended for production** — `synchronize` can silently `ALTER`/`DROP`
  columns and **lose data** when entities change. Fine for a throwaway test DB,
  not for one holding real content.

### Option B — migrations (recommended for Coolify)

Generate versioned SQL migration files locally, commit them, and let the server
apply them on boot. The `deploy/` project is already wired for this:

- `deploy/index.ts` calls `runMigrations(config)` **before** bootstrap, so pending
  migrations apply automatically on every Coolify deploy — no manual step.
- `deploy/vendure-config.ts` points at `migrations/*.ts`.
- `deploy/migration.ts` + npm scripts generate/run/revert them.

**Workflow:**

```bash
cd deploy

# 1. Point at the SAME db dialect prod uses (so generated SQL matches), e.g. Postgres
#    via your local .env / shell. Set DB_SYNCHRONIZE=false so it doesn't auto-sync.

# 2. Generate a migration from the current entities (incl. all 5 plugins):
npm run migration:generate Init          # creates deploy/migrations/<timestamp>-Init.ts

# 3. Commit the generated file:
git add migrations/ && git commit -m "chore(deploy): initial schema migration"
```

On Coolify, set **`DB_SYNCHRONIZE=false`**. When the service boots, `runMigrations`
applies any committed-but-unapplied migrations to the prod DB. Each time you change
an entity later: `migration:generate <Name>` → commit → redeploy.

> Generate migrations against the **same DB engine** as production (Postgres here).
> A migration generated against MariaDB produces MySQL-flavored SQL that won't run
> on Postgres.

> Manual apply/rollback if ever needed: `npm run migration:run` /
> `npm run migration:revert`.

### Does my CMS content come along?

**No — migrations move *schema*, not *data*.** The pages, content blocks, and text
you create in the local admin are **rows in your local DB**. Migrations only build
the empty tables. Your Coolify Postgres starts empty regardless. To move content:

- **Recreate it** in the production admin (simplest for a bit of content), or
- **Copy the data**: `pg_dump` your local DB → `pg_restore`/`psql` into the prod DB
  (carries all rows — products, CMS content, everything).

So: do your CMS authoring wherever the content should *live*. If you build it
locally and want it in prod, dump+restore the data; migrations alone won't carry it.

---

## Gotchas

- **Dashboard order:** `DashboardPlugin` must be **after** the UI plugins in the
  array, or their extensions won't be picked up.
- **DB schema:** the plugins add tables/columns (audit log, cms, translation).
  Run once with `DB_SYNCHRONIZE=true` (or generate a migration), then turn it off.
- **TanStack Router:** newer `@tanstack/router-*` releases break the dashboard's
  bundled routes. If the dashboard build fails on routing, pin that family — copy
  the `overrides` block from `deploy/package.json`.
- **Diagnostics env:** only register the diagnostics plugin if you set
  `MENATA_DIAGNOSTIC_API_KEY`, `MENATA_API_BASE_URL`, `MENATA_CLIENT_ID`. Without
  them, leave it out (the conditional above handles this).
- **Version match:** keep the new project on the same Vendure minor (`3.5.x`) the
  plugins were built against.

---

## Shortcut: just copy the `deploy/` project

If the "new Vendure" is really another **production deploy** (not a dev fork),
the fastest path is to clone the existing `deploy/` folder — it already wires all
5 plugins, the dashboard build, Docker, and env handling. See `deploy/README.md`
and `deploy/COOLIFY.md`. This guide is for adding the plugins to a *brand-new,
independent* Vendure instead.
