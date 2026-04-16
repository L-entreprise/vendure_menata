import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { ChevronDownIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useState } from 'react';
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
                translations {
                    languageCode
                    name
                    altText
                }
            }
        }
    }
`);

// ── Regular page documents ──

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
    disabled,
}: {
    blockType: string | null;
    fieldName: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    if (blockType === 'RICH_TEXT') {
        return <RichTextEditor value={value} onChange={onChange} disabled={disabled} />;
    }
    if (blockType === 'TEXT_LONG') {
        return (
            <Textarea
                rows={4}
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
            />
        );
    }
    if (blockType === 'IMAGE') {
        return <ImageFieldInput value={value} onChange={onChange} disabled={disabled} />;
    }
    return (
        <Input
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
        />
    );
}

function ImageFieldInput({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
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
                disabled={disabled}
            >
                {value ? t`Change Image` : t`Select Image`}
            </Button>
            {value && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange('')}
                    disabled={disabled}
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

const FIELD_SUBTITLES: Record<string, string> = {
    textContent: 'Content',
    altText: 'Alt text',
    image: 'Image',
    name: 'Name',
    slug: 'Slug',
};

function pageFieldLabel(fieldName: string): string {
    if (fieldName === 'name') return 'Page Name';
    if (fieldName === 'slug') return 'Page Slug';
    return fieldName;
}

function fieldSubtitle(fieldName: string): string {
    return FIELD_SUBTITLES[fieldName] ?? fieldName;
}

interface BlockInfo {
    id: string;
    name: string;
    key: string;
    type: string;
}

type BlockMap = Map<string, BlockInfo>;

function LanguageHeaders({ languages }: { languages: Language[] }) {
    return (
        <>
            {languages.map(lang => (
                <div key={lang.code}>
                    {lang.name} ({lang.code})
                    {lang.isDefault && (
                        <span className="ml-2 text-xs text-muted-foreground">
                            (CMS — read-only)
                        </span>
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
    blockMap,
}: {
    pageId: string;
    pageName: string;
    languages: Language[];
    blockMap: BlockMap;
}) {
    const { t } = useLingui();
    const [fields, setFields] = useState<FieldValue[]>([]);
    const [saving, setSaving] = useState(false);
    const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});

    useEffect(() => {
        const load = async () => {
            const [fieldsResult, translationsResult] = await Promise.all([
                api.query(getTranslatableFieldsDocument, { pageId }),
                api.query(getPageTranslationsDocument, { pageId }),
            ]);

            setFields(fieldsResult.cmsPageTranslatableFields ?? []);

            const map: Record<string, Record<string, string>> = {};
            for (const lang of languages) {
                map[lang.code] = {};
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
            const defaultCode = languages.find(l => l.isDefault)?.code;
            const promises = Object.entries(translations)
                .filter(([langCode]) => langCode !== defaultCode)
                .map(([langCode, fieldMap]) => {
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
    }, [translations, pageId, languages, t]);

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
                    <div className="overflow-x-auto">
                        <div
                            className="grid gap-4 border-b pb-2 mb-4 font-medium"
                            style={{ gridTemplateColumns: `minmax(220px, 220px) repeat(${languages.length}, minmax(220px, 1fr))` }}
                        >
                            <div className="sticky left-0 bg-background z-10">
                                <Trans>Field</Trans>
                            </div>
                            <LanguageHeaders languages={languages} />
                        </div>
                        {(() => {
                            // Group fields: key '__page__' for page-level, otherwise blockId
                            const groups = new Map<string, FieldValue[]>();
                            for (const f of fields) {
                                const groupId = f.contentBlockId ?? '__page__';
                                const list = groups.get(String(groupId)) ?? [];
                                list.push(f);
                                groups.set(String(groupId), list);
                            }
                            const rendered: ReactNode[] = [];
                            for (const [groupId, groupFields] of groups) {
                                const isPage = groupId === '__page__';
                                const block = !isPage ? blockMap.get(groupId) : null;
                                const header = isPage ? null : (block?.name ?? groupId);
                                if (!isPage && header) {
                                    rendered.push(
                                        <div
                                            key={`${groupId}-header`}
                                            className="text-sm font-semibold pt-3 pb-1"
                                        >
                                            {header}
                                        </div>,
                                    );
                                }
                                for (const field of groupFields) {
                                    const fieldKey = `${field.contentBlockId ?? 'page'}|${field.fieldName}`;
                                    const label = isPage
                                        ? pageFieldLabel(field.fieldName)
                                        : fieldSubtitle(field.fieldName);
                                    rendered.push(
                                        <div
                                            key={fieldKey}
                                            className="grid gap-4 mb-4 items-start"
                                            style={{ gridTemplateColumns: `minmax(220px, 220px) repeat(${languages.length}, minmax(220px, 1fr))` }}
                                        >
                                            <div className="pt-2 text-sm font-medium text-muted-foreground truncate sticky left-0 bg-background z-10">
                                                {label}
                                            </div>
                                            {languages.map(lang => (
                                                <FieldInput
                                                    key={lang.code}
                                                    blockType={field.blockType}
                                                    fieldName={field.fieldName}
                                                    value={translations[lang.code]?.[fieldKey] ?? ''}
                                                    onChange={v => updateValue(lang.code, fieldKey, v)}
                                                    disabled={lang.isDefault}
                                                />
                                            ))}
                                        </div>,
                                    );
                                }
                            }
                            return rendered;
                        })()}
                    </div>
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
    blockMap,
}: {
    entry: CollectionEntry;
    pageId: string;
    fields: CollectionField[];
    languages: Language[];
    blockMap: BlockMap;
}) {
    const { t } = useLingui();
    const [expanded, setExpanded] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});

    const entryLabel = Object.values(entry.data).find(v => typeof v === 'string' && v.length > 0)
        ?? `#${entry.id}`;

    const blockByKey = new Map<string, BlockInfo>();
    for (const info of blockMap.values()) blockByKey.set(info.key, info);

    const loadTranslations = useCallback(async () => {
        if (loaded) return;
        const transResult = await api.query(getCollectionEntryTranslationsDocument, {
            pageId,
            entryId: entry.id,
        });

        const map: Record<string, Record<string, string>> = {};
        for (const lang of languages) {
            map[lang.code] = {};
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
            const defaultCode = languages.find(l => l.isDefault)?.code;
            const promises = Object.entries(translations)
                .filter(([langCode]) => langCode !== defaultCode)
                .map(([langCode, fieldMap]) => {
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
    }, [translations, pageId, entry.id, languages, t]);

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
                    <div className="overflow-x-auto">
                        <div
                            className="grid gap-4 border-b pb-2 mb-4 font-medium text-sm"
                            style={{ gridTemplateColumns: `minmax(220px, 220px) repeat(${languages.length}, minmax(220px, 1fr))` }}
                        >
                            <div className="sticky left-0 bg-background z-10">
                                <Trans>Field</Trans>
                            </div>
                            <LanguageHeaders languages={languages} />
                        </div>
                        {fields.map(field => {
                            const block = blockByKey.get(field.fieldName);
                            const label = block?.name ?? field.fieldName;
                            return (
                                <div
                                    key={field.fieldName}
                                    className="grid gap-4 mb-4 items-start"
                                    style={{ gridTemplateColumns: `minmax(220px, 220px) repeat(${languages.length}, minmax(220px, 1fr))` }}
                                >
                                    <div className="pt-2 text-sm font-medium text-muted-foreground truncate sticky left-0 bg-background z-10">
                                        {label}
                                    </div>
                                    {languages.map(lang => (
                                        <FieldInput
                                            key={lang.code}
                                            blockType={field.blockType}
                                            fieldName={field.fieldName}
                                            value={translations[lang.code]?.[field.fieldName] ?? ''}
                                            onChange={v => updateValue(lang.code, field.fieldName, v)}
                                            disabled={lang.isDefault}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

function CollectionPageTranslation({
    pageId,
    pageName,
    languages,
    blockMap,
}: {
    pageId: string;
    pageName: string;
    languages: Language[];
    blockMap: BlockMap;
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
                            blockMap={blockMap}
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
    const [blockMap, setBlockMap] = useState<BlockMap>(new Map());

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

            const map: BlockMap = new Map();
            for (const block of pageResult.cmsPage?.contentBlocks ?? []) {
                const defaultTrans = block.translations?.[0];
                map.set(block.id, {
                    id: block.id,
                    name: defaultTrans?.name || block.key || block.type,
                    key: block.key,
                    type: block.type,
                });
            }
            setBlockMap(map);
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
                blockMap={blockMap}
            />
        );
    }

    return (
        <RegularPageTranslation
            pageId={pageId}
            pageName={pageName}
            languages={languages}
            blockMap={blockMap}
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
