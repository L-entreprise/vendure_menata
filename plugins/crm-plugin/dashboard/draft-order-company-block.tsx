import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { api, Button, PageContextValue } from '@vendure/dashboard';

import { addressLines, GroupAddress } from './group-addresses-block';
import { GroupPicker, SectionLabel } from './group-picker';
import { OrderCrmBlock } from './order-crm-block';
import { useCrmAction } from './use-crm-action';

const draftDocument = graphql(`
    query CrmDraftCompany($orderId: ID!) {
        order(id: $orderId) {
            id
            customer { id }
            crmCompany { id name customers(options: { take: 200, sort: { lastName: ASC } }) { items { id firstName lastName } } }
        }
        crmGroupTree { group { id name crmGroupType } }
    }
`);
const suggestionsDocument = graphql(`
    query CrmDraftSuggestions($customerId: ID!) {
        crmAddressSuggestions(customerId: $customerId) {
            source
            groupName
            address { id kind label fullName company streetLine1 streetLine2 city province postalCode countryCode phoneNumber defaultShipping defaultBilling }
        }
    }
`);
const setCompanyDocument = graphql(`
    mutation CrmSetDraftCompany($orderId: ID!, $companyId: ID!) { setDraftOrderCompany(orderId: $orderId, companyId: $companyId) { id } }
`);
const setCustomerDocument = graphql(`
    mutation CrmSetDraftCustomer($orderId: ID!, $customerId: ID!) {
        setCustomerForDraftOrder(orderId: $orderId, customerId: $customerId) { ... on Order { id } }
    }
`);
const shippingDocument = graphql(`
    mutation CrmDraftShipping($orderId: ID!, $input: CreateAddressInput!) { setDraftOrderShippingAddress(orderId: $orderId, input: $input) { id } }
`);
const billingDocument = graphql(`
    mutation CrmDraftBilling($orderId: ID!, $input: CreateAddressInput!) { setDraftOrderBillingAddress(orderId: $orderId, input: $input) { id } }
`);

/** The order receives a copy (A4): later edits of the company address never reach it. */
function toAddressInput(address: GroupAddress) {
    return {
        fullName: address.fullName, company: address.company, streetLine1: address.streetLine1, streetLine2: address.streetLine2,
        city: address.city, province: address.province, postalCode: address.postalCode, countryCode: address.countryCode, phoneNumber: address.phoneNumber,
    };
}

/** A2 / A3: order "by company": pick the company, then its contact, then a proposed address. */
export function DraftOrderCompanyBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const { t } = useLingui();
    const orderId: string | undefined = context.entity?.id;
    const { run, pending } = useCrmAction();
    const { data } = useQuery({
        queryKey: ['crm-draft-company', orderId, context.entity?.customer?.id],
        queryFn: () => api.query(draftDocument, { orderId: orderId! }) as Promise<any>,
        enabled: !!orderId,
    });
    const customerId: string | undefined = data?.order?.customer?.id;
    const { data: suggestions } = useQuery({
        queryKey: ['crm-draft-suggestions', customerId],
        queryFn: async () => ((await api.query(suggestionsDocument, { customerId: customerId! })) as any).crmAddressSuggestions as Array<{ source: string; groupName: string; address: GroupAddress }>,
        enabled: !!customerId,
    });
    if (!data?.order) {
        return null;
    }
    const company = data.order.crmCompany;
    const companies = (data.crmGroupTree as any[]).map(entry => entry.group).filter(group => group.crmGroupType === 'company' && group.id !== company?.id);
    const contacts = (company?.customers.items ?? []).map((c: any) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));

    return (
        <div className="space-y-4 text-sm">
            <OrderCrmBlock context={context} />
            {!customerId && (
                <div>
                    <SectionLabel><Trans>Order for a company</Trans></SectionLabel>
                    <GroupPicker groups={companies} placeholder={t`Choose a company`} actionLabel={company ? t`Change` : t`Choose`} disabled={pending}
                        onPick={companyId => run(() => api.mutate(setCompanyDocument, { orderId: orderId!, companyId }))} />
                    {company && (
                        <div className="mt-2">
                            <GroupPicker groups={contacts} placeholder={t`Choose the contact`} actionLabel={t`Choose`} disabled={pending}
                                onPick={id => run(() => api.mutate(setCustomerDocument, { orderId: orderId!, customerId: id }))} />
                            {contacts.length === 0 && <p className="mt-1 text-muted-foreground"><Trans>This company has no contact yet.</Trans></p>}
                        </div>
                    )}
                </div>
            )}
            {customerId && !!suggestions?.length && (
                <div>
                    <SectionLabel><Trans>Company addresses</Trans></SectionLabel>
                    <ul className="space-y-2">
                        {suggestions.map(({ address, groupName, source }) => (
                            <li key={address.id}>
                                <p>{address.label || groupName}{source === 'ancestor' && <span className="text-muted-foreground"> · {groupName}</span>}</p>
                                <p className="text-muted-foreground">{addressLines(address)}</p>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => api.mutate(shippingDocument, { orderId: orderId!, input: toAddressInput(address) }), t`Delivery address set`)}><Trans>For delivery</Trans></Button>
                                    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => api.mutate(billingDocument, { orderId: orderId!, input: toAddressInput(address) }), t`Billing address set`)}><Trans>For billing</Trans></Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
