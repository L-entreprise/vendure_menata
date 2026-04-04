import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { ChevronDownIcon, ChevronRightIcon, XIcon } from 'lucide-react';
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
    Textarea,
    detailPageRouteLoader,
} from '@vendure/dashboard';
import { toast } from 'sonner';

// ── Shared GraphQL documents ──

const getTranslationLanguagesDocument = graphql(`
    query GetTranslationLanguagesForDetail {
        translationLanguages {
            id
            code
            name
            enabled
            isDefault
        }
    }
`);

const getCmsPageForTranslationDocument = graphql(`
    query GetCmsPageForTranslation($id: ID!) {
        cmsPage(id: $id) {
            id
            key
            name
            isCollection
            contentBlocks {
                id
                key
                type
                position
            }
        }
    }
`);

// ── Regular page documents ──

const getDefaultContentDocument = graphql(`
    query GetCmsPageDefaultContent($pageId: ID!) {
        cmsPageDefaultContent(pageId: $pageId) {
            languageCode
            pageId
            contentBlockId
            fieldName
            value
        }
    }
`);

const getTranslatableFieldsDocument = graphql(`
    query GetTranslatableFields($pageId: ID!) {
        cmsPageTranslatableFields(pageId: $pageId) {
            contentBlockId
            fieldName
            blockKey
            blockType
        }
    }
`);

const getPageTranslationsDocument = graphql(`
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
            languageCode
            fieldName
            value
        }
    }
`);

// ── Collection entry documents ──

