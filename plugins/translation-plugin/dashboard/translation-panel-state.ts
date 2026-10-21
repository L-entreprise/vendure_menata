import { useCallback, useState } from 'react';

import { changedKeys, Values } from './translation-rows';

/** Values per language code, then per field key. */
export type ValuesByLanguage = Readonly<Record<string, Values>>;

/** What every translation panel receives from the page around it. */
export interface PanelContext {
    sourceCode: string | null;
    targetCode: string;
    /** Every language that can be translated, so edits in one survive switching to another. */
    targetCodes: string[];
    onlyToTranslate: boolean;
    simple: boolean;
    /** Called after a save, so the tab counts refresh. */
    onSaved: () => void;
}

/**
 * Loaded and edited values of a panel. Edits are kept per language until saved, and a
 * save only sends the fields that changed.
 */
export function useEditableValues() {
    const [loaded, setLoaded] = useState<ValuesByLanguage>({});
    const [edited, setEdited] = useState<ValuesByLanguage>({});

    const reset = useCallback((values: ValuesByLanguage) => {
        setLoaded(values);
        setEdited({});
    }, []);

    const change = useCallback((languageCode: string, key: string, value: string) => {
        setEdited(prev => ({ ...prev, [languageCode]: { ...prev[languageCode], [key]: value } }));
    }, []);

    const valuesFor = (languageCode: string | null): Values =>
        languageCode ? { ...loaded[languageCode], ...edited[languageCode] } : {};

    const changesFor = (languageCode: string): string[] =>
        changedKeys(loaded[languageCode] ?? {}, edited[languageCode] ?? {});

    return { loaded, edited, reset, change, valuesFor, changesFor };
}

/** Groups API translation entries into values per language. */
export function toValuesByLanguage(
    groups: ReadonlyArray<{ languageCode: string; entries: ReadonlyArray<{ value: string }> }>,
    keyOf: (entry: any) => string,
): Record<string, Record<string, string>> {
    return groups.reduce<Record<string, Record<string, string>>>(
        (acc, group) => ({
            ...acc,
            [group.languageCode]: {
                ...acc[group.languageCode],
                ...Object.fromEntries(group.entries.map(entry => [keyOf(entry), entry.value])),
            },
        }),
        {},
    );
}
