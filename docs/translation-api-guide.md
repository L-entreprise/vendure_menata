# CMS Translation API Guide

All translation queries are on the **Shop API** (`/shop-api`) and are public (no auth required).

## Endpoints

### Get translations for a page by ID

```graphql
query {
  cmsPageTranslations(pageId: "1", languageCode: "fr") {
    pageId
    languageCode
    entries {
      id
      contentBlockId
      fieldName
      value
    }
  }
}
```

### Get translations for a page by key (recommended)

```graphql
query {
  cmsPageTranslationsByKey(pageKey: "homepage", languageCode: "fr") {
    pageId
    languageCode
    entries {
      id
      contentBlockId
      fieldName
      value
    }
  }
}
```

### Get translations for a collection entry (blog post, etc.)

```graphql
query {
  collectionEntryTranslations(pageId: "3", entryId: "12", languageCode: "de") {
    pageId
    languageCode
    entries {
      id
      fieldName
      value
    }
  }
}
```

## Response structure

Each entry in `entries` has:

| Field | Description |
|-------|-------------|
| `contentBlockId` | The content block this belongs to (`null` for page-level fields like `name`/`slug`) |
| `fieldName` | Field name: `name`, `slug`, `textContent`, `image` (asset ID), or block key for collections |
| `value` | The translated value |

## Usage in your frontend

### Fetch example (Next.js / any JS)

```ts
const SHOP_API = 'http://localhost:3000/shop-api';

async function getTranslations(pageKey: string, lang: string) {
  const res = await fetch(SHOP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query ($pageKey: String!, $lang: String!) {
          cmsPageTranslationsByKey(pageKey: $pageKey, languageCode: $lang) {
            entries { contentBlockId fieldName value }
          }
        }
      `,
      variables: { pageKey, lang },
    }),
  });
  const { data } = await res.json();
  return data.cmsPageTranslationsByKey?.entries ?? [];
}
```

### Applying translations to page data

```ts
// entries from the API
const translations = await getTranslations('homepage', 'fr');

// Build a lookup: "contentBlockId|fieldName" -> value
const map = new Map(
  translations.map(e => [`${e.contentBlockId ?? 'page'}|${e.fieldName}`, e.value])
);

// Override page-level fields
const pageName = map.get('page|name') ?? originalPage.name;
const pageSlug = map.get('page|slug') ?? originalPage.slug;

// Override block fields
for (const block of originalPage.contentBlocks) {
  block.textContent = map.get(`${block.id}|textContent`) ?? block.textContent;
  // For IMAGE blocks, the value is an asset ID
  const imageId = map.get(`${block.id}|image`);
  if (imageId) block.featuredAssetId = imageId;
}
```

### Collection entries (blog posts)

```ts
async function getEntryTranslation(pageId: string, entryId: string, lang: string) {
  const res = await fetch(SHOP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query ($pageId: ID!, $entryId: ID!, $lang: String!) {
          collectionEntryTranslations(pageId: $pageId, entryId: $entryId, languageCode: $lang) {
            entries { fieldName value }
          }
        }
      `,
      variables: { pageId, entryId, lang },
    }),
  });
  const { data } = await res.json();
  return data.collectionEntryTranslations?.entries ?? [];
}

// Apply: entries are keyed by block key (e.g. "title", "description")
const translations = await getEntryTranslation('3', '12', 'fr');
for (const t of translations) {
  entryData[t.fieldName] = t.value;
}
```

## Notes

- Returns `null` if no translations exist for the requested page/language
- The default language (marked in settings) has its fields pre-populated from CMS content, but only if translations were saved for it
- IMAGE fields store asset IDs as values; use the asset ID to build image URLs via Vendure's asset system
