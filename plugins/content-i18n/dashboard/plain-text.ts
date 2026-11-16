const ENTITIES: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
};

/** Rich text as a short plain line, for hints and dialogs. */
export function plainText(value: unknown): string {
    if (value == null) return '';
    return String(value)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, entity => ENTITIES[entity])
        .replace(/\s+/g, ' ')
        .trim();
}
