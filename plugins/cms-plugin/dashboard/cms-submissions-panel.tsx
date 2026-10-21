import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { EyeIcon, MailIcon, TrashIcon } from 'lucide-react';
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

import { deleteFormSubmissionDocument, formSubmissionsDocument } from './cms-collection-entries-panel';

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


export function SubmissionsPanel({ pageId, schema, allowCustomerCreation }: { pageId: string; schema: any[]; allowCustomerCreation: boolean }) {
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
                                <Button variant="ghost" size="sm" render={<Link to={`/customers/${customerId}`} />}>
                                    <Trans>View Customer</Trans>
                                </Button>
                            ) : (
                                <Button type="button" variant="ghost" size="sm" onClick={() => handleCreateCustomer(sub.id)}>
                                    <Trans>Create Customer</Trans>
                                </Button>
                            )
                        )}
                        <Button variant="ghost" size="sm" render={<Link to={`/cms-pages/${pageId}/submissions/${sub.id}`} />}>
                            <EyeIcon className="h-3.5 w-3.5" />
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
