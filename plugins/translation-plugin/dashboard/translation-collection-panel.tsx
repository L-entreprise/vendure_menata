import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@vendure/dashboard';
import { toast } from 'sonner';

import { CollapsibleSection } from '../../cms-plugin/dashboard/cms-collapsible-section';
import { hasText, sumProgress } from '../translation-progress';

import { ColumnHeadings, EditorLanguage, FieldRows } from './translation-field-row';
import { PanelContext, toValuesByLanguage, useEditableValues } from './translation-panel-state';
import { PanelEmpty, PanelShell, PanelStatus } from './translation-panel-shell';
import { BlockInfo, buildEntryRows, rowsProgress, TranslationRow, visibleRows } from './translation-rows';

const collectionSchemaDocument = graphql(`
    query GetCollectionSchemaForTranslation($id: ID!) {
        cmsPage(id: $id) {
            id
            contentBlocks {
                id
                key
                type
                metadata
                translations {
                    languageCode
                    name
                }
            }
        }
    }
`);

const entryFieldsDocument = graphql(`
    query GetCollectionEntryTranslatableFields($pageId: ID!) {
        collectionEntryTranslatableFields(pageId: $pageId) {
            fieldName
            blockType
        }
    }
`);

const entriesDocument = graphql(`
    query GetFormSubmissionsForTranslation($pageId: ID!, $options: FormSubmissionListOptions) {
        formSubmissions(pageId: $pageId, options: $options) {
            items {
                id
                data
            }
        }
    }
`);

const entriesTranslationsDocument = graphql(`
    query GetCollectionEntriesTranslations($pageId: ID!) {
        collectionEntriesTranslations(pageId: $pageId) {
            entryId
            languageCode
            entries {
                fieldName
                value
            }
        }
    }
`);

const updateEntryTranslationsDocument = graphql(`
    mutation UpdateCollectionEntryTranslations($input: UpdateCollectionEntryTranslationsInput!) {
        updateCollectionEntryTranslations(input: $input) {
            id
        }
    }
`);

/** Matches the server's admin list limit; a list longer than this is not a page section. */
const MAX_ENTRIES = 1000;

interface Entry {
    id: string;
    rows: TranslationRow[];
}

