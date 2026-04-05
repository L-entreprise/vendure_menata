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
import {
    AlertTriangleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    InfoIcon,
    ShieldAlertIcon,
    ShieldIcon,
} from 'lucide-react';

const auditLogDocument = graphql(`
    query GetAuditLog($options: AuditLogEntryListOptions) {
        auditLog(options: $options) {
            items {
                id
                createdAt
                action
                category
                entityType
                entityId
                userId
                userName
                apiType
                ipAddress
                severity
                success
                detail
            }
            totalItems
        }
    }
`);

const auditLogStatsDocument = graphql(`
    query GetAuditLogStats {
        auditLogStats {
            totalEntries
            todayEntries
            categories {
                category
                count
            }
            topUsers {
                userName
                count
            }
        }
    }
`);

const CATEGORIES = [
    { value: '', label: 'All Categories' },
    { value: 'auth', label: 'Authentication' },
    { value: 'catalog', label: 'Catalog' },
    { value: 'order', label: 'Orders' },
    { value: 'payment', label: 'Payments' },
    { value: 'fulfillment', label: 'Fulfillment' },
    { value: 'customer', label: 'Customers' },
    { value: 'promotion', label: 'Promotions' },
    { value: 'stock', label: 'Stock' },
    { value: 'system', label: 'System' },
    { value: 'settings', label: 'Settings' },
    { value: 'cms', label: 'CMS' },
    { value: 'translation', label: 'Translation' },
];

const SEVERITY_OPTIONS = [
    { value: '', label: 'All Severity' },
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'critical', label: 'Critical' },
];

