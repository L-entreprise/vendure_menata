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

/**
 * Parses a gallery per-image field name (`gallery:<assetId>:alt|description`).
 * Mirrors `galleryFieldName` in the plugin constants; inlined here to keep the
 * dashboard bundle free of server-side imports.
 */
function parseGalleryFieldName(
    fieldName: string,
): { assetId: string; field: 'alt' | 'description' } | null {
    const match = /^gallery:(.+):(alt|description)$/.exec(fieldName);
    if (!match) return null;
    return { assetId: match[1], field: match[2] as 'alt' | 'description' };
}

/** Alt-text field across regular IMAGE, gallery and collection image fields. */
function isAltField(fieldName: string): boolean {
    return fieldName === 'altText' || fieldName.endsWith(':alt') || fieldName.endsWith('__alt');
}

/** Description field across regular IMAGE, gallery and collection image fields. */
function isDescriptionField(fieldName: string): boolean {
    return (
        fieldName === 'description' ||
        fieldName.endsWith(':description') ||
        fieldName.endsWith('__description')
    );
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
    // Image alt / description are plain text fields. Check these BEFORE the IMAGE
    // picker branch so an IMAGE block's altText/description (which carry
    // blockType 'IMAGE') render as text inputs, not an asset picker.
    if (isAltField(fieldName)) {
        return <Input value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />;
    }
    if (isDescriptionField(fieldName)) {
        return (
            <Textarea
                rows={3}
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
            />
        );
    }
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
    // The image itself (per-language swap): regular page uses fieldName 'image';
    // collection entries use the block key (blockType 'IMAGE').
    if (fieldName === 'image' || blockType === 'IMAGE') {
        return <ImageFieldInput value={value} onChange={onChange} disabled={disabled} />;
    }
    if (blockType === 'ENUM') {
        return <OptionsListTranslationInput value={value} onChange={onChange} disabled={disabled} />;
    }
    return (
        <Input
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
        />
    );
}

/**
 * Parses an Options List value that may be stored as a JSON array (collection
 * entries / translated lists) or as a newline/comma string (regular-page ENUM
 * textContent), returning a plain string[].
 */
function parseOptionsValue(value: string): string[] {
    if (!value) return [];
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
        try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr)) return arr.map((x: any) => String(x));
        } catch {
            // fall through to line/comma split
        }
    }
    return trimmed.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
}

/**
 * Per-language Options List editor for translations. Renders the list as chips,
 * lets you add/remove options, and stores the result as a JSON array string so it
 * round-trips regardless of the source format. Read-only for the default language.
 */
function OptionsListTranslationInput({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    const { t } = useLingui();
    const options = parseOptionsValue(value);
    const [draft, setDraft] = useState('');

    const commit = (next: string[]) => onChange(JSON.stringify(next));
    const addOption = () => {
        const v = draft.trim();
        if (!v) return;
        commit([...options, v]);
        setDraft('');
    };
    const removeOption = (i: number) => commit(options.filter((_, idx) => idx !== i));

    return (
        <div>
            {!disabled && (
                <div className="flex gap-2">
                    <Input
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addOption();
                            }
                        }}
                        placeholder={t`Add an option and press Enter`}
                    />
                    <Button type="button" variant="outline" onClick={addOption}>
                        <Trans>Add</Trans>
                    </Button>
                </div>
            )}
            {options.length > 0 ? (
                <div className="flex gap-1.5 flex-wrap mt-2">
                    {options.map((opt, i) => (
                        <Badge key={i} variant="secondary" className="flex items-center gap-1">
                            {opt}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => removeOption(i)}
                                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                                >
                                    <XIcon className="h-3 w-3" />
                                </button>
                            )}
                        </Badge>
                    ))}
                </div>
            ) : (
                disabled && <span className="text-sm text-muted-foreground">—</span>
            )}
        </div>
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

/**
 * Translated subtitle for a field. `useFieldSubtitle` returns a function bound to
 * the active language; keep the `t` literals here so Lingui can extract them.
 */
function useFieldSubtitle(): (fieldName: string) => string {
    const { t } = useLingui();
    return (fieldName: string): string => {
        if (isAltField(fieldName)) return t`Alt text`;
        if (isDescriptionField(fieldName)) return t`Description`;
        switch (fieldName) {
            case 'textContent':
                return t`Content`;
            case 'image':
                return t`Image`;
            case 'name':
                return t`Name`;
            case 'slug':
                return t`Slug`;
            default:
                return fieldName;
        }
    };
}

