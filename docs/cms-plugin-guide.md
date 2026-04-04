# CMS Plugin & Related Plugins — Feature Guide

> **Purpose:** Comprehensive reference for the custom Vendure plugins in this project. Use this document to understand plugin capabilities without reading every source file.

---

## Table of Contents

1. [CMS Plugin — Entities](#1-cms-plugin--entities)
2. [CMS Plugin — Services](#2-cms-plugin--services)
3. [CMS Plugin — GraphQL Schema](#3-cms-plugin--graphql-schema)
4. [CMS Plugin — Resolvers](#4-cms-plugin--resolvers)
5. [CMS Plugin — Dashboard Components](#5-cms-plugin--dashboard-components)
6. [The 9 Content Block Types](#6-the-9-content-block-types)
7. [Key Features](#7-key-features)
8. [Audit Log Plugin](#8-audit-log-plugin)
9. [Menata Branding Plugin](#9-menata-branding-plugin)
10. [i18n & Translations](#10-i18n--translations)
11. [File Paths Reference](#11-file-paths-reference)

---

## 1. CMS Plugin — Entities

### CmsPage
- Extends `VendureEntity`, implements `Translatable`, `HasCustomFields`
- **Fields:** `key` (indexed, max 255), `enabled` (default true), `acceptsSubmissions` (default false), `isCollection` (default false), `pinnedInSidebar` (default false), `allowCustomerCreation` (default false)
- **Relations:** `translations` (eager), `contentBlocks` (OneToMany), `channels` (ManyToMany)
- **Locale strings:** `name`, `slug`

### CmsPageTranslation
- **Fields:** `languageCode`, `name` (max 255), `slug` (max 255)
- **Relation:** `base: CmsPage` (cascade delete)

### ContentBlock
- Extends `VendureEntity`, implements `Translatable`, `HasCustomFields`
- **Fields:** `key` (indexed with pageId), `type` (ContentBlockType enum), `enabled`, `position`, `metadata` (JSON, max 8KB), `dateValue`, `numberValue`
- **Relations:** `featuredAsset` (ManyToOne, nullable), `page` (ManyToOne, cascade delete), `translations` (eager), `channels` (ManyToMany)
- **Locale strings:** `name`, `textContent`, `altText`

### ContentBlockTranslation
- **Fields:** `languageCode`, `name` (max 255), `textContent` (text), `altText` (max 255)

### FormSubmission
- **Fields:** `data` (JSON, required), `pageId` (indexed)
- **Relations:** `page` (ManyToOne, cascade delete), `channels` (ManyToMany)
- Used for both form submissions AND collection entries (determined by `page.isCollection`)

---

## 2. CMS Plugin — Services

### CmsPageService

| Method | Returns | Description |
|--------|---------|-------------|
| `findAll(ctx, options?, onlyEnabled)` | `PaginatedList<CmsPage>` | Lists pages with blocks, filtered by channel |
| `findOne(ctx, id, onlyEnabled)` | `CmsPage \| undefined` | Single page with sorted blocks |
| `findByKey(ctx, key, onlyEnabled)` | `CmsPage \| undefined` | Lookup by key (unique per channel) |
| `findPinned(ctx)` | `CmsPage[]` | Pages with `pinnedInSidebar=true` and `enabled=true` |
| `create(ctx, input)` | `CmsPage` | Validates key uniqueness, mutual exclusivity, sanitizes RICH_TEXT |
| `update(ctx, input)` | `CmsPage` | SuperAdmin: full sync. Non-SuperAdmin: content-only updates |
| `delete(ctx, id)` | `DeletionResponse` | Deletes page |

**Validation rules:**
- Key: 1-255 chars, unique per channel
- `acceptsSubmissions` and `isCollection` are mutually exclusive
- Non-SuperAdmin cannot modify block structure (key, type, add/remove blocks)

### ContentBlockService

| Method | Returns | Description |
|--------|---------|-------------|
| `findAll(ctx, options?, onlyEnabled)` | `PaginatedList<ContentBlock>` | Lists standalone blocks |
| `findOne(ctx, id, onlyEnabled)` | `ContentBlock \| undefined` | Single block |
| `findByKey(ctx, key, onlyEnabled)` | `ContentBlock \| undefined` | Lookup standalone block by key |
| `create(ctx, input)` | `ContentBlock` | Creates with sanitization |
| `update(ctx, input)` | `ContentBlock` | Updates with sanitization |
| `delete(ctx, id)` | `DeletionResponse` | Deletes block |

### FormSubmissionService

| Method | Returns | Description |
|--------|---------|-------------|
| `findByPage(ctx, pageId, options?)` | `PaginatedList<FormSubmission>` | Lists submissions for a page |
| `delete(ctx, id)` | `DeletionResponse` | Deletes submission |
| `submit(ctx, input)` | `{ success: boolean }` | Public form submission (Shop API) |
| `createEntry(ctx, input)` | `FormSubmission` | Creates collection entry (validates against schema) |
| `updateEntry(ctx, input)` | `FormSubmission` | Updates collection entry |
| `createCustomerFromSubmission(ctx, submissionId)` | `{ submission, customerId, existing }` | Converts submission to customer |

**Submission validation constraints:**
- Max 50 fields, max 255 char keys, max 10KB values, max 32KB total
- Forbidden keys: `__proto__`, `constructor`, `prototype`
- HTML stripped from string values

**Customer creation:**
- Requires `page.allowCustomerCreation=true` and `email` field in submission
- Maps: `firstName`, `lastName`, `phone` (optional)
- Checks for existing customer by email before creating
- Returns `existing: true` if customer already existed

### sanitize-rich-text.ts
- Sanitizes RICH_TEXT block translations
- Allowed HTML: standard tags + `h1`, `h2`, `img`, `figure`, `figcaption`
- Allowed attributes: `href`, `name`, `target`, `rel`, `src`, `alt`, `width`, `height`, `class`, `style`

---

## 3. CMS Plugin — GraphQL Schema

### Enums

```graphql
enum ContentBlockType {
  TEXT_SHORT, TEXT_LONG, RICH_TEXT, BOOLEAN, ENUM, IMAGE, IMAGE_GALLERY, DATE, NUMBER
}
```

### Shop API Queries

```graphql
contentBlock(id: ID!): ContentBlock
contentBlockByKey(key: String!): ContentBlock
contentBlocks(options: ContentBlockListOptions): ContentBlockList!
cmsPage(id: ID!): CmsPage
cmsPageByKey(key: String!): CmsPage
cmsPages(options: CmsPageListOptions): CmsPageList!
```

### Shop API Mutations

```graphql
submitForm(input: SubmitFormInput!): SubmitFormResult!
# input: { pageKey: String!, fields: JSON! }
```

### Admin API (extends Shop API queries, adds)

```graphql
# Additional queries
formSubmissions(pageId: ID!, options: FormSubmissionListOptions): FormSubmissionList!
pinnedCmsPages: [CmsPage!]!

# Page mutations
createCmsPage(input: CreateCmsPageInput!): CmsPage!
updateCmsPage(input: UpdateCmsPageInput!): CmsPage!
deleteCmsPage(id: ID!): DeletionResponse!

# Block mutations
createContentBlock(input: CreateContentBlockInput!): ContentBlock!
updateContentBlock(input: UpdateContentBlockInput!): ContentBlock!
deleteContentBlock(id: ID!): DeletionResponse!

# Submission mutations
deleteFormSubmission(id: ID!): DeletionResponse!
createCollectionEntry(input: CreateCollectionEntryInput!): FormSubmission!
updateCollectionEntry(input: UpdateCollectionEntryInput!): FormSubmission!
createCustomerFromSubmission(submissionId: ID!): CreateCustomerFromSubmissionResult!
```

### Key Types

```graphql
type CreateCustomerFromSubmissionResult {
  submission: FormSubmission!
  customerId: ID!
  existing: Boolean!
}
```

---

## 4. CMS Plugin — Resolvers

### Permissions

| Resolver | Permission |
|----------|-----------|
| Read pages/blocks | `ReadCmsPage` / `ReadContentBlock` |
| Create pages/blocks | `CreateCmsPage` / `CreateContentBlock` |
| Update pages/blocks | `UpdateCmsPage` / `UpdateContentBlock` |
| Delete pages/blocks/submissions | `DeleteCmsPage` / `DeleteContentBlock` |
| Collection entry CRUD | `CreateCmsPage` / `UpdateCmsPage` |
| Customer creation from submission | `UpdateCmsPage` |
| Shop API (all) | `Permission.Public` (read-only, enabled-only) |

---

## 5. CMS Plugin — Dashboard Components

### Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/cms-pages` | `cms-page-list.tsx` | List all CMS pages |
| `/cms-pages/$id` | `cms-page-detail.tsx` | Create/edit page with blocks |
| `/cms-pages/$pageId/entries/$entryId` | `cms-collection-entry.tsx` | Create/edit collection entry |
| `/content-blocks` | `content-block-list.tsx` | List standalone blocks |
| `/content-blocks/$id` | `content-block-detail.tsx` | Standalone block detail |

### cms-page-detail.tsx (~1586 lines, main component)

**Sections:**
1. **Page Settings** — Key, name, slug, enabled, acceptsSubmissions, isCollection, pinnedInSidebar, allowCustomerCreation
2. **Content Blocks Editor** — Add/remove/reorder blocks, type-specific editors
3. **Submissions Panel** — DataTable with dynamic columns, view/delete/create-customer actions
4. **Collection Entries Panel** — DataTable with dynamic columns, add/edit/delete

**Permission handling:**
- SuperAdmin: full CRUD on structure
- Non-SuperAdmin: content-only edits

### cms-collection-entry.tsx

- Dynamic form generated from page schema (contentBlocks)
- Supports all 9 block types as form fields
- Create mode (`/entries/new`) and edit mode (`/entries/$entryId`)

### index.tsx (extension entry)

- Registers all routes and sidebar navigation
- Fetches `pinnedCmsPages` at load time
- Creates dynamic sidebar items for pinned pages with PinIcon

---

## 6. The 9 Content Block Types

| Type | Storage | Editor | Collection Entry Editor |
|------|---------|--------|------------------------|
| **TEXT_SHORT** | `translations[0].textContent` | Input + char counter (max from `metadata.maxLength`, default 255) | Input |
| **TEXT_LONG** | `translations[0].textContent` | Textarea (4 rows) + char counter (max from `metadata.maxLength`, default 2000) | Textarea |
| **RICH_TEXT** | `translations[0].textContent` (HTML) | RichTextEditor (WYSIWYG) | RichTextEditor |
| **BOOLEAN** | `numberValue` (1/0) | Switch + custom labels (`metadata.trueLabel`/`falseLabel`) | Switch |
| **ENUM** | `translations[0].textContent` (newline-separated options) | Textarea + badge preview | Select dropdown |
| **IMAGE** | `featuredAssetId` + `translations[0].altText` | AssetPickerDialog (single) + alt text input | AssetPickerDialog |
| **IMAGE_GALLERY** | `metadata.assetIds` (array) | Grid of thumbnails + multi-select AssetPickerDialog | N/A |
| **DATE** | `dateValue` (ISO string) | `input[type=datetime-local]` | `input[type=datetime-local]` |
| **NUMBER** | `numberValue` (float) | `input[type=number]` | `input[type=number]` |

---

## 7. Key Features

### Form Submissions
- Page with `acceptsSubmissions=true` accepts public submissions via Shop API
- Submissions viewed/managed in admin Submissions Panel
- Optional customer creation from submissions (`allowCustomerCreation=true`)

### Collection Entries
- Page with `isCollection=true` uses ContentBlocks as schema definition
- Entries stored in FormSubmission table (same entity, different flag)
- Dedicated entry creation/editing page with full block-type form

### Pinned Pages Sidebar
- Pages with `pinnedInSidebar=true` appear in dashboard sidebar
- Dynamically loaded at plugin init via `pinnedCmsPages` query

### Asset Picking
- IMAGE blocks: single-select `AssetPickerDialog`
- IMAGE_GALLERY blocks: multi-select, previews resolved after load

### Rich Text Sanitization
- XSS prevention via sanitizeBlockTranslations on create/update

### Channel Awareness
- Pages and blocks scoped to channels
- Key uniqueness enforced per channel

---

## 8. Audit Log Plugin

**Location:** `plugins/audit-log-plugin/`

### Entity: AuditLogEntry
- **Fields:** `action`, `entityType`, `entityId`, `userId`, `userName`, `detail` (JSON)
- **Relations:** `channels` (ManyToMany)

### Service: AuditLogService
- `findAll(ctx, options?)` — Paginated list filtered by channel
- `log(ctx, input)` — Logs event (action, entityType?, entityId?, detail?)
- `pruneOldEntries(retentionDays)` — Deletes old entries

### Event Subscriptions
LoginEvent, LogoutEvent, ProductEvent, ProductVariantEvent, OrderStateTransitionEvent, OrderPlacedEvent, CustomerEvent, CollectionEvent, ChannelEvent, RoleChangeEvent

### Configuration
```typescript
AuditLogPlugin.init({ retentionDays: 90 })
```

### Dashboard
- Route: `/admin/audit-log`
- Expandable rows showing detail JSON, filterable by action
- SuperAdmin only

---

## 9. Menata Branding Plugin

**Location:** `plugins/menata-branding/`

### Features
1. **Auto language detection** — Loads French if browser locale starts with `fr`
2. **Login page customization** — Logo, welcome message, gradient background
3. **Bilingual** — English/French welcome messages

---

## 10. i18n & Translations

### Setup
- **Library:** @lingui/js (macro-based)
- **Format:** PO files in `dashboard/i18n/{en,fr}.po`
- **Languages:** English (en), French (fr)

### Usage Patterns
```typescript
import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';

const { t } = useLingui();
<Trans>Page created</Trans>           // JSX
t`Customer already exists`            // String props
msg`Short Text`                       // Module-level descriptors
```

### Important
- `en.po` must have entries (msgid = msgstr) for Lingui to compile catalogs
- PO files auto-discovered from `dashboard/**/*.po` by `vite-plugin-translations.ts`
- Restart dev server after modifying PO files

---

## 11. File Paths Reference

```
plugins/
├── cms-plugin/
│   ├── cms.plugin.ts
│   ├── constants.ts
│   ├── entities/
│   │   ├── cms-page.entity.ts
│   │   ├── cms-page-translation.entity.ts
│   │   ├── content-block.entity.ts
│   │   ├── content-block-translation.entity.ts
│   │   └── form-submission.entity.ts
│   ├── services/
│   │   ├── cms-page.service.ts
│   │   ├── content-block.service.ts
│   │   ├── form-submission.service.ts
│   │   └── sanitize-rich-text.ts
│   ├── api/
│   │   ├── api-extensions.ts
│   │   ├── cms-page-admin.resolver.ts
│   │   ├── cms-page-shop.resolver.ts
│   │   ├── content-block-admin.resolver.ts
│   │   ├── content-block-shop.resolver.ts
│   │   ├── form-submission-admin.resolver.ts
│   │   ├── form-submission-shop.resolver.ts
│   │   └── types.ts
│   └── dashboard/
│       ├── index.tsx
│       ├── cms-page-list.tsx
│       ├── cms-page-detail.tsx
│       ├── cms-collection-entry.tsx
│       ├── content-block-list.tsx
│       ├── content-block-detail.tsx
│       ├── pinned-pages-list.tsx
│       └── i18n/{en,fr}.po
├── audit-log-plugin/
│   ├── audit-log.plugin.ts
│   ├── entities/audit-log-entry.entity.ts
│   ├── services/audit-log.service.ts
│   ├── api/{api-extensions,audit-log-admin.resolver,types}.ts
│   └── dashboard/{index,audit-log-list}.tsx + i18n/
└── menata-branding/
    ├── menata-branding.plugin.ts
    └── dashboard/{index,menata-login-logo}.tsx
```
