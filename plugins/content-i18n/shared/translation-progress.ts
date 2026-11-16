// Translation progress rules, shared by the Admin API (list progress) and the
// dashboard (tab counts, "to translate only" filter). Pure: no server or browser imports.

export interface FieldProgress {
    /** Fields whose default-language text is not empty. */
    total: number;
    /** Of those, fields with a non-empty value in the target language. */
    translated: number;
}

/**
 * True when a value holds text a reader would see: rich text without its tags, and
 * an Options List (JSON array) with at least one option, count; blanks do not.
 */
export function hasText(value: string | null | undefined): boolean {
    if (!value) return false;
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.some(item => String(item).trim() !== '');
        } catch {
            // Not JSON: plain text that happens to start with "[".
        }
    }
    return trimmed.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
}

/**
 * Which fields count as text to translate. Page name and slug are page settings, and a
 * per-language image swap (the asset itself) is optional: neither counts.
 * `collectionImageKeys` are the keys of a collection's IMAGE fields, whose value is an asset id.
 */
export function isCountableField(
    fieldName: string,
    options: { pageField?: boolean; collectionImageKeys?: ReadonlySet<string> } = {},
): boolean {
    if (options.pageField) return false;
    if (fieldName === 'image') return false;
    return !options.collectionImageKeys?.has(fieldName);
}

/** A field needs translating when its source has text and the target has none. */
export function needsTranslation(source: string | null | undefined, target: string | null | undefined): boolean {
    return hasText(source) && !hasText(target);
}

export function countProgress(
    fields: ReadonlyArray<{ source: string | null | undefined; target: string | null | undefined }>,
): FieldProgress {
    return fields.reduce<FieldProgress>(
        (acc, field) =>
            hasText(field.source)
                ? { total: acc.total + 1, translated: acc.translated + (hasText(field.target) ? 1 : 0) }
                : acc,
        { total: 0, translated: 0 },
    );
}

export function sumProgress(items: ReadonlyArray<FieldProgress>): FieldProgress {
    return items.reduce<FieldProgress>(
        (acc, item) => ({ total: acc.total + item.total, translated: acc.translated + item.translated }),
        { total: 0, translated: 0 },
    );
}

/** Share translated, 0 to 1, or null when there is nothing to translate. Never rounds up to 1 early. */
export function progressRatio(progress: FieldProgress): number | null {
    if (progress.total === 0) return null;
    const ratio = progress.translated / progress.total;
    return ratio < 1 ? Math.min(Math.floor(ratio * 100), 99) / 100 : 1;
}
