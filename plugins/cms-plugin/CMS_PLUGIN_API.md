# CMS Plugin - API Reference & Frontend Integration Guide

## Overview

The CMS plugin adds content management to Vendure with two APIs:
- **Shop API** (`/shop-api`) - Public, read-only access to pages/blocks + form submissions
- **Admin API** (`/admin-api`) - Full CRUD, requires authentication

Base URL for local dev: `http://localhost:3000`

---

## Shop API (Public - No Auth Required)

### List all pages

```graphql
query {
  cmsPages {
    items {
      id
      key
      name
      slug
      enabled
      acceptsSubmissions
    }
    totalItems
  }
}
```

### Get a page by key (with all content blocks)

This is the primary query for rendering a CMS page on the frontend.

```graphql
query GetPage($key: String!) {
  cmsPageByKey(key: $key) {
    id
    key
    name
    slug
    enabled
    acceptsSubmissions
    contentBlocks {
      id
      key
      type
      enabled
      position
      name
      textContent
      altText
      dateValue
      numberValue
      metadata
      featuredAsset {
        id
        preview
        source
      }
    }
  }
}
```

**Variables:**
```json
{ "key": "homepage" }
```

### Get a page by ID

```graphql
query GetPageById($id: ID!) {
  cmsPage(id: $id) {
    id
    key
    name
    slug
    contentBlocks {
      id
      key
      type
      name
      textContent
      featuredAsset {
        id
        preview
        source
      }
    }
  }
}
```

### Get a single content block by key

```graphql
query GetBlock($key: String!) {
  contentBlockByKey(key: $key) {
    id
    key
    type
    name
    textContent
    altText
    metadata
    featuredAsset {
      id
      preview
      source
    }
  }
}
```

### Submit a form (contact form, etc.)

Only works on pages where `acceptsSubmissions: true`.

```graphql
mutation SubmitForm($input: SubmitFormInput!) {
  submitForm(input: $input) {
    success
  }
}
```

**Variables:**
```json
{
  "input": {
    "pageKey": "contact",
    "fields": {
      "name": "John Doe",
      "email": "john@example.com",
      "message": "Hello, I have a question about..."
    }
  }
}
```

**Validation rules:**
- `pageKey` must match an enabled page with `acceptsSubmissions: true`
- `fields` must be a JSON object (not array, not string)
- Maximum 50 fields
- Field keys max 255 characters
- Field values max 10,000 characters per string
- Total payload max 32KB
- Only primitive values allowed (string, number, boolean, null, or arrays of primitives)
- No nested objects
- HTML tags are stripped from string values
- Keys `__proto__`, `constructor`, `prototype` are forbidden

---

## Content Block Types

Each content block has a `type` that determines what data it holds:

| Type | Data Location | Description |
|------|--------------|-------------|
| `TEXT_SHORT` | `textContent` | Single-line text (max defined in `metadata.maxLength`) |
| `TEXT_LONG` | `textContent` | Multi-line text |
| `RICH_TEXT` | `textContent` | HTML content (sanitized server-side) |
| `BOOLEAN` | `numberValue` | `1` = true, `0` = false. Labels in `metadata.trueLabel` / `metadata.falseLabel` |
| `ENUM` | `textContent` | Newline-separated list of options |
| `IMAGE` | `featuredAsset` | Single image. Alt text in `altText` |
| `IMAGE_GALLERY` | `metadata.assetIds` | Array of asset IDs. Resolve each via Vendure's asset system |
| `DATE` | `dateValue` | ISO 8601 datetime string |
| `NUMBER` | `numberValue` | Numeric value |

### Rendering example (pseudocode)