/** Small asset thumbnail resolved from an asset id, used in gallery field labels. */
function AssetThumb({ assetId }: { assetId: string }) {
    const [preview, setPreview] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        api.query(getAssetDocument, { id: assetId })
            .then(r => {
                if (active && r.asset?.preview) setPreview(r.asset.preview);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [assetId]);
    if (!preview) return null;
    return (
        <img
            src={`${preview}?preset=thumb`}
            alt=""
            className="h-8 w-8 rounded object-cover border shrink-0"
        />
    );
}

/**
 * Renders the label cell for a translatable field. Gallery per-image fields
 * (`gallery:<assetId>:alt|description`) get a thumbnail + subtitle so the editor
 * can tell which image each row belongs to. Page-level fields (name/slug) use a
 * "Page …" prefix.
 */
function FieldLabel({ fieldName, isPage }: { fieldName: string; isPage?: boolean }) {
    const { t } = useLingui();
    const subtitle = useFieldSubtitle();

    if (isPage) {
        if (fieldName === 'name') return <>{t`Page Name`}</>;
        if (fieldName === 'slug') return <>{t`Page Slug`}</>;
        return <>{fieldName}</>;
    }

    const gallery = parseGalleryFieldName(fieldName);
    if (gallery) {
        return (
            <div className="flex items-center gap-2">
                <AssetThumb assetId={gallery.assetId} />
                <span>{gallery.field === 'alt' ? t`Alt text` : t`Description`}</span>
            </div>
        );
    }
    return <>{subtitle(fieldName)}</>;
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
                            (<Trans>CMS — read-only</Trans>)
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
                            className="grid gap-4 border-b pb-2 mb-4 text-sm font-medium text-muted-foreground"
                            style={{ gridTemplateColumns: `minmax(220px, 220px) repeat(${languages.length}, minmax(220px, 1fr))` }}
                        >
                            <div className="sticky left-0 bg-card z-10">
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
                                            className="text-xs font-medium uppercase tracking-wide text-muted-foreground pt-3 pb-1"
                                        >
                                            {header}
                                        </div>,
                                    );
                                }
                                for (const field of groupFields) {
                                    const fieldKey = `${field.contentBlockId ?? 'page'}|${field.fieldName}`;
                                    rendered.push(
                                        <div
                                            key={fieldKey}
                                            className="grid gap-4 mb-4 items-start"
                                            style={{ gridTemplateColumns: `minmax(220px, 220px) repeat(${languages.length}, minmax(220px, 1fr))` }}
                                        >
                                            <div className="pt-2 text-sm font-medium text-muted-foreground truncate sticky left-0 bg-card z-10">
                                                <FieldLabel fieldName={field.fieldName} isPage={isPage} />
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
                            className="grid gap-4 border-b pb-2 mb-4 text-sm font-medium text-muted-foreground"
                            style={{ gridTemplateColumns: `minmax(220px, 220px) repeat(${languages.length}, minmax(220px, 1fr))` }}
                        >
                            <div className="sticky left-0 bg-card z-10">
                                <Trans>Field</Trans>
                            </div>
                            <LanguageHeaders languages={languages} />
                        </div>
                        {(() => {
                            const sub = (suffix: 'alt' | 'description') =>
                                suffix === 'alt' ? t`Alt text` : t`Description`;

                            interface Row {
                                fieldName: string;
                                label: ReactNode;
                                blockType: string | null;
                            }
                            const rows: Row[] = [];

                            for (const field of fields) {
                                // IMAGE_GALLERY: per-image fields are per-entry (the
                                // asset ids live in this row's data), so expand them
                                // from the entry data rather than the page schema.
                                if (field.blockType === 'IMAGE_GALLERY') {
                                    const baseName = blockByKey.get(field.fieldName)?.name ?? field.fieldName;
                                    const ids = Array.isArray(entry.data[field.fieldName])
                                        ? (entry.data[field.fieldName] as string[])
                                        : [];
                                    for (const assetId of ids) {
                                        for (const f of ['alt', 'description'] as const) {
                                            rows.push({
                                                fieldName: `${field.fieldName}__${assetId}__${f}`,
                                                blockType: null,
                                                label: (
                                                    <div className="flex items-center gap-2">
                                                        <AssetThumb assetId={String(assetId)} />
                                                        <span>{baseName} — {sub(f)}</span>
                                                    </div>
                                                ),
                                            });
                                        }
                                    }
                                    continue;
                                }

                                // Collection image meta fields are `<key>__alt` / `<key>__description`.
                                const metaMatch = /^(.+)__(alt|description)$/.exec(field.fieldName);
                                const baseKey = metaMatch ? metaMatch[1] : field.fieldName;
                                const baseName = blockByKey.get(baseKey)?.name ?? baseKey;
                                rows.push({
                                    fieldName: field.fieldName,
                                    blockType: field.blockType,
                                    label: metaMatch
                                        ? `${baseName} — ${sub(metaMatch[2] as 'alt' | 'description')}`
                                        : baseName,
                                });
                            }

                            return rows.map(row => (
                                <div
                                    key={row.fieldName}
                                    className="grid gap-4 mb-4 items-start"
                                    style={{ gridTemplateColumns: `minmax(220px, 220px) repeat(${languages.length}, minmax(220px, 1fr))` }}
                                >
                                    <div className="pt-2 text-sm font-medium text-muted-foreground truncate sticky left-0 bg-card z-10">
                                        {row.label}
                                    </div>
                                    {languages.map(lang => (
                                        <FieldInput
                                            key={lang.code}
                                            blockType={row.blockType}
                                            fieldName={row.fieldName}
                                            value={translations[lang.code]?.[row.fieldName] ?? ''}
                                            onChange={v => updateValue(lang.code, row.fieldName, v)}
                                            disabled={lang.isDefault}
                                        />
                                    ))}
                                </div>
                            ));
                        })()}
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
        // The nav section crumb already links to the translations list.
        breadcrumb: (isNew, entity) => [entity?.name ?? <Trans>Translation</Trans>],
    }),
    component: () => <TranslationDetailContent />,
};
