# Calling the API from your website — CMS content, translations & images

This guide explains how a storefront fetches CMS pages, collections, translations,
and images from the Vendure **Shop API**, and renders them in the visitor's language.

- **Endpoint:** `https://api.menata.fr/shop-api` — GraphQL over HTTP `POST`.
- **Auth:** none. All CMS read queries are `Public`; just `POST` a JSON body.
- **CORS:** your site's origin must be listed in the server's `CORS_ORIGIN` env var
  (comma-separated). For local dev add e.g. `http://localhost:5173`.
- **Assets:** served from `https://api.menata.fr/assets/…`. Append
  `?preset=thumb|medium|large` to any asset URL for a resized version.

> The Admin API (`/admin-api`) is only for the dashboard. The storefront uses the
> **Shop API** exclusively.

---

## 0. Shop API queries you can call

| Query | Returns | Use for |
|-------|---------|---------|
| `cmsPageByKey(key)` | `CmsPage` | A single page + its content blocks (base/default language) |
| `cmsPage(id)` | `CmsPage` | Same, by id |
| `cmsPages(options)` | `CmsPageList` | List/paginate pages |
| `cmsPageTranslationsByKey(pageKey, languageCode)` | `PageTranslations` | Translation overrides for a page |
| `cmsPageTranslations(pageId, languageCode)` | `PageTranslations` | Same, by page id |
| `collectionEntries(pageKey, options)` | `FormSubmissionList` | Rows of a collection (`data` JSON each) |
| `collectionEntry(pageKey, entryId)` | `FormSubmission` | One collection row |
| `collectionEntryTranslations(pageId, entryId, languageCode)` | `PageTranslations` | Translation overrides for one row |
| `cmsAssets(ids: [ID!]!)` | `[Asset!]!` | Resolve image asset IDs → full URLs |

`contentBlockByKey(key)` / `contentBlocks(options)` also exist for fetching a single
block directly.

---

## 1. The fetch helper

```ts
const SHOP_API = 'https://api.menata.fr/shop-api';

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(SHOP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data as T;
}
```

No API key needed.

---

## 2. The mental model: base content + translation overlay

Every piece of content has **two layers**:

1. **Base content** — the page/blocks (`cmsPageByKey`) or collection rows
   (`collectionEntries`) in the **default language**. This always contains *every*
   field, including non-translatable ones (booleans, numbers, dates).
2. **Translation overlay** — a flat list of overrides for **one** target language
   (`cmsPageTranslationsByKey` / `collectionEntryTranslations`). It only contains the
   fields someone actually translated.

**To render a language:** fetch the base, then overlay the translations on top.
Fields with a translation are replaced; everything else falls through to the base.
So you always have a complete object, in any language. Non-translatable fields
(boolean/number/date) are never in the overlay — read them straight from the base.

### Where each block type's value lives

| `ContentBlock.type` | Base field | Translated? | Notes |
|---------------------|-----------|-------------|-------|
| `TEXT_SHORT` / `TEXT_LONG` | `textContent` | yes | plain text |
| `RICH_TEXT` | `textContent` | yes | HTML string |
| `IMAGE` | `featuredAsset` (page) / asset **id** (entry) | yes (value = asset id) | + `altText`; see §5 |
| `IMAGE_GALLERY` | `metadata.assetIds` | no | array of asset ids |
| `BOOLEAN` | `numberValue` (0/1) + `metadata.trueLabel/falseLabel` | no | read from base |
| `DATE` | `dateValue` | no | ISO string |
| `NUMBER` | `numberValue` | no | read from base |
| `ENUM` (Options List) | `textContent` (base) | yes (value = JSON array) | list; see §4 |

Translation overlay keys:
- **Pages:** `contentBlockId` + `fieldName` (page-level `name`/`slug` use `contentBlockId = null`).
- **Collection entries:** just `fieldName` (= the block `key`).

---

## 3. Fetch a single page in a given language

