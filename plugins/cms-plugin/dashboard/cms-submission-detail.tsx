import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    api,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    DashboardRouteDefinition,
    Page,
    PageActionBar,
    PageTitle,
    RichTextEditor,
    Switch,
} from '@vendure/dashboard';

const cmsPageForSubmissionDocument = graphql(`
    query GetCmsPageForSubmission($id: ID!) {
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

const formSubmissionForDetailDocument = graphql(`
    query GetFormSubmissionForDetail($pageId: ID!, $options: FormSubmissionListOptions) {
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

const getAssetForSubmissionDocument = graphql(`
    query GetAssetForSubmission($id: ID!) {
        asset(id: $id) {
            id
            preview
        }
    }
`);

function SubmissionDetailPage({ route }: { route: any }) {
    const params = route.useParams();
    const { pageId, submissionId } = params;
    const { t } = useLingui();

    const [schema, setSchema] = useState<any[]>([]);
    const [pageName, setPageName] = useState('');
    const [submission, setSubmission] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [assetPreviews, setAssetPreviews] = useState<Map<string, string>>(new Map());

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const pageResult = await api.query(cmsPageForSubmissionDocument, { id: pageId });
            const page = pageResult.cmsPage;
            if (!page) return;
            setPageName(page.name || page.key);
            const blocks = [...(page.contentBlocks || [])].sort((a: any, b: any) => a.position - b.position);
            setSchema(blocks);

            const subResult = await api.query(formSubmissionForDetailDocument, {
                pageId,
                options: { filter: { id: { eq: submissionId } }, take: 1 },
            });
            const sub = subResult.formSubmissions.items[0];
            if (sub) {
                setSubmission(sub);
                const data = sub.data as Record<string, any>;
                const imageBlocks = blocks.filter(b => b.type === 'IMAGE' && data[b.key]);
                for (const block of imageBlocks) {
                    const assetId = data[block.key];
                    if (assetId) {
                        api.query(getAssetForSubmissionDocument, { id: assetId }).then(r => {
                            if (r.asset?.preview) {
                                setAssetPreviews(prev => new Map(prev).set(assetId, r.asset!.preview));
                            }
                        }).catch(() => {});
                    }
                }
            }
        } finally {
            setLoading(false);
        }
    }, [pageId, submissionId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <Page>
                <PageTitle><Trans>Loading...</Trans></PageTitle>
            </Page>
        );
    }

    if (!submission) {
        return (
            <Page>
                <PageTitle><Trans>Submission not found</Trans></PageTitle>
                <PageActionBar>
                    <Button asChild variant="ghost" size="sm">
                        <Link to={`/cms-pages/${pageId}`}>
                            <ArrowLeftIcon className="mr-2 h-4 w-4" />
                            {pageName || t`Back`}
                        </Link>
                    </Button>
                </PageActionBar>
            </Page>
        );
    }

    const data = submission.data as Record<string, any>;
    const schemaFields = schema.filter(b => b.key);
    const schemaKeys = new Set(schemaFields.map(b => b.key));
    const extraKeys = Object.keys(data).filter(k => !schemaKeys.has(k));

    const renderFieldValue = (block: any) => {
        const value = data[block.key];
        const fieldLabel = block.translations?.[0]?.name || block.key;

        if (value == null || value === '') {
            return (
                <div key={block.key} className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">{fieldLabel}</label>
                    <p className="text-sm">-</p>
                </div>
            );
        }

        switch (block.type) {
            case 'BOOLEAN':
                return (
                    <div key={block.key} className="flex items-center gap-3">
                        <Switch checked={!!value} disabled />
                        <label className="text-sm font-medium text-muted-foreground">{fieldLabel}</label>
                    </div>
                );
            case 'RICH_TEXT':
                return (
                    <div key={block.key} className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">{fieldLabel}</label>
                        <div className="prose prose-sm max-w-none rounded border p-3 bg-muted/30" dangerouslySetInnerHTML={{ __html: String(value) }} />
                    </div>
                );
            case 'DATE':
                return (
                    <div key={block.key} className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">{fieldLabel}</label>
                        <p className="text-sm">{new Date(value).toLocaleString()}</p>
                    </div>
                );
            case 'IMAGE': {
                const preview = assetPreviews.get(value);
                return (
                    <div key={block.key} className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">{fieldLabel}</label>
                        {preview ? (
                            <img src={`${preview}?preset=medium`} alt={fieldLabel} className="h-32 rounded border object-cover" />
                        ) : (
                            <Badge variant="secondary">{t`Image`} (ID: {value})</Badge>
                        )}
                    </div>
                );
            }
            case 'IMAGE_GALLERY':
                return (
                    <div key={block.key} className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">{fieldLabel}</label>
                        <p className="text-sm">{Array.isArray(value) ? `${value.length} ${t`images`}` : String(value)}</p>
                    </div>
                );
            default:
                return (
                    <div key={block.key} className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">{fieldLabel}</label>
                        <p className="text-sm break-all">{String(value)}</p>
                    </div>
                );
        }
    };

    return (
        <Page>
            <PageTitle>{t`Submission`}</PageTitle>
            <PageActionBar>
                <Button asChild variant="ghost" size="sm">
                    <Link to={`/cms-pages/${pageId}`}>
                        <ArrowLeftIcon className="mr-2 h-4 w-4" />
                        {pageName}
                    </Link>
                </Button>
            </PageActionBar>

            <div className="w-full mt-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="text-lg font-semibold">
                                <Trans>Submission Details</Trans>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {new Date(submission.createdAt).toLocaleString()}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-6">
                            {schemaFields.map(renderFieldValue)}
                            {extraKeys.length > 0 && (
                                <>
                                    <div className="border-t pt-4">
                                        <p className="text-sm font-medium text-muted-foreground mb-3">
                                            <Trans>Additional Fields</Trans>
                                        </p>
                                        <div className="grid gap-4">
                                            {extraKeys.map(key => (
                                                <div key={key} className="space-y-1">
                                                    <label className="text-sm font-medium text-muted-foreground">{key}</label>
                                                    <p className="text-sm break-all">{data[key] != null ? String(data[key]) : '-'}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </Page>
    );
}

export const cmsSubmissionDetail: DashboardRouteDefinition = {
    path: '/cms-pages/$pageId/submissions/$submissionId',
    loader: () => ({
        breadcrumb: [
            { path: '/cms-pages', label: 'Pages' },
            'Submission',
        ],
    }),
    component: route => <SubmissionDetailPage route={route} />,
};
