// Rows of the translation editor: which fields show, under which label and section,
// and which ones still need translating. Pure, so it is unit tested.

import { groupBlocksBySection } from '../../cms-plugin/dashboard/cms-block-utils';
import { countProgress, FieldProgress, isCountableField, needsTranslation } from '../translation-progress';

export interface BlockInfo {
    id: string;
    key: string;
    type: string;
    /** Block name in the default language (the label the client knows from the CMS). */
    name: string;
    metadata: Record<string, unknown> | null;
}

/** What a row edits: the text itself, an image's alt text or description, or the image. */
export type RowPart = 'value' | 'alt' | 'description' | 'image';

export interface TranslationRow {
    /** Key in the value maps: `<blockId|page>|<field>` on a page, the field name on a list entry. */
    key: string;
    fieldName: string;
    blockType: string | null;
    /** Block name; for page fields, the field name (`name`, `slug`). Null when the block has none. */
    label: string | null;
    /** Technical key, shown in expert mode only. */
    technicalKey: string | null;
    part: RowPart;
    /** Gallery image the row belongs to. */
    assetId?: string;
    help?: unknown;
    /** The block's metadata: `section`, `sectionCollapsed`, `help`. */
    metadata: Record<string, unknown> | null;
    pageField: boolean;
    /** Counts towards progress and can be "to translate". */
    countable: boolean;
}

export type Values = Readonly<Record<string, string | undefined>>;

const GALLERY_FIELD = /^gallery:(.+):(alt|description)$/;
const ENTRY_META_FIELD = /^(.+)__(alt|description)$/;

export function pageRowKey(contentBlockId: string | null, fieldName: string): string {
    return `${contentBlockId ?? 'page'}|${fieldName}`;
}

/**
 * Rows of a plain page, from `cmsPageTranslatableFields`. Simple mode leaves out the
 * page name and slug, which are page settings in the CMS too.
 */
export function buildPageRows(
    fields: ReadonlyArray<{ contentBlockId: string | null; fieldName: string; blockType: string | null }>,
    blocks: ReadonlyMap<string, BlockInfo>,
    options: { simple: boolean },
): TranslationRow[] {
    return fields.flatMap(field => {
        const pageField = field.contentBlockId == null;
        if (pageField && options.simple) return [];
        const block = pageField ? undefined : blocks.get(String(field.contentBlockId));
        const gallery = GALLERY_FIELD.exec(field.fieldName);
        return [{
            key: pageRowKey(field.contentBlockId, field.fieldName),
            fieldName: field.fieldName,
            blockType: field.blockType,
            label: pageField ? field.fieldName : block?.name || null,
            technicalKey: pageField ? null : block?.key ?? null,
            part: gallery ? (gallery[2] as RowPart) : pagePart(field.fieldName),
            assetId: gallery?.[1],
            help: block?.metadata?.help,
            metadata: block?.metadata ?? null,
            pageField,
            countable: isCountableField(field.fieldName, { pageField }),
        }];
    });
}

function pagePart(fieldName: string): RowPart {
    if (fieldName === 'altText') return 'alt';
    if (fieldName === 'description') return 'description';
    if (fieldName === 'image') return 'image';
    return 'value';
}

/**
 * Rows of one list entry. Gallery images live in the entry data, so their alt text and
 * description rows are built from it (`<key>__<assetId>__alt|description`).
 */
export function buildEntryRows(
    fields: ReadonlyArray<{ fieldName: string; blockType: string | null }>,
    blocksByKey: ReadonlyMap<string, BlockInfo>,
    data: Readonly<Record<string, unknown>>,
): TranslationRow[] {
    const collectionImageKeys = new Set(
        [...blocksByKey.values()].filter(b => b.type === 'IMAGE').map(b => b.key),
    );
    const row = (fieldName: string, baseKey: string, part: RowPart, blockType: string | null, assetId?: string) => {
        const block = blocksByKey.get(baseKey);
        return {
            key: fieldName,
            fieldName,
            blockType,
            label: block?.name || null,
            technicalKey: baseKey,
            part,
            assetId,
            help: part === 'value' || part === 'image' ? block?.metadata?.help : undefined,
            metadata: block?.metadata ?? null,
            pageField: false,
            countable: isCountableField(fieldName, { collectionImageKeys }),
        };
    };
    return fields.flatMap((field): TranslationRow[] => {
        if (field.blockType === 'IMAGE_GALLERY') {
            const ids = Array.isArray(data[field.fieldName]) ? (data[field.fieldName] as unknown[]).map(String) : [];
            return ids.flatMap(assetId =>
                (['alt', 'description'] as const).map(part =>
                    row(`${field.fieldName}__${assetId}__${part}`, field.fieldName, part, null, assetId),
                ),
            );
        }
        const meta = ENTRY_META_FIELD.exec(field.fieldName);
        if (meta) return [row(field.fieldName, meta[1], meta[2] as RowPart, null)];
        return [row(field.fieldName, field.fieldName, field.blockType === 'IMAGE' ? 'image' : 'value', field.blockType)];
    });
}

/** The rows to show: all of them, or only those still to translate in the target language. */
export function visibleRows(
    rows: ReadonlyArray<TranslationRow>,
    source: Values,
    target: Values,
    onlyToTranslate: boolean,
): TranslationRow[] {
    if (!onlyToTranslate) return [...rows];
    return rows.filter(r => r.countable && needsTranslation(source[r.key], target[r.key]));
}

export function rowsProgress(rows: ReadonlyArray<TranslationRow>, source: Values, target: Values): FieldProgress {
    return countProgress(rows.filter(r => r.countable).map(r => ({ source: source[r.key], target: target[r.key] })));
}

export interface RowSection {
    title: string | null;
    collapsed: boolean;
    rows: TranslationRow[];
}

/** Same sections, in the same order, as the CMS page editor (`metadata.section`). */
export function groupRowsBySection(rows: ReadonlyArray<TranslationRow>): RowSection[] {
    return groupBlocksBySection([...rows]).map(section => ({
        title: section.title,
        collapsed: section.collapsed,
        rows: section.items.map(item => item.block as TranslationRow),
    }));
}

/** Fields whose value differs from what was loaded: the only ones a save sends. */
export function changedKeys(loaded: Values, edited: Values): string[] {
    return Object.keys(edited).filter(key => (edited[key] ?? '') !== (loaded[key] ?? ''));
}
