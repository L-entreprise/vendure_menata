import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import {
    api,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    DashboardRouteDefinition,
    Input,
    Page,
    PageTitle,
} from '@vendure/dashboard';
import { ChevronDownIcon, ChevronRightIcon, ShieldIcon } from 'lucide-react';

const auditLogDocument = graphql(`
    query GetAuditLog($options: AuditLogEntryListOptions) {
        auditLog(options: $options) {
            items {
                id
                createdAt
                action
                entityType
                entityId
                userId
                userName
                detail
            }
            totalItems
        }
    }
`);

function AuditLogListPage() {
    const { t } = useLingui();
    const [entries, setEntries] = useState<any[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filterAction, setFilterAction] = useState('');
    const pageSize = 20;

    const loadEntries = useCallback(async () => {
        const result = await api.query(auditLogDocument, {
            options: {
                take: pageSize,
                skip: currentPage * pageSize,
                sort: { createdAt: 'DESC' as any },
                ...(filterAction ? { filter: { action: { contains: filterAction } } } : {}),
            },
        });
        setEntries(result.auditLog.items);
        setTotalItems(result.auditLog.totalItems);
    }, [currentPage, filterAction]);

    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return (
        <Page>
            <PageTitle><Trans>Audit Log</Trans></PageTitle>
            <div className="w-full mt-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldIcon className="h-5 w-5 text-muted-foreground" />
                                <span className="text-lg font-semibold"><Trans>Activity Log</Trans></span>
                                <Badge variant="secondary">{totalItems}</Badge>
                            </div>
                            <Input
                                placeholder={t`Filter by action...`}
                                value={filterAction}
                                onChange={e => {
                                    setFilterAction(e.target.value);
                                    setCurrentPage(0);
                                }}
                                className="w-64"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {entries.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                                <Trans>No audit log entries found.</Trans>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {entries.map((entry: any) => {
                                    const isExpanded = expandedId === entry.id;
                                    return (
                                        <div
                                            key={entry.id}
                                            className="border rounded-md"
                                        >
                                            <div
                                                className="flex items-center gap-3 py-2 px-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                            >
                                                {isExpanded
                                                    ? <ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    : <ChevronRightIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                }
                                                <span className="text-xs text-muted-foreground shrink-0 w-36">
                                                    {new Date(entry.createdAt).toLocaleString()}
                                                </span>
                                                <Badge variant="outline" className="shrink-0">{entry.action}</Badge>
                                                {entry.entityType && (
                                                    <span className="text-sm text-muted-foreground">
                                                        {entry.entityType}
                                                        {entry.entityId ? ` #${entry.entityId}` : ''}
                                                    </span>
                                                )}
                                                <span className="text-sm text-muted-foreground ml-auto shrink-0">
                                                    {entry.userName}
                                                </span>
                                            </div>
                                            {isExpanded && entry.detail && (
                                                <div className="px-3 pb-3 pt-0 border-t">
                                                    <pre className="text-xs bg-muted/50 p-2 rounded mt-2 overflow-auto">
                                                        {JSON.stringify(entry.detail, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-3">
                                        <span className="text-sm text-muted-foreground">
                                            <Trans>Page {currentPage + 1} of {totalPages}</Trans>
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={currentPage === 0}
                                                onClick={() => setCurrentPage(p => p - 1)}
                                            >
                                                <Trans>Previous</Trans>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={currentPage >= totalPages - 1}
                                                onClick={() => setCurrentPage(p => p + 1)}
                                            >
                                                <Trans>Next</Trans>
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </Page>
    );
}

export const auditLogList: DashboardRouteDefinition = {
    path: '/audit-log',
    component: () => <AuditLogListPage />,
    navMenuItem: {
        id: 'audit-log',
        title: 'Audit Log',
        sectionId: 'settings',
        icon: ShieldIcon,
        order: 900,
        requiresPermission: 'SuperAdmin',
    },
};