const getFormSubmissionsDocument = graphql(`
    query GetFormSubmissionsForTranslation($pageId: ID!, $options: FormSubmissionListOptions) {
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

const getCollectionEntryFieldsDocument = graphql(`
    query GetCollectionEntryTranslatableFields($pageId: ID!) {
        collectionEntryTranslatableFields(pageId: $pageId) {
            fieldName
            blockType
        }
    }
`);

const getCollectionEntryTranslationsDocument = graphql(`
    query GetCollectionEntryTranslations($pageId: ID!, $entryId: ID!, $languageCode: String) {
        collectionEntryTranslations(pageId: $pageId, entryId: $entryId, languageCode: $languageCode) {
            pageId
            languageCode
            entries {
                id
                languageCode
                fieldName
                value
            }
        }
    }
`);

const getCollectionEntryDefaultContentDocument = graphql(`
    query GetCollectionEntryDefaultContent($pageId: ID!, $entryId: ID!) {
        collectionEntryDefaultContent(pageId: $pageId, entryId: $entryId) {
            languageCode
            pageId
            fieldName
            value
        }
    }
`);

const updateCollectionEntryTranslationsDocument = graphql(`
    mutation UpdateCollectionEntryTranslations($input: UpdateCollectionEntryTranslationsInput!) {
        updateCollectionEntryTranslations(input: $input) {
            id
            languageCode
            fieldName
            value
        }
    }
`);

const getAssetDocument = graphql(`
    query GetAssetPreviewForTranslation($id: ID!) {
        asset(id: $id) {
            id
            preview
        }
    }
`);

// ── Shared types & components ──

interface FieldValue {
    contentBlockId: string | null;
    fieldName: string;
    blockKey: string | null;
    blockType: string | null;
}

interface Language {
    id: string;
    code: string;
    name: string;
    enabled: boolean;
    isDefault: boolean;
}

function FieldInput({
    blockType,
    fieldName,
    value,
    onChange,
}: {
    blockType: string | null;
    fieldName: string;
    value: string;
    onChange: (value: string) => void;
}) {
    if (blockType === 'RICH_TEXT') {
        return <RichTextEditor value={value} onChange={onChange} />;
    }
    if (blockType === 'TEXT_LONG') {
        return (
            <Textarea
                rows={4}
                value={value}
                onChange={e => onChange(e.target.value)}
            />
        );
    }
    if (blockType === 'IMAGE') {
        return <ImageFieldInput value={value} onChange={onChange} />;
    }
    return (
        <Input
            value={value}
            onChange={e => onChange(e.target.value)}
        />
    );
}

function ImageFieldInput({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    const { t } = useLingui();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!value) {
            setPreview(null);
            return;
        }
        api.query(getAssetDocument, { id: value }).then(r => {
            if (r.asset?.preview) setPreview(r.asset.preview);
        }).catch(() => {});
    }, [value]);

    return (
        <div className="flex items-center gap-3">
            {value && preview ? (
                <img
                    src={`${preview}?preset=thumb`}
                    alt=""
                    className="h-16 w-16 rounded object-cover border"
                />
            ) : value ? (
                <Badge variant="secondary">{t`Image selected`}</Badge>
            ) : null}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
            >
                {value ? t`Change Image` : t`Select Image`}
            </Button>
            {value && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange('')}
                >
                    <XIcon className="h-4 w-4" />
                </Button>
            )}
            {pickerOpen && (
                <AssetPickerDialog
                    open={true}
                    onClose={() => setPickerOpen(false)}
                    multiSelect={false}
                    onSelect={assets => {
                        if (assets.length > 0) {
                            const asset = assets[0];
                            onChange(asset.id);
                            if (asset.preview) setPreview(asset.preview);
                        }
                        setPickerOpen(false);
                    }}
                />
            )}
        </div>
    );
}

function LanguageHeaders({ languages }: { languages: Language[] }) {
    return (
        <>
            {languages.map(lang => (
                <div key={lang.code}>
                    {lang.name} ({lang.code})
                    {lang.isDefault && (
                        <span className="ml-2 text-xs text-muted-foreground">(CMS)</span>
                    )}
                </div>
            ))}
        </>
    );
}

// ── Regular page translation ──

function RegularPageTranslation({
    pageId,
    pageName,
    languages,
}: {
    pageId: string;
    pageName: string;
    languages: Language[];
}) {
    const { t } = useLingui();
    const [fields, setFields] = useState<FieldValue[]>([]);
    const [saving, setSaving] = useState(false);
    const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});

    useEffect(() => {
        const load = async () => {
            const [fieldsResult, translationsResult, defaultContentResult] = await Promise.all([
                api.query(getTranslatableFieldsDocument, { pageId }),
                api.query(getPageTranslationsDocument, { pageId }),
                api.query(getDefaultContentDocument, { pageId }),
            ]);

            setFields(fieldsResult.cmsPageTranslatableFields ?? []);

            const defaultLang = languages.find(l => l.isDefault);
            const map: Record<string, Record<string, string>> = {};
            for (const lang of languages) {
                map[lang.code] = {};
            }
            if (defaultLang) {
                for (const entry of defaultContentResult.cmsPageDefaultContent ?? []) {
                    const key = `${entry.contentBlockId ?? 'page'}|${entry.fieldName}`;
                    map[defaultLang.code][key] = entry.value;
                }
            }
            for (const group of translationsResult.cmsPageTranslations ?? []) {
                if (!map[group.languageCode]) map[group.languageCode] = {};
                for (const entry of group.entries) {
                    const key = `${entry.contentBlockId ?? 'page'}|${entry.fieldName}`;
                    map[group.languageCode][key] = entry.value;
                }
            }
            setTranslations(map);
        };
        load();
    }, [pageId, languages]);

    const updateValue = useCallback(
        (langCode: string, fieldKey: string, value: string) => {
            setTranslations(prev => ({
                ...prev,
                [langCode]: { ...prev[langCode], [fieldKey]: value },
            }));
        },
        [],
    );

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const promises = Object.entries(translations).map(([langCode, fieldMap]) => {
                const entries = Object.entries(fieldMap).map(([key, value]) => {
                    const [blockIdOrPage, fieldName] = key.split('|');
                    return {
                        contentBlockId: blockIdOrPage === 'page' ? null : blockIdOrPage,
                        fieldName,
                        value,
                    };
                });
                return api.mutate(updateTranslationsDocument, {
                    input: { pageId, languageCode: langCode, entries },
                });
            });
            await Promise.all(promises);
            toast.success(t`Translations saved`);
        } catch (err: any) {
            toast.error(err.message ?? 'Failed to save translations');
        } finally {
            setSaving(false);
        }
    }, [translations, pageId, t]);

    return (
        <Page>
            <PageTitle>{pageName} — {t`Translations`}</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? '...' : <Trans>Save Translations</Trans>}
                    </Button>
                </PageActionBarRight>
            </PageActionBar>
            <Card>
                <CardContent>
                    <div
                        className="grid gap-4 border-b pb-2 mb-4 font-medium"
                        style={{ gridTemplateColumns: `200px repeat(${languages.length}, 1fr)` }}
                    >
                        <div><Trans>Field</Trans></div>
                        <LanguageHeaders languages={languages} />
                    </div>
                    {fields.map(field => {
                        const fieldKey = `${field.contentBlockId ?? 'page'}|${field.fieldName}`;
                        return (
                            <div
                                key={fieldKey}
                                className="grid gap-4 mb-4 items-start"
                                style={{ gridTemplateColumns: `200px repeat(${languages.length}, 1fr)` }}
                            >
                                <div className="pt-2 text-sm font-medium text-muted-foreground truncate">
                                    {field.fieldName}
                                </div>
                                {languages.map(lang => (
                                    <FieldInput
                                        key={lang.code}
                                        blockType={field.blockType}
                                        fieldName={field.fieldName}
                                        value={translations[lang.code]?.[fieldKey] ?? ''}
                                        onChange={v => updateValue(lang.code, fieldKey, v)}
                                    />
                                ))}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </Page>
    );
}

// ── Collection entry translation (one expandable card per entry) ──

interface CollectionField {
    fieldName: string;
    blockType: string | null;
}

interface CollectionEntry {
    id: string;
    createdAt: string;
    data: Record<string, unknown>;
}

function CollectionEntryCard({
    entry,
    pageId,
    fields,
    languages,
}: {
    entry: CollectionEntry;
    pageId: string;
    fields: CollectionField[];
    languages: Language[];
}) {
    const { t } = useLingui();
    const [expanded, setExpanded] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});

    const entryLabel = Object.values(entry.data).find(v => typeof v === 'string' && v.length > 0)
        ?? `#${entry.id}`;

    const loadTranslations = useCallback(async () => {
        if (loaded) return;
        const [transResult, defaultResult] = await Promise.all([
            api.query(getCollectionEntryTranslationsDocument, { pageId, entryId: entry.id }),
            api.query(getCollectionEntryDefaultContentDocument, { pageId, entryId: entry.id }),
        ]);

        const defaultLang = languages.find(l => l.isDefault);
        const map: Record<string, Record<string, string>> = {};
        for (const lang of languages) {
            map[lang.code] = {};
        }
        if (defaultLang) {
            for (const e of defaultResult.collectionEntryDefaultContent ?? []) {
                map[defaultLang.code][e.fieldName] = e.value;
            }
        }
        for (const group of transResult.collectionEntryTranslations ?? []) {
            if (!map[group.languageCode]) map[group.languageCode] = {};
            for (const e of group.entries) {
                map[group.languageCode][e.fieldName] = e.value;
            }
        }
        setTranslations(map);
        setLoaded(true);
    }, [loaded, pageId, entry.id, languages]);

    const toggleExpand = useCallback(() => {
        const next = !expanded;
        setExpanded(next);
        if (next) loadTranslations();
    }, [expanded, loadTranslations]);

    const updateValue = useCallback(
        (langCode: string, fieldName: string, value: string) => {
            setTranslations(prev => ({
                ...prev,
                [langCode]: { ...prev[langCode], [fieldName]: value },
            }));
        },
        [],
    );

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const promises = Object.entries(translations).map(([langCode, fieldMap]) => {
                const entries = Object.entries(fieldMap).map(([fieldName, value]) => ({
                    fieldName,
                    value,
                }));
                return api.mutate(updateCollectionEntryTranslationsDocument, {
                    input: { pageId, entryId: entry.id, languageCode: langCode, entries },
                });
            });
            await Promise.all(promises);
            toast.success(t`Translations saved`);
        } catch (err: any) {
            toast.error(err.message ?? 'Failed to save translations');
        } finally {
            setSaving(false);
        }
    }, [translations, pageId, entry.id, t]);

    return (
        <Card>
            <CardHeader
                className="cursor-pointer flex flex-row items-center gap-2"
                onClick={toggleExpand}
            >
                {expanded
                    ? <ChevronDownIcon className="h-4 w-4" />
                    : <ChevronRightIcon className="h-4 w-4" />}
                <span className="font-medium">{String(entryLabel)}</span>
                <Badge variant="outline" className="ml-auto">
                    {new Date(entry.createdAt).toLocaleDateString()}
                </Badge>
            </CardHeader>
            {expanded && (
                <CardContent>
                    <div className="flex justify-end mb-4">
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                            {saving ? '...' : <Trans>Save</Trans>}
                        </Button>
                    </div>
                    <div
                        className="grid gap-4 border-b pb-2 mb-4 font-medium text-sm"
                        style={{ gridTemplateColumns: `200px repeat(${languages.length}, 1fr)` }}
                    >
                        <div><Trans>Field</Trans></div>
                        <LanguageHeaders languages={languages} />
                    </div>
                    {fields.map(field => (
                        <div
                            key={field.fieldName}
                            className="grid gap-4 mb-4 items-start"
                            style={{ gridTemplateColumns: `200px repeat(${languages.length}, 1fr)` }}
                        >
                            <div className="pt-2 text-sm font-medium text-muted-foreground truncate">
                                {field.fieldName}
                            </div>
                            {languages.map(lang => (
                                <FieldInput
                                    key={lang.code}
                                    blockType={field.blockType}
                                    fieldName={field.fieldName}
                                    value={translations[lang.code]?.[field.fieldName] ?? ''}
                                    onChange={v => updateValue(lang.code, field.fieldName, v)}
                                />
                            ))}
                        </div>
                    ))}
                </CardContent>
            )}
        </Card>
    );
}