const CATEGORY_COLORS: Record<string, string> = {
    auth: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    catalog: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    order: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    payment: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    fulfillment: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    customer: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    promotion: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    stock: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    system: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    settings: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
    cms: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    translation: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

function SeverityIcon({ severity }: { severity: string }) {
    switch (severity) {
        case 'critical':
            return <ShieldAlertIcon className="h-4 w-4 text-red-500" />;
        case 'warning':
            return <AlertTriangleIcon className="h-4 w-4 text-yellow-500" />;
        default:
            return <InfoIcon className="h-4 w-4 text-blue-400" />;
    }
}

function AuditLogListPage() {
    const { t } = useLingui();
    const [entries, setEntries] = useState<any[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filterAction, setFilterAction] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterSeverity, setFilterSeverity] = useState('');
    const [stats, setStats] = useState<any>(null);
    const pageSize = 25;

    const loadStats = useCallback(async () => {
        try {
            const result = await api.query(auditLogStatsDocument, {});
            setStats(result.auditLogStats);
        } catch {
            // non-blocking
        }
    }, []);

    const loadEntries = useCallback(async () => {
        const filter: Record<string, any> = {};
        if (filterAction) {
            filter.action = { contains: filterAction };
        }
        if (filterCategory) {
            filter.category = { eq: filterCategory };
        }
        if (filterSeverity) {
            filter.severity = { eq: filterSeverity };
        }

        const result = await api.query(auditLogDocument, {
            options: {
                take: pageSize,
                skip: currentPage * pageSize,
                sort: { createdAt: 'DESC' as any },
                ...(Object.keys(filter).length > 0 ? { filter } : {}),
            },
        });
        setEntries(result.auditLog.items);
        setTotalItems(result.auditLog.totalItems);
    }, [currentPage, filterAction, filterCategory, filterSeverity]);

    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const totalPages = Math.ceil(totalItems / pageSize);

    const isFromTo = (v: unknown): v is { from: unknown; to: unknown } =>
        v != null && typeof v === 'object' && 'from' in v && 'to' in v;

    const formatValue = (v: unknown): string => {
        if (v === null || v === undefined) return '(empty)';
        if (typeof v === 'string') return v.length > 120 ? v.slice(0, 120) + '...' : v;
        if (typeof v === 'boolean' || typeof v === 'number') return String(v);
        return JSON.stringify(v);
    };

    const renderDetail = (rawDetail: any) => {
        if (!rawDetail) return null;
        let detail: any;
        if (typeof rawDetail === 'string') {
            try { detail = JSON.parse(rawDetail); } catch { detail = rawDetail; }
        } else {
            detail = rawDetail;
        }
        if (typeof detail !== 'object' || detail === null) {
            return <pre className="text-xs bg-muted/50 p-2 rounded mt-2">{String(detail)}</pre>;
        }
        const changes = detail.changes;
        const rest = { ...detail };
        delete rest.changes;
        const hasRest = Object.keys(rest).length > 0;

        return (
            <div className="mt-2 space-y-2">
                {changes && typeof changes === 'object' && (
                    <div className="bg-muted/50 rounded p-2 text-xs space-y-1">
                        <div className="font-medium text-muted-foreground mb-1">Changes:</div>
                        {Object.entries(changes).map(([field, value]) => (
                            <div key={field} className="flex items-start gap-2">
                                <span className="font-medium min-w-[100px]">{field}</span>
                                {isFromTo(value) ? (
                                    <span>
                                        <span className="text-red-500 line-through">{formatValue(value.from)}</span>
                                        {' → '}
                                        <span className="text-green-600">{formatValue(value.to)}</span>
                                    </span>
                                ) : (
                                    <span className="text-green-600">{formatValue(value)}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {hasRest && (
                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-64">
                        {JSON.stringify(rest, null, 2)}
                    </pre>
                )}
            </div>
        );
    };

    return (
        <Page>
            <PageTitle><Trans>Audit Log</Trans></PageTitle>
            <div className="w-full mt-4 space-y-4">
                {/* Stats cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card>
                            <CardContent className="pt-4 pb-3 px-4">
                                <div className="text-2xl font-bold">{stats.totalEntries.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground"><Trans>Total Events</Trans></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4 pb-3 px-4">
                                <div className="text-2xl font-bold">{stats.todayEntries.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground"><Trans>Today</Trans></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4 pb-3 px-4">
                                <div className="text-2xl font-bold">{stats.categories?.length ?? 0}</div>
                                <div className="text-xs text-muted-foreground"><Trans>Active Categories</Trans></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4 pb-3 px-4">
                                <div className="text-2xl font-bold">{stats.topUsers?.length ?? 0}</div>
                                <div className="text-xs text-muted-foreground"><Trans>Active Users</Trans></div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Main log card */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShieldIcon className="h-5 w-5 text-muted-foreground" />
                                    <span className="text-lg font-semibold"><Trans>Activity Log</Trans></span>
                                    <Badge variant="secondary">{totalItems}</Badge>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    placeholder={t`Filter by action...`}
                                    value={filterAction}
                                    onChange={e => {
                                        setFilterAction(e.target.value);
                                        setCurrentPage(0);
                                    }}
                                    className="w-48"
                                />
                                <select
                                    value={filterCategory}
                                    onChange={e => {
                                        setFilterCategory(e.target.value);
                                        setCurrentPage(0);
                                    }}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    {CATEGORIES.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                                <select
                                    value={filterSeverity}
                                    onChange={e => {
                                        setFilterSeverity(e.target.value);
                                        setCurrentPage(0);
                                    }}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    {SEVERITY_OPTIONS.map(s => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                                {(filterAction || filterCategory || filterSeverity) && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setFilterAction('');
                                            setFilterCategory('');
                                            setFilterSeverity('');
                                            setCurrentPage(0);
                                        }}
                                    >
                                        <Trans>Clear filters</Trans>
                                    </Button>
                                )}
                            </div>
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
                                            className={`border rounded-md ${!entry.success ? 'border-red-300 dark:border-red-800' : ''}`}
                                        >
                                            <div
                                                className="flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                            >
                                                {isExpanded
                                                    ? <ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    : <ChevronRightIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                }
                                                <SeverityIcon severity={entry.severity} />
                                                <span className="text-xs text-muted-foreground shrink-0 w-36">
                                                    {new Date(entry.createdAt).toLocaleString()}
                                                </span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other}`}>
                                                    {entry.category}
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
                                            {isExpanded && (
                                                <div className="px-3 pb-3 pt-0 border-t">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                                                        <div>
                                                            <span className="text-muted-foreground">User ID:</span>{' '}
                                                            {entry.userId ?? 'N/A'}
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">API:</span>{' '}
                                                            {entry.apiType ?? 'N/A'}
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">IP:</span>{' '}
                                                            {entry.ipAddress ?? 'N/A'}
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Success:</span>{' '}
                                                            {entry.success ? 'Yes' : 'No'}
                                                        </div>
                                                    </div>
                                                    {entry.detail && renderDetail(entry.detail)}
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
