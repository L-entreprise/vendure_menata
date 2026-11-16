import { countProgress, FieldProgress } from '../../content-i18n/shared/translation-progress';

import { entryTranslatableKeys, EntrySchemaBlock, pickTranslation, sourceTranslation, TranslationRowLike } from './localize';

/**
 * Which CMS fields count as "text to translate", and whether a language has them.
 * Pure: the source is the default-language value, the target the language's own value
 * (no fallback). Page name and slug, and per-language image swaps, are not counted.
 */

export interface ProgressBlock extends EntrySchemaBlock {
    metadata?: Record<string, unknown> | null;
    translations: TranslationRowLike[];
}

export interface ProgressEntry {
    data: Record<string, unknown>;
    translations?: Array<{ languageCode: string; data: Record<string, unknown> }>;
}

interface FieldPair {
    source: string | null | undefined;
    target: string | null | undefined;
}

const TEXT_BLOCK_TYPES = new Set(['TEXT_SHORT', 'TEXT_LONG', 'RICH_TEXT', 'ENUM']);
const IMAGE_META_FIELDS = ['alt', 'description'] as const;

type ImageMeta = Record<string, Record<string, unknown> | undefined>;

/** Progress of a content page's blocks in `lang`. */
export function blocksProgress(blocks: readonly ProgressBlock[], lang: string, defaultLang: string): FieldProgress {
    return countProgress(blocks.flatMap(block => blockFields(block, lang, defaultLang)));
}

/** Progress of a list's entries in `lang`. */
export function entriesProgress(
    schema: readonly EntrySchemaBlock[],
    entries: readonly ProgressEntry[],
    lang: string,
): FieldProgress {
    const isTranslatable = entryTranslatableKeys(schema);
    const imageKeys = new Set(schema.filter(b => b.type === 'IMAGE').map(b => b.key));
    return countProgress(
        entries.flatMap(entry => {
            const target = entry.translations?.find(t => t.languageCode === lang)?.data ?? {};
            return Object.entries(entry.data ?? {})
                .filter(([key]) => isTranslatable(key) && !imageKeys.has(key))
                .flatMap(([key, value]) =>
                    key.endsWith('__imageMeta')
                        ? imageMetaFields(value as ImageMeta, target[key] as ImageMeta | undefined)
                        : [{ source: text(value), target: text(target[key]) }],
                );
        }),
    );
}

function blockFields(block: ProgressBlock, lang: string, defaultLang: string): FieldPair[] {
    const source = sourceTranslation(block.translations, defaultLang);
    const own = pickTranslation(block.translations, lang);
    const ownMeta = (own?.translatedMetadata ?? {}) as Record<string, unknown>;
    const metadata = block.metadata ?? {};
    if (TEXT_BLOCK_TYPES.has(block.type)) {
        return [{ source: text(source?.textContent), target: text(own?.textContent) }];
    }
    if (block.type === 'IMAGE') {
        return [
            { source: text(source?.altText), target: text(own?.altText) },
            { source: text(metadata.description), target: text(ownMeta.description) },
        ];
    }
    if (block.type === 'IMAGE_GALLERY') {
        const assetIds = Array.isArray(metadata.assetIds) ? metadata.assetIds.map(String) : [];
        const baseMeta = (metadata.imageMeta ?? {}) as ImageMeta;
        const ordered = Object.fromEntries(assetIds.map(id => [id, baseMeta[id]]));
        return imageMetaFields(ordered, ownMeta.imageMeta as ImageMeta | undefined);
    }
    return [];
}

function imageMetaFields(base: ImageMeta | undefined, translated: ImageMeta | undefined): FieldPair[] {
    return Object.entries(base ?? {}).flatMap(([assetId, fields]) =>
        IMAGE_META_FIELDS.map(f => ({ source: text(fields?.[f]), target: text(translated?.[assetId]?.[f]) })),
    );
}

function text(value: unknown): string {
    if (value == null) return '';
    return Array.isArray(value) ? JSON.stringify(value) : String(value);
}