function CollectionPageTranslation({
    pageId,
    pageName,
    languages,
}: {
    pageId: string;
    pageName: string;
    languages: Language[];
}) {
    const { t } = useLingui();
    const [fields, setFields] = useState<CollectionField[]>([]);
    const [entries, setEntries] = useState<CollectionEntry[]>([]);

    useEffect(() => {
        const load = async () => {
            const [fieldsResult, entriesResult] = await Promise.all([
                api.query(getCollectionEntryFieldsDocument, { pageId }),
                api.query(getFormSubmissionsDocument, {
                    pageId,
                    options: { take: 100, sort: { createdAt: 'ASC' as any } },
                }),
            ]);
            setFields(fieldsResult.collectionEntryTranslatableFields ?? []);
            setEntries(
                (entriesResult.formSubmissions?.items ?? []).map((e: any) => ({
                    id: e.id,
                    createdAt: e.createdAt,
                    data: typeof e.data === 'string' ? JSON.parse(e.data) : e.data ?? {},
                })),
            );
        };
        load();
    }, [pageId]);

    return (
        <Page>
            <PageTitle>{pageName} — {t`Collection Translations`}</PageTitle>
            {entries.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        <Trans>No entries found in this collection.</Trans>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {entries.map(entry => (
                        <CollectionEntryCard
                            key={entry.id}
                            entry={entry}
                            pageId={pageId}
                            fields={fields}
                            languages={languages}
                        />
                    ))}
                </div>
            )}
        </Page>
    );
}

