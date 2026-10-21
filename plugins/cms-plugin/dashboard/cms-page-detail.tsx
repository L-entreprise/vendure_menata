import { graphql } from '@/graphql/graphql';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import {
    AlignLeftIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    CalendarIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    HashIcon,
    ImageIcon,
    ImagesIcon,
    ListIcon,
    ExternalLinkIcon,
    LanguagesIcon,
    PlusIcon,
    TextIcon,
    ToggleLeftIcon,
    TrashIcon,
    TypeIcon,
} from 'lucide-react';
import { useState } from 'react';
import {
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
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    detailPageRouteLoader,
    useDetailPage,
    usePermissions,
} from '@vendure/dashboard';
import { toast } from 'sonner';

import { BlockValueEditor } from './cms-block-editors';
import { BlockLayoutFields } from './cms-block-layout-fields';
import { BlockSections } from './cms-block-sections';
import {
    getDefaultMetadata,
    prepareBlocksForMutation,
    resolveBlockEnabled,
    toEditableBlock,
} from './cms-block-utils';
import { ChildPageTab } from './cms-child-page-tab';
import { CollectionEntriesPanel } from './cms-collection-entries-panel';
import { PageSettingsCard } from './cms-page-settings-card';
import { ExpertModeSwitch, useCmsSimpleMode } from './cms-simple-mode';
import { SubmissionsPanel } from './cms-submissions-panel';

