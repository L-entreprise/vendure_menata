# Menata Vendure plugins

Plugins-only branch of `vendure_menata`. No Vendure fork here: the plugins are built and
tested against the **official `@vendure/*` npm release** pinned in `deploy/package.json`.

Development still happens on `menata_branding` (the full monorepo). This branch is a
copy of its `plugins/` and `deploy/` folders, kept in sync with the command below.

## Layout

| Path | What |
|---|---|
| `plugins/menata-branding` | `MenataBrandingPlugin`, dashboard branding |
| `plugins/cms-plugin` | `CmsPlugin`, pages and content blocks (needs `sanitize-html`) |
| `plugins/audit-log-plugin` | `AuditLogPlugin.init({ retentionDays })` |
| `plugins/translation-plugin` | `TranslationPlugin.init({ languages })` |
| `plugins/diagnostics-plugin` | `DiagnosticsPlugin.init({ ... })`, Menata web diagnostic |
| `deploy/` | Minimal Vendure app wiring all 5 plugins: config, Dockerfile, dashboard build, e2e test harness |

Each plugin folder has its own README with its options.

## Use the plugins in another Vendure project

1. Copy the plugin folders you need into the project (e.g. `src/plugins/cms-plugin`).
2. Install the extra dependency if you take `cms-plugin`: `npm i sanitize-html @types/sanitize-html`.
   Everything else they import comes with `@vendure/core` and `@vendure/dashboard`.
3. Register them in `vendure-config.ts` (see `deploy/vendure-config.ts` for a working example).
4. Rebuild the dashboard (`vite build`) since every plugin ships a dashboard extension.
5. Generate and run a DB migration: `cms`, `audit-log` and `translation` add entities.

Or pull the whole folder into another git repo:

```bash
git remote add menata-plugins https://github.com/L-entreprise/vendure_menata.git
git fetch menata-plugins plugins
git checkout menata-plugins/plugins -- plugins
```

## Run and test here

```bash
cd deploy
npm ci
cd .. && ln -s deploy/node_modules node_modules && cd deploy   # plugins resolve deps from deploy/
npx tsc --noEmit -p tsconfig.json   # typecheck deploy + plugins
npm run test:e2e                    # plugin e2e tests
npx vite build                      # dashboard with the 5 extensions
```

On Windows use `mklink /J node_modules deploy\node_modules` instead of `ln -s`.
See `deploy/README.md` for running the server and the Docker image.

The `dashboard/tsconfig.json` files inside each plugin point their `@/vdb/*` paths at the
monorepo (`../../../packages/...`). They only help the editor on `menata_branding`;
the build does not use them.

## Sync from `menata_branding`

From the main checkout, with this branch checked out in a worktree:

```bash
git worktree add ../vendure_menata_plugins plugins   # once
cd ../vendure_menata_plugins
git rm -r -q plugins deploy
git checkout menata_branding -- plugins deploy .dockerignore
git commit -m "chore: Sync plugins from menata_branding"
```
