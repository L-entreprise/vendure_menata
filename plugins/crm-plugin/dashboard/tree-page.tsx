import { graphql } from '@/graphql/graphql';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api, Card, CardContent, DashboardRouteDefinition, Page, PageTitle } from '@vendure/dashboard';
import { NetworkIcon } from 'lucide-react';

import { CRM_NAV_SECTION } from './constants';
import { GROUP_TYPE_LABELS } from './group-labels';

const MAX_DEPTH = 5;

const treeDocument = graphql(`
    query CrmTreePage {
        crmGroupTree {
            parentIds
            group {
                id
                name
                crmCode
                crmGroupType
            }
        }
    }
`);

interface TreeGroup {
    id: string;
    name: string;
    crmCode: string;
    crmGroupType?: string | null;
}

function Branch({ group, childrenOf, depth }: Readonly<{ group: TreeGroup; childrenOf: Map<string, TreeGroup[]>; depth: number }>) {
    const { i18n: lingui } = useLingui();
    const type = group.crmGroupType && GROUP_TYPE_LABELS[group.crmGroupType];
    const children = depth < MAX_DEPTH ? (childrenOf.get(group.id) ?? []) : [];
    return (
        <li>
            <div className="flex flex-wrap items-baseline gap-x-3 py-1">
                <Link to="/customer-groups/$id" params={{ id: group.id }} className="font-medium hover:underline">
                    {group.name}
                </Link>
                <span className="text-sm text-muted-foreground">
                    {type ? lingui._(type) : ''} <span className="font-mono">{group.crmCode}</span>
                </span>
            </div>
            {children.length > 0 && (
                <ul className="ml-3 border-l pl-5">
                    {children.map(child => (
                        <Branch key={child.id} group={child} childrenOf={childrenOf} depth={depth + 1} />
                    ))}
                </ul>
            )}
        </li>
    );
}

/** G4: the whole group hierarchy. A group with two parents appears under both. */
function TreePage() {
    const { data } = useQuery({
        queryKey: ['crm-tree'],
        queryFn: () => api.query(treeDocument, {}) as Promise<any>,
    });
    const entries: Array<{ group: TreeGroup; parentIds: string[] }> = data?.crmGroupTree ?? [];
    const childrenOf = new Map<string, TreeGroup[]>();
    for (const entry of entries) {
        for (const parentId of entry.parentIds) {
            childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), entry.group]);
        }
    }
    const roots = entries.filter(entry => entry.parentIds.length === 0).map(entry => entry.group);

    return (
        <Page pageId="crm-tree">
            <PageTitle><Trans>Group tree</Trans></PageTitle>
            <Card className="mt-4">
                <CardContent className="pt-6">
                    {roots.length === 0 ? (
                        <p className="text-sm text-muted-foreground"><Trans>No customer group yet.</Trans></p>
                    ) : (
                        <ul>
                            {roots.map(root => <Branch key={root.id} group={root} childrenOf={childrenOf} depth={1} />)}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </Page>
    );
}

export const crmTreeRoute: DashboardRouteDefinition = {
    path: '/crm/tree',
    loader: () => ({ breadcrumb: () => i18n._(msg`Group tree`) }),
    component: () => <TreePage />,
    navMenuItem: {
        id: 'crm-tree',
        title: 'Arborescence',
        sectionId: CRM_NAV_SECTION,
        icon: NetworkIcon,
        order: 200,
    },
};
