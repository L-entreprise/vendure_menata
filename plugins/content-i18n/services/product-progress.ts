import { hasText } from '../shared/translation-progress';

/**
 * Translation progress of one product: which texts have an original (default language)
 * and which of those are filled in each target language. Pure, so the field resolver,
 * the summary and the specs count the same fields.
 *
 * Counted: product name and description, translatable custom fields, each variant name.
 * The slug is not counted (the dashboard derives it from the name).
 */

export interface ProductRow {
    languageCode: string;
    name?: string | null;
    description?: string | null;
    customFields?: object | null;
}

export interface ProductProgressInput {
    translations: ProductRow[];
    variants: Array<{ id: string | number; translations: ProductRow[] }>;
    /** Names of the Product custom fields of type localeString / localeText. */
    customFieldNames: string[];
}

export interface LanguageProgress {
    languageCode: string;
    total: number;
    translated: number;
    /** Labels of the untranslated fields: `name`, `description`, `customFields.<n>`, `variant:<id>:name`. */
    missing: string[];
}

interface CountedField {
    label: string;
    read: (row: ProductRow | undefined) => unknown;
    rows: ProductRow[];
}

export function productProgress(
    input: ProductProgressInput,
    defaultLang: string,
    targets: readonly string[],
): LanguageProgress[] {
    const fields: CountedField[] = [
        { label: 'name', read: r => r?.name, rows: input.translations },
        { label: 'description', read: r => r?.description, rows: input.translations },
        ...input.customFieldNames.map(name => ({
            label: `customFields.${name}`,
            read: (r: ProductRow | undefined) => (r?.customFields as Record<string, unknown> | null | undefined)?.[name],
            rows: input.translations,
        })),
        ...input.variants.map(variant => ({
            label: `variant:${variant.id}:name`,
            read: (r: ProductRow | undefined) => r?.name,
            rows: variant.translations,
        })),
    ];
    const withSource = fields.filter(field => hasText(text(field.read(source(field.rows, defaultLang)))));
    return targets.map(lang => {
        const missing = withSource
            .filter(field => !hasText(text(field.read(field.rows.find(r => r.languageCode === lang)))))
            .map(field => field.label);
        return { languageCode: lang, total: withSource.length, translated: withSource.length - missing.length, missing };
    });
}

/** True when a product misses at least one translation in `lang`. */
export function isIncomplete(progress: readonly LanguageProgress[], lang: string): boolean {
    const entry = progress.find(p => p.languageCode === lang);
    return !!entry && entry.translated < entry.total;
}

function source(rows: ProductRow[], defaultLang: string): ProductRow | undefined {
    return rows.find(r => r.languageCode === defaultLang) ?? rows[0];
}

function text(value: unknown): string {
    return value == null ? '' : String(value);
}