/** Every entry of a list in one view, each with its fields side by side. */
export function CollectionTranslationPanel({
    pageId,
    context,
    languages,
}: {
    pageId: string;
    context: PanelContext;
    languages: { source: EditorLanguage | null; target: EditorLanguage };
}) {
    const { t } = useLingui();
    const [status, setStatus] = useState<PanelStatus>('loading');
    const [saving, setSaving] = useState(false);
    const [entries, setEntries] = useState<Entry[]>([]);
    const values = useEditableValues();
    const { reset } = values;

    const load = useCallback(async () => {
        try {
            const [schemaResult, fieldsResult, entriesResult, translationsResult] = await Promise.all([
                api.query(collectionSchemaDocument, { id: pageId }),
                api.query(entryFieldsDocument, { pageId }),
                api.query(entriesDocument, {
                    pageId,
                    options: { take: MAX_ENTRIES, sort: { createdAt: 'ASC' as any } },
                }),
                api.query(entriesTranslationsDocument, { pageId }),
            ]);
            const blocksByKey = new Map<string, BlockInfo>(
                (schemaResult.cmsPage?.contentBlocks ?? []).map((block: any) => [
                    block.key,
                    {
                        id: String(block.id),
                        key: block.key,
                        type: block.type,
                        name: block.translations?.[0]?.name ?? '',
                        metadata: block.metadata ?? null,
                    },
                ]),
            );
            const fields = fieldsResult.collectionEntryTranslatableFields ?? [];
            setEntries(
                (entriesResult.formSubmissions?.items ?? []).map((item: any) => {
                    const entryId = String(item.id);
                    const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data ?? {};
                    // Keys carry the entry id so all entries share one value map.
                    const rows = buildEntryRows(fields, blocksByKey, data).map(row => ({
                        ...row,
                        key: `${entryId}|${row.key}`,
                    }));
                    return { id: entryId, rows };
                }),
            );
            reset(
                toValuesByLanguage(
                    (translationsResult.collectionEntriesTranslations ?? []).map((group: any) => ({
                        languageCode: group.languageCode,
                        entries: group.entries.map((entry: any) => ({ ...entry, entryId: String(group.entryId) })),
                    })),
                    (entry: any) => `${entry.entryId}|${entry.fieldName}`,
                ),
            );
            setStatus('ready');
        } catch {
            setStatus('failed');
        }
    }, [pageId, reset]);

    useEffect(() => {
        load();
    }, [load]);

    const source = values.valuesFor(context.sourceCode);
    const target = values.valuesFor(context.targetCode);
    const savedTarget = values.loaded[context.targetCode] ?? {};
    const shownEntries = entries
        .map((entry, index) => ({
            ...entry,
            number: index + 1,
            shown: visibleRows(entry.rows, source, savedTarget, context.onlyToTranslate),
        }))
        .filter(entry => entry.shown.length > 0);
    const dirtyCodes = context.targetCodes.filter(code => values.changesFor(code).length > 0);

    const save = async () => {
        setSaving(true);
        try {
            const requests = dirtyCodes.flatMap(languageCode => {
                const edited = values.valuesFor(languageCode);
                const byEntry = values.changesFor(languageCode).reduce<Record<string, Array<{ fieldName: string; value: string }>>>(
                    (acc, key) => {
                        const separator = key.indexOf('|');
                        const entryId = key.slice(0, separator);
                        const change = { fieldName: key.slice(separator + 1), value: edited[key] ?? '' };
                        return { ...acc, [entryId]: [...(acc[entryId] ?? []), change] };
                    },
                    {},
                );
                return Object.entries(byEntry).map(([entryId, changes]) =>
                    api.mutate(updateEntryTranslationsDocument, {
                        input: { pageId, entryId, languageCode, entries: changes },
                    }),
                );
            });
            await Promise.all(requests);
            toast.success(t`Translations saved`);
            await load();
            context.onSaved();
        } catch (error) {
            toast.error(t`Failed to save translations`, {
                description: error instanceof Error ? error.message : t`Unknown error`,
            });
        } finally {
            setSaving(false);
        }
    };

    const editing = {
        source,
        target,
        onChange: (key: string, value: string) => values.change(context.targetCode, key, value),
        showKeys: !context.simple,
    };

    return (
        <PanelShell
            status={status}
            onRetry={load}
            progress={sumProgress(entries.map(entry => rowsProgress(entry.rows, source, target)))}
            targetName={languages.target.name}
            dirty={dirtyCodes.length > 0}
            saving={saving}
            onSave={save}
        >
            {entries.length === 0 ? (
                <PanelEmpty><Trans>This list has no entries yet.</Trans></PanelEmpty>
            ) : shownEntries.length === 0 ? (
                <PanelEmpty><Trans>Nothing left to translate on this tab.</Trans></PanelEmpty>
            ) : (
                <>
                    <ColumnHeadings source={languages.source} target={languages.target} />
                    <div className="space-y-4">
                        {shownEntries.map(entry => (
                            <CollapsibleSection
                                key={entry.id}
                                title={entryTitle(entry, source) ?? t`Entry ${entry.number}`}
                            >
                                <FieldRows rows={entry.shown} editing={editing} />
                            </CollapsibleSection>
                        ))}
                    </div>
                </>
            )}
        </PanelShell>
    );
}

/** An entry is named by its first text in the original language (a question, a name). */
function entryTitle(entry: Entry, source: Record<string, string | undefined>): string | null {
    const first = entry.rows.find(row => row.part === 'value' && row.countable && hasText(source[row.key]));
    if (!first) return null;
    const text = (source[first.key] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}
