# CMS Plugin

Pages, typed content blocks, collections and public forms for Vendure, with a
dashboard editor and public Shop API queries.

- **Export:** `CmsPlugin` (`cms.plugin.ts`)
- **Entities:** `CmsPage`(+`Translation`), `ContentBlock`(+`Translation`), `FormSubmission`
- **Compatibility:** Vendure `^3.0.0`
- **API reference:** `CMS_PLUGIN_API.md`

## Install requirements

1. **npm dependencies** — the plugin has no `package.json` of its own; the host app
   must provide them:

   ```bash
   npm i sanitize-html
   npm i -D @types/sanitize-html
   ```

   (`services/sanitize-rich-text.ts` imports `sanitize-html` for RICH_TEXT blocks.)

2. **Sibling `audit-log-plugin` folder** — `cms.plugin.ts`, `cms-page.service.ts` and
   `form-submission.service.ts` import `../audit-log-plugin/...` by relative path, and
   the plugin module imports `AuditLogPlugin`. Keep `audit-log-plugin/` next to
   `cms-plugin/` and register `AuditLogPlugin` too, or nothing compiles.
   `translation-plugin`, if used, must be a sibling as well.

3. **Inside the TypeScript / dashboard scan roots** — put the plugin folders under a
   path covered by the host `tsconfig.json` `include` and by the dashboard Vite
   config (e.g. `src/plugins/`), otherwise they are not compiled and the dashboard
   extension is not picked up.

4. **A migration** — the plugin adds tables. Generate one (or run once with
   `synchronize: true` in development). Upgrading from a version without page
   hierarchy adds two nullable columns to `cms_page`: `parentId` (FK to `cms_page`,
   `ON DELETE SET NULL`) and `previewUrl`. Existing rows need no data change.

## Database dialects

`ContentBlock.dateValue` is the only dialect-sensitive column. Its type is chosen at
bootstrap from `VendureConfig.dbConnectionOptions.type` (`timestamp` on Postgres,
`datetime` on MySQL/MariaDB/SQLite) by the plugin's `configuration` hook — no env var
needed. Everything else is `simple-json`, numeric or varchar and is portable.

## Register

```ts
import { AuditLogPlugin } from './plugins/audit-log-plugin/audit-log.plugin';
import { CmsPlugin } from './plugins/cms-plugin/cms.plugin';

plugins: [
    AuditLogPlugin.init({ retentionDays: 90 }),
    CmsPlugin,
    // ... DashboardPlugin must come after
]
```

## Dashboard notes

- New sections are always created **enabled**. Existing sections show a
  *Visible / Hidden* switch in their header; hidden sections are filtered out of the
  Shop API.
- Pages can be grouped under a top-level page (*Parent Page* field). The page list
  shows top-level pages only; each child opens as a tab of its parent (lists show
  their entries, plain pages their fields with their own Save). See
  `CMS_PLUGIN_API.md`, "Page hierarchy".
- *Address on the Site* turns on a *View on site* button on the page.
- Gallery previews are resolved per asset id from the Admin API, so reordering,
  removing, saving or reloading never shifts thumbnails.
