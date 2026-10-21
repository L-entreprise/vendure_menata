# Translation Plugin

Multi-language content for the CMS plugin: a per-channel list of languages, a
translation editor in the dashboard, and public Shop API queries the storefront reads.

- **Export:** `TranslationPlugin` (`translation.plugin.ts`)
- **Entities:** `TranslationLanguage`, `CmsTranslationEntry`
- **Services:** `TranslationLanguageService`, `CmsTranslationService`,
  `ShopTranslationService` (Shop API view)
- **Dashboard routes:** `/cms-translations`, `/cms-translations/$id`,
  `/cms-translations/settings` — nav section `translations`
- **Compatibility:** Vendure `^3.0.0`
- **Extra npm deps:** none
- **Depends on:** `AuditLogPlugin` (imported by the plugin; translation changes are
  written to the audit trail through an `@Optional()` `AuditLogService`) and content
  from `CmsPlugin`

> **Packaging constraint:** the code imports `../audit-log-plugin/...` and
> `../cms-plugin/...` by relative path. The `audit-log-plugin`, `cms-plugin` and
> `translation-plugin` folders must be **siblings** in the same directory, or nothing
> compiles. Register all three plugins.

## Register

```ts
import { TranslationPlugin } from './plugins/translation-plugin/translation.plugin';

plugins: [
    CmsPlugin,
    AuditLogPlugin.init({ /* ... */ }),
    TranslationPlugin.init({
        languages: [
            { code: 'en', name: 'English' },
            { code: 'fr', name: 'French' },
        ],
    }),
    // ... DashboardPlugin must come after
]
```

| Option | Type | Meaning |
|---|---|---|
| `languages` | `LanguageInput[]` | Seeded on bootstrap into every channel. Empty array = no seeding (languages are then managed only from the dashboard). |

`LanguageInput`: `{ code, name, enabled?, isDefault?, position? }`.

No env vars — the language list lives in the config file (`deploy/vendure-config.ts`).
On `onApplicationBootstrap` the plugin syncs that list into `TranslationLanguage` rows;
afterwards the admin can manage them at `/cms-translations/settings`.

## Entities

**`TranslationLanguage`** — `code` (≤10, indexed), `name` (≤100), `enabled` (default
true), `isDefault` (default false), `position` (default 0), `channels` (ManyToMany).

**`CmsTranslationEntry`** — one translated value:

| Column | Notes |
|---|---|
| `languageCode` | ≤10 |
| `pageId` | the CMS page |
| `contentBlockId` | nullable — set when translating a block field |
| `entryId` | nullable — set when translating a collection entry |
| `fieldName` | ≤100, e.g. `name`, `textContent`, `altText` |
| `value` | `text`, default `''` |

Composite indexes: `(pageId, languageCode)`, `(contentBlockId, languageCode, fieldName)`,
`(entryId, languageCode)`.

Adding this plugin adds tables — run once with `DB_SYNCHRONIZE=true` or generate a
migration.

## Admin API (`/admin-api`)

```graphql
query {
    translationLanguages { id code name enabled isDefault position }
    cmsPageTranslatableFields(pageId: ID!) { ... }
    cmsPageTranslations(pageId: ID!, languageCode: String) { ... }
    cmsPageDefaultContent(pageId: ID!) { ... }
    collectionEntryTranslatableFields(pageId: ID!) { ... }
    collectionEntryTranslations(pageId: ID!, entryId: ID!, languageCode: String) { ... }
    collectionEntryDefaultContent(pageId: ID!, entryId: ID!) { ... }
    # Dashboard views, read-only, a fixed number of DB queries however many pages:
    cmsTranslationProgress(pageIds: [ID!]!) { pageId languageCode total translated }
    collectionEntriesTranslations(pageId: ID!) { entryId languageCode entries { fieldName value } }
}

mutation {
    setTranslationLanguages(input: [TranslationLanguageInput!]!) { ... }
    updateCmsPageTranslations(input: UpdateCmsPageTranslationsInput!) { ... }
    updateCollectionEntryTranslations(input: UpdateCollectionEntryTranslationsInput!) { ... }
}
```

