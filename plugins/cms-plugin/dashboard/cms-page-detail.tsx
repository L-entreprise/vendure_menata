import { graphql } from '@/graphql/graphql';
import { useNavigate } from '@tanstack/react-router';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    CalendarIcon,
    HashIcon,
    ImageIcon,
    PlusIcon,
    TextIcon,
    TrashIcon,
    TypeIcon,
} from 'lucide-react';
import { useState } from 'react';
import {
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Textarea,
    detailPageRouteLoader,
    useDetailPage,
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
                textContent
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

const BLOCK_TYPES = [
    { value: 'TEXT', label: 'Text', icon: TextIcon },
    { value: 'RICH_TEXT', label: 'Rich Text', icon: TypeIcon },
    { value: 'IMAGE', label: 'Image', icon: ImageIcon },
    { value: 'DATE', label: 'Date', icon: CalendarIcon },
    { value: 'NUMBER', label: 'Number', icon: HashIcon },
] as const;

function getBlockTypeIcon(type: string) {
    return BLOCK_TYPES.find(bt => bt.value === type)?.icon ?? TextIcon;
}

function CmsPageDetailPage({ route }: { route: any }) {
    const params = route.useParams();
    const isNew = params.id === 'new';
    const navigate = useNavigate();

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
            translations: page.translations,
            contentBlocks: (page.contentBlocks || []).map((block: any) => ({
                id: block.id,
                type: block.type,
                key: block.key,
                position: block.position,
                enabled: block.enabled ?? true,
                featuredAssetId: block.featuredAsset?.id,
                dateValue: block.dateValue,
                numberValue: block.numberValue != null ? Number(block.numberValue) : null,
                translations: block.translations?.map((t: any) => ({
                    id: t.id,
                    languageCode: t.languageCode,
                    name: t.name,
                    textContent: t.textContent ?? '',
                    altText: t.altText ?? '',
                })) ?? [],
            })),
        }),
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

    const contentBlocks: any[] = form.watch('contentBlocks') ?? [];

    const addBlock = (type: string) => {
        const newBlock = {
            type,
            key: '',
            position: contentBlocks.length,
            enabled: true,
            featuredAssetId: null,
            dateValue: null,
            numberValue: null,
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

    const title = entity?.name ?? 'New Page';

    return (
        <Page pageId="cms-page-detail" form={form} submitHandler={submitHandler} entity={entity}>
            <PageTitle>{title}</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <Button type="submit">{isNew ? 'Create' : 'Save'}</Button>
                </PageActionBarRight>
            </PageActionBar>
            <PageLayout>
                <PageBlock column="main" blockId="main-form" title="Page Details">
                    <DetailFormGrid>
                        <FormFieldWrapper
                            control={form.control}
                            name="key"
                            label="Key"
                            render={({ field }) => (
                                <Input {...field} placeholder="e.g. homepage" />
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
                                />
                            )}
                        />
                    </DetailFormGrid>
                </PageBlock>

                <PageBlock column="main" blockId="content-blocks" title="Content Sections">
                    <div className="space-y-3">
                        {contentBlocks.map((block, index) => {
                            const Icon = getBlockTypeIcon(block.type);
                            return (
                                <Card key={block.id ?? `new-${index}`}>
                                    <CardHeader className="py-3 px-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4 text-muted-foreground" />
                                                <Badge variant="secondary">{block.type}</Badge>
                                                <span className="text-sm text-muted-foreground">
                                                    #{index + 1}
                                                </span>
                                                {block.key && (
                                                    <span className="text-sm font-medium">
                                                        {block.key}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    disabled={index === 0}
                                                    onClick={() => moveBlock(index, 'up')}
                                                >
                                                    <ArrowUpIcon className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    disabled={index === contentBlocks.length - 1}
                                                    onClick={() => moveBlock(index, 'down')}
                                                >
                                                    <ArrowDownIcon className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => removeBlock(index)}
                                                >
                                                    <TrashIcon className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="py-3 px-4 pt-0">
                                        <div className="grid gap-3 @md:grid-cols-2">
                                            <div>
                                                <label className="text-sm font-medium">Key</label>
                                                <Input
                                                    value={block.key}
                                                    onChange={e =>
                                                        updateBlockField(index, 'key', e.target.value)
                                                    }
                                                    placeholder="e.g. hero-title"
                                                    className="mt-1"
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
                                        <div className="mt-3">
                                            <BlockValueEditor
                                                block={block}
                                                index={index}
                                                onFieldChange={updateBlockField}
                                                onTranslationChange={updateBlockTranslation}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}

                        {contentBlocks.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md">
                                No sections yet. Add one below.
                            </div>
                        )}

                        <div className="relative">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={() => setAddMenuOpen(!addMenuOpen)}
                            >
                                <PlusIcon className="mr-2 h-4 w-4" />
                                Add Section
                            </Button>
                            {addMenuOpen && (
                                <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-md p-1">
                                    {BLOCK_TYPES.map(bt => {
                                        const Icon = bt.icon;
                                        return (
                                            <button
                                                key={bt.value}
                                                type="button"
                                                className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded hover:bg-accent hover:text-accent-foreground"
                                                onClick={() => {
                                                    addBlock(bt.value);
                                                    setAddMenuOpen(false);
                                                }}
                                            >
                                                <Icon className="h-4 w-4" />
                                                {bt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </PageBlock>
            </PageLayout>
        </Page>
    );
}

function BlockValueEditor({
    block,
    index,
    onFieldChange,
    onTranslationChange,
}: {
    block: any;
    index: number;
    onFieldChange: (index: number, field: string, value: any) => void;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    switch (block.type) {
        case 'TEXT':
            return (
                <div>
                    <label className="text-sm font-medium">Text Content</label>
                    <Input
                        value={block.translations?.[0]?.textContent ?? ''}
                        onChange={e => onTranslationChange(index, 'textContent', e.target.value)}
                        placeholder="Enter text"
                        className="mt-1"
                    />
                </div>
            );
        case 'RICH_TEXT':
            return (
                <div>
                    <label className="text-sm font-medium">Markdown Content</label>
                    <Textarea
                        value={block.translations?.[0]?.textContent ?? ''}
                        onChange={e => onTranslationChange(index, 'textContent', e.target.value)}
                        placeholder="Enter markdown content..."
                        rows={4}
                        className="mt-1 font-mono text-sm"
                    />
                </div>
            );
        case 'IMAGE':
            return (
                <div className="grid gap-3 @md:grid-cols-2">
                    <div>
                        <label className="text-sm font-medium">Asset ID</label>
                        <Input
                            value={block.featuredAssetId ?? ''}
                            onChange={e =>
                                onFieldChange(index, 'featuredAssetId', e.target.value || null)
                            }
                            placeholder="Asset ID"
                            className="mt-1"
                        />
                    </div>
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
            );
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
