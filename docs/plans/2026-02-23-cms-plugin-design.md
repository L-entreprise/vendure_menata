# CMS Plugin Design

## Overview

A Vendure CMS plugin providing standalone content blocks with typed fields (image, text). Content blocks are fetched by a stable `key` identifier and support translations (French + English), channel-awareness, and standard Vendure CRUD permissions.

## Scope (v1)

- **Content block types:** `IMAGE` and `TEXT`
- **Standalone blocks only** — no page grouping (future enhancement)
- **Translatable:** text content, alt text, and display name
- **Channel-aware:** blocks scoped to channels
- **Shop API:** public read-only access (by ID, by key, list)
- **Admin API:** full CRUD with permission checks
- **Translation fallback:** falls back to default channel language (standard Vendure behavior)

## Data Model

### ContentBlock Entity

| Field | Type | Notes |
|-------|------|-------|
| id | ID | Auto-generated |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |
| key | string | Unique per channel. Stable identifier for frontend queries. |
| type | ContentBlockType enum | `IMAGE` or `TEXT` |
| enabled | boolean | Default `true`. Soft-disable without deleting. |
| featuredAsset | Asset (nullable) | For IMAGE blocks. Uses Vendure's existing Asset entity. |
| featuredAssetId | ID (nullable) | FK to Asset |
| metadata | JSON (nullable) | Extensibility field for future use |
| translations | ContentBlockTranslation[] | OneToMany, eager loaded |
| channels | Channel[] | ManyToMany, ChannelAware |
| customFields | CustomContentBlockFields | Standard Vendure custom fields |

### ContentBlockTranslation Entity

| Field | Type | Notes |
|-------|------|-------|
| id | ID | Auto-generated |
| languageCode | LanguageCode | `en`, `fr`, etc. |
| name | string | Human-readable label (e.g., "Homepage Hero Banner") |
| textContent | string (nullable) | Rich text content, for TEXT blocks |
| altText | string (nullable) | Image alt text, for IMAGE blocks |
| base | ContentBlock | ManyToOne, CASCADE delete |
| customFields | CustomContentBlockTranslationFields | Standard Vendure custom fields |

### Interfaces

- `Translatable` — multi-language support via TranslatableSaver
- `ChannelAware` — automatic channel scoping
- `HasCustomFields` — extensible via admin config

## Permissions

Uses `CrudPermissionDefinition('ContentBlock')` which auto-generates:
- `CreateContentBlock`
- `ReadContentBlock`
- `UpdateContentBlock`
- `DeleteContentBlock`

## GraphQL API

### Shared Types

```graphql
type ContentBlock {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    key: String!
    type: ContentBlockType!
    enabled: Boolean!
    featuredAsset: Asset
    translations: [ContentBlockTranslation!]!
    name: String!
    textContent: String
    altText: String
    customFields: JSON
}

enum ContentBlockType { IMAGE TEXT }

type ContentBlockTranslation {
    id: ID!
    languageCode: LanguageCode!
    name: String!
    textContent: String
    altText: String
}

type ContentBlockList implements PaginatedList {
    items: [ContentBlock!]!
    totalItems: Int!
}
```

### Shop API (read-only, public)

```graphql
extend type Query {
    contentBlock(id: ID!): ContentBlock
    contentBlockByKey(key: String!): ContentBlock
    contentBlocks(options: ContentBlockListOptions): ContentBlockList!
}
```

### Admin API (full CRUD)

```graphql
extend type Query {
    contentBlock(id: ID!): ContentBlock
    contentBlocks(options: ContentBlockListOptions): ContentBlockList!
}

extend type Mutation {
    createContentBlock(input: CreateContentBlockInput!): ContentBlock!
    updateContentBlock(input: UpdateContentBlockInput!): ContentBlock!
    deleteContentBlock(id: ID!): DeletionResponse!
}

input CreateContentBlockInput {
    key: String!
    type: ContentBlockType!
    enabled: Boolean
    featuredAssetId: ID
    translations: [ContentBlockTranslationInput!]!
}

input UpdateContentBlockInput {
    id: ID!
    key: String
    enabled: Boolean
    featuredAssetId: ID
    translations: [ContentBlockTranslationInput!]
}

input ContentBlockTranslationInput {
    id: ID
    languageCode: LanguageCode!
    name: String!
    textContent: String
    altText: String
}
```

## Service Layer

**ContentBlockService** wraps all data access:
- `TransactionalConnection` for DB queries (channel-aware)
- `TranslatableSaver` for create/update with translations
- `ListQueryBuilder` for paginated list queries
- `AssetService` for image association (no custom upload — reuse existing)
- `translateDeep()` to resolve translations to current language

## Plugin Structure

```
packages/cms-plugin/
├── src/
│   ├── entities/
│   │   ├── content-block.entity.ts
│   │   └── content-block-translation.entity.ts
│   ├── api/
│   │   ├── api-extensions.ts
│   │   ├── content-block-admin.resolver.ts
│   │   └── content-block-shop.resolver.ts
│   ├── services/
│   │   └── content-block.service.ts
│   ├── types.ts
│   ├── constants.ts
│   └── cms.plugin.ts
├── package.json
├── tsconfig.json
└── index.ts
```

## What We Reuse From Vendure Core

- `CrudPermissionDefinition` — auto-generated CRUD permissions
- `Translatable` + `TranslatableSaver` — multi-language support
- `ChannelAware` — multi-channel scoping with automatic filtering
- `ListQueryBuilder` — pagination, filtering, sorting for free
- `AssetService` + `Asset` entity — existing image upload/management
- `TransactionalConnection` — channel-aware DB access
- `DeletionResponse` — standard delete mutation return type
- `PaginatedList` — standard list response type

## Future Enhancements (not in v1)

- Page entity to group blocks with ordering
- Additional block types (video, HTML, rich media)
- Block scheduling (publishAt / unpublishAt)
- Dashboard UI for managing blocks
- Block versioning / draft states
