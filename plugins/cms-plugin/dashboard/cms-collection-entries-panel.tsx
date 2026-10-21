import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    api,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    DataTable,
    PageBlockContext,
} from '@vendure/dashboard';
import { toast } from 'sonner';

// Also used by the submissions panel of the page editor.
export const formSubmissionsDocument = graphql(`
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

export const deleteFormSubmissionDocument = graphql(`
    mutation DeleteFormSubmission($id: ID!) {
        deleteFormSubmission(id: $id) {
            result
            message
        }
    }
`);

export function CollectionEntriesPanel({ pageId, schema, title }: { pageId: string; schema: any[]; title?: string }) {
    const { t } = useLingui();
    const [entries, setEntries] = useState<any[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const loadEntries = useCallback(async () => {
        const result = await api.query(formSubmissionsDocument, {
            pageId,
            options: { take: itemsPerPage, skip: (currentPage - 1) * itemsPerPage, sort: { createdAt: 'DESC' as any } },
        });
        setEntries(result.formSubmissions.items);
        setTotalItems(result.formSubmissions.totalItems);
    }, [pageId, currentPage, itemsPerPage]);

    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const handleDelete = async (id: string) => {
        await api.mutate(deleteFormSubmissionDocument, { id });
        toast.success(t`Entry deleted`);
        loadEntries();
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
            cell: ({ row }: any) => (
                <div className="flex items-center gap-1 justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        render={<Link to={`/cms-pages/${pageId}/entries/${row.original.id}`} />}
                    >
                        <Trans>Edit</Trans>
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(row.original.id)}>
                        <TrashIcon className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
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
                            <span className="text-lg font-semibold">{title ?? <Trans>Collection Entries</Trans>}</span>
                            <Badge variant="secondary">{totalItems}</Badge>
                        </div>
                        <Button render={<Link to={`/cms-pages/${pageId}/entries/new`} />}>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            <Trans>Add Entry</Trans>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {entries.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                            <Trans>No entries yet. Add one above.</Trans>
                        </div>
                    ) : (
                        <PageBlockContext.Provider value={{ blockId: 'collection-entries-table', column: 'main' }}>
                            <DataTable
                                columns={columns as any}
                                data={entries}
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
