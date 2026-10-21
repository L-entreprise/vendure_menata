import { graphql } from '@/graphql/graphql';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
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
    MailIcon,
    EyeIcon,
    ExternalLinkIcon,
    PlusIcon,
    TextIcon,
    ToggleLeftIcon,
    TrashIcon,
    TypeIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    api,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    DashboardRouteDefinition,
    DataTable,
    DetailFormGrid,
    FormFieldWrapper,
    Input,
    Page,
    PageActionBar,
    PageActionBarRight,
    PageBlockContext,
    PageTitle,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    TranslatableFormFieldWrapper,
    detailPageRouteLoader,
    useDetailPage,
    usePermissions,
} from '@vendure/dashboard';
import { toast } from 'sonner';

import { BlockValueEditor } from './cms-block-editors';
import {
    getDefaultMetadata,
    prepareBlocksForMutation,
    resolveBlockEnabled,
    toEditableBlock,
} from './cms-block-utils';
import { ChildPageTab } from './cms-child-page-tab';
import {
    CollectionEntriesPanel,
    deleteFormSubmissionDocument,
    formSubmissionsDocument,
} from './cms-collection-entries-panel';
import { ParentPageSelect } from './cms-parent-page-select';

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
            }
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

const createCustomerFromSubmissionDocument = graphql(`
    mutation CreateCustomerFromSubmission($submissionId: ID!) {
        createCustomerFromSubmission(submissionId: $submissionId) {
            submission {
                id
            }
            customerId
            existing
        }
    }
`);

