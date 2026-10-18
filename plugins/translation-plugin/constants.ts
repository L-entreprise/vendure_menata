/**
 * Maps ContentBlockType to the fields that can be translated.
 * Block types not in this map have no translatable fields.
 *
 * IMAGE_GALLERY has an empty list here because its translatable fields are
 * dynamic — one alt + one description per image. Those field names are built at
 * runtime from the gallery's asset ids (see `galleryFieldName` /
 * `parseGalleryFieldName`). Keeping the key present marks the type as
 * translatable so it is not skipped by the `!translatableFields` guard.
 */
export const TRANSLATABLE_BLOCK_FIELDS: Record<string, string[]> = {
    TEXT_SHORT: ['textContent'],
    TEXT_LONG: ['textContent'],
    RICH_TEXT: ['textContent'],
    IMAGE: ['image', 'altText', 'description'],
    IMAGE_GALLERY: [],
    ENUM: ['textContent'],
};

/** Page-level fields that are always translatable */
export const PAGE_TRANSLATABLE_FIELDS = ['name', 'slug'];

/** Per-image fields for an IMAGE_GALLERY block. */
export const GALLERY_IMAGE_FIELDS = ['alt', 'description'] as const;
export type GalleryImageField = (typeof GALLERY_IMAGE_FIELDS)[number];

/**
 * Builds the dynamic translatable field name for a single gallery image.
 * Shape: `gallery:<assetId>:<alt|description>`.
 */
export function galleryFieldName(assetId: string, field: GalleryImageField): string {
    return `gallery:${assetId}:${field}`;
}

/** Parses a gallery field name back into its `{ assetId, field }` parts. */
export function parseGalleryFieldName(
    fieldName: string,
): { assetId: string; field: GalleryImageField } | null {
    const match = /^gallery:(.+):(alt|description)$/.exec(fieldName);
    if (!match) return null;
    return { assetId: match[1], field: match[2] as GalleryImageField };
}

/**
 * Per-image fields for a collection-entry IMAGE field. The entry data stores the
 * asset id under `<key>` and the metadata under `<key>__alt` / `<key>__description`.
 */
export function collectionImageMetaKey(fieldKey: string, field: GalleryImageField): string {
    return `${fieldKey}__${field}`;
}

/**
 * Per-image field name for a collection-entry IMAGE_GALLERY field. The entry data
 * stores the asset ids under `<key>` and the per-image metadata under
 * `<key>__imageMeta`. Shape: `<key>__<assetId>__<alt|description>`.
 */
export function collectionGalleryFieldName(
    fieldKey: string,
    assetId: string,
    field: GalleryImageField,
): string {
    return `${fieldKey}__${assetId}__${field}`;
}
