import { ContentBlock } from '../../cms-plugin/entities/content-block.entity';
import { galleryFieldName, GALLERY_IMAGE_FIELDS, TRANSLATABLE_BLOCK_FIELDS } from '../constants';

export interface BlockFieldValue {
    fieldName: string;
    value: string;
}

/** The translatable text columns of a block's default-language translation row. */
export interface BlockTranslationRow {
    altText?: string | null;
    textContent?: string | null;
    [field: string]: unknown;
}

/**
 * The default-language values of one page block, in field order. `translation` is the
 * block's CMS translation row (name, textContent, altText), when it has one.
 *
 * Pure: shared by the per-page default content (dashboard source column, Shop API
 * default language) and the bulk progress count, so both see the same fields.
 */
export function blockDefaultValues(
    block: Pick<ContentBlock, 'type' | 'featuredAssetId' | 'metadata'>,
    translation: BlockTranslationRow | undefined,
): BlockFieldValue[] {
    const translatableFields = TRANSLATABLE_BLOCK_FIELDS[block.type];
    if (!translatableFields) return [];
    const metadata = (block.metadata ?? {}) as Record<string, any>;

    // IMAGE blocks: the image itself (asset id) plus alt text (translation row) and
    // description (block metadata) are translatable.
    if (block.type === 'IMAGE') {
        return [
            ...(block.featuredAssetId ? [{ fieldName: 'image', value: String(block.featuredAssetId) }] : []),
            ...(translation?.altText ? [{ fieldName: 'altText', value: String(translation.altText) }] : []),
            ...(metadata.description ? [{ fieldName: 'description', value: String(metadata.description) }] : []),
        ];
    }

    // IMAGE_GALLERY: per-image alt/description stored in metadata.imageMeta.
    if (block.type === 'IMAGE_GALLERY') {
        const assetIds: string[] = metadata.assetIds ?? [];
        const imageMeta: Record<string, { alt?: string; description?: string }> = metadata.imageMeta ?? {};
        return assetIds.flatMap(assetId =>
            GALLERY_IMAGE_FIELDS.flatMap(f => {
                const value = (imageMeta[String(assetId)] ?? {})[f];
                return value != null && value !== ''
                    ? [{ fieldName: galleryFieldName(String(assetId), f), value: String(value) }]
                    : [];
            }),
        );
    }

    if (!translation) return [];
    return translatableFields.flatMap(fieldName => {
        const value = translation[fieldName];
        return value != null ? [{ fieldName, value: String(value) }] : [];
    });
}