`setTranslationLanguages` is a full replace: codes missing from the input are deleted.

`cmsTranslationProgress` counts, per page and enabled non-default language, the fields with
text in the default language (`total`) and those with a value in that language
(`translated`). Page name and slug (page settings) and per-language image swaps are not
counted; empty rich text and empty option lists count as empty. The rules live in
`translation-progress.ts`, shared with the dashboard. Nothing records which source text a
translation was made from (block rows also change when a label changes), so outdated
translations are not flagged.

## Shop API (`/shop-api`) — public, no auth

```graphql
query {
    cmsPageTranslations(pageId: ID!, languageCode: String!) { ... }
    cmsPageTranslationsByKey(pageKey: String!, languageCode: String!) { ... }
    collectionEntryTranslations(pageId: ID!, entryId: ID!, languageCode: String!) { ... }
    collectionTranslationsByKey(pageKey: String!, languageCode: String!) {
        entryId
        entries { fieldName value blockKey blockType }
    }
}
```

Prefer `cmsPageTranslationsByKey` / `collectionTranslationsByKey` in the storefront —
page keys are stable, ids are not.

These queries are enough to render a page without the `cms-plugin` Shop API:

- Every entry carries **`blockKey`** and **`blockType`** (null for the page-level
  `name` / `slug`). For collection entries, `fieldName` is the block key or a companion
  of it (`<key>__alt`, `<key>__<assetId>__description`).
- Every **IMAGE_GALLERY** returns one structure entry whose `value` is the JSON array of
  its ordered asset ids — `fieldName: "gallery"` on a page, `fieldName: <key>` on a
  collection entry — in every language, even when no image has alt text. Resolve ids
  with `cmsAssets(ids)`.
- Entries of **disabled blocks** are dropped (same rule as `cmsPageByKey`); only
  **enabled pages** of the current channel are served; the collection queries only
  serve real collections (`isCollection`, not form pages — submissions are never public).
- Default language = CMS content; other languages = only the stored translations, so
  merge them over the default-language result.

Full request/response examples: **`menata-docs/docs/translation-api-guide.md`** (local, untracked).

## Dashboard

| Route | Page |
|---|---|
| `/cms-translations` | Top-level CMS pages, with their tab count and progress per language (`DE 92 % · EN 100 %`) |
| `/cms-translations/$id` | Side-by-side editor: original (read-only) on the left, one target language on the right |
| `/cms-translations/settings` | Manage the language list (SuperAdmin) |

The editor follows the CMS page editor:

- **Tabs:** "Texts", then one tab per child page (`sidebarOrder`). A child page opened
  directly redirects to its parent's tab. A list (`isCollection`) shows every entry in one
  tab. Each tab shows how many fields are left and saves only the fields that changed, in
  every language edited.
- **Sections and help:** fields are grouped by `metadata.section` (collapsed when
  `sectionCollapsed`), with `metadata.help` under each field.
- **Only fields to translate:** keeps the fields with source text and no translation in the
  target language, judged on saved values so a field being typed in stays visible.
- **Simple mode:** the CMS display preference (`cms-simple-mode.tsx`, one switch for both
  plugins). It hides advanced pages, page name and slug, technical keys and the language
  settings button. SuperAdmins switch to expert mode.
- **Links:** "Edit in the original language" opens the CMS page on the same tab; the CMS
  page editor shows "Translate this page" when this plugin's route is registered.

Image `altText` and description fields are translatable alongside text content. Strings
are localized with Lingui PO files in `dashboard/i18n/`.

## See also

- `menata-docs/docs/translation-api-guide.md` (local, untracked) — Shop API reference for the storefront
- `menata-docs/STOREFRONT_CMS_TRANSLATIONS.md` (local, untracked) — storefront integration notes
- `../cms-plugin/CMS_PLUGIN_API.md` — the content this plugin translates
- `menata-docs/ADD-PLUGINS-TO-NEW-VENDURE.md` (local, untracked) — installing this plugin in another Vendure
