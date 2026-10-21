import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { api, Button, Card, CardContent, CardHeader } from '@vendure/dashboard';
import { toast } from 'sonner';

import { BlockValueEditor } from './cms-block-editors';
import { prepareBlocksForMutation, toEditableBlock } from './cms-block-utils';
import { CollectionEntriesPanel } from './cms-collection-entries-panel';

const childPageDocument = graphql(`
    query GetCmsChildPage($id: ID!) {
        cmsPage(id: $id) {
            id
            key
            name
            isCollection
            acceptsSubmissions
            contentBlocks {
                id
                key
                type
                enabled
                position
                metadata
                dateValue
                numberValue
                featuredAsset {
                    id
                    preview
                }
                translations {
                    id
                    languageCode
                    name
                    textContent
                    altText
                }
            }
        }
    }
`);

const updateChildPageDocument = graphql(`
    mutation UpdateCmsChildPage($input: UpdateCmsPageInput!) {
        updateCmsPage(input: $input) {
            id
        }
    }
`);

/**
 * One tab of a parent page: a child page shown in place. A list (collection) shows
 * its entries; a plain page shows its fields with its own save button. Structure
 * stays on the child's own page, linked from here.
 */
export function ChildPageTab({ pageId, isSuperAdmin }: { pageId: string; isSuperAdmin: boolean }) {
    const { t } = useLingui();
    const [page, setPage] = useState<any>(null);
    const [blocks, setBlocks] = useState<any[]>([]);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const load = useCallback(async () => {
        try {
            const result = await api.query(childPageDocument, { id: pageId });
            setPage(result.cmsPage);
            setBlocks((result.cmsPage?.contentBlocks ?? []).map(toEditableBlock));
            setDirty(false);
            setLoadFailed(false);
        } catch {
            setLoadFailed(true);
        }
    }, [pageId]);

    useEffect(() => {
        load();
    }, [load]);

    const updateBlock = (index: number, change: (block: any) => any) => {
        setBlocks(prev => prev.map((block, i) => (i === index ? change(block) : block)));
        setDirty(true);
    };
    const onFieldChange = (index: number, field: string, value: any) =>
        updateBlock(index, block => ({ ...block, [field]: value }));
    const onFieldsChange = (index: number, fields: Record<string, any>) =>
        updateBlock(index, block => ({ ...block, ...fields }));
    const onMetadataChange = (index: number, key: string, value: any) =>
        updateBlock(index, block => ({ ...block, metadata: { ...(block.metadata || {}), [key]: value } }));
    const onTranslationChange = (index: number, field: string, value: string) =>
        updateBlock(index, block => {
            const [first, ...rest] = block.translations?.length
                ? block.translations
                : [{ languageCode: 'en', name: '', textContent: '', altText: '' }];
            return { ...block, translations: [{ ...first, [field]: value }, ...rest] };
        });

    const save = async () => {
        setSaving(true);
        try {
            await api.mutate(updateChildPageDocument, {
                input: { id: pageId, contentBlocks: prepareBlocksForMutation(blocks) },
            });
            toast.success(t`Page updated`);
            await load();
        } catch (error) {
            toast.error(t`Failed to save page`, {
                description: error instanceof Error ? error.message : t`Unknown error`,
            });
        } finally {
            setSaving(false);
        }
    };

    if (loadFailed) {
        return (
            <div className="py-12 text-center text-muted-foreground">
                <Trans>This tab could not be loaded.</Trans>{' '}
                <Button type="button" variant="link" onClick={load}>
                    <Trans>Try again</Trans>
                </Button>
            </div>
        );
    }
    if (!page) {
        return <div className="py-12 text-center text-muted-foreground"><Trans>Loading...</Trans></div>;
    }

    const structureLink = isSuperAdmin && (
        <div className="flex justify-end mt-4">
            <Button variant="ghost" size="sm" render={<Link to={`/cms-pages/${pageId}`} />}>
                <Trans>Edit fields</Trans>
            </Button>
        </div>
    );

    if (page.isCollection) {
        return (
            <>
                {structureLink}
                <CollectionEntriesPanel pageId={pageId} schema={page.contentBlocks} title={page.name || page.key} />
            </>
        );
    }

    if (page.acceptsSubmissions) {
        return (
            <div className="py-12 text-center">
                <Button variant="outline" render={<Link to={`/cms-pages/${pageId}`} />}>
                    <Trans>Open the form and its submissions</Trans>
                </Button>
            </div>
        );
    }

    return (
        <>
            {structureLink}
            <div className="w-full mt-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-lg font-semibold">{page.name || page.key}</span>
                            <Button type="button" disabled={!dirty || saving} onClick={save}>
                                <Trans>Save</Trans>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {blocks.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                                <Trans>No sections yet.</Trans>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {blocks.map((block, index) => (
                                    <section key={block.id ?? index}>
                                        <h3 className="text-base font-semibold mb-2">
                                            {block.translations?.[0]?.name || block.key}
                                        </h3>
                                        <BlockValueEditor
                                            block={block}
                                            index={index}
                                            isSuperAdmin={isSuperAdmin}
                                            onFieldChange={onFieldChange}
                                            onFieldsChange={onFieldsChange}
                                            onMetadataChange={onMetadataChange}
                                            onTranslationChange={onTranslationChange}
                                        />
                                    </section>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
