import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api, PageContextValue } from '@vendure/dashboard';

import { GROUP_TYPE_LABELS } from './group-labels';

const customerGroupsDocument = graphql(`
    query CrmCustomerGroups($id: ID!) {
        customer(id: $id) {
            id
            groups {
                id
                name
                crmGroupType
            }
        }
    }
`);

interface CrmGroup {
    id: string;
    name: string;
    crmGroupType?: string | null;
}

/**
 * C5: the customer's single company first, then their other groups. Shared by the
 * customer page and the draft order page (A2 starts from the company of the contact).
 */
function CustomerCompany({ customerId }: Readonly<{ customerId: string }>) {
    const { i18n } = useLingui();
    const { data, isPending, isError } = useQuery({
        queryKey: ['crm-customer-groups', customerId],
        queryFn: () => api.query(customerGroupsDocument, { id: customerId }),
    });

    if (isPending) {
        return null;
    }
    if (isError) {
        return (
            <p className="text-sm text-destructive">
                <Trans>Could not load the company.</Trans>
            </p>
        );
    }

    const groups = ((data as any)?.customer?.groups ?? []) as CrmGroup[];
    const company = groups.find(group => group.crmGroupType === 'company');
    const others = groups.filter(group => group !== company);

    return (
        <div className="space-y-3 text-sm">
            {company ? (
                <Link to="/customer-groups/$id" params={{ id: company.id }} className="font-medium hover:underline">
                    {company.name}
                </Link>
            ) : (
                <p className="text-muted-foreground">
                    <Trans>No company yet.</Trans>
                </p>
            )}
            {others.length > 0 && (
                <ul className="space-y-1 text-muted-foreground">
                    {others.map(group => {
                        const type = group.crmGroupType;
                        return (
                            <li key={group.id}>
                                {group.name}
                                {type && GROUP_TYPE_LABELS[type] ? ` · ${i18n._(GROUP_TYPE_LABELS[type])}` : ''}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export function CustomerCompanyBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const customerId = context.entity?.id;
    return customerId ? <CustomerCompany customerId={customerId} /> : null;
}

export function DraftOrderCompanyBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const customerId = context.entity?.customer?.id;
    if (!customerId) {
        return (
            <p className="text-sm text-muted-foreground">
                <Trans>Pick a customer to see their company.</Trans>
            </p>
        );
    }
    return <CustomerCompany customerId={customerId} />;
}
