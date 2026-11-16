// "The original text changed" for CMS blocks. Pure: the page editor, the child tabs and
// the specs share it.

import { staleTranslations, TranslationRow } from '../../content-i18n/shared/stale-translations';
import { blockForMutation, editableBlockForLanguage } from './cms-language';

type Row = Record<string, any>;

const WATCHED_FIELDS = ['textContent', 'altText', 'description'];

export interface StaleBlock {
    blockId: string;
    label: string;
    /** Changed original fields: textContent, altText, description (image caption). */
    fields: string[];
    languages: string[];
}

/**
 * Compares the blocks as loaded (`before`, from the Admin API) with what was just saved
 * in the default language (`submitted`, mutation inputs).
 */
export function staleBlocks(before: Row[], submitted: Row[], defaultLang: string): StaleBlock[] {
    return submitted.flatMap(input => {
        const loaded = input.id != null ? before.find(b => String(b.id) === String(input.id)) : undefined;
        if (!loaded) return [];
        const beforeRows = rowsWithDescription(loaded, defaultLang);
        const savedRow = input.translations?.find((t: Row) => t.languageCode === defaultLang);
        if (!savedRow) return [];
        const afterRows = beforeRows.map(row =>
            row.languageCode === defaultLang
                ? { ...row, textContent: savedRow.textContent ?? '', altText: savedRow.altText ?? '', description: input.metadata?.description }
                : row,
        );
        const stale = staleTranslations(beforeRows, afterRows, defaultLang, WATCHED_FIELDS);
        if (stale.fields.length === 0) return [];
        const source = beforeRows.find(r => r.languageCode === defaultLang);
        return [{ blockId: String(loaded.id), label: String(source?.name || loaded.key), ...stale }];
    });
}

/**
 * `contentBlocks` for updateCmsPage that empties the stale fields in their languages.
 * Every block is sent (the mutation removes missing ones); untouched blocks carry no row.
 */
export function clearStaleInput(apiBlocks: Row[], stale: StaleBlock[], defaultLang: string): Row[] {
    const ordered = [...apiBlocks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return ordered.map((block, index) => {
        const base = blockForMutation(editableBlockForLanguage(block, defaultLang, defaultLang), index, defaultLang, defaultLang);
        const entry = stale.find(s => s.blockId === String(block.id));
        if (!entry) return { ...base, translations: [] };
        const rows = (block.translations ?? []).filter((t: Row) => entry.languages.includes(t.languageCode));
        return { ...base, translations: rows.map((row: Row) => clearedRow(row, entry.fields)) };
    });
}

function clearedRow(row: Row, fields: string[]): Row {
    const { description, ...restMeta } = (row.translatedMetadata ?? {}) as Row;
    const translatedMetadata = fields.includes('description')
        ? Object.keys(restMeta).length ? restMeta : null
        : row.translatedMetadata ?? null;
    return {
        id: row.id,
        languageCode: row.languageCode,
        name: row.name ?? '',
        textContent: fields.includes('textContent') ? '' : row.textContent ?? '',
        altText: fields.includes('altText') ? '' : row.altText ?? '',
        translatedMetadata,
    };
}

/** Translation rows with the image caption folded in: block metadata for the original, row metadata otherwise. */
function rowsWithDescription(block: Row, defaultLang: string): TranslationRow[] {
    const rows: Row[] = block.translations ?? [];
    const sourceLang = rows.some(r => r.languageCode === defaultLang) ? defaultLang : rows[0]?.languageCode;
    return rows.map(row => ({
        ...row,
        languageCode: row.languageCode === sourceLang ? defaultLang : row.languageCode,
        description: row.languageCode === sourceLang ? block.metadata?.description : row.translatedMetadata?.description,
    }));
}
