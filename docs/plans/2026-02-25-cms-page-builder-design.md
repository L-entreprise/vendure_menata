# CMS Page Builder Design

## Overview

Extend the CMS plugin with a Page entity that groups ordered content blocks. Users compose pages by picking field types (Text, Rich Text, Image, Date, Number) and ordering them. A "Créer" nav shortcut goes directly to page creation.

## Changes from v1

v1 had standalone content blocks. v2 adds:
- **CmsPage entity** — groups blocks into a page with a key, slug, and translatable name
- **Expanded ContentBlockType** — adds RICH_TEXT, DATE, NUMBER
- **Block ordering** — position within a page
- **Dashboard page builder** — compose pages from typed sections
- **"Créer" nav item** — shortcut to create new page

## Data Model

### New: CmsPage Entity

| Field | Type | Notes |
|-------|------|-------|
| id | ID | Auto-generated |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |
| key | string | Unique identifier (e.g. 'homepage') |
| enabled | boolean | Default true |
| translations | CmsPageTranslation[] | OneToMany, eager |
| contentBlocks | ContentBlock[] | OneToMany, ordered by position |
| channels | Channel[] | ManyToMany, ChannelAware |
| customFields | CustomCmsPageFields | Standard Vendure custom fields |

### New: CmsPageTranslation Entity

| Field | Type | Notes |
|-------|------|-------|
| id | ID | Auto-generated |
| languageCode | LanguageCode | en, fr |
| name | string | Human-readable name (e.g. "Page d'accueil") |
| slug | string | URL-friendly identifier |
| base | CmsPage | ManyToOne, CASCADE delete |
| customFields | CustomCmsPageTranslationFields | Standard Vendure custom fields |

### Modified: ContentBlock Entity

New columns added:

| Field | Type | Notes |
|-------|------|-------|
| page | CmsPage (nullable) | ManyToOne FK. Null = standalone block. |
| pageId | ID (nullable) | FK column |
| position | number | Default 0. Ordering within page. |
| dateValue | DateTime (nullable) | For DATE type blocks |
| numberValue | float (nullable) | For NUMBER type blocks |

### Modified: ContentBlockType Enum

```
IMAGE      (existing — uses featuredAsset)
TEXT       (existing — uses textContent for plain text)
RICH_TEXT  (new — uses textContent for markdown)
DATE       (new — uses dateValue)
NUMBER     (new — uses numberValue)
```

### Field mapping by type

| Type | Entity field used |
|------|------------------|
| TEXT | textContent (translatable) |
| RICH_TEXT | textContent (translatable, markdown) |
| IMAGE | featuredAsset + altText (translatable) |
| DATE | dateValue |
| NUMBER | numberValue |

## Permissions

Existing: `CrudPermissionDefinition('ContentBlock')` — unchanged.

New: `CrudPermissionDefinition('CmsPage')` → CreateCmsPage, ReadCmsPage, UpdateCmsPage, DeleteCmsPage.

## GraphQL API

### New: CmsPage Types

```graphql
type CmsPage implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    key: String!
    enabled: Boolean!
    name: String!
    slug: String!
    translations: [CmsPageTranslation!]!
    contentBlocks: [ContentBlock!]!
}

type CmsPageTranslation {
    id: ID!
    languageCode: LanguageCode!
    name: String!
    slug: String!
}

type CmsPageList implements PaginatedList {
    items: [CmsPage!]!
    totalItems: Int!
}
```

### Shop API (read-only, public)

```graphql
extend type Query {
    cmsPage(id: ID!): CmsPage
    cmsPageByKey(key: String!): CmsPage
    cmsPages(options: CmsPageListOptions): CmsPageList!
}
```

### Admin API (full CRUD)

```graphql
extend type Query {
    cmsPage(id: ID!): CmsPage
    cmsPages(options: CmsPageListOptions): CmsPageList!
}

extend type Mutation {
    createCmsPage(input: CreateCmsPageInput!): CmsPage!
    updateCmsPage(input: UpdateCmsPageInput!): CmsPage!
    deleteCmsPage(id: ID!): DeletionResponse!
}

input CmsPageTranslationInput {
    id: ID
    languageCode: LanguageCode!
    name: String!
    slug: String!
}

input CreateCmsPageInput {
    key: String!
    enabled: Boolean
    translations: [CmsPageTranslationInput!]!
    contentBlocks: [CreateContentBlockInput!]
}

input UpdateCmsPageInput {
    id: ID!
    key: String
    enabled: Boolean
    translations: [CmsPageTranslationInput!]
    contentBlocks: [UpdatePageContentBlockInput!]
}

input UpdatePageContentBlockInput {
    id: ID
    type: ContentBlockType!
    key: String!
    position: Int!
    enabled: Boolean
    featuredAssetId: ID
    dateValue: DateTime
    numberValue: Float
    translations: [ContentBlockTranslationInput!]
}
```

### Modified: ContentBlockType Enum

```graphql
enum ContentBlockType {
    IMAGE
    TEXT
    RICH_TEXT
    DATE
    NUMBER
}
```

### Modified: ContentBlock Type

```graphql
type ContentBlock implements Node {
    # ... existing fields ...
    page: CmsPage
    position: Int!
    dateValue: DateTime
    numberValue: Float
}
```

## Dashboard UX

### Nav sidebar (under CMS section)

- **"Créer"** → navigates to `/cms-pages/new` (page creation)
- **"Pages"** → navigates to `/cms-pages` (list of pages)
- **"Content Blocks"** → existing list (kept for now, may remove later)

### Page list (`/cms-pages`)

Standard ListPage with columns: name, key, slug, enabled, block count.
"New Page" button in action bar.

### Page detail / create (`/cms-pages/$id`)

1. **Top section:** name (translatable), key, slug (translatable), enabled toggle
2. **Sections area:** ordered list of content blocks belonging to this page
   - Each block shows: type badge, key field, and type-specific fields inline
   - TEXT/RICH_TEXT → text input / markdown editor
   - IMAGE → asset picker + alt text
   - DATE → date picker
   - NUMBER → number input
3. **"Add section" button** at the bottom → dropdown to pick type
4. Reorder via drag & drop or up/down buttons
5. Save creates/updates the page and all its blocks in one mutation

## Backward Compatibility

- Standalone content blocks (no page) continue to work — `pageId` is nullable
- Existing Shop API queries (`contentBlockByKey`, `contentBlocks`) unchanged
- Existing Admin API CRUD for content blocks unchanged
- New CmsPage API is additive only
- No breaking changes to existing data or schema

## File Changes

### New files
- `plugins/cms-plugin/entities/cms-page.entity.ts`
- `plugins/cms-plugin/entities/cms-page-translation.entity.ts`
- `plugins/cms-plugin/services/cms-page.service.ts`
- `plugins/cms-plugin/api/cms-page-admin.resolver.ts`
- `plugins/cms-plugin/api/cms-page-shop.resolver.ts`
- `plugins/cms-plugin/dashboard/cms-page-list.tsx`
- `plugins/cms-plugin/dashboard/cms-page-detail.tsx`

### Modified files
- `plugins/cms-plugin/constants.ts` — expand enum + add CmsPage permission
- `plugins/cms-plugin/entities/content-block.entity.ts` — add page FK, position, dateValue, numberValue
- `plugins/cms-plugin/api/api-extensions.ts` — add CmsPage schema, expand ContentBlock
- `plugins/cms-plugin/cms.plugin.ts` — register new entities, resolvers, service, permission
- `plugins/cms-plugin/dashboard/index.tsx` — add nav items + routes
