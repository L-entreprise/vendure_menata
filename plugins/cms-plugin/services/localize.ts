import { hasText } from '../../content-i18n/shared/translation-progress';

/**
 * Per-field language resolution for CMS content, on Vendure's native translation rows.
 *
 * `translateDeep` picks a whole translation row; here every field falls back on its own
 * to the channel's default language when it is empty in the requested one. Pure: shared
 * by the Shop API reads, the progress count and the specs.
 */

export interface TranslationRowLike {
    languageCode: string;
    [field: string]: unknown;
}

type ImageMeta = Record<string, Record<string, unknown>>;

export interface EntrySchemaBlock {
    key: string;
    type: string;
}

const IMAGE_META_FIELDS = ['alt', 'description'] as const;
const TEXT_ENTRY_TYPES = new Set(['TEXT_SHORT', 'TEXT_LONG', 'RICH_TEXT', 'ENUM', 'IMAGE']);
const IMAGE_META_SUFFIX = '__imageMeta';

/** The row of `lang`, if any. */
export function pickTranslation<T extends { languageCode: string }>(rows: readonly T[] | undefined, lang: string): T | undefined {
    return rows?.find(r => r.languageCode === lang);
}

/** The row holding the original text: the default language's, else the first row. */
export function sourceTranslation<T extends { languageCode: string }>(
    rows: readonly T[] | undefined,
    defaultLang: string,
): T | undefined {
    return pickTranslation(rows, defaultLang) ?? rows?.[0];
}

export function withFallback(
    rows: readonly TranslationRowLike[] | undefined,
    lang: string,
    defaultLang: string,
    fields: readonly string[],
): Record<string, string> {
    const own = pickTranslation(rows, lang);
    const source = sourceTranslation(rows, defaultLang);
    return Object.fromEntries(
        fields.map(field => {
            const ownValue = own?.[field];
            if (lang === defaultLang && own) return [field, asString(ownValue)];
            const value = hasText(asString(ownValue)) ? ownValue : (source?.[field] ?? ownValue);
            return [field, asString(value)];
        }),
    );
}

export function mergeTranslatedMetadata(
    base: Record<string, unknown> | null | undefined,
    translated: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
    if (!translated) return base;
    const description = translated.description;
    const withDescription = hasText(asString(description)) ? { ...(base ?? {}), description } : { ...(base ?? {}) };
    const imageMeta = mergeImageMeta(base?.imageMeta as ImageMeta | undefined, translated.imageMeta as ImageMeta | undefined);
    return imageMeta ? { ...withDescription, imageMeta } : withDescription;
}

/**
 * A copy of `block` as seen in `lang`: texts, and (with `media`) image metadata and image,
 * each with fallback. The Admin API leaves `media` off: the editor needs the original
 * metadata and image of the block, the translation sits on its row.
 */
export function localizeBlock<B extends LocalizableBlock>(
    block: B,
    lang: string,
    defaultLang: string,
    options: LocalizeOptions = { media: true },
): B {
    const texts = withFallback(block.translations, lang, defaultLang, ['name', 'textContent', 'altText']);
    if (lang === defaultLang || !options.media) return { ...block, ...texts };
    const own = pickTranslation(block.translations, lang);
    const ownAssetId = own?.featuredAssetId;
    return {
        ...block,
        ...texts,
        metadata: mergeTranslatedMetadata(block.metadata, own?.translatedMetadata as Record<string, unknown> | null),
        ...(ownAssetId != null && { featuredAssetId: ownAssetId, featuredAsset: own?.featuredAsset ?? block.featuredAsset }),
    };
}

/** A copy of `page` as seen in `lang`: name and slug with fallback, and its loaded blocks. */
export function localizePage<P extends LocalizablePage>(
    page: P,
    lang: string,
    defaultLang: string,
    options: LocalizeOptions = { media: true },
): P {
    const texts = withFallback(page.translations, lang, defaultLang, ['name', 'slug']);
    return {
        ...page,
        ...texts,
        ...(page.contentBlocks && {
            contentBlocks: page.contentBlocks.map(block => localizeBlock(block, lang, defaultLang, options)),
        }),
    };
}

export interface LocalizeOptions {
    /** Merge per-language image texts and image (Shop API); off keeps the block's own. */
    media: boolean;
}

export interface LocalizableBlock {
    translations: TranslationRowLike[];
    metadata?: Record<string, unknown> | null;
    featuredAssetId?: unknown;
    featuredAsset?: unknown;
}

