import { graphql } from '@/graphql/graphql';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api, Button, Card, CardContent, CardHeader, CardTitle, DashboardRouteDefinition, Page, PageTitle } from '@vendure/dashboard';
import { ScanSearchIcon } from 'lucide-react';
import { useState } from 'react';

import { CRM_ADMIN_PERMISSION, CRM_NAV_SECTION } from './constants';
import { useCrmAction } from './use-crm-action';

const auditDocument = graphql(`
    query CrmAudit {
        crmDuplicateEmails { email customers { id crmCode firstName lastName createdAt orders { totalItems } } }
        crmCompanyConflicts { customer { id crmCode firstName lastName } companies { id name } }
    }
`);
const mergeDocument = graphql(`
    mutation CrmMergeCustomers($sourceId: ID!, $targetId: ID!) { mergeCustomers(sourceId: $sourceId, targetId: $targetId) { id } }
`);

interface DuplicateCustomer {
    id: string;
    crmCode: string;
    firstName: string;
    lastName: string;
    createdAt: string;
    orders: { totalItems: number };
}

/** D3: pick the customer to keep; the others are merged into it one by one. */
function DuplicateRow({ email, customers }: Readonly<{ email: string; customers: DuplicateCustomer[] }>) {
    const { t } = useLingui();
    const { run, pending } = useCrmAction();
    const [keepId, setKeepId] = useState(customers[0].id);
    const mergeAll = () =>
        run(async () => {
            for (const other of customers.filter(c => c.id !== keepId)) {
                await api.mutate(mergeDocument, { sourceId: other.id, targetId: keepId });
            }
        }, t`Customers merged`);
    return (
        <li className="py-3">
            <p className="font-medium">{email}</p>
            <ul className="mt-1 space-y-1">
                {customers.map(customer => (
                    <li key={customer.id}>
                        <label className="flex items-center gap-2">
                            <input type="radio" name={`keep-${email}`} checked={keepId === customer.id} onChange={() => setKeepId(customer.id)} />
                            <Link to="/customers/$id" params={{ id: customer.id }} className="hover:underline">{customer.firstName} {customer.lastName}</Link>
                            <span className="text-muted-foreground">{customer.crmCode} · {customer.orders.totalItems} <Trans>order(s)</Trans></span>
                        </label>
                    </li>
                ))}
            </ul>
            <Button size="sm" variant="outline" className="mt-2" disabled={pending} onClick={mergeAll}><Trans>Merge into the selected customer</Trans></Button>
        </li>
    );
}

/** Migration audits: duplicate e-mails (D3) and customers in several companies (R3). Super admin only. */
function AuditPage() {
    const { data } = useQuery({ queryKey: ['crm-audit'], queryFn: () => api.query(auditDocument, {}) as Promise<any> });
    return (
        <Page pageId="crm-audit">
            <PageTitle><Trans>CRM audit</Trans></PageTitle>
            <div className="mt-4 grid max-w-4xl gap-6 text-sm">
                <Card>
                    <CardHeader><CardTitle><Trans>Duplicate e-mails</Trans></CardTitle></CardHeader>
                    <CardContent>
                        {data?.crmDuplicateEmails.length === 0 && <p className="text-muted-foreground"><Trans>No duplicate.</Trans></p>}
                        <ul className="divide-y">{data?.crmDuplicateEmails.map((d: any) => <DuplicateRow key={d.email} email={d.email} customers={d.customers} />)}</ul>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle><Trans>Customers in several companies</Trans></CardTitle></CardHeader>
                    <CardContent>
                        {data?.crmCompanyConflicts.length === 0 && <p className="text-muted-foreground"><Trans>None: each customer has one company at most.</Trans></p>}
                        <ul className="divide-y">
                            {data?.crmCompanyConflicts.map((c: any) => (
                                <li key={c.customer.id} className="py-2">
                                    <Link to="/customers/$id" params={{ id: c.customer.id }} className="font-medium hover:underline">{c.customer.firstName} {c.customer.lastName}</Link>
                                    <span className="text-muted-foreground"> · {c.companies.map((g: any) => g.name).join(', ')}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </Page>
    );
}

export const crmAuditRoute: DashboardRouteDefinition = {
    path: '/crm/audit',
    loader: () => ({ breadcrumb: () => i18n._(msg`CRM audit`) }),
    component: () => <AuditPage />,
    navMenuItem: { id: 'crm-audit', title: 'Audit CRM', sectionId: CRM_NAV_SECTION, icon: ScanSearchIcon, order: 800, requiresPermission: CRM_ADMIN_PERMISSION },
};
