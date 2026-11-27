// Language-aware editing of CMS blocks and list entries, on Vendure's native translation
// rows. Pure: the page editor, the child-page tabs and the specs share it.
//
// In the default language the editor works on the original row and the block's own
// image texts. In another language it works on that language's row: texts, image
// texts (`translatedMetadata`) and an optional image of its own. The original stays in
// `_source`, for the hints under each field and to restore the block on save.

import { hasText } from '../../content-i18n/shared/translation-progress';
import { entryTranslatableKeys, mergeEntryData } from '../services/localize';
import { getDefaultMetadata, resolveBlockEnabled } from './cms-block-utils';

type Row = Record<string, any>;
type ImageMeta = Record<string, { alt?: string; description?: string }>;

const IMAGE_TYPES = new Set(['IMAGE', 'IMAGE_GALLERY']);

export interface BlockSource {
    name: string;
    textContent: string;
    altText: string;
    description: unknown;
    imageMeta: ImageMeta | undefined;
    metadata: Record<string, unknown> | null;
    featuredAssetId: string | null;
    featuredAssetPreview: string | null;
}

/** A block from the Admin API, as the block editors edit it in `lang`. */
export function editableBlockForLanguage(block: Row, lang: string, defaultLang: string): Row {
    const rows: Row[] = block.translations ?? [];
    const sourceRow = rows.find(r => r.languageCode === defaultLang) ?? rows[0];
    const metadata = block.metadata ?? getDefaultMetadata(block.type);
    const base = {
        id: block.id,
        type: block.type,
        key: block.key,
        position: block.position,
        enabled: block.enabled ?? true,
        dateValue: block.dateValue,
        numberValue: block.numberValue != null ? Number(block.numberValue) : null,
    };
    const baseAssetId: string | null = block.featuredAsset?.id ?? block.featuredAssetId ?? null;
    const basePreview: string | null = block.featuredAsset?.preview ?? null;

    if (lang === defaultLang) {
        const own = rows.find(r => r.languageCode === lang);
        const row = own ? editableRow(own) : sourceRow ? { ...editableRow(sourceRow), id: undefined, languageCode: lang } : emptyRow(lang, '');
        return { ...base, metadata, featuredAssetId: baseAssetId, _assetPreview: basePreview, translations: [stripUndefined(row)] };
    }

    const own = rows.find(r => r.languageCode === lang);
    const translated = (own?.translatedMetadata ?? {}) as Row;
    return {
        ...base,
        metadata: IMAGE_TYPES.has(block.type)
            ? { ...(metadata ?? {}), description: translated.description ?? '', imageMeta: translated.imageMeta ?? {} }
            : metadata,
        featuredAssetId: own?.featuredAsset?.id ?? baseAssetId,
        _assetPreview: own?.featuredAsset?.preview ?? basePreview,
        translations: [own ? editableRow(own) : emptyRow(lang, sourceRow?.name ?? '')],
        _source: {
            name: sourceRow?.name ?? '',
            textContent: sourceRow?.textContent ?? '',
            altText: sourceRow?.altText ?? '',
            description: metadata?.description,
            imageMeta: metadata?.imageMeta,
            metadata,
            featuredAssetId: baseAssetId,
            featuredAssetPreview: basePreview,
        } satisfies BlockSource,
    };
}

/** The `UpdatePageContentBlockInput` for an edited block, writing only the `lang` row. */
export function blockForMutation(block: Row, index: number, lang: string, defaultLang: string): Row {
    const row: Row = block.translations?.[0] ?? emptyRow(lang, '');
    const source: BlockSource | undefined = block._source;
    const common = {
        ...(block.id ? { id: block.id } : {}),
        type: block.type,
        key: block.key,
        position: index,
        enabled: resolveBlockEnabled(block),
        dateValue: block.dateValue ?? null,
        numberValue: block.numberValue != null ? Number(block.numberValue) : null,
    };
    // A block added while translating has no original yet: its first row is the original.
    const rowLanguage = !source && !block.id ? defaultLang : lang;
    const rowInput = {
        ...(row.id ? { id: row.id } : {}),
        languageCode: rowLanguage,
        name: row.name ?? '',
        textContent: row.textContent ?? '',
        altText: row.altText ?? '',
    };
    if (lang === defaultLang || !source) {
        return { ...common, featuredAssetId: block.featuredAssetId ?? null, metadata: block.metadata ?? null, translations: [rowInput] };
    }
    const { description, imageMeta, ...structural } = (block.metadata ?? {}) as Row;
    const restored = {
        ...structural,
        ...(source.metadata?.description !== undefined && { description: source.metadata.description }),
        ...(source.metadata?.imageMeta !== undefined && { imageMeta: source.metadata.imageMeta }),
    };
    const ownImage = block.featuredAssetId != null && String(block.featuredAssetId) !== String(source.featuredAssetId ?? '');
    return {
        ...common,
        featuredAssetId: source.featuredAssetId,
        metadata: Object.keys(restored).length ? restored : null,
        translations: [
            {
                ...rowInput,
                translatedMetadata: translatedMetadata(description, imageMeta),
                featuredAssetId: ownImage ? block.featuredAssetId : null,
            },
        ],
    };
}

