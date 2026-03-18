# CMS Block Types Expansion — Implementation Steps

**Date:** 2026-03-18
**Spec:** docs/plans/2026-03-18-cms-block-types-expansion.md
**Branch:** menata_branding

Each step is a commit-sized unit. Check off as completed.

---

## Step 1: Update Backend Enum + GraphQL Schema
**Status:** [x] DONE

**Files:**
- `plugins/cms-plugin/constants.ts`
- `plugins/cms-plugin/api/api-extensions.ts`

**Changes:**
1. In `constants.ts`, update `ContentBlockType` enum:
   - Rename `TEXT` → `TEXT_SHORT`
   - Add: `TEXT_LONG`, `BOOLEAN`, `ENUM`, `IMAGE_GALLERY`
2. In `api-extensions.ts`, update the GraphQL `ContentBlockType` enum to match
3. No entity file changes needed — it's a varchar column storing the string

**Commit:** `feat(cms-plugin): Expand ContentBlockType enum with 4 new types`

---

## Step 2: Update Dashboard BLOCK_TYPES Array + Icons
**Status:** [x] DONE

**Files:**
- `plugins/cms-plugin/dashboard/cms-page-detail.tsx`

**Changes:**
1. Update `BLOCK_TYPES` array from 5 to 9 entries
2. Add icons for new types:
   - TEXT_SHORT → TextIcon
   - TEXT_LONG → AlignLeftIcon
   - RICH_TEXT → TypeIcon (keep)
   - BOOLEAN → ToggleLeftIcon
   - ENUM → ListIcon
   - IMAGE → ImageIcon (keep)
   - IMAGE_GALLERY → ImagesIcon (or GalleryHorizontalIcon)
   - DATE → CalendarIcon (keep)
   - NUMBER → HashIcon (keep)
3. Add short descriptions for each type (used in Add Section menu)
4. Rename TEXT references to TEXT_SHORT throughout the file

**Commit:** `feat(cms-plugin): Update block types array with new types and icons`

---

## Step 3: Redesign "Add Section" Menu
**Status:** [x] DONE

**Files:**
- `plugins/cms-plugin/dashboard/cms-page-detail.tsx`

**Changes:**
1. Replace the small dropdown button+menu with a spacious grid popover
2. Layout: 3-column grid with icon, name, description per type
3. Group visually: Text types | Media types | Data types
4. Each card is clickable, closes menu and adds the block
5. Make the trigger button full-width and prominent

**Commit:** `feat(cms-plugin): Redesign Add Section menu as grid layout`

---

## Step 4: Implement TEXT_SHORT + TEXT_LONG Editors
**Status:** [x] DONE

**Files:**
- `plugins/cms-plugin/dashboard/cms-page-detail.tsx`

**Changes:**
1. TEXT_SHORT case in BlockValueEditor:
   - Single-line `<Input>` with `maxLength` from metadata (default 255)
   - Character counter display: `{length} / {max}`
   - Store/read from `translations[0].textContent`
2. TEXT_LONG case in BlockValueEditor:
   - Multi-line `<Textarea rows={4}>` with `maxLength` from metadata (default 2000)
   - Character counter display
   - Store/read from `translations[0].textContent`
3. Update `addBlock()` to set default metadata per type:
   - TEXT_SHORT: `{ maxLength: 255 }`
   - TEXT_LONG: `{ maxLength: 2000 }`

**Commit:** `feat(cms-plugin): Add TEXT_SHORT and TEXT_LONG block editors with char limits`

---

## Step 5: Implement RICH_TEXT Editor Upgrade
**Status:** [x] DONE

**Files:**
- `plugins/cms-plugin/dashboard/cms-page-detail.tsx`

**Changes:**
1. Import `RichTextEditor` from `@vendure/dashboard`
2. Replace the textarea in the RICH_TEXT case with `<RichTextEditor>`
3. Props: `value={textContent}`, `onChange={handler}`
4. The editor stores HTML — same `textContent` field, different format
5. Ensure the editor has enough vertical space (min-height)

**Commit:** `feat(cms-plugin): Replace RICH_TEXT textarea with TipTap WYSIWYG editor`

---

## Step 6: Implement BOOLEAN Editor
**Status:** [x] DONE

**Files:**
- `plugins/cms-plugin/dashboard/cms-page-detail.tsx`

**Changes:**
1. BOOLEAN case in BlockValueEditor:
   - Two `<Input>` fields: "True label" and "False label"
   - Labels stored in metadata: `{ trueLabel: "...", falseLabel: "..." }`
   - `<Switch>` toggle for the boolean value
   - Value stored in `numberValue` (1 = true, 0 = false)
   - Display active label text next to the switch
2. Update `addBlock()` defaults for BOOLEAN:
   - `metadata: { trueLabel: "Yes", falseLabel: "No" }`
   - `numberValue: 0`
3. Update `updateBlockField` / `updateBlockMetadata` to handle metadata subfields

