import { graphql } from '@/graphql/graphql';
import { useNavigate } from '@tanstack/react-router';
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
    PlusIcon,
    TextIcon,
    ToggleLeftIcon,
    TrashIcon,
    TypeIcon,
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
    DetailFormGrid,
    FormFieldWrapper,
    Input,
    Page,
    PageActionBar,
    PageActionBarRight,
    PageBlock,
    PageLayout,
    PageTitle,
    RichTextEditor,
    Switch,
    Textarea,
    TranslatableFormFieldWrapper,
    detailPageRouteLoader,
    useDetailPage,
    usePermissions,
} from '@vendure/dashboard';
import { toast } from 'sonner';

const cmsPageDetailDocument = graphql(`
    query GetCmsPageDetail($id: ID!) {
        cmsPage(id: $id) {
            id
            createdAt
            updatedAt
            key
            enabled
            acceptsSubmissions
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

const formSubmissionsDocument = graphql(`
    query GetFormSubmissions($pageId: ID!, $options: FormSubmissionListOptions) {
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

const deleteFormSubmissionDocument = graphql(`
    mutation DeleteFormSubmission($id: ID!) {
        deleteFormSubmission(id: $id) {
            result
            message
        }
    }
`);

interface BlockTypeDefinition {
    value: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    group: 'text' | 'media' | 'data';
}

const BLOCK_TYPES: BlockTypeDefinition[] = [
    { value: 'TEXT_SHORT', label: 'Short Text', description: 'Single-line text with character limit', icon: TextIcon, group: 'text' },
    { value: 'TEXT_LONG', label: 'Long Text', description: 'Multi-line text for paragraphs', icon: AlignLeftIcon, group: 'text' },
    { value: 'RICH_TEXT', label: 'Rich Text', description: 'WYSIWYG editor with formatting', icon: TypeIcon, group: 'text' },
    { value: 'BOOLEAN', label: 'Boolean', description: 'Toggle with custom labels', icon: ToggleLeftIcon, group: 'data' },
    { value: 'ENUM', label: 'Options List', description: 'List of values, one per line', icon: ListIcon, group: 'data' },
    { value: 'IMAGE', label: 'Image', description: 'Single image with alt text', icon: ImageIcon, group: 'media' },
    { value: 'IMAGE_GALLERY', label: 'Image Gallery', description: 'Multiple images', icon: ImagesIcon, group: 'media' },
    { value: 'DATE', label: 'Date', description: 'Date and time picker', icon: CalendarIcon, group: 'data' },
    { value: 'NUMBER', label: 'Number', description: 'Numeric value', icon: HashIcon, group: 'data' },
];

const BLOCK_TYPE_GROUPS = [
    { key: 'text' as const, label: 'Text' },
    { key: 'media' as const, label: 'Media' },
    { key: 'data' as const, label: 'Data' },
];

function getBlockTypeInfo(type: string) {
    return BLOCK_TYPES.find(bt => bt.value === type);
}

function getBlockTypeIcon(type: string) {
    return getBlockTypeInfo(type)?.icon ?? TextIcon;
}

function prepareBlocksForMutation(blocks: any[]): any[] {
    return (blocks || [])
        .filter((b: any) => b.type)
        .map((b: any, i: number) => ({
            ...(b.id ? { id: b.id } : {}),
            type: b.type,
            key: b.key,
            position: i,
            enabled: b.enabled,
            featuredAssetId: b.featuredAssetId ?? null,
            metadata: b.metadata ?? null,
            dateValue: b.dateValue ?? null,
            numberValue: b.numberValue != null ? Number(b.numberValue) : null,
            translations: (b.translations || []).map((t: any) => ({
                ...(t.id ? { id: t.id } : {}),
                languageCode: t.languageCode,
                name: t.name,
                textContent: t.textContent ?? '',
                altText: t.altText ?? '',
            })),
        }));
}

function getBlockSummary(block: any): string {
    const typeInfo = getBlockTypeInfo(block.type);
    const label = typeInfo?.label ?? block.type;
    switch (block.type) {
        case 'TEXT_SHORT':
        case 'TEXT_LONG': {
            const text = block.translations?.[0]?.textContent ?? '';
            return text ? `${text.slice(0, 80)}${text.length > 80 ? '...' : ''}` : 'Empty';
        }
        case 'RICH_TEXT': {
            const html = block.translations?.[0]?.textContent ?? '';
            const stripped = html.replace(/<[^>]*>/g, '').trim();
            return stripped ? `${stripped.slice(0, 80)}${stripped.length > 80 ? '...' : ''}` : 'Empty';
        }
        case 'BOOLEAN': {
            const isTrue = block.numberValue === 1;
            const trueLabel = String(block.metadata?.trueLabel ?? 'Yes');
            const falseLabel = String(block.metadata?.falseLabel ?? 'No');
            return isTrue ? trueLabel : falseLabel;
        }
        case 'ENUM': {
            const text = block.translations?.[0]?.textContent ?? '';
            const count = text.split('\n').filter((l: string) => l.trim()).length;
            return count > 0 ? `${count} option${count !== 1 ? 's' : ''}` : 'Empty';
        }
        case 'IMAGE':
            return block.featuredAssetId ? 'Image selected' : 'No image';
        case 'IMAGE_GALLERY': {
            const count = block.metadata?.assetIds?.length ?? 0;
            return count > 0 ? `${count} image${count !== 1 ? 's' : ''}` : 'No images';
        }
        case 'DATE':
            return block.dateValue ? new Date(block.dateValue).toLocaleDateString() : 'Not set';
        case 'NUMBER':
            return block.numberValue != null ? String(block.numberValue) : 'Not set';
        default:
            return label;
    }
}

function getDefaultMetadata(type: string): Record<string, unknown> | null {
    switch (type) {
        case 'TEXT_SHORT':
            return { maxLength: 255 };
        case 'TEXT_LONG':
            return { maxLength: 2000 };
        case 'BOOLEAN':
            return { trueLabel: 'Yes', falseLabel: 'No' };
        case 'IMAGE_GALLERY':
            return { assetIds: [], assetPreviews: [] };
        default:
            return null;
    }
}

function CmsPageDetailPage({ route }: { route: any }) {
    const params = route.useParams();
    const isNew = params.id === 'new';
    const navigate = useNavigate();
    const { hasPermissions } = usePermissions();
    const isSuperAdmin = hasPermissions(['SuperAdmin']);

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
            name: page.name,
            slug: page.slug,
            translations: page.translations,
            contentBlocks: (page.contentBlocks || []).map((block: any) => ({
                id: block.id,
                type: block.type,
                key: block.key,
                position: block.position,
                enabled: block.enabled ?? true,
                featuredAssetId: block.featuredAsset?.id ?? null,
                metadata: block.metadata ?? getDefaultMetadata(block.type),
                dateValue: block.dateValue,
                numberValue: block.numberValue != null ? Number(block.numberValue) : null,
                _assetPreview: block.featuredAsset?.preview ?? null,
                translations: block.translations?.map((t: any) => ({
                    id: t.id,
                    languageCode: t.languageCode,
                    name: t.name,
                    textContent: t.textContent ?? '',
                    altText: t.altText ?? '',
                })) ?? [],
            })),
        }),
        transformCreateInput: (input: any) => {
            return {
                key: input.key,
                enabled: input.enabled,
                acceptsSubmissions: input.acceptsSubmissions ?? false,
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
                translations: input.translations,
                contentBlocks: prepareBlocksForMutation(input.contentBlocks),
            };
        },
        onSuccess: async (data: any) => {
            toast.success(isNew ? 'Page created' : 'Page updated');
            resetForm();
            if (isNew && data?.id) {
                await navigate({ to: `../$id`, params: { id: data.id } });
            }
        },
        onError: (error: unknown) => {
            toast.error('Failed to save page', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        },
    });

    const rawContentBlocks: any[] = form.watch('contentBlocks') ?? [];
    const contentBlocks = rawContentBlocks.filter((b: any) => b.type);

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

    const title = entity?.name || entity?.key || 'New Page';

    return (
        <Page pageId="cms-page-detail" form={form} submitHandler={submitHandler} entity={entity}>
            <PageTitle>{title}</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <Button type="submit" disabled={isNew && !isSuperAdmin}>{isNew ? 'Create' : 'Save'}</Button>
                </PageActionBarRight>
            </PageActionBar>
            <PageLayout>
                <PageBlock column="main" blockId="main-form" title="Page Details">
                    <DetailFormGrid>
                        <TranslatableFormFieldWrapper
                            control={form.control}
                            name="name"
                            label="Name"
                            render={({ field }) => (
                                <Input {...field} placeholder="Page name" disabled={!isSuperAdmin} />
                            )}
                        />
                        <TranslatableFormFieldWrapper
                            control={form.control}
                            name="slug"
                            label="Slug"
                            render={({ field }) => (
                                <Input {...field} placeholder="page-slug" disabled={!isSuperAdmin} />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="key"
                            label="Key"
                            render={({ field }) => (
                                <Input {...field} placeholder="e.g. homepage" disabled={!isSuperAdmin} />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="enabled"
                            label="Enabled"
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
                            label="Accepts Submissions"
                            render={({ field }) => (
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={!isSuperAdmin}
                                />
                            )}
                        />
                    </DetailFormGrid>
                </PageBlock>
            </PageLayout>

            <div className="w-full mt-4">
                <Card>
                    <CardHeader>
                        <div className="text-lg font-semibold">Content Sections</div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {contentBlocks.map((block, index) => {
                                const Icon = getBlockTypeIcon(block.type);
                                const typeInfo = getBlockTypeInfo(block.type);
                                const isExpanded = expandedBlocks.has(index);
                                const summary = getBlockSummary(block);
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
                                                <Badge variant="secondary" className="shrink-0">
                                                    {typeInfo?.label ?? block.type}
                                                </Badge>
                                                {block.key && (
                                                    <span className="text-sm font-medium shrink-0">
                                                        {block.key}
                                                    </span>
                                                )}
                                                {!isExpanded && (
                                                    <span className="text-sm text-muted-foreground truncate">
                                                        {summary}
                                                    </span>
                                                )}
                                            </div>
                                            {isSuperAdmin && (
                                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
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
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => removeBlock(index)}
                                                >
                                                    <TrashIcon className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                            )}
                                        </div>
                                        {isExpanded && (
                                            <CardContent className="px-5 pb-5 pt-0 border-t">
                                                <div className="grid gap-4 @md:grid-cols-2 pt-4">
                                                    <div>
                                                        <label className="text-sm font-medium">Key</label>
                                                        <Input
                                                            value={block.key}
                                                            onChange={e =>
                                                                updateBlockField(index, 'key', e.target.value)
                                                            }
                                                            placeholder="e.g. hero-title"
                                                            className="mt-1"
                                                            disabled={!isSuperAdmin}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium">Name</label>
                                                        <Input
                                                            value={block.translations?.[0]?.name ?? ''}
                                                            onChange={e =>
                                                                updateBlockTranslation(index, 'name', e.target.value)
                                                            }
                                                            placeholder="Section name"
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-4">
                                                    <BlockValueEditor
                                                        block={block}
                                                        index={index}
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

                            {contentBlocks.length === 0 && (
                                <div className="text-center py-16 text-muted-foreground border border-dashed rounded-lg">
                                    {isSuperAdmin ? 'No sections yet. Add one below.' : 'No sections yet.'}
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
                                    Add Section
                                </Button>
                                {addMenuOpen && (
                                    <div className="absolute z-10 mt-2 w-full bg-popover border rounded-lg shadow-lg p-5">
                                        {BLOCK_TYPE_GROUPS.map(group => {
                                            const groupTypes = BLOCK_TYPES.filter(bt => bt.group === group.key);
                                            return (
                                                <div key={group.key} className="mb-5 last:mb-0">
                                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                                        {group.label}
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
                                                                        <div className="text-sm font-medium">{bt.label}</div>
                                                                        <div className="text-xs text-muted-foreground">{bt.description}</div>
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

            {!isNew && entity?.acceptsSubmissions && (
                <SubmissionsPanel pageId={params.id} />
            )}
        </Page>
    );
}

function SubmissionsPanel({ pageId }: { pageId: string }) {
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const pageSize = 10;

    const loadSubmissions = useCallback(async () => {
        const result = await api.query(formSubmissionsDocument, {
            pageId,
            options: { take: pageSize, skip: currentPage * pageSize, sort: { createdAt: 'DESC' as any } },
        });
        setSubmissions(result.formSubmissions.items);
        setTotalItems(result.formSubmissions.totalItems);
    }, [pageId, currentPage]);

    useEffect(() => {
        loadSubmissions();
    }, [loadSubmissions]);

    const handleDelete = async (id: string) => {
        await api.mutate(deleteFormSubmissionDocument, { id });
        toast.success('Submission deleted');
        loadSubmissions();
    };

    const totalPages = Math.ceil(totalItems / pageSize);

    return (
        <div className="w-full mt-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MailIcon className="h-5 w-5 text-muted-foreground" />
                            <span className="text-lg font-semibold">Submissions</span>
                            <Badge variant="secondary">{totalItems}</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {submissions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                            No submissions yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {submissions.map((sub: any) => {
                                const isExpanded = expandedId === sub.id;
                                const data = sub.data as Record<string, unknown>;
                                const keys = Object.keys(data);
                                const preview = keys.slice(0, 3).map(k => `${k}: ${String(data[k]).slice(0, 40)}`).join(' · ');
                                return (
                                    <Card key={sub.id} className="border-border/60">
                                        <div
                                            className="flex items-center justify-between py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
                                            onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                {isExpanded
                                                    ? <ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    : <ChevronRightIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                }
                                                <span className="text-xs text-muted-foreground shrink-0">
                                                    {new Date(sub.createdAt).toLocaleString()}
                                                </span>
                                                {!isExpanded && (
                                                    <span className="text-sm text-muted-foreground truncate">
                                                        {preview}
                                                    </span>
                                                )}
                                            </div>
                                            <div onClick={e => e.stopPropagation()}>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => handleDelete(sub.id)}
                                                >
                                                    <TrashIcon className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <CardContent className="px-4 pb-4 pt-0 border-t">
                                                <div className="grid gap-2 pt-3">
                                                    {keys.map(key => (
                                                        <div key={key} className="flex gap-2">
                                                            <span className="text-sm font-medium min-w-[120px] text-muted-foreground">{key}</span>
                                                            <span className="text-sm break-all">{String(data[key])}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        )}
                                    </Card>
                                );
                            })}

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between pt-3">
                                    <span className="text-sm text-muted-foreground">
                                        Page {currentPage + 1} of {totalPages}
                                    </span>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={currentPage === 0}
                                            onClick={() => setCurrentPage(p => p - 1)}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={currentPage >= totalPages - 1}
                                            onClick={() => setCurrentPage(p => p + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function BlockValueEditor({
    block,
    index,
    onFieldChange,
    onFieldsChange,
    onMetadataChange,
    onTranslationChange,
}: {
    block: any;
    index: number;
    onFieldChange: (index: number, field: string, value: any) => void;
    onFieldsChange: (index: number, fields: Record<string, any>) => void;
    onMetadataChange: (index: number, key: string, value: any) => void;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    switch (block.type) {
        case 'TEXT_SHORT':
            return <TextShortEditor block={block} index={index} onTranslationChange={onTranslationChange} />;
        case 'TEXT_LONG':
            return <TextLongEditor block={block} index={index} onTranslationChange={onTranslationChange} />;
        case 'RICH_TEXT':
            return <RichTextBlockEditor block={block} index={index} onTranslationChange={onTranslationChange} />;
        case 'BOOLEAN':
            return <BooleanEditor block={block} index={index} onFieldChange={onFieldChange} onMetadataChange={onMetadataChange} />;
        case 'ENUM':
            return <EnumEditor block={block} index={index} onTranslationChange={onTranslationChange} />;
        case 'IMAGE':
            return <ImageEditor block={block} index={index} onFieldsChange={onFieldsChange} onTranslationChange={onTranslationChange} />;
        case 'IMAGE_GALLERY':
            return <ImageGalleryEditor block={block} index={index} onFieldChange={onFieldChange} />;
        case 'DATE':
            return (
                <div>
                    <label className="text-sm font-medium">Date</label>
                    <Input
                        type="datetime-local"
                        value={block.dateValue ? new Date(block.dateValue).toISOString().slice(0, 16) : ''}
                        onChange={e =>
                            onFieldChange(
                                index,
                                'dateValue',
                                e.target.value ? new Date(e.target.value).toISOString() : null,
                            )
                        }
                        className="mt-1"
                    />
                </div>
            );
        case 'NUMBER':
            return (
                <div>
                    <label className="text-sm font-medium">Number</label>
                    <Input
                        type="number"
                        value={block.numberValue ?? ''}
                        onChange={e =>
                            onFieldChange(
                                index,
                                'numberValue',
                                e.target.value ? Number(e.target.value) : null,
                            )
                        }
                        placeholder="0"
                        className="mt-1"
                    />
                </div>
            );
        default:
            return null;
    }
}

// --- Individual block type editors ---

function TextShortEditor({ block, index, onTranslationChange }: {
    block: any;
    index: number;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    const maxLength = block.metadata?.maxLength ?? 255;
    const currentValue = block.translations?.[0]?.textContent ?? '';
    return (
        <div>
            <label className="text-sm font-medium">Short Text</label>
            <Input
                value={currentValue}
                onChange={e => onTranslationChange(index, 'textContent', e.target.value)}
                placeholder="Enter text"
                maxLength={maxLength}
                className="mt-1"
            />
            <div className="text-xs text-muted-foreground text-right mt-1">
                {currentValue.length} / {maxLength}
            </div>
        </div>
    );
}

function TextLongEditor({ block, index, onTranslationChange }: {
    block: any;
    index: number;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    const maxLength = block.metadata?.maxLength ?? 2000;
    const currentValue = block.translations?.[0]?.textContent ?? '';
    return (
        <div>
            <label className="text-sm font-medium">Long Text</label>
            <Textarea
                value={currentValue}
                onChange={e => onTranslationChange(index, 'textContent', e.target.value)}
                placeholder="Enter text content..."
                maxLength={maxLength}
                rows={4}
                className="mt-1"
            />
            <div className="text-xs text-muted-foreground text-right mt-1">
                {currentValue.length} / {maxLength}
            </div>
        </div>
    );
}

function RichTextBlockEditor({ block, index, onTranslationChange }: {
    block: any;
    index: number;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    const currentValue = block.translations?.[0]?.textContent ?? '';
    return (
        <div>
            <label className="text-sm font-medium">Rich Text Content</label>
            <div className="mt-1">
                <RichTextEditor
                    value={currentValue}
                    onChange={(val: string) => onTranslationChange(index, 'textContent', val)}
                />
            </div>
        </div>
    );
}

function BooleanEditor({ block, index, onFieldChange, onMetadataChange }: {
    block: any;
    index: number;
    onFieldChange: (index: number, field: string, value: any) => void;
    onMetadataChange: (index: number, key: string, value: any) => void;
}) {
    const trueLabel = block.metadata?.trueLabel ?? 'Yes';
    const falseLabel = block.metadata?.falseLabel ?? 'No';
    const isTrue = block.numberValue === 1;
    const activeLabel = isTrue ? trueLabel : falseLabel;

    return (
        <div className="space-y-3">
            <div className="grid gap-3 @md:grid-cols-2">
                <div>
                    <label className="text-sm font-medium">True Label</label>
                    <Input
                        value={trueLabel}
                        onChange={e => onMetadataChange(index, 'trueLabel', e.target.value)}
                        placeholder="e.g. Show Banner"
                        className="mt-1"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium">False Label</label>
                    <Input
                        value={falseLabel}
                        onChange={e => onMetadataChange(index, 'falseLabel', e.target.value)}
                        placeholder="e.g. Hide Banner"
                        className="mt-1"
                    />
                </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                <Switch
                    checked={isTrue}
                    onCheckedChange={checked => onFieldChange(index, 'numberValue', checked ? 1 : 0)}
                />
                <span className="text-sm font-medium">{activeLabel}</span>
            </div>
        </div>
    );
}

function EnumEditor({ block, index, onTranslationChange }: {
    block: any;
    index: number;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    const currentValue = block.translations?.[0]?.textContent ?? '';
    const options = currentValue.split('\n').filter((line: string) => line.trim());

    return (
        <div>
            <label className="text-sm font-medium">Options</label>
            <p className="text-xs text-muted-foreground mb-1">Enter one option per line</p>
            <Textarea
                value={currentValue}
                onChange={e => onTranslationChange(index, 'textContent', e.target.value)}
                placeholder={"Small\nMedium\nLarge\nExtra Large"}
                rows={4}
                className="mt-1 font-mono text-sm"
            />
            {options.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                    {options.map((opt: string, i: number) => (
                        <Badge key={i} variant="secondary">{opt.trim()}</Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

function ImageEditor({ block, index, onFieldsChange, onTranslationChange }: {
    block: any;
    index: number;
    onFieldsChange: (index: number, fields: Record<string, any>) => void;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const assetPreview = block._assetPreview ?? block.featuredAsset?.preview;
    const hasAsset = !!block.featuredAssetId;

    return (
        <div className="space-y-3">
            <div className="flex items-start gap-4">
                {hasAsset && assetPreview ? (
                    <div className="relative group">
                        <img
                            src={`${assetPreview}?preset=thumb`}
                            alt=""
                            className="w-24 h-24 object-cover rounded-md border"
                        />
                        <button
                            type="button"
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onFieldsChange(index, { featuredAssetId: null, _assetPreview: null })}
                        >
                            <XIcon className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ) : (
                    <div className="w-24 h-24 border border-dashed rounded-md flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                    </div>
                )}
                <div className="flex-1 space-y-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPickerOpen(true)}
                    >
                        {hasAsset ? 'Change Image' : 'Select Image'}
                    </Button>
                    <div>
                        <label className="text-sm font-medium">Alt Text</label>
                        <Input
                            value={block.translations?.[0]?.altText ?? ''}
                            onChange={e => onTranslationChange(index, 'altText', e.target.value)}
                            placeholder="Image description"
                            className="mt-1"
                        />
                    </div>
                </div>
            </div>
            {pickerOpen && (
                <AssetPickerDialog
                    open={pickerOpen}
                    onClose={() => setPickerOpen(false)}
                    multiSelect={false}
                    onSelect={assets => {
                        if (assets.length > 0) {
                            const asset = assets[0];
                            onFieldsChange(index, { featuredAssetId: asset.id, _assetPreview: asset.preview });
                        }
                    }}
                />
            )}
        </div>
    );
}

function ImageGalleryEditor({ block, index, onFieldChange }: {
    block: any;
    index: number;
    onFieldChange: (index: number, field: string, value: any) => void;
}) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const assetIds: string[] = block.metadata?.assetIds ?? [];
    const assetPreviews: string[] = block.metadata?.assetPreviews ?? [];

    const updateGalleryMetadata = (newIds: string[], newPreviews: string[]) => {
        const newMetadata = { ...(block.metadata || {}), assetIds: newIds, assetPreviews: newPreviews };
        onFieldChange(index, 'metadata', newMetadata);
    };

    const removeAsset = (assetIndex: number) => {
        const newIds = assetIds.filter((_, i) => i !== assetIndex);
        const newPreviews = assetPreviews.filter((_, i) => i !== assetIndex);
        updateGalleryMetadata(newIds, newPreviews);
    };

    return (
        <div>
            <label className="text-sm font-medium">Images</label>
            <div className="flex gap-2 flex-wrap mt-2">
                {assetPreviews.map((preview, i) => (
                    <div key={assetIds[i] ?? i} className="relative group">
                        <img
                            src={`${preview}?preset=thumb`}
                            alt=""
                            className="w-20 h-20 object-cover rounded-md border"
                        />
                        <button
                            type="button"
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeAsset(i)}
                        >
                            <XIcon className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    className="w-20 h-20 border border-dashed rounded-md flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    onClick={() => setPickerOpen(true)}
                >
                    <PlusIcon className="h-6 w-6" />
                </button>
            </div>
            {assetIds.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Click + to add images</p>
            )}
            {pickerOpen && (
                <AssetPickerDialog
                    open={pickerOpen}
                    onClose={() => setPickerOpen(false)}
                    multiSelect={true}
                    onSelect={assets => {
                        if (assets.length > 0) {
                            const newIds = [...assetIds, ...assets.map(a => a.id)];
                            const newPreviews = [...assetPreviews, ...assets.map(a => a.preview)];
                            updateGalleryMetadata(newIds, newPreviews);
                        }
                    }}
                />
            )}
        </div>
    );
}

export const cmsPageDetail: DashboardRouteDefinition = {
    path: '/cms-pages/$id',
    loader: detailPageRouteLoader({
        queryDocument: cmsPageDetailDocument,
        breadcrumb: (isNew, entity) => [
            { path: '/cms-pages', label: 'Pages' },
            isNew ? 'New page' : entity?.name,
        ],
    }),
    component: route => <CmsPageDetailPage route={route} />,
};
