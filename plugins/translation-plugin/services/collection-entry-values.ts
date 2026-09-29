import { ContentBlock } from '../../cms-plugin/entities/content-block.entity';
import {
    collectionGalleryFieldName,
    collectionImageMetaKey,
    GALLERY_IMAGE_FIELDS,
    TRANSLATABLE_BLOCK_FIELDS,
} from '../constants';

export interface CollectionFieldValue {
    fieldName: string;
    value: string;
}

type ImageMeta = Record<string, { alt?: string; description?: string }>;

/**
 * Extracts the default-language translatable values of one collection entry from its
 * JSON `data`, using the collection's schema blocks (ordered by position).
 *
 * Pure: shared by the single-entry lookup and the bulk `collectionTranslationsByKey`
 * Shop query so both produce identical field names and values.
 */
export function collectionEntryDefaultValues(
    blocks: ContentBlock[],
    data: Record<string, unknown>,
): CollectionFieldValue[] {
    return blocks.flatMap(block => {
        if (!TRANSLATABLE_BLOCK_FIELDS[block.type]) return [];
        if (block.type === 'IMAGE_GALLERY') return galleryValues(block.key, data);
        return [...scalarValue(block.key, data[block.key]), ...imageMetaValues(block, data)];
    });
}

/** The ordered asset ids of a collection-entry IMAGE_GALLERY field. */
export function collectionGalleryAssetIds(data: Record<string, unknown>, key: string): string[] {
    const raw = data[key];
    return Array.isArray(raw) ? raw.map(String) : [];
}

// Per-image alt/description, keyed by asset id, stored in `<key>__imageMeta`.
// The asset id array itself is not translatable text.
function galleryValues(key: string, data: Record<string, unknown>): CollectionFieldValue[] {
    const galleryMeta = (data[`${key}__imageMeta`] as ImageMeta | undefined) ?? {};
    return collectionGalleryAssetIds(data, key).flatMap(assetId =>
        GALLERY_IMAGE_FIELDS.flatMap(f => {
            const metaValue = galleryMeta[assetId]?.[f];
            return typeof metaValue === 'string' && metaValue
                ? [{ fieldName: collectionGalleryFieldName(key, assetId, f), value: metaValue }]
                : [];
        }),
    );
}

function scalarValue(key: string, raw: unknown): CollectionFieldValue[] {
    if (typeof raw === 'string') return [{ fieldName: key, value: raw }];
    // Options List (ENUM) stores a string[]; serialise it so the default
    // language column seeds and round-trips through the list editor.
    if (Array.isArray(raw)) return [{ fieldName: key, value: JSON.stringify(raw) }];
    return [];
}

// IMAGE fields: the per-image alt text + description companions.
function imageMetaValues(block: ContentBlock, data: Record<string, unknown>): CollectionFieldValue[] {
    if (block.type !== 'IMAGE') return [];
    return GALLERY_IMAGE_FIELDS.flatMap(f => {
        const metaKey = collectionImageMetaKey(block.key, f);
        const metaValue = data[metaKey];
        return typeof metaValue === 'string' && metaValue ? [{ fieldName: metaKey, value: metaValue }] : [];
    });
}
