# CMS Block Types Expansion — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Branch:** menata_branding

## Summary

Expand the CMS plugin from 5 block types to 9, fix broken UX (image picker, rich text editor), and improve the "Add Section" UI in the page builder.

## Current State

**Existing types:** TEXT, RICH_TEXT, IMAGE, DATE, NUMBER
**Problems:**
- TEXT is one type — need short (single-line, 255 char) and long (multi-line, 2000 char)
- RICH_TEXT uses a plain textarea — should use Vendure's built-in TipTap WYSIWYG editor
- IMAGE has a raw text input for Asset ID — should use Vendure's AssetPickerDialog
- No boolean type
- No enum/options list type
- No multi-image/gallery type
- "Add Section" dropdown is too small and cramped

## Target State — 9 Block Types

### 1. TEXT_SHORT (replaces TEXT)
- Single-line `<Input>` with character counter
- Default max: 255 characters (stored in `metadata.maxLength`)
- Translatable: uses `textContent` from translations
- Dashboard shows: `21 / 255` counter

### 2. TEXT_LONG (new)
- Multi-line `<Textarea>` with character counter
- Default max: 2000 characters (stored in `metadata.maxLength`)
- Translatable: uses `textContent` from translations
- Dashboard shows: `52 / 2000` counter

### 3. RICH_TEXT (upgraded)
- Replace plain textarea with Vendure's `RichTextEditor` component (TipTap)
- Full toolbar: bold, italic, headings, links, images, tables
- Stores HTML in `textContent` translation field
- Import from `@vendure/dashboard`: `RichTextEditor`

### 4. BOOLEAN (new)
- Toggle switch (`<Switch>`)
- Custom labels for true/false stored in `metadata`: `{ trueLabel: "Show Banner", falseLabel: "Hide Banner" }`
- Value stored in `numberValue`: 1 = true, 0 = false
- Dashboard displays the active label next to the toggle
- Label inputs shown in the block editor so admin can configure them

### 5. ENUM (new)
- Textarea where each line = one option
- Stored in `textContent` (newline-separated)
- Dashboard shows tag/badge preview below the textarea
- NOT translatable (enum values are typically keys/identifiers)
- Stored as plain text, frontend splits by `\n`

### 6. IMAGE (single — keeps existing name)
- Replace raw text input with Vendure's `AssetPickerDialog`
- Shows thumbnail preview of selected asset
- Alt text field (translatable)
- Uses existing `featuredAsset` / `featuredAssetId` field
- "Select Image" button opens picker, "Remove" button clears

### 7. IMAGE_GALLERY (new)
- Multi-select asset picker
- Uses Vendure's `EntityAssets` component with `multiSelect={true}`
- Asset IDs stored in `metadata.assetIds: string[]`
- Shows grid of thumbnails, drag to reorder
- "Add Images" button opens picker with multi-select

### 8. DATE (unchanged)
- datetime-local input
- Stored in `dateValue`

### 9. NUMBER (unchanged)
- number input
- Stored in `numberValue`

## Data Storage Strategy

**No new database columns needed.** All new types use existing fields:

| Type | textContent | numberValue | dateValue | featuredAsset | metadata |
|------|------------|-------------|-----------|---------------|----------|
| TEXT_SHORT | content | - | - | - | `{ maxLength: 255 }` |
| TEXT_LONG | content | - | - | - | `{ maxLength: 2000 }` |
| RICH_TEXT | HTML content | - | - | - | - |
| BOOLEAN | - | 0 or 1 | - | - | `{ trueLabel, falseLabel }` |
| ENUM | line-separated | - | - | - | - |
| IMAGE | - | - | - | asset ref | - |
| IMAGE_GALLERY | - | - | - | - | `{ assetIds: [] }` |
| DATE | - | - | date | - | - |
| NUMBER | - | numberValue | - | - | - |

## GraphQL Schema Changes

### Enum Update
```graphql
enum ContentBlockType {
    TEXT_SHORT    # was TEXT
    TEXT_LONG     # new
    RICH_TEXT     # existing
    BOOLEAN       # new
    ENUM          # new
    IMAGE         # existing
    IMAGE_GALLERY # new
    DATE          # existing
    NUMBER        # existing
}
```

### No input/query changes needed
- `metadata` field already exists as JSON
- `textContent`, `numberValue`, `dateValue`, `featuredAssetId` all exist
- IMAGE_GALLERY uses `metadata.assetIds` — no schema change

## Dashboard UI Changes

### "Add Section" Menu Redesign
Replace the small dropdown with a **grid dialog/popover** showing:
- Icon + name + short description for each type
- 2-3 column grid layout
- Grouped: Text types | Media types | Data types
- Much more spacious and discoverable

### Block Editor Updates (BlockValueEditor)
Each type gets its own editor panel within the block card:
- **TEXT_SHORT**: `<Input>` + char counter
- **TEXT_LONG**: `<Textarea rows={4}>` + char counter
- **RICH_TEXT**: `<RichTextEditor>` from @vendure/dashboard
- **BOOLEAN**: Two label inputs + `<Switch>` with active label display
- **ENUM**: `<Textarea>` + tag preview below
- **IMAGE**: Asset thumbnail + "Select Image" button + alt text input
- **IMAGE_GALLERY**: `EntityAssets` component grid
- **DATE**: unchanged
- **NUMBER**: unchanged

## Migration Note

Rename `TEXT` → `TEXT_SHORT` in:
1. `ContentBlockType` enum in `constants.ts`
2. GraphQL schema in `api-extensions.ts`
3. Entity — the varchar column stores the enum string value; existing rows with `TEXT` need updating
4. Since `synchronize: true` is on and this is pre-production, a simple UPDATE query handles existing data

## Files to Modify

### Backend (plugin)
1. `plugins/cms-plugin/constants.ts` — update ContentBlockType enum
2. `plugins/cms-plugin/api/api-extensions.ts` — update GraphQL ContentBlockType enum
3. `plugins/cms-plugin/entities/content-block.entity.ts` — no structural changes, just enum update

### Dashboard (plugin)
4. `plugins/cms-plugin/dashboard/cms-page-detail.tsx` — main work:
   - Update BLOCK_TYPES array (9 types with icons and descriptions)
   - Rewrite BlockValueEditor with new type editors
   - Redesign "Add Section" menu as a grid
   - Import RichTextEditor, AssetPickerDialog from @vendure/dashboard
5. `plugins/cms-plugin/dashboard/content-block-detail.tsx` — update if it references block types
6. `plugins/cms-plugin/dashboard/content-block-list.tsx` — update if it references block types

### Dev Server
7. `packages/dev-server/graphql/` — regenerate GraphQL types after schema change
