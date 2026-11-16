import { hasText } from './translation-progress';

export interface TranslationRow {
    languageCode: string;
    [field: string]: unknown;
}

export interface StaleTranslations {
    /** Original fields that changed and are translated somewhere. */
    fields: string[];
    /** Languages holding a translation of at least one of those fields. */
    languages: string[];
}

/**
 * After a save: which original (default-language) fields changed while other languages
 * still hold a translation of the previous text. Pure; shared by products and the CMS.
 */
export function staleTranslations(
    before: readonly TranslationRow[],
    after: readonly TranslationRow[],
    defaultLanguage: string,
    fields: readonly string[],
): StaleTranslations {
    const previous = before.find(r => r.languageCode === defaultLanguage);
    const current = after.find(r => r.languageCode === defaultLanguage);
    if (!previous || !current) return { fields: [], languages: [] };
    const others = after.filter(r => r.languageCode !== defaultLanguage);
    const changed = fields
        .filter(field => text(previous[field]) !== text(current[field]))
        .map(field => ({ field, languages: others.filter(r => hasText(text(r[field]))).map(r => r.languageCode) }))
        .filter(change => change.languages.length > 0);
    return {
        fields: changed.map(change => change.field),
        languages: [...new Set(changed.flatMap(change => change.languages))],
    };
}

function text(value: unknown): string {
    return value == null ? '' : String(value);
}
