/**
 * Exclusive toggles: a BOOLEAN field of a collection whose schema block carries
 * `metadata.exclusive = true` may be on for one entry only (e.g. "featured").
 * Turning it on for an entry turns it off on every other entry of the collection.
 */

export const EXCLUSIVE_METADATA_KEY = 'exclusive';

interface ExclusiveSchemaBlock {
    key?: string | null;
    type: string;
    metadata?: Record<string, unknown> | null;
}

/** Whether a schema block is a BOOLEAN field flagged as exclusive. */
export function isExclusiveToggle(block: ExclusiveSchemaBlock): boolean {
    return block.type === 'BOOLEAN' && !!block.key && block.metadata?.[EXCLUSIVE_METADATA_KEY] === true;
}

/** The exclusive fields that the given entry data turns on. */
export function exclusiveKeysTurnedOn(
    blocks: readonly ExclusiveSchemaBlock[],
    data: Record<string, unknown> | null | undefined,
): string[] {
    if (!data) return [];
    return blocks
        .filter(isExclusiveToggle)
        .map(block => block.key as string)
        .filter(key => data[key] === true);
}

/**
 * The entry data with the given fields turned off, or `null` when none of them was on
 * (nothing to save).
 */
export function turnOffKeys(
    data: Record<string, unknown> | null | undefined,
    keys: readonly string[],
): Record<string, unknown> | null {
    if (!data) return null;
    const onKeys = keys.filter(key => data[key] === true);
    if (onKeys.length === 0) return null;
    return { ...data, ...Object.fromEntries(onKeys.map(key => [key, false])) };
}