// ── Main detail component (routes to regular or collection) ──

function TranslationDetailContent() {
    const { t } = useLingui();
    const [languages, setLanguages] = useState<Language[]>([]);
    const [pageName, setPageName] = useState('');
    const [pageId, setPageId] = useState('');
    const [isCollection, setIsCollection] = useState(false);

    useEffect(() => {
        const match = window.location.pathname.match(/\/cms-translations\/([^/]+)/);
        if (match && match[1] !== 'settings') setPageId(match[1]);
    }, []);

    useEffect(() => {
        if (!pageId) return;
        const load = async () => {
            const [langResult, pageResult] = await Promise.all([
                api.query(getTranslationLanguagesDocument, {}),
                api.query(getCmsPageForTranslationDocument, { id: pageId }),
            ]);
            const enabledLangs = (langResult.translationLanguages ?? []).filter(
                (l: any) => l.enabled,
            );
            setLanguages(enabledLangs);
            setPageName(pageResult.cmsPage?.name ?? pageResult.cmsPage?.key ?? '');
            setIsCollection(pageResult.cmsPage?.isCollection ?? false);
        };
        load();
    }, [pageId]);

    if (!pageId || languages.length === 0) {
        return (
            <Page>
                <PageTitle>{t`Translations`}</PageTitle>
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        <Trans>No translatable fields found</Trans>
                    </CardContent>
                </Card>
            </Page>
        );
    }

    if (isCollection) {
        return (
            <CollectionPageTranslation
                pageId={pageId}
                pageName={pageName}
                languages={languages}
            />
        );
    }

    return (
        <RegularPageTranslation
            pageId={pageId}
            pageName={pageName}
            languages={languages}
        />
    );
}

export const translationDetail: DashboardRouteDefinition = {
    path: '/cms-translations/$id',
    loader: detailPageRouteLoader({
        queryDocument: getCmsPageForTranslationDocument,
        breadcrumb: (isNew, entity) => [
            { path: '/cms-translations', label: 'Translations' },
            entity?.name ?? 'Translation',
        ],
    }),
    component: () => <TranslationDetailContent />,
};