```ts
const PAGE_QUERY = `
  query Page($key: String!) {
    cmsPageByKey(key: $key) {
      id key name slug
      contentBlocks {
        id key type enabled
        textContent altText dateValue numberValue metadata
        featuredAsset { id preview }
      }
    }
  }`;

const PAGE_TR_QUERY = `
  query Tr($key: String!, $lang: String!) {
    cmsPageTranslationsByKey(pageKey: $key, languageCode: $lang) {
      languageCode
      entries { contentBlockId fieldName value }
    }
  }`;

async function getPage(key: string, lang: string) {
    const [{ cmsPageByKey: page }, { cmsPageTranslationsByKey: tr }] = await Promise.all([
        gql<any>(PAGE_QUERY, { key }),
        gql<any>(PAGE_TR_QUERY, { key, lang }),
    ]);
    if (!page) return null;

    // Index overrides by "<blockId|page>|<field>"
    const ov = new Map<string, string>();
    for (const e of tr?.entries ?? []) {
        ov.set(`${e.contentBlockId ?? 'page'}|${e.fieldName}`, e.value);
    }

    page.name = ov.get('page|name') ?? page.name;
    page.slug = ov.get('page|slug') ?? page.slug;

    page.contentBlocks = page.contentBlocks
        .filter((b: any) => b.enabled)
        .map((b: any) => ({
            ...b,
            textContent: ov.get(`${b.id}|textContent`) ?? b.textContent,
            altText: ov.get(`${b.id}|altText`) ?? b.altText,
            // IMAGE: translated value (if any) is an asset id, else the base asset id
            imageAssetId: ov.get(`${b.id}|image`) ?? b.featuredAsset?.id ?? null,
            imageUrl: b.featuredAsset?.preview ?? null, // base URL; override via cmsAssets if translated
        }));

    return page;
}
```

---

## 4. ENUM (Options List) — reading the list

An Options List is a list of strings. In **base** content it's a newline/comma string
(`textContent`); in a **translation** it's a JSON array string; in a **collection
entry** it's a real array. This helper normalizes all three:

```ts
function readOptions(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    const s = String(value ?? '').trim();
    if (!s) return [];
    if (s.startsWith('[')) {
        try { return JSON.parse(s).map(String); } catch { /* fall through */ }
    }
    return s.split(/\r?\n|,/).map(x => x.trim()).filter(Boolean);
}
```

---

## 5. Images — turning asset IDs into URLs

Image **blocks on a page** already give the URL: `featuredAsset { preview }`.

Image values **inside collection entries** and **IMAGE translations** are bare asset
**IDs** (the stable reference is stored, not a URL that could change). Resolve them
with `cmsAssets` — it returns full URLs (`assetUrlPrefix` already applied):

```ts
const ASSETS_QUERY = `
  query CmsAssets($ids: [ID!]!) {
    cmsAssets(ids: $ids) { id preview source width height }
  }`;

async function resolveImages(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean) as string[])];
    if (unique.length === 0) return new Map();
    const { cmsAssets } = await gql<any>(ASSETS_QUERY, { ids: unique });
    return new Map(cmsAssets.map((a: any) => [a.id, a.preview])); // id -> URL
}
```

Gather every image id, resolve once, then look up the URL when rendering.

---

## 6. Collections (a page of many entries)

A collection page's blocks define the **schema**; each entry is a row stored as JSON
keyed by block `key`. Fetch entries, overlay per-entry translations, resolve images.