```typescript
function renderBlock(block) {
  switch (block.type) {
    case 'TEXT_SHORT':
    case 'TEXT_LONG':
      return block.textContent;

    case 'RICH_TEXT':
      // HTML string - render with dangerouslySetInnerHTML or a sanitizing renderer
      return block.textContent;

    case 'BOOLEAN':
      return block.numberValue === 1;

    case 'ENUM':
      // Split by newlines to get options array
      return block.textContent?.split('\n').filter(Boolean);

    case 'IMAGE':
      return {
        src: block.featuredAsset?.preview,
        alt: block.altText,
      };

    case 'IMAGE_GALLERY':
      // metadata.assetIds contains the IDs
      // metadata.assetPreviews is stripped server-side, not available
      return block.metadata?.assetIds;

    case 'DATE':
      return new Date(block.dateValue);

    case 'NUMBER':
      return block.numberValue;
  }
}
```

---

## Frontend Integration Pattern

### 1. Fetch page data

```typescript
const SHOP_API = 'http://localhost:3000/shop-api';

async function fetchPage(key: string) {
  const response = await fetch(SHOP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query GetPage($key: String!) {
          cmsPageByKey(key: $key) {
            id
            key
            name
            slug
            acceptsSubmissions
            contentBlocks {
              id
              key
              type
              position
              name
              textContent
              altText
              dateValue
              numberValue
              metadata
              featuredAsset {
                id
                preview
                source
              }
            }
          }
        }
      `,
      variables: { key },
    }),
  });
  const { data } = await response.json();
  return data.cmsPageByKey;
}
```

### 2. Helper to get a block by key from a page

```typescript
function getBlock(page, blockKey: string) {
  return page.contentBlocks.find(b => b.key === blockKey);
}

// Usage:
const page = await fetchPage('homepage');
const heroTitle = getBlock(page, 'hero-title')?.textContent;
const heroImage = getBlock(page, 'hero-image')?.featuredAsset?.preview;
```

### 3. Submit a contact form

```typescript
async function submitContactForm(fields: Record<string, string>) {
  const response = await fetch(SHOP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation SubmitForm($input: SubmitFormInput!) {
          submitForm(input: $input) {
            success
          }
        }
      `,
      variables: {
        input: {
          pageKey: 'contact',
          fields,
        },
      },
    }),
  });
  const { data, errors } = await response.json();
  if (errors?.length) {
    throw new Error(errors[0].message);
  }
  return data.submitForm.success;
}

// Usage:
await submitContactForm({
  name: 'Jane Doe',
  email: 'jane@example.com',
  message: 'I would like to know more about your services.',
});
```

---

## Notes on the Shop API

- Only **enabled** pages and blocks are returned. Disabled content is filtered server-side.
- Blocks are sorted by `position` (ascending).
- The shop API is read-only except for `submitForm`.
- No authentication is needed for any shop API query.
- Asset URLs in `featuredAsset.preview` and `featuredAsset.source` are relative to the Vendure server. Prepend the server base URL if needed (e.g., `http://localhost:3000` + preview path).
- For image galleries, `metadata.assetIds` gives you the IDs. You can resolve full asset URLs by querying individual assets or by using them with Vendure's asset URL pattern.

---

## Existing Test Data

Pages currently in the database:

| ID | Key | Name | Accepts Submissions |
|----|-----|------|-------------------|
| 1 | `oui` | azeazeaze | No |
| 2 | `category` | category | No |
| 3 | `a` | a | No |
| 4 | `contactr` | contact | **Yes** |

To test form submission, use page key `contactr`.

---

## Quick curl Test Commands

**Fetch all pages:**
```bash
curl -s -X POST http://localhost:3000/shop-api \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ cmsPages { items { id key name acceptsSubmissions } totalItems } }"}'
```

**Fetch a page with content:**
```bash
curl -s -X POST http://localhost:3000/shop-api \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { cmsPageByKey(key: \"contactr\") { id name contentBlocks { key type textContent } } }"}'
```

**Submit a form:**
```bash
cat << 'EOF' | curl -s -X POST http://localhost:3000/shop-api -H 'Content-Type: application/json' -d @-
{
  "query": "mutation SubmitForm($input: SubmitFormInput!) { submitForm(input: $input) { success } }",
  "variables": {
    "input": {
      "pageKey": "contactr",
      "fields": {
        "name": "Test User",
        "email": "test@example.com",
        "message": "This is a test submission"
      }
    }
  }
}
EOF
```
