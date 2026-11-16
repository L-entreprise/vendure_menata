# Content i18n Plugin

Translations on Vendure's **native** system: no translation store of its own. Replaces
the former `translation-plugin`.

- **Export:** `ContentI18nPlugin` (`content-i18n.plugin.ts`), no options
- **Languages:** the channel's `availableLanguageCodes`; the original is the channel's
  `defaultLanguageCode` (Settings → Channels)
- **Compatibility:** Vendure `^3.0.0` (dashboard extension points of 3.7)
- **Extra npm deps:** none
- **Used by:** `cms-plugin` imports `shared/` and a few dashboard components by relative
  path `../content-i18n/...`: keep both folders **siblings**.

## Register

```ts
import { ContentI18nPlugin } from './plugins/content-i18n/content-i18n.plugin';

plugins: [CmsPlugin, AuditLogPlugin.init({}), ContentI18nPlugin /* ... DashboardPlugin after */]
```

## Admin API

```graphql
type LanguageProgress { languageCode: LanguageCode!, total: Int!, translated: Int!, missing: [String!]! }
extend type Product { translationProgress: [LanguageProgress!]! }
extend type Query { productTranslationSummary: [ProductTranslationSummary!]! }  # incomplete products per language
```

Counted per product: `name`, `description`, translatable custom fields
(`localeString` / `localeText`) and each variant `name`. A field counts only when the
original has text. The slug is not counted (derived from the name). `missing` labels:
`name`, `description`, `customFields.<name>`, `variant:<id>:name`.

## Dashboard

| Extension | What it does |
|---|---|
| Toolbar item, before the alerts bell | Content language switcher (channel languages). Same setting as Vendure's own selector: every editor follows it. |
| Product list column | `EN 80 %  DE 0 %` (complete languages dimmed) |
| Product page side panel "Translations" | Fields left per language, *Translate* switches the content language |
| Product / variant `name`, product `description` inputs | Native input, plus the original text and a *Copy* button while translating |
| Dialog after saving the original | When a changed field is translated somewhere: *Keep*, *Clear in EN, DE* (the site then shows the original) or *Translate now* |
| Prompt after creating a product | *Translate into EN* or *Later* (once per product and session) |
| Bell alert | "Products not fully translated", per language, every 5 minutes |

Shared with the CMS: `original-hint.tsx`, `stale-translations-dialog.tsx`,
`translating-notice.tsx`, `progress-cell.tsx`, `use-languages.tsx`,
`shared/translation-progress.ts`, `shared/stale-translations.ts`.

## Storefront

- CMS: query with `?languageCode=xx`; fields fall back to the default language per field
  (see `../cms-plugin/CMS_PLUGIN_API.md`).
- Products: Vendure falls back to the default language only when a language has no
  translation at all. After *Clear*, a field is empty in that language: fall back per
  field in the storefront.

## Upgrading from `translation-plugin`

The old data (`cms_translation_entry`, `translation_language`) is moved onto the native
rows. Run it per environment, **after a database backup**. Running it again only fills
fields that are still empty, so translations edited in the dashboard since are kept.

```bash
cd deploy
npm run migrate:translations            # copy, prints a JSON report
npm run migrate:translations -- --drop  # copy, then drop the legacy tables
```

`--drop` is refused while entries were skipped (their data would be lost); add the
languages to the channel and run again, or add `--force` to drop anyway.

- Originals saved as `en` by the old CMS editor move to the channel's default language
  (when it is not `en` and has no row yet).
- Languages the channel does not offer, and unknown codes, are **skipped and listed**
  in the report; channel settings are never changed. Add the language to the channel
  and run it again to bring them over.
- Stops with a message if the old plugin's default language differs from the channel's.

The removed Shop API queries (`cmsPageTranslationsByKey`, `collectionTranslationsByKey`,
...) have no replacement: the CMS queries return each language directly.