// `any`: the result feeds generated GraphQL input types the editor state is not typed against.
export function blocksForMutation(blocks: Row[], lang: string, defaultLang: string): any[] {
    return (blocks ?? []).filter(b => b.type).map((b, i) => blockForMutation(b, i, lang, defaultLang));
}

/** A block's label: its name in the edited language (or as the API localised it), else the original's. */
export function blockLabel(block: Row): string {
    return block.name || block.translations?.[0]?.name || block._source?.name || block.key || '';
}

/**
 * A list entry's data as edited in `lang`: values that are not translated come from the
 * entry; texts and image texts from the language's own translation (empty when missing);
 * the image falls back to the entry's own.
 */
export function entryDataForLanguage(
    blocks: Array<{ key: string; type: string }>,
    base: Row,
    translated: Row | undefined,
    lang: string,
    defaultLang: string,
): Row {
    if (lang === defaultLang) return { ...base };
    const isTranslatable = entryTranslatableKeys(blocks);
    const own = translated ?? {};
    const structural = Object.fromEntries(Object.entries(base ?? {}).filter(([key]) => !isTranslatable(key)));
    const texts = blocks.reduce<Row>((acc, block) => {
        switch (block.type) {
            case 'TEXT_SHORT':
            case 'TEXT_LONG':
            case 'RICH_TEXT':
                return { ...acc, [block.key]: own[block.key] ?? '' };
            case 'ENUM':
                return { ...acc, [block.key]: own[block.key] ?? [] };
            case 'IMAGE':
                return {
                    ...acc,
                    [block.key]: own[block.key] ?? base?.[block.key] ?? null,
                    [`${block.key}__alt`]: own[`${block.key}__alt`] ?? '',
                    [`${block.key}__description`]: own[`${block.key}__description`] ?? '',
                };
            case 'IMAGE_GALLERY':
                return { ...acc, [`${block.key}__imageMeta`]: own[`${block.key}__imageMeta`] ?? {} };
            default:
                return acc;
        }
    }, {});
    return { ...structural, ...texts };
}

function editableRow(row: Row): Row {
    return { id: row.id, languageCode: row.languageCode, name: row.name ?? '', textContent: row.textContent ?? '', altText: row.altText ?? '' };
}

function emptyRow(lang: string, name: string): Row {
    return { languageCode: lang, name, textContent: '', altText: '' };
}

function translatedMetadata(description: unknown, imageMeta: unknown): Row | null {
    const meta = Object.entries((imageMeta ?? {}) as ImageMeta).reduce<ImageMeta>((acc, [assetId, fields]) => {
        const kept = Object.fromEntries(Object.entries(fields ?? {}).filter(([, v]) => hasText(String(v ?? ''))));
        return Object.keys(kept).length ? { ...acc, [assetId]: kept } : acc;
    }, {});
    const result = {
        ...(hasText(String(description ?? '')) && { description }),
        ...(Object.keys(meta).length && { imageMeta: meta }),
    };
    return Object.keys(result).length ? result : null;
}

function stripUndefined(row: Row): Row {
    return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
}

/**
 * An entry's values as the site shows them in `lang` (read-only views such as the
 * entries table): that language's texts over the original, field by field, with the
 * same fallback as the Shop API. The editor uses `entryDataForLanguage` instead, which
 * leaves untranslated fields empty.
 */
export function entryDataInLanguage(
    blocks: Array<{ key: string; type: string }>,
    entry: { data?: Row | null; translations?: Array<{ languageCode: string; data: Row }> | null },
    lang: string,
    defaultLang: string,
): Row {
    const base = entry.data ?? {};
    if (lang === defaultLang) return base;
    const translation = (entry.translations ?? []).find(tr => tr.languageCode === lang);
    return mergeEntryData(blocks, base, translation?.data);
}