**Commit:** `feat(cms-plugin): Add BOOLEAN block type with custom labels`

---

## Step 7: Implement ENUM Editor
**Status:** [x] DONE

**Files:**
- `plugins/cms-plugin/dashboard/cms-page-detail.tsx`

**Changes:**
1. ENUM case in BlockValueEditor:
   - `<Textarea>` for entering options (one per line)
   - Value stored in `translations[0].textContent` (newline-separated)
   - Below textarea: render parsed options as badge/tag preview
   - Helper text: "Enter one option per line"
2. Parse logic: `textContent.split('\n').filter(line => line.trim())`
3. Display tags using `<Badge>` component from @vendure/dashboard

**Commit:** `feat(cms-plugin): Add ENUM block type with tag preview`

---

## Step 8: Implement IMAGE (Single) with Asset Picker
**Status:** [x] DONE

**Files:**
- `plugins/cms-plugin/dashboard/cms-page-detail.tsx`

**Changes:**
1. Import `AssetPickerDialog` from `@vendure/dashboard`
2. IMAGE case in BlockValueEditor:
   - Show thumbnail preview if asset is selected (use asset preview URL)
   - "Select Image" button opens `AssetPickerDialog` with `multiSelect={false}`
   - On select: set `featuredAssetId` from the chosen asset
   - "Remove" button to clear the asset
   - Alt text `<Input>` below (translatable, `translations[0].altText`)
3. Need to track selected asset data (preview URL) in local state or form
4. Query the asset preview URL from the GraphQL response when editing existing blocks

**Commit:** `feat(cms-plugin): Wire IMAGE block to AssetPickerDialog`

---

## Step 9: Implement IMAGE_GALLERY with Multi-Select
**Status:** [x] DONE

**Files:**
- `plugins/cms-plugin/dashboard/cms-page-detail.tsx`

**Changes:**
1. IMAGE_GALLERY case in BlockValueEditor:
   - Use `AssetPickerDialog` with `multiSelect={true}`
   - Asset IDs stored in `metadata.assetIds: string[]`
   - Show thumbnail grid of selected assets
   - "Add Images" button opens picker
   - Individual remove buttons on each thumbnail
   - Consider using EntityAssets component if it fits
2. Update `addBlock()` defaults: `metadata: { assetIds: [] }`
3. Update transform functions to preserve metadata.assetIds

**Note:** This is the most complex step. EntityAssets may need adaptation
since it expects a different data shape. May need a simpler custom grid.

**Commit:** `feat(cms-plugin): Add IMAGE_GALLERY block with multi-select asset picker`

---

## Step 10: Update Content Block List/Detail Pages
**Status:** [x] DONE

**Files:**
- `plugins/cms-plugin/dashboard/content-block-list.tsx`
- `plugins/cms-plugin/dashboard/content-block-detail.tsx`

**Changes:**
1. Verify these pages handle the new block types gracefully
2. Update any hardcoded type references from TEXT to TEXT_SHORT
3. Ensure type column displays new types correctly in list view

**Commit:** `feat(cms-plugin): Update content block list/detail for new types`

---

## Step 11: Regenerate GraphQL Types + Test
**Status:** [x] DONE — vite build succeeded

**Changes:**
1. Start dev server to trigger schema introspection
2. Run `npm run codegen` if needed from dev-server
3. Verify dashboard loads without errors
4. Test creating a page with each of the 9 block types
5. Test saving and reloading — all data persists correctly

**Commit:** `chore(cms-plugin): Regenerate GraphQL types for expanded block types`

---

## Step 12: Handle Existing Data Migration (if any)
**Status:** [ ] Not started

**Changes:**
1. If any existing content blocks have `type = 'TEXT'`, update to `'TEXT_SHORT'`
2. SQL: `UPDATE content_block SET type = 'TEXT_SHORT' WHERE type = 'TEXT'`
3. Only needed if there's existing data in the database
4. Since `synchronize: true` and pre-production, this is low risk

**Commit:** `fix(cms-plugin): Migrate existing TEXT blocks to TEXT_SHORT`

---

## Verification Checklist

After all steps:
- [ ] All 9 block types appear in "Add Section" grid
- [ ] TEXT_SHORT: single-line input with char counter works
- [ ] TEXT_LONG: textarea with char counter works
- [ ] RICH_TEXT: TipTap editor loads with toolbar, saves HTML
- [ ] BOOLEAN: toggle + custom labels save/load correctly
- [ ] ENUM: textarea + tag preview, newline parsing works
- [ ] IMAGE: asset picker opens, thumbnail preview shows, alt text works
- [ ] IMAGE_GALLERY: multi-select picker, thumbnail grid, add/remove works
- [ ] DATE: unchanged, still works
- [ ] NUMBER: unchanged, still works
- [ ] Existing pages still load (no data corruption)
- [ ] Create new page with mixed block types — save and reload
