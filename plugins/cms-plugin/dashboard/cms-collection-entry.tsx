import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import {
    ArrowLeftIcon,
    XIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    api,
    AssetPickerDialog,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    DashboardRouteDefinition,
    Input,
    Page,
    PageActionBar,
    PageActionBarRight,
    PageTitle,
    RichTextEditor,
    Switch,
    Textarea,
} from '@vendure/dashboard';
import { toast } from 'sonner';

const cmsPageForEntryDocument = graphql(`
    query GetCmsPageForEntry($id: ID!) {
        cmsPage(id: $id) {
            id
            name
            key
            contentBlocks {
                id
                key
                type
                enabled
                position
                metadata
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

const formSubmissionDocument = graphql(`
    query GetFormSubmission($pageId: ID!, $options: FormSubmissionListOptions) {
        formSubmissions(pageId: $pageId, options: $options) {
            items {
                id
                createdAt
                data
            }
            totalItems
        }
    }
`);

const getAssetDocument = graphql(`
    query GetAssetPreview($id: ID!) {
        asset(id: $id) {
            id
            preview
        }
    }
`);

const createCollectionEntryDocument = graphql(`
    mutation CreateCollectionEntryFromPage($input: CreateCollectionEntryInput!) {
        createCollectionEntry(input: $input) {
            id
        }
    }
`);

const updateCollectionEntryDocument = graphql(`
    mutation UpdateCollectionEntryFromPage($input: UpdateCollectionEntryInput!) {
        updateCollectionEntry(input: $input) {
            id
        }
    }
`);

function CollectionEntryPage({ route }: { route: any }) {
    const params = route.useParams();
    const { pageId, entryId } = params;
    const isNew = entryId === 'new';
    const navigate = useNavigate();
    const { t } = useLingui();

    const [schema, setSchema] = useState<any[]>([]);
    const [pageName, setPageName] = useState('');
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [pickerOpen, setPickerOpen] = useState<string | null>(null);
    const [assetPreviews, setAssetPreviews] = useState<Map<string, string>>(new Map());

    const loadAssetPreview = useCallback(async (assetId: string) => {
        if (!assetId || assetPreviews.has(assetId)) return;
        try {
            const result = await api.query(getAssetDocument, { id: assetId });
            if (result.asset?.preview) {
                setAssetPreviews(prev => new Map(prev).set(assetId, result.asset!.preview));
            }
        } catch {
            // ignore
        }
    }, [assetPreviews]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const pageResult = await api.query(cmsPageForEntryDocument, { id: pageId });
            const page = pageResult.cmsPage;
            if (!page) return;
            setPageName(page.name || page.key);
            const blocks = [...(page.contentBlocks || [])].sort((a: any, b: any) => a.position - b.position);
            setSchema(blocks);

            if (isNew) {
                const defaults: Record<string, any> = {};
                for (const block of blocks) {
                    if (block.key) {
                        defaults[block.key] = block.type === 'BOOLEAN' ? false : '';
                    }
                }
                setFormData(defaults);
            } else {
                const entryResult = await api.query(formSubmissionDocument, {
                    pageId,
                    options: { filter: { id: { eq: entryId } }, take: 1 },
                });
                const entry = entryResult.formSubmissions.items[0];
                if (entry) {
                    const data = { ...(entry.data as Record<string, any>) };
                    setFormData(data);
                    // Resolve asset previews for IMAGE fields
                    const imageBlocks = blocks.filter(b => b.type === 'IMAGE' && data[b.key]);
                    for (const block of imageBlocks) {
                        const assetId = data[block.key];
                        if (assetId) {
                            api.query(getAssetDocument, { id: assetId }).then(r => {
                                if (r.asset?.preview) {
                                    setAssetPreviews(prev => new Map(prev).set(assetId, r.asset!.preview));
                                }
                            }).catch(() => {});
                        }
                    }
                }
            }
        } finally {
            setLoading(false);
        }
    }, [pageId, entryId, isNew]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async () => {
        try {
            if (isNew) {
                await api.mutate(createCollectionEntryDocument, {
                    input: { pageId, data: formData },
                });
                toast.success(t`Entry created`);
            } else {
                await api.mutate(updateCollectionEntryDocument, {
                    input: { id: entryId, data: formData },
                });
                toast.success(t`Entry updated`);
            }
            await navigate({ to: `/cms-pages/${pageId}` });
        } catch (e: any) {
            toast.error(t`Failed to save entry`, {
                description: e?.message || t`Unknown error`,
            });
        }
    };

    const schemaFields = schema.filter(b => b.key);

    const renderField = (block: any) => {
        if (!block.key) return null;
        const fieldLabel = block.translations?.[0]?.name || block.key;
        const value = formData[block.key] ?? '';

        switch (block.type) {
            case 'TEXT_SHORT':
                return (
                    <div key={block.key}>
                        <label className="text-sm font-medium">{fieldLabel}</label>
                        <Input
                            value={String(value)}
                            onChange={e => setFormData(prev => ({ ...prev, [block.key]: e.target.value }))}
                            className="mt-1"
                        />
                    </div>
                );
            case 'TEXT_LONG':
                return (
                    <div key={block.key}>
                        <label className="text-sm font-medium">{fieldLabel}</label>
                        <Textarea
                            value={String(value)}
                            onChange={e => setFormData(prev => ({ ...prev, [block.key]: e.target.value }))}
                            rows={4}
                            className="mt-1"
                        />
                    </div>
                );
            case 'RICH_TEXT':
                return (
                    <div key={block.key}>
                        <label className="text-sm font-medium">{fieldLabel}</label>
                        <div className="mt-1">
                            <RichTextEditor
                                value={String(value)}
                                onChange={(val: string) => setFormData(prev => ({ ...prev, [block.key]: val }))}
                            />
                        </div>
                    </div>
                );
            case 'BOOLEAN':
                return (
                    <div key={block.key} className="flex items-center gap-3">
                        <Switch
                            checked={!!value}
                            onCheckedChange={checked => setFormData(prev => ({ ...prev, [block.key]: checked }))}
                        />
                        <label className="text-sm font-medium">{fieldLabel}</label>
                    </div>
                );
            case 'NUMBER':
                return (
                    <div key={block.key}>
                        <label className="text-sm font-medium">{fieldLabel}</label>
                        <Input
                            type="number"
                            value={value ?? ''}
                            onChange={e => setFormData(prev => ({ ...prev, [block.key]: e.target.value ? Number(e.target.value) : null }))}
                            className="mt-1"
                        />
                    </div>
                );
            case 'DATE':
                return (
                    <div key={block.key}>
                        <label className="text-sm font-medium">{fieldLabel}</label>
                        <Input
                            type="datetime-local"
                            value={value ? new Date(value).toISOString().slice(0, 16) : ''}
                            onChange={e => setFormData(prev => ({ ...prev, [block.key]: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                            className="mt-1"
                        />
                    </div>
                );
            case 'ENUM': {
                const options = (block.translations?.[0]?.textContent ?? '').split('\n').filter((l: string) => l.trim());
                return (
                    <div key={block.key}>
                        <label className="text-sm font-medium">{fieldLabel}</label>
                        <select
                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={String(value)}
                            onChange={e => setFormData(prev => ({ ...prev, [block.key]: e.target.value }))}
                        >
                            <option value="">{t`Select...`}</option>
                            {options.map((opt: string, i: number) => (
                                <option key={i} value={opt.trim()}>{opt.trim()}</option>
                            ))}
                        </select>
                    </div>
                );
            }
            case 'IMAGE': {
                const assetId = formData[block.key];
                const preview = assetId ? assetPreviews.get(assetId) : undefined;
                return (
                    <div key={block.key}>
                        <label className="text-sm font-medium">{fieldLabel}</label>
                        <div className="flex items-center gap-3 mt-1">
                            {assetId && preview ? (
                                <img src={`${preview}?preset=thumb`} alt={fieldLabel} className="h-16 w-16 rounded object-cover border" />
                            ) : assetId ? (
                                <Badge variant="secondary">{t`Image selected`}</Badge>
                            ) : null}
                            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(block.key)}>
                                {assetId ? t`Change Image` : t`Select Image`}
                            </Button>
                            {assetId && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => setFormData(prev => ({ ...prev, [block.key]: null }))}>
                                    <XIcon className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        {pickerOpen === block.key && (
                            <AssetPickerDialog
                                open={true}
                                onClose={() => setPickerOpen(null)}
                                multiSelect={false}
                                onSelect={assets => {
                                    if (assets.length > 0) {
                                        const asset = assets[0];
                                        setFormData(prev => ({ ...prev, [block.key]: asset.id }));
                                        if (asset.preview) {
                                            setAssetPreviews(prev => new Map(prev).set(asset.id, asset.preview));
                                        }
                                    }
                                }}
                            />
                        )}
                    </div>
                );
            }
            default:
                return (
                    <div key={block.key}>
                        <label className="text-sm font-medium">{fieldLabel}</label>
                        <Input
                            value={String(value)}
                            onChange={e => setFormData(prev => ({ ...prev, [block.key]: e.target.value }))}
                            className="mt-1"
                        />
                    </div>
                );
        }
    };

    if (loading) {
        return (
            <Page>
                <PageTitle><Trans>Loading...</Trans></PageTitle>
            </Page>
        );
    }

    return (
        <Page>
            <PageTitle>{isNew ? t`New Entry` : t`Edit Entry`}</PageTitle>
            <PageActionBar>
                <Button asChild variant="ghost" size="sm">
                    <Link to={`/cms-pages/${pageId}`}>
                        <ArrowLeftIcon className="mr-2 h-4 w-4" />
                        {pageName}
                    </Link>
                </Button>
                <PageActionBarRight>
                    <Button variant="outline" onClick={() => navigate({ to: `/cms-pages/${pageId}` })}>
                        <Trans>Cancel</Trans>
                    </Button>
                    <Button onClick={handleSave}>
                        {isNew ? <Trans>Create</Trans> : <Trans>Save</Trans>}
                    </Button>
                </PageActionBarRight>
            </PageActionBar>

            <div className="w-full mt-4">
                <Card>
                    <CardHeader>
                        <div className="text-lg font-semibold">
                            {isNew ? <Trans>New Entry</Trans> : <Trans>Edit Entry</Trans>}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-6">
                            {schemaFields.map(renderField)}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </Page>
    );
}

export const cmsCollectionEntry: DashboardRouteDefinition = {
    path: '/cms-pages/$pageId/entries/$entryId',
    loader: () => ({
        breadcrumb: [
            { path: '/cms-pages', label: 'Pages' },
            'Entry',
        ],
    }),
    component: route => <CollectionEntryPage route={route} />,
};