const getCustomersByEmailDocument = graphql(`
    query GetCustomersByEmail($options: CustomerListOptions) {
        customers(options: $options) {
            items {
                id
                emailAddress
            }
            totalItems
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

function getBlockSummary(block: any, t: any): string {
    const typeInfo = getBlockTypeInfo(block.type);
    const label = typeInfo ? t(typeInfo.label) : block.type;
    switch (block.type) {
        case 'TEXT_SHORT':
        case 'TEXT_LONG': {
            const text = block.translations?.[0]?.textContent ?? '';
            return text ? `${text.slice(0, 80)}${text.length > 80 ? '...' : ''}` : t`Empty`;
        }
        case 'RICH_TEXT': {
            const html = block.translations?.[0]?.textContent ?? '';
            const stripped = html.replace(/<[^>]*>/g, '').trim();
            return stripped ? `${stripped.slice(0, 80)}${stripped.length > 80 ? '...' : ''}` : t`Empty`;
        }
        case 'BOOLEAN': {
            const isTrue = block.numberValue === 1;
            const trueLabel = String(block.metadata?.trueLabel ?? t`Yes`);
            const falseLabel = String(block.metadata?.falseLabel ?? t`No`);
            return isTrue ? trueLabel : falseLabel;
        }
        case 'ENUM': {
            const text = block.translations?.[0]?.textContent ?? '';
            const count = text.split('\n').filter((l: string) => l.trim()).length;
            return count > 0 ? t`${count} options` : t`Empty`;
        }
        case 'IMAGE':
            return block.featuredAssetId ? t`Image selected` : t`No image`;
        case 'IMAGE_GALLERY': {
            const count = block.metadata?.assetIds?.length ?? 0;
            return count > 0 ? t`${count} images` : t`No images`;
        }
        case 'DATE':
            return block.dateValue ? new Date(block.dateValue).toLocaleDateString() : t`Not set`;
        case 'NUMBER':
            return block.numberValue != null ? String(block.numberValue) : t`Not set`;
        default:
            return label;
    }
}

// Tab of the page's own fields; child pages use their id as tab value.
const CONTENT_TAB = 'content';

function CmsPageDetailPage({ route }: { route: any }) {
    const params = route.useParams();
    const isNew = params.id === 'new';
    const navigate = useNavigate();
    const search = useSearch({ strict: false }) as { tab?: string | number };
    const { hasPermissions } = usePermissions();
    const isSuperAdmin = hasPermissions(['SuperAdmin']);
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
    const hasParent = !!form.watch('parentId' as any);
    const childPages: Array<{ id: string; key: string; name: string }> = isNew ? [] : (entity?.children ?? []);
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
                <CollectionEntriesPanel pageId={params.id} schema={contentBlocks} />
            )}

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

            <div className="w-full mt-4">
                <Card>
                    <CardHeader>
                        <div className="text-lg font-semibold"><Trans>Page Details</Trans></div>
                    </CardHeader>
                    <CardContent>
                        <DetailFormGrid>
                        <TranslatableFormFieldWrapper
                            control={form.control}
                            name="name"
                            label={t`Name`}
                            render={({ field }) => (
                                <Input {...field} placeholder={t`Page name`} disabled={!isSuperAdmin} />
                            )}
                        />
                        <TranslatableFormFieldWrapper
                            control={form.control}
                            name="slug"
                            label={t`Slug`}
                            render={({ field }) => (
                                <Input {...field} placeholder={t`page-slug`} disabled={!isSuperAdmin} />
                            )}
                        />
                        {isSuperAdmin && (
                        <FormFieldWrapper
                            control={form.control}
                            name="key"
                            label={t`Key`}
                            render={({ field }) => (
                                <Input {...field} placeholder={t`e.g. homepage`} disabled={!isSuperAdmin} />
                            )}
                        />
                        )}
                        <FormFieldWrapper
                            control={form.control}
                            name="enabled"
                            label={t`Enabled`}
                            render={({ field }) => (
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={!isSuperAdmin}
                                />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="acceptsSubmissions"
                            label={t`Accepts Submissions`}
                            render={({ field }) => (
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={checked => {
                                        field.onChange(checked);
                                        if (checked) (form as any).setValue('isCollection', false, { shouldDirty: true });
                                    }}
                                    disabled={!isSuperAdmin}
                                />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name={'isCollection' as any}
                            label={t`Collection`}
                            render={({ field }) => (
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={checked => {
                                        field.onChange(checked);
                                        if (checked) form.setValue('acceptsSubmissions', false, { shouldDirty: true });
                                    }}
                                    disabled={!isSuperAdmin}
                                />
                            )}
                        />
                        {!hasParent && (
                        <FormFieldWrapper
                            control={form.control}
                            name={'pinnedInSidebar' as any}
                            label={t`Pin to Sidebar`}
                            render={({ field }) => (
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={!isSuperAdmin}
                                />
                            )}
                        />
                        )}
                        {(hasParent || form.watch('pinnedInSidebar')) && (
                            <FormFieldWrapper
                                control={form.control}
                                name={'sidebarOrder' as any}
                                label={hasParent ? t`Tab Order` : t`Sidebar Order`}
                                render={({ field }) => (
                                    <Input
                                        type="number"
                                        value={field.value ?? 0}
                                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                        disabled={!isSuperAdmin}
                                        className="w-24"
                                    />
                                )}
                            />
                        )}
                        {isSuperAdmin && form.watch('acceptsSubmissions') && (
                            <div>
                                <FormFieldWrapper
                                    control={form.control}
                                    name={'allowCustomerCreation' as any}
                                    label={t`Allow Customer Creation`}
                                    render={({ field }) => (
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    )}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    <Trans>When enabled, submissions can be converted to customers. Use these block keys:</Trans>{' '}
                                    <code>email</code> (<Trans>required</Trans>), <code>firstName</code>, <code>lastName</code>, <code>phone</code>
                                </p>
                            </div>
                        )}
                        {isSuperAdmin && (
                            <div>
                                <FormFieldWrapper
                                    control={form.control}
                                    name={'parentId' as any}
                                    label={t`Parent Page`}
                                    render={({ field }) => (
                                        <ParentPageSelect
                                            pageId={isNew ? undefined : params.id}
                                            value={field.value ?? null}
                                            onChange={field.onChange}
                                            disabled={childPages.length > 0}
                                        />
                                    )}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    {childPages.length > 0
                                        ? <Trans>This page has child pages, so it stays at the top level.</Trans>
                                        : <Trans>The page then shows as a tab of its parent. The site address does not change.</Trans>}
                                </p>
                            </div>
                        )}
                        {isSuperAdmin && (
                            <FormFieldWrapper
                                control={form.control}
                                name={'previewUrl' as any}
                                label={t`Address on the Site`}
                                render={({ field }) => (
                                    <Input {...field} value={field.value ?? ''} type="url" placeholder="https://" />
                                )}
                            />
                        )}
                    </DetailFormGrid>
                    </CardContent>
                </Card>
            </div>
        </>
    );

    return (
        <Page pageId="cms-page-detail" form={form} submitHandler={submitHandler} entity={entity}>
            <PageTitle>{title}</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    {viewOnSiteUrl && (
                        <Button
                            variant="outline"
                            render={<a href={viewOnSiteUrl} target="_blank" rel="noopener noreferrer" />}
                        >
                            <ExternalLinkIcon className="mr-2 h-4 w-4" />
                            <Trans>View on site</Trans>
                        </Button>
                    )}
                    {activeTab === CONTENT_TAB && (
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
                                <ChildPageTab pageId={String(child.id)} isSuperAdmin={isSuperAdmin} />
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

function SubmissionsPanel({ pageId, schema, allowCustomerCreation }: { pageId: string; schema: any[]; allowCustomerCreation: boolean }) {
    const { t } = useLingui();
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [customerMap, setCustomerMap] = useState<Map<string, string>>(new Map());

    const lookupExistingCustomers = useCallback(async (subs: any[]) => {
        if (!allowCustomerCreation) return;
        const emails = subs
            .map(sub => sub.data?.email)
            .filter((e): e is string => typeof e === 'string' && e.length > 0);
        const uniqueEmails = [...new Set(emails)];
        if (uniqueEmails.length === 0) return;

        const newMap = new Map<string, string>();
        // Query customers for each unique email (batch of in-filters not available, so query per email)
        await Promise.all(
            uniqueEmails.map(async (email) => {
                try {
                    const result = await api.query(getCustomersByEmailDocument, {
                        options: { filter: { emailAddress: { eq: email } }, take: 1 },
                    });
                    if (result.customers.items.length > 0) {
                        const customerId = result.customers.items[0].id;
                        for (const sub of subs) {
                            if (sub.data?.email === email) {
                                newMap.set(sub.id, customerId);
                            }
                        }
                    }
                } catch {
                    // Ignore lookup errors - button will just show "Create Customer"
                }
            }),
        );
        if (newMap.size > 0) {
            setCustomerMap(prev => {
                const merged = new Map(prev);
                for (const [k, v] of newMap) merged.set(k, v);
                return merged;
            });
        }
    }, [allowCustomerCreation]);

    const loadSubmissions = useCallback(async () => {
        const result = await api.query(formSubmissionsDocument, {
            pageId,
            options: { take: itemsPerPage, skip: (currentPage - 1) * itemsPerPage, sort: { createdAt: 'DESC' as any } },
        });
        const items = result.formSubmissions.items;
        setSubmissions(items);
        setTotalItems(result.formSubmissions.totalItems);
        lookupExistingCustomers(items);
    }, [pageId, currentPage, itemsPerPage, lookupExistingCustomers]);

    useEffect(() => {
        loadSubmissions();
    }, [loadSubmissions]);

    const handleDelete = async (id: string) => {
        await api.mutate(deleteFormSubmissionDocument, { id });
        toast.success(t`Submission deleted`);
        loadSubmissions();
    };

    const handleCreateCustomer = async (submissionId: string) => {
        try {
            const result = await api.mutate(createCustomerFromSubmissionDocument, { submissionId });
            const { customerId, existing } = result.createCustomerFromSubmission;
            if (existing) {
                toast.info(t`Customer already exists`);
            } else {
                toast.success(t`Customer created`);
            }
            setCustomerMap(prev => new Map(prev).set(submissionId, customerId));
        } catch (e: any) {
            toast.error(t`Failed to create customer`, {
                description: e?.message || t`Unknown error`,
            });
        }
    };

    const schemaFields = schema.filter(b => b.key);

    const formatCellValue = (type: string, value: any): string => {
        if (value == null || value === '') return '-';
        switch (type) {
            case 'BOOLEAN':
                return value ? t`Yes` : t`No`;
            case 'DATE':
                return new Date(value).toLocaleDateString();
            case 'IMAGE':
            case 'IMAGE_GALLERY':
                return value ? `[${t`Image`}]` : '-';
            case 'RICH_TEXT': {
                const stripped = String(value).replace(/<[^>]*>/g, '').trim();
                return stripped.length > 60 ? stripped.slice(0, 60) + '...' : stripped;
            }
            default: {
                const str = String(value);
                return str.length > 80 ? str.slice(0, 80) + '...' : str;
            }
        }
    };

    const columns = [
        {
            id: 'createdAt',
            header: t`Date`,
            accessorFn: (row: any) => new Date(row.createdAt).toLocaleDateString(),
        },
        ...schemaFields.map(block => ({
            id: block.key,
            header: block.translations?.[0]?.name || block.key,
            accessorFn: (row: any) => formatCellValue(block.type, row.data?.[block.key]),
        })),
        {
            id: '_actions',
            header: '',
            cell: ({ row }: any) => {
                const sub = row.original;
                const customerId = customerMap.get(sub.id);
                return (
                    <div className="flex items-center gap-1 justify-end">
                        {allowCustomerCreation && (
                            customerId ? (
                                <Button asChild variant="ghost" size="sm">
                                    <Link to={`/customers/${customerId}`}>
                                        <Trans>View Customer</Trans>
                                    </Link>
                                </Button>
                            ) : (
                                <Button type="button" variant="ghost" size="sm" onClick={() => handleCreateCustomer(sub.id)}>
                                    <Trans>Create Customer</Trans>
                                </Button>
                            )
                        )}
                        <Button asChild variant="ghost" size="sm">
                            <Link to={`/cms-pages/${pageId}/submissions/${sub.id}`}>
                                <EyeIcon className="h-3.5 w-3.5" />
                            </Link>
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(sub.id)}>
                            <TrashIcon className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                );
            },
            enableSorting: false,
            enableColumnFilter: false,
        },
    ];

    const defaultVisibility: Record<string, boolean> = {};
    schemaFields.forEach((block, i) => {
        if (i >= 5) defaultVisibility[block.key] = false;
    });

    return (
        <div className="w-full mt-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MailIcon className="h-5 w-5 text-muted-foreground" />
                            <span className="text-lg font-semibold"><Trans>Submissions</Trans></span>
                            <Badge variant="secondary">{totalItems}</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {submissions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                            <Trans>No submissions yet.</Trans>
                        </div>
                    ) : (
                        <PageBlockContext.Provider value={{ blockId: 'submissions-table', column: 'main' }}>
                            <DataTable
                                columns={columns as any}
                                data={submissions}
                                totalItems={totalItems}
                                page={currentPage}
                                itemsPerPage={itemsPerPage}
                                defaultColumnVisibility={defaultVisibility}
                                onPageChange={(_table, page, perPage) => {
                                    setCurrentPage(page);
                                    setItemsPerPage(perPage);
                                }}
                            />
                        </PageBlockContext.Provider>
                    )}
                </CardContent>
            </Card>
        </div>
    );
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
