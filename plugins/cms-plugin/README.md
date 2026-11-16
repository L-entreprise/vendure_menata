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
   `content-i18n` must be a sibling as well: the CMS imports its shared translation
   helpers (progress rules, hints, dialogs) by relative path `../content-i18n/...`.

3. **Inside the TypeScript / dashboard scan roots** — put the plugin folders under a
   path covered by the host `tsconfig.json` `include` and by the dashboard Vite
   config (e.g. `src/plugins/`), otherwise they are not compiled and the dashboard
   extension is not picked up.

4. **A migration** — the plugin adds tables. Generate one (or run once with
   `synchronize: true` in development). Upgrading from a version without page
   hierarchy adds three columns to `cms_page`: `parentId` (nullable FK to
   `cms_page`, `ON DELETE SET NULL`), `previewUrl` (nullable) and `advanced`
   (boolean, default `false`). Existing rows need no data change.

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
- **Simple mode** is the default for everyone: page fields only, grouped in
  sections, without keys, types, page settings, adding/removing fields, page
  creation or deletion. SuperAdmins switch to *Expert mode* (per browser, a display
  preference only; the API still enforces who may change structure).
- **Sections and help** live in each block's `metadata` (no migration):
  `section` (panel title, panels follow the page order), `sectionCollapsed: true`
  (panel starts closed, e.g. "Référencement Google") and `help` (line under the
  field; `[label](/products)` links to a dashboard screen, http(s) links open
  outside, anything else stays text). Edit them in expert mode, or set them from a
  seed script.
- **Advanced pages** (`advanced: true`, e.g. interface labels) are hidden from the
  page list and from tabs in simple mode.
- Gallery previews are resolved per asset id from the Admin API, so reordering,
  removing, saving or reloading never shifts thumbnails.

## Languages

Content uses Vendure's native translations. The languages are the channel's
(Settings → Channels); the original is the channel's **default language**.

- **Editing:** the editor works on the dashboard's *content language* (the switcher
  next to the alerts bell, from `content-i18n`). In the default language it edits the
  original; in another language it edits that language's row, with the original under
  each field (copy button). The Admin API already receives `?languageCode=` from the
  dashboard, so `ctx.languageCode` is the language being edited.
- **What is translated:** block texts (`textContent`, `altText`, `name`), image
  captions and gallery alt/description (`ContentBlockTranslation.translatedMetadata`),
  an optional per-language image (`ContentBlockTranslation.featuredAsset`), page
  `name`/`slug`, and list-entry texts (`FormSubmissionTranslation.data`). Dates,
  numbers, toggles and gallery contents are shared by all languages.
- **Fallback:** the Shop API answers per field: a field empty or missing in the
  requested language shows the default language's value.
- **Rights:** editors without SuperAdmin may translate page `name`/`slug` in the other
  languages; the original stays SuperAdmin-only.
- **Progress:** `CmsPage.translationProgress` and `cmsTranslationProgress(pageIds)`
  (Admin API) count, per target language, the fields with original text and those
  translated (a top-level page includes its child pages; form pages never count).
  The page list shows it, and a bell alert lists unfinished pages.
- **Original changed:** after saving the original, if translations of the changed
  fields exist, a dialog offers to keep them, clear them, or translate now.
- **Upgrading from `translation-plugin`:** run `npm run migrate:translations` in
  `deploy/` once (see `../content-i18n/README.md`).
