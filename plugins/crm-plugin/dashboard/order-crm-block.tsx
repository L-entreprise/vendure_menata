import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api, PageContextValue, usePermissions } from '@vendure/dashboard';

import { CRM_ADMIN_PERMISSION } from './constants';
import { GroupPicker } from './group-picker';
import { useCrmAction } from './use-crm-action';

const orderCrmDocument = graphql(`
    query CrmOrderSummary($id: ID!) {
        order(id: $id) {
            id
            state
            crmSalesRepName
            crmCompany { id name }
            customer { id groups { id name crmGroupType } }
        }
        crmGroupTree { group { id name crmGroupType } }
    }
`);

const setCompanyDocument = graphql(`
    mutation CrmSetOrderCompany($orderId: ID!, $companyId: ID) {
        setOrderCompany(orderId: $orderId, companyId: $companyId) { id }
    }
`);

/**
 * O1 / O3 / O6: the company frozen on the order (or, on a draft, the one it will get) and
 * the sales rep. Only the super admin may change the company.
 */
export function OrderCrmBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const { t } = useLingui();
    const orderId: string | undefined = context.entity?.id;
    const isAdmin = usePermissions().hasPermissions([CRM_ADMIN_PERMISSION]);
    const { run, pending } = useCrmAction();
    const { data } = useQuery({
        queryKey: ['crm-order-summary', orderId, context.entity?.customer?.id],
        queryFn: () => api.query(orderCrmDocument, { id: orderId! }) as Promise<any>,
        enabled: !!orderId,
    });
    const order = data?.order;
    if (!order) {
        return null;
    }
    const frozen = order.crmCompany;
    const expected = order.customer?.groups?.find((group: any) => group.crmGroupType === 'company');
    const company = frozen ?? expected;
    const companies = (data.crmGroupTree as any[]).map(entry => entry.group).filter(group => group.crmGroupType === 'company' && group.id !== frozen?.id);

    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground"><Trans>Company</Trans></dt>
            <dd>
                {company ? (
                    <Link to="/customer-groups/$id" params={{ id: company.id }} className="font-medium hover:underline">{company.name}</Link>
                ) : (
                    <span className="text-muted-foreground">{order.customer ? <Trans>The customer has no company.</Trans> : <Trans>No company yet.</Trans>}</span>
                )}
                {!frozen && company && <p className="text-xs text-muted-foreground"><Trans>Frozen when the order is placed.</Trans></p>}
            </dd>
            <dt className="text-muted-foreground"><Trans>Sales rep</Trans></dt>
            <dd>{order.crmSalesRepName ?? <span className="text-muted-foreground"><Trans>Not recorded</Trans></span>}</dd>
            {isAdmin && order.state !== 'Draft' && (
                <dd className="col-span-2 pt-1">
                    <GroupPicker groups={companies} placeholder={t`Change the company`} actionLabel={t`Change`} disabled={pending}
                        onPick={companyId => run(() => api.mutate(setCompanyDocument, { orderId: order.id, companyId }), t`Company updated`)} />
                </dd>
            )}
        </dl>
    );
}