```ts
const ENTRIES_QUERY = `
  query Entries($key: String!) {
    cmsPageByKey(key: $key) {
      id
      contentBlocks { key type }   # to know which fields are images
    }
    collectionEntries(pageKey: $key, options: { take: 100 }) {
      items { id data }
      totalItems
    }
  }`;

const ENTRY_TR_QUERY = `
  query EntryTr($pageId: ID!, $entryId: ID!, $lang: String!) {
    collectionEntryTranslations(pageId: $pageId, entryId: $entryId, languageCode: $lang) {
      entries { fieldName value }
    }
  }`;

async function getEntries(key: string, lang: string) {
    const base = await gql<any>(ENTRIES_QUERY, { key });
    const pageId = base.cmsPageByKey?.id;
    const imageKeys = (base.cmsPageByKey?.contentBlocks ?? [])
        .filter((b: any) => b.type === 'IMAGE').map((b: any) => b.key);

    // 1. overlay translations onto each row's data
    const rows = await Promise.all(base.collectionEntries.items.map(async (entry: any) => {
        const tr = await gql<any>(ENTRY_TR_QUERY, { pageId, entryId: entry.id, lang });
        const overlay: Record<string, unknown> = {};
        for (const e of tr.collectionEntryTranslations?.entries ?? []) {
            overlay[e.fieldName] = e.value;
        }
        return { id: entry.id, data: { ...entry.data, ...overlay } };
    }));

    // 2. resolve all image ids in one call, then attach URLs
    const ids = rows.flatMap(r => imageKeys.map((k: string) => r.data[k]));
    const urls = await resolveImages(ids);
    for (const r of rows) {
        for (const k of imageKeys) {
            const id = r.data[k];
            if (id) (r.data as any)[`${k}Url`] = urls.get(String(id)) ?? null;
        }
    }
    return rows; // each: { id, data: { ...fields, <imageKey>Url } }
}
```

> Non-translatable fields (boolean/number/date) are already in `entry.data` and stay
> identical across languages — no extra work. ENUM values: pass through `readOptions`.

---

## 7. React example (single page)

```tsx
import { useEffect, useState } from 'react';

export function CmsPage({ pageKey, lang }: { pageKey: string; lang: string }) {
    const [page, setPage] = useState<any>(null);
    useEffect(() => { getPage(pageKey, lang).then(setPage); }, [pageKey, lang]);
    if (!page) return <div>Loading…</div>;

    return (
        <article>
            <h1>{page.name}</h1>
            {page.contentBlocks.map((b: any) => {
                switch (b.type) {
                    case 'RICH_TEXT':
                        return <div key={b.id} dangerouslySetInnerHTML={{ __html: b.textContent ?? '' }} />;
                    case 'TEXT_SHORT':
                    case 'TEXT_LONG':
                        return <p key={b.id}>{b.textContent}</p>;
                    case 'IMAGE':
                        return b.imageUrl ? <img key={b.id} src={`${b.imageUrl}?preset=large`} alt={b.altText ?? ''} /> : null;
                    case 'ENUM':
                        return <ul key={b.id}>{readOptions(b.textContent).map((o, i) => <li key={i}>{o}</li>)}</ul>;
                    case 'BOOLEAN':
                        return <span key={b.id}>{b.numberValue ? (b.metadata?.trueLabel ?? 'Yes') : (b.metadata?.falseLabel ?? 'No')}</span>;
                    case 'DATE':
                        return <time key={b.id}>{b.dateValue && new Date(b.dateValue).toLocaleDateString(lang)}</time>;
                    case 'NUMBER':
                        return <span key={b.id}>{b.numberValue}</span>;
                    default:
                        return null;
                }
            })}
        </article>
    );
}
```

---

## 8. Checklist

- [ ] Use the **Shop API** (`/shop-api`), `POST`, body `{ query, variables }`. No auth.
- [ ] Add your site's origin to `CORS_ORIGIN` on the server (prod + localhost dev).
- [ ] Fetch base content: `cmsPageByKey` (page) / `collectionEntries` (collection).
- [ ] Fetch translations: `cmsPageTranslationsByKey` / `collectionEntryTranslations`,
      then overlay by `contentBlockId|fieldName` (pages) or `fieldName` (entries).
- [ ] Read non-translatable fields (boolean/number/date) straight from the base.
- [ ] Normalize `ENUM` values with `readOptions` (handles array, JSON, newline/comma).
- [ ] Resolve images: page blocks expose `featuredAsset.preview`; for entry / translated
      images, pass the asset ids to `cmsAssets(ids)` to get URLs. Add `?preset=…` for sizes.