const cmsPageDetailDocument = graphql(`
    query GetCmsPageDetail($id: ID!) {
        cmsPage(id: $id) {
            id
            createdAt
            updatedAt
            key
            enabled
            acceptsSubmissions
            isCollection
            pinnedInSidebar
            allowCustomerCreation
            sidebarOrder
            parentId
            previewUrl
            parent {
                id
                name
                previewUrl
            }
            children {
                id
                key
                name
                advanced
            }
            advanced
            name
            slug
            translations {
                id
                languageCode
                name
                slug
            }
            contentBlocks {
                id
                key
                type
                enabled
                position
                metadata
                textContent
                dateValue
                numberValue
                featuredAsset {
                    id
                    preview
                    source
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

const updateCmsPageDocument = graphql(`
    mutation UpdateCmsPage($input: UpdateCmsPageInput!) {
        updateCmsPage(input: $input) {
            id
        }
    }
`);

const createCmsPageDocument = graphql(`
    mutation CreateCmsPage($input: CreateCmsPageInput!) {
        createCmsPage(input: $input) {
            id
        }
    }
`);

interface BlockTypeDefinition {
    value: string;
    label: any;
    description: any;
    icon: React.ComponentType<{ className?: string }>;
    group: 'text' | 'media' | 'data';
}

const BLOCK_TYPES: BlockTypeDefinition[] = [
    { value: 'TEXT_SHORT', label: msg`Short Text`, description: msg`Single-line text with character limit`, icon: TextIcon, group: 'text' },
    { value: 'TEXT_LONG', label: msg`Long Text`, description: msg`Multi-line text for paragraphs`, icon: AlignLeftIcon, group: 'text' },
    { value: 'RICH_TEXT', label: msg`Rich Text`, description: msg`WYSIWYG editor with formatting`, icon: TypeIcon, group: 'text' },
    { value: 'BOOLEAN', label: msg`Boolean`, description: msg`Toggle with custom labels`, icon: ToggleLeftIcon, group: 'data' },
    { value: 'ENUM', label: msg`Options List`, description: msg`List of values, one per line`, icon: ListIcon, group: 'data' },
    { value: 'IMAGE', label: msg`Image`, description: msg`Single image with alt text`, icon: ImageIcon, group: 'media' },
    { value: 'IMAGE_GALLERY', label: msg`Image Gallery`, description: msg`Multiple images`, icon: ImagesIcon, group: 'media' },
    { value: 'DATE', label: msg`Date`, description: msg`Date and time picker`, icon: CalendarIcon, group: 'data' },
    { value: 'NUMBER', label: msg`Number`, description: msg`Numeric value`, icon: HashIcon, group: 'data' },
];

const BLOCK_TYPE_GROUPS = [
    { key: 'text' as const, label: msg`Text` },
    { key: 'media' as const, label: msg`Media` },
    { key: 'data' as const, label: msg`Data` },
];

function getBlockTypeInfo(type: string) {
    return BLOCK_TYPES.find(bt => bt.value === type);
}

function getBlockTypeIcon(type: string) {
    return getBlockTypeInfo(type)?.icon ?? TextIcon;
}

// Tab of the page's own fields; child pages use their id as tab value.
const CONTENT_TAB = 'content';

// Registered by the translation plugin, when it is installed next to this one.
const TRANSLATION_ROUTE = '/cms-translations/$id';

function useHasRoute(fullPath: string): boolean {
    const router = useRouter();
    return Object.values(router.routesById as Record<string, { fullPath?: string }>).some(
        route => route.fullPath === fullPath,
    );
}

function CmsPageDetailPage({ route }: { route: any }) {
    const params = route.useParams();
    const isNew = params.id === 'new';
    const navigate = useNavigate();
    const search = useSearch({ strict: false }) as { tab?: string | number };
    const { hasPermissions } = usePermissions();
    const isSuperAdmin = hasPermissions(['SuperAdmin']);
    const mode = useCmsSimpleMode();
    const canTranslate = useHasRoute(TRANSLATION_ROUTE);
    // Creating a page is structure work, so a new page always shows the full editor.
    const simple = mode.simple && !isNew;
    const { t } = useLingui();

    const { form, submitHandler, entity, resetForm } = useDetailPage({
        pageId: 'cms-page-detail',
        queryDocument: cmsPageDetailDocument,
        updateDocument: updateCmsPageDocument,
        createDocument: createCmsPageDocument,
        params: { id: params.id },
        setValuesForUpdate: (page: any) => ({
            id: page.id,
            key: page.key,
            enabled: page.enabled,
            acceptsSubmissions: page.acceptsSubmissions ?? false,
            isCollection: page.isCollection ?? false,
            pinnedInSidebar: page.pinnedInSidebar ?? false,
            allowCustomerCreation: page.allowCustomerCreation ?? false,
            sidebarOrder: page.sidebarOrder ?? 0,
            parentId: page.parentId ?? null,
            previewUrl: page.previewUrl ?? '',
            advanced: page.advanced ?? false,
            name: page.name,
            slug: page.slug,
            translations: page.translations,
            contentBlocks: (page.contentBlocks || []).map(toEditableBlock),
        }),
        transformCreateInput: (input: any) => {
            return {
                key: input.key,
                enabled: input.enabled,
                acceptsSubmissions: input.acceptsSubmissions ?? false,
                isCollection: input.isCollection ?? false,
                pinnedInSidebar: input.pinnedInSidebar ?? false,
                allowCustomerCreation: input.allowCustomerCreation ?? false,
                sidebarOrder: input.sidebarOrder ?? 0,
                parentId: input.parentId || null,
                previewUrl: input.previewUrl || null,
                advanced: input.advanced ?? false,
                translations: input.translations,
                contentBlocks: prepareBlocksForMutation(input.contentBlocks),
            };
        },
        transformUpdateInput: (input: any) => {
            return {
                id: input.id,
                key: input.key,
                enabled: input.enabled,
                acceptsSubmissions: input.acceptsSubmissions,
                isCollection: input.isCollection,
                pinnedInSidebar: input.pinnedInSidebar,
                allowCustomerCreation: input.allowCustomerCreation,
                sidebarOrder: input.sidebarOrder,
                parentId: input.parentId || null,
                previewUrl: input.previewUrl || null,
                advanced: input.advanced ?? false,
                translations: input.translations,
                contentBlocks: prepareBlocksForMutation(input.contentBlocks),
            };
        },
        onSuccess: async (data: any) => {
            toast.success(isNew ? t`Page created` : t`Page updated`);
            resetForm();
            if (isNew && data?.id) {
                await navigate({ to: `../$id`, params: { id: data.id } });
            }
        },
        onError: (error: unknown) => {
            toast.error(t`Failed to save page`, {
                description: error instanceof Error ? error.message : t`Unknown error`,
            });
        },
    });

    const rawContentBlocks: any[] = form.watch('contentBlocks') ?? [];
    const contentBlocks = rawContentBlocks.filter((b: any) => b.type);
    const isCollectionPage = form.watch('isCollection') ?? false;
    const isSubmissionPage = form.watch('acceptsSubmissions') ?? false;
    const isSchemaOnly = isCollectionPage || isSubmissionPage;

    const addBlock = (type: string) => {
        const newBlock = {
            type,
            key: '',
            position: contentBlocks.length,
            enabled: true,
            featuredAssetId: null,
            metadata: getDefaultMetadata(type),
            dateValue: null,
            numberValue: type === 'BOOLEAN' ? 0 : null,
            _assetPreview: null,
            translations: [
                { languageCode: 'en', name: '', textContent: '', altText: '' },
            ],
        };
        form.setValue('contentBlocks', [...contentBlocks, newBlock], { shouldDirty: true });
    };

    const removeBlock = (index: number) => {
        const updated = contentBlocks.filter((_, i) => i !== index)
            .map((block, i) => ({ ...block, position: i }));
        form.setValue('contentBlocks', updated, { shouldDirty: true });
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= contentBlocks.length) return;
        const updated = [...contentBlocks];
        [updated[index], updated[target]] = [updated[target], updated[index]];
        form.setValue(
            'contentBlocks',
            updated.map((block, i) => ({ ...block, position: i })),
            { shouldDirty: true },
        );
    };

    const updateBlockField = (index: number, field: string, value: any) => {
        const updated = [...contentBlocks];
        updated[index] = { ...updated[index], [field]: value };
        form.setValue('contentBlocks', updated, { shouldDirty: true });
    };

    const updateBlockFields = (index: number, fields: Record<string, any>) => {
        const updated = [...contentBlocks];
        updated[index] = { ...updated[index], ...fields };
        form.setValue('contentBlocks', updated, { shouldDirty: true });
    };

    const updateBlockMetadata = (index: number, key: string, value: any) => {
        const updated = [...contentBlocks];
        const block = { ...updated[index] };
        block.metadata = { ...(block.metadata || {}), [key]: value };
        updated[index] = block;
        form.setValue('contentBlocks', updated, { shouldDirty: true });
    };

    const updateBlockTranslation = (index: number, field: string, value: string) => {
        const updated = [...contentBlocks];
        const block = { ...updated[index] };
        const translations = [...(block.translations || [])];
        if (translations.length === 0) {
            translations.push({ languageCode: 'en', name: '', textContent: '', altText: '' });
        }
        translations[0] = { ...translations[0], [field]: value };
        block.translations = translations;
        updated[index] = block;
        form.setValue('contentBlocks', updated, { shouldDirty: true });
    };

    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());

    const toggleBlockExpanded = (index: number) => {
        setExpandedBlocks(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const title = entity?.name || entity?.key || t`New Page`;
    // Advanced child pages (e.g. interface labels) stay out of the client's simple mode.
    const childPages: Array<{ id: string; key: string; name: string; advanced: boolean }> = isNew
        ? []
        : (entity?.children ?? []).filter((child: any) => !simple || !child.advanced);
    const viewOnSiteUrl = entity?.previewUrl || entity?.parent?.previewUrl;
    const requestedTab = String(search.tab ?? CONTENT_TAB);
    const activeTab = childPages.some(child => String(child.id) === requestedTab) ? requestedTab : CONTENT_TAB;
    const selectTab = (tab: string) =>
        navigate({ search: (prev: any) => ({ ...prev, tab: tab === CONTENT_TAB ? undefined : tab }), replace: true } as any);

    const pageContent = (
        <>
            {!isNew && entity?.acceptsSubmissions && (
                <SubmissionsPanel
                    pageId={params.id}
                    schema={contentBlocks}
                    allowCustomerCreation={entity?.allowCustomerCreation ?? false}
                />
            )}
            {!isNew && entity?.isCollection && (
                <CollectionEntriesPanel pageId={params.id} schema={contentBlocks} title={simple ? entity?.name : undefined} />
            )}

            {simple ? (
                !isSchemaOnly && (
                    <div className="w-full mt-4">
                        <Card>
                            <CardContent>
                                {contentBlocks.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground"><Trans>No sections yet.</Trans></div>
                                ) : (
                                    <BlockSections
                                        blocks={contentBlocks}
                                        isSuperAdmin={isSuperAdmin}
                                        handlers={{
                                            onFieldChange: updateBlockField,
                                            onFieldsChange: updateBlockFields,
                                            onMetadataChange: updateBlockMetadata,
                                            onTranslationChange: updateBlockTranslation,
                                        }}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )
            ) : (
            <>
            <div className="w-full mt-4">
                <Card>
                    <CardHeader>
                        <div className="text-lg font-semibold">
                            {isSchemaOnly ? <Trans>Schema Fields</Trans> : <Trans>Content Sections</Trans>}
                        </div>
                        {isSchemaOnly && (
                            <p className="text-sm text-muted-foreground">
                                {isCollectionPage
                                    ? <Trans>These fields define the columns for collection entries.</Trans>
                                    : <Trans>These fields define the form structure for submissions.</Trans>}
                            </p>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {isSchemaOnly ? (
                                <>
                                    {contentBlocks.map((block, index) => {
                                        const Icon = getBlockTypeIcon(block.type);
                                        const isExpanded = expandedBlocks.has(index);
                                        return (
                                            <div key={block.id ?? `new-${index}`} className="border rounded-md">
                                                <div
                                                    className="flex items-center justify-between py-2 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
                                                    onClick={() => toggleBlockExpanded(index)}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {isExpanded
                                                            ? <ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                            : <ChevronRightIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        }
                                                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        {block.key && (
                                                            <code className="text-xs text-muted-foreground">{block.key}</code>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => moveBlock(index, 'up')}>
                                                            <ArrowUpIcon className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === contentBlocks.length - 1} onClick={() => moveBlock(index, 'down')}>
                                                            <ArrowDownIcon className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {isSuperAdmin && (
                                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeBlock(index)}>
                                                            <TrashIcon className="h-3.5 w-3.5" />
                                                        </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="px-4 pb-4 pt-2 border-t space-y-3">
                                                        <div className="grid gap-3 @md:grid-cols-2">
                                                            <div>
                                                                <label className="text-sm font-medium"><Trans>Name</Trans></label>
                                                                <Input
                                                                    value={block.translations?.[0]?.name ?? ''}
                                                                    onChange={e => updateBlockTranslation(index, 'name', e.target.value)}
                                                                    placeholder={t`Section name`}
                                                                    className="mt-1"
                                                                />
                                                            </div>
                                                            {isSuperAdmin && (
                                                            <div>
                                                                <label className="text-sm font-medium"><Trans>Key</Trans></label>
                                                                <Input
                                                                    value={block.key}
                                                                    onChange={e => updateBlockField(index, 'key', e.target.value)}
                                                                    placeholder={t`e.g. hero-title`}
                                                                    className="mt-1"
                                                                />
                                                            </div>
                                                            )}
                                                        </div>
                                                        <BlockLayoutFields block={block} index={index} onMetadataChange={updateBlockMetadata} helpOnly />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            ) : (
                                <>
                            {contentBlocks.map((block, index) => {
                                const Icon = getBlockTypeIcon(block.type);
                                const typeInfo = getBlockTypeInfo(block.type);
                                const isExpanded = expandedBlocks.has(index);
                                return (
                                    <Card key={block.id ?? `new-${index}`} className="border-border/60">
                                        <div
                                            className="flex items-center justify-between py-3 px-5 cursor-pointer hover:bg-muted/30 transition-colors"
                                            onClick={() => toggleBlockExpanded(index)}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {isExpanded
                                                    ? <ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    : <ChevronRightIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                }
                                                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="text-base font-semibold shrink-0">
                                                    {block.translations?.[0]?.name || block.key || (typeInfo ? t(typeInfo.label) : block.type)}
                                                </span>
                                                {block.metadata?.section && (
                                                    <span className="text-xs text-muted-foreground truncate">{String(block.metadata.section)}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                {block.id && (
                                                    <label
                                                        className="flex items-center gap-2 mr-2 text-xs text-muted-foreground"
                                                        title={t`Disabled sections are hidden from the Shop API`}
                                                    >
                                                        {resolveBlockEnabled(block) ? <Trans>Visible</Trans> : <Trans>Hidden</Trans>}
                                                        <Switch
                                                            checked={resolveBlockEnabled(block)}
                                                            onCheckedChange={checked => updateBlockField(index, 'enabled', checked)}
                                                        />
                                                    </label>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    disabled={index === 0}
                                                    onClick={() => moveBlock(index, 'up')}
                                                >
                                                    <ArrowUpIcon className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    disabled={index === contentBlocks.length - 1}
                                                    onClick={() => moveBlock(index, 'down')}
                                                >
                                                    <ArrowDownIcon className="h-3.5 w-3.5" />
                                                </Button>
                                                {isSuperAdmin && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => removeBlock(index)}
                                                >
                                                    <TrashIcon className="h-3.5 w-3.5" />
                                                </Button>
                                                )}
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <CardContent className="px-5 pb-5 pt-0 border-t">
                                                <div className={`grid gap-4 pt-4 ${isSuperAdmin ? '@md:grid-cols-2' : ''}`}>
                                                    {isSuperAdmin && (
                                                    <div>
                                                        <label className="text-sm font-medium"><Trans>Key</Trans></label>
                                                        <Input
                                                            value={block.key}
                                                            onChange={e =>
                                                                updateBlockField(index, 'key', e.target.value)
                                                            }
                                                            placeholder={t`e.g. hero-title`}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                    )}
                                                    <div>
                                                        <label className="text-base font-semibold"><Trans>Name</Trans></label>
                                                        <Input
                                                            value={block.translations?.[0]?.name ?? ''}
                                                            onChange={e =>
                                                                updateBlockTranslation(index, 'name', e.target.value)
                                                            }
                                                            placeholder={t`Section name`}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                </div>
                                                <BlockLayoutFields block={block} index={index} onMetadataChange={updateBlockMetadata} />
                                                <div className="mt-4">
                                                    <BlockValueEditor
                                                        block={block}
                                                        index={index}
                                                        isSuperAdmin={isSuperAdmin}
                                                        onFieldChange={updateBlockField}
                                                        onFieldsChange={updateBlockFields}
                                                        onMetadataChange={updateBlockMetadata}
                                                        onTranslationChange={updateBlockTranslation}
                                                    />
                                                </div>
                                            </CardContent>
                                        )}
                                    </Card>
                                );
                            })}
                                </>
                            )}

                            {contentBlocks.length === 0 && (
                                <div className="text-center py-16 text-muted-foreground border border-dashed rounded-lg">
                                    {isSuperAdmin ? t`No sections yet. Add one below.` : t`No sections yet.`}
                                </div>
                            )}

                            {isSuperAdmin && (
                            <div className="relative">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full py-6 text-base"
                                    onClick={() => setAddMenuOpen(!addMenuOpen)}
                                >
                                    <PlusIcon className="mr-2 h-5 w-5" />
                                    <Trans>Add Section</Trans>
                                </Button>
                                {addMenuOpen && (
                                    <div className="mt-2 w-full max-h-[70vh] overflow-y-auto bg-popover border rounded-lg shadow-lg p-5">
                                        {BLOCK_TYPE_GROUPS.map(group => {
                                            const groupTypes = BLOCK_TYPES.filter(bt => bt.group === group.key);
                                            return (
                                                <div key={group.key} className="mb-5 last:mb-0">
                                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                                        {t(group.label)}
                                                    </div>
                                                    <div className="grid grid-cols-2 @lg:grid-cols-3 gap-2">
                                                        {groupTypes.map(bt => {
                                                            const BtIcon = bt.icon;
                                                            return (
                                                                <button
                                                                    key={bt.value}
                                                                    type="button"
                                                                    className="flex items-start gap-3 w-full p-3 text-left rounded-md border border-transparent hover:border-border hover:bg-accent/50 transition-colors"
                                                                    onClick={() => {
                                                                        addBlock(bt.value);
                                                                        setAddMenuOpen(false);
                                                                    }}
                                                                >
                                                                    <BtIcon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                                                                    <div className="min-w-0">
                                                                        <div className="text-sm font-medium">{t(bt.label)}</div>
                                                                        <div className="text-xs text-muted-foreground">{t(bt.description)}</div>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <PageSettingsCard
                form={form}
                isSuperAdmin={isSuperAdmin}
                pageId={isNew ? undefined : params.id}
                childCount={childPages.length}
            />
            </>
            )}
        </>
    );

    return (
        <Page pageId="cms-page-detail" form={form} submitHandler={submitHandler} entity={entity}>
            <PageTitle>{title}</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <ExpertModeSwitch mode={mode} />
                    {canTranslate && !isNew && !entity?.acceptsSubmissions && (
                        <Button
                            variant="outline"
                            render={
                                <Link
                                    to={TRANSLATION_ROUTE as any}
                                    params={{ id: params.id } as any}
                                    search={(activeTab === CONTENT_TAB ? {} : { tab: activeTab }) as any}
                                />
                            }
                        >
                            <LanguagesIcon className="mr-2 h-4 w-4" />
                            <Trans>Translate this page</Trans>
                        </Button>
                    )}
                    {viewOnSiteUrl && (
                        <Button
                            variant="outline"
                            render={<a href={viewOnSiteUrl} target="_blank" rel="noopener noreferrer" />}
                        >
                            <ExternalLinkIcon className="mr-2 h-4 w-4" />
                            <Trans>View on site</Trans>
                        </Button>
                    )}
                    {activeTab === CONTENT_TAB && !(simple && isSchemaOnly) && (
                        <Button type="submit" disabled={isNew && !isSuperAdmin}>{isNew ? <Trans>Create</Trans> : <Trans>Save</Trans>}</Button>
                    )}
                </PageActionBarRight>
            </PageActionBar>
            {childPages.length === 0 ? pageContent : (
                <Tabs value={activeTab} onValueChange={value => selectTab(String(value))} className="w-full mt-4">
                    <TabsList className="flex-wrap h-auto">
                        <TabsTrigger value={CONTENT_TAB}><Trans>Texts</Trans></TabsTrigger>
                        {childPages.map(child => (
                            <TabsTrigger key={child.id} value={String(child.id)}>{child.name || child.key}</TabsTrigger>
                        ))}
                    </TabsList>
                    <TabsContent value={CONTENT_TAB}>{pageContent}</TabsContent>
                    {childPages.map(child => (
                        <TabsContent key={child.id} value={String(child.id)}>
                            {/* The tab sits inside this page's form: Enter in a field must not save the parent */}
                            <div onKeyDown={preventImplicitSubmit}>
                                <ChildPageTab pageId={String(child.id)} isSuperAdmin={isSuperAdmin} simple={simple} />
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            )}
        </Page>
    );
}

function preventImplicitSubmit(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
        event.preventDefault();
    }
}


export const cmsPageDetail: DashboardRouteDefinition = {
    path: '/cms-pages/$id',
    loader: detailPageRouteLoader({
        queryDocument: cmsPageDetailDocument,
        breadcrumb: (isNew, entity) => [
            { path: '/cms-pages', label: <Trans>Pages</Trans> },
            ...(entity?.parent ? [{ path: `/cms-pages/${entity.parent.id}`, label: entity.parent.name }] : []),
            isNew ? <Trans>New Page</Trans> : entity?.name,
        ],
    }),
    component: route => <CmsPageDetailPage route={route} />,
};