export interface LocalizablePage {
    translations: TranslationRowLike[];
    contentBlocks?: LocalizableBlock[];
}

/** Which keys of a collection entry's `data` hold text that is translated per language. */
export function entryTranslatableKeys(blocks: readonly EntrySchemaBlock[]): (key: string) => boolean {
    const textKeys = new Set(blocks.filter(b => TEXT_ENTRY_TYPES.has(b.type)).map(b => b.key));
    const imageKeys = blocks.filter(b => b.type === 'IMAGE').map(b => b.key);
    const galleryKeys = blocks.filter(b => b.type === 'IMAGE_GALLERY').map(b => b.key);
    return key =>
        textKeys.has(key) ||
        imageKeys.some(k => IMAGE_META_FIELDS.some(f => key === `${k}__${f}`)) ||
        galleryKeys.some(
            k => key === `${k}${IMAGE_META_SUFFIX}` || (key.startsWith(`${k}__`) && IMAGE_META_FIELDS.some(f => key.endsWith(`__${f}`))),
        );
}

export function splitEntryData(
    blocks: readonly EntrySchemaBlock[],
    data: Record<string, unknown>,
): { translatable: Record<string, unknown>; structural: Record<string, unknown> } {
    const isTranslatable = entryTranslatableKeys(blocks);
    const entries = Object.entries(data ?? {});
    return {
        translatable: Object.fromEntries(entries.filter(([k]) => isTranslatable(k))),
        structural: Object.fromEntries(entries.filter(([k]) => !isTranslatable(k))),
    };
}

/** The entry `data` as seen in a language: translated values over the base, per key. */
export function mergeEntryData(
    blocks: readonly EntrySchemaBlock[],
    base: Record<string, unknown>,
    translated: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
    if (!translated) return base;
    const isTranslatable = entryTranslatableKeys(blocks);
    return Object.entries(translated).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (!isTranslatable(key)) return acc;
        if (key.endsWith(IMAGE_META_SUFFIX)) {
            const merged = mergeImageMeta(acc[key] as ImageMeta | undefined, value as ImageMeta | undefined);
            return merged ? { ...acc, [key]: merged } : acc;
        }
        return hasValue(value) ? { ...acc, [key]: value } : acc;
    }, { ...base });
}

/** What is worth storing for a language: translatable keys with a value, no "swap" to the same image. */
export function pruneEntryTranslation(
    blocks: readonly EntrySchemaBlock[],
    base: Record<string, unknown>,
    translated: Record<string, unknown>,
): Record<string, unknown> {
    const isTranslatable = entryTranslatableKeys(blocks);
    const imageKeys = new Set(blocks.filter(b => b.type === 'IMAGE').map(b => b.key));
    return Object.entries(translated ?? {}).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (!isTranslatable(key)) return acc;
        if (key.endsWith(IMAGE_META_SUFFIX)) {
            const meta = pruneImageMeta(value as ImageMeta | undefined);
            return meta ? { ...acc, [key]: meta } : acc;
        }
        if (imageKeys.has(key) && value != null && String(value) === String(base?.[key] ?? '')) return acc;
        return hasValue(value) ? { ...acc, [key]: value } : acc;
    }, {});
}

function mergeImageMeta(base: ImageMeta | undefined, translated: ImageMeta | undefined): ImageMeta | undefined {
    if (!translated || typeof translated !== 'object') return base;
    return Object.entries(translated).reduce<ImageMeta>(
        (acc, [assetId, fields]) => {
            const overrides = Object.fromEntries(
                IMAGE_META_FIELDS.filter(f => hasText(asString(fields?.[f]))).map(f => [f, fields[f]]),
            );
            return Object.keys(overrides).length ? { ...acc, [assetId]: { ...(acc[assetId] ?? {}), ...overrides } } : acc;
        },
        { ...(base ?? {}) },
    );
}

function pruneImageMeta(meta: ImageMeta | undefined): ImageMeta | undefined {
    const pruned = mergeImageMeta(undefined, meta);
    return pruned && Object.keys(pruned).length ? pruned : undefined;
}

function hasValue(value: unknown): boolean {
    if (typeof value === 'string') return hasText(value);
    if (typeof value === 'number') return true;
    if (Array.isArray(value)) return value.some(item => hasText(asString(item)));
    return false;
}

function asString(value: unknown): string {
    return value == null ? '' : String(value);
}
