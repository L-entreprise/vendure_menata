import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@vendure/dashboard';
import { toast } from 'sonner';

import { ColumnHeadings, EditorLanguage, SectionedRows } from './translation-field-row';
import { PanelContext, toValuesByLanguage, useEditableValues } from './translation-panel-state';
import { PanelEmpty, PanelShell, PanelStatus } from './translation-panel-shell';
import { BlockInfo, buildPageRows, pageRowKey, rowsProgress, visibleRows } from './translation-rows';

const pageBlocksDocument = graphql(`
    query GetCmsPageBlocksForTranslation($id: ID!) {
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

const translatableFieldsDocument = graphql(`
    query GetTranslatableFields($pageId: ID!) {
        cmsPageTranslatableFields(pageId: $pageId) {
            contentBlockId
            fieldName
            blockKey
            blockType
        }
    }
`);

const pageTranslationsDocument = graphql(`
    query GetPageTranslations($pageId: ID!, $languageCode: String) {
        cmsPageTranslations(pageId: $pageId, languageCode: $languageCode) {
            pageId
            languageCode
            entries {
                id
                languageCode
                contentBlockId
                fieldName
                value
            }
        }
    }
`);

const updateTranslationsDocument = graphql(`
    mutation UpdateCmsPageTranslations($input: UpdateCmsPageTranslationsInput!) {
        updateCmsPageTranslations(input: $input) {
            id
        }
    }
`);

interface PageField {
    contentBlockId: string | null;
    fieldName: string;
    blockType: string | null;
}

/** The fields of one plain page, original on the left and translation on the right. */
export function PageTranslationPanel({
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
    const [fields, setFields] = useState<PageField[]>([]);
    const [blocks, setBlocks] = useState<ReadonlyMap<string, BlockInfo>>(new Map());
    const values = useEditableValues();
    const { reset } = values;

    const load = useCallback(async () => {
        try {
            const [blocksResult, fieldsResult, translationsResult] = await Promise.all([
                api.query(pageBlocksDocument, { id: pageId }),
                api.query(translatableFieldsDocument, { pageId }),
                api.query(pageTranslationsDocument, { pageId }),
            ]);
            setBlocks(
                new Map(
                    (blocksResult.cmsPage?.contentBlocks ?? []).map((block: any) => [
                        String(block.id),
                        {
                            id: String(block.id),
                            key: block.key,
                            type: block.type,
                            name: block.translations?.[0]?.name ?? '',
                            metadata: block.metadata ?? null,
                        },
                    ]),
                ),
            );
            setFields(
                (fieldsResult.cmsPageTranslatableFields ?? []).map((f: any) => ({
                    contentBlockId: f.contentBlockId != null ? String(f.contentBlockId) : null,
                    fieldName: f.fieldName,
                    blockType: f.blockType ?? null,
                })),
            );
            reset(
                toValuesByLanguage(translationsResult.cmsPageTranslations ?? [], (entry: any) =>
                    pageRowKey(entry.contentBlockId != null ? String(entry.contentBlockId) : null, entry.fieldName),
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

    const rows = useMemo(() => buildPageRows(fields, blocks, { simple: context.simple }), [fields, blocks, context.simple]);
    const source = values.valuesFor(context.sourceCode);
    const target = values.valuesFor(context.targetCode);
    // Filter on saved values: a field being typed in stays on screen until the save.
    const shown = visibleRows(rows, source, values.loaded[context.targetCode] ?? {}, context.onlyToTranslate);
    const dirtyCodes = context.targetCodes.filter(code => values.changesFor(code).length > 0);

    const save = async () => {
        setSaving(true);
        try {
            await Promise.all(
                dirtyCodes.map(languageCode => {
                    const edited = values.valuesFor(languageCode);
                    const entries = values.changesFor(languageCode).map(key => {
                        const separator = key.indexOf('|');
                        const blockId = key.slice(0, separator);
                        return {
                            contentBlockId: blockId === 'page' ? null : blockId,
                            fieldName: key.slice(separator + 1),
                            value: edited[key] ?? '',
                        };
                    });
                    return api.mutate(updateTranslationsDocument, { input: { pageId, languageCode, entries } });
                }),
            );
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

    return (
        <PanelShell
            status={status}
            onRetry={load}
            progress={rowsProgress(rows, source, target)}
            targetName={languages.target.name}
            dirty={dirtyCodes.length > 0}
            saving={saving}
            onSave={save}
        >
            {rows.length === 0 ? (
                <PanelEmpty><Trans>This page has no text to translate.</Trans></PanelEmpty>
            ) : shown.length === 0 ? (
                <PanelEmpty><Trans>Nothing left to translate on this tab.</Trans></PanelEmpty>
            ) : (
                <>
                    <ColumnHeadings source={languages.source} target={languages.target} />
                    <SectionedRows
                        rows={shown}
                        forceOpen={context.onlyToTranslate}
                        editing={{
                            source,
                            target,
                            onChange: (key, value) => values.change(context.targetCode, key, value),
                            showKeys: !context.simple,
                        }}
                    />
                </>
            )}
        </PanelShell>
    );
}
