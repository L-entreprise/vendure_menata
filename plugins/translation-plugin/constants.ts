/**
 * Maps ContentBlockType to the fields that can be translated.
 * Block types not in this map have no translatable fields.
 */
export const TRANSLATABLE_BLOCK_FIELDS: Record<string, string[]> = {
    TEXT_SHORT: ['textContent'],
    TEXT_LONG: ['textContent'],
    RICH_TEXT: ['textContent'],
    IMAGE: ['image', 'altText'],
    ENUM: ['textContent'],
};

/** Page-level fields that are always translatable */
export const PAGE_TRANSLATABLE_FIELDS = ['name', 'slug'];
