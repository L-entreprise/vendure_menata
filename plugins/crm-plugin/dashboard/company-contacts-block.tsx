import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api, NativeSelect, NativeSelectOption, PageContextValue } from '@vendure/dashboard';
import { useState } from 'react';

import { optionLabel, useCrmSettings } from './use-crm-settings';

const CONTACTS_LIMIT = 200;

const contactsDocument = graphql(`
    query CrmCompanyContacts($id: ID!, $take: Int!) {
        customerGroup(id: $id) {
            id
            crmGroupType
            customers(options: { take: $take, sort: { lastName: ASC } }) {
                totalItems
                items {
                    id
                    firstName
                    lastName
                    emailAddress
                    customFields {
                        companyRoles
                    }
                }
            }
        }
    }
`);

interface Contact {
    id: string;
    firstName: string;
    lastName: string;
    emailAddress: string;
    customFields?: { companyRoles?: string[] | null };
}

/** C6: the contacts of a company with their roles, filterable by role. */
export function CompanyContactsBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const { t } = useLingui();
    const groupId: string | undefined = context.entity?.id;
    const { data: settings } = useCrmSettings();
    const [role, setRole] = useState('');
    const { data } = useQuery({
        queryKey: ['crm-company-contacts', groupId],
        queryFn: () => api.query(contactsDocument, { id: groupId!, take: CONTACTS_LIMIT }) as Promise<any>,
        enabled: !!groupId,
    });
    const group = data?.customerGroup;
    if (!group || group.crmGroupType !== 'company') {
        return null;
    }

    const contacts: Contact[] = group.customers.items;
    const shown = role ? contacts.filter(contact => contact.customFields?.companyRoles?.includes(role)) : contacts;
    const rolesOf = (contact: Contact) =>
        (contact.customFields?.companyRoles ?? []).map(code => optionLabel(settings?.roleOptions, code)).join(', ');

    return (
        <div className="space-y-3 text-sm">
            <NativeSelect value={role} onChange={event => setRole(event.target.value)} aria-label={t`Filter by role`}>
                <NativeSelectOption value="">{t`All roles`}</NativeSelectOption>
                {(settings?.roleOptions ?? []).map(option => (
                    <NativeSelectOption key={option.code} value={option.code}>
                        {option.label}
                    </NativeSelectOption>
                ))}
            </NativeSelect>
            {shown.length === 0 ? (
                <p className="text-muted-foreground"><Trans>No contact with this role.</Trans></p>
            ) : (
                <ul className="divide-y">
                    {shown.map(contact => (
                        <li key={contact.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
                            <Link to="/customers/$id" params={{ id: contact.id }} className="font-medium hover:underline">
                                {contact.firstName} {contact.lastName}
                            </Link>
                            <span className="text-muted-foreground">{rolesOf(contact) || contact.emailAddress}</span>
                        </li>
                    ))}
                </ul>
            )}
            {group.customers.totalItems > CONTACTS_LIMIT && (
                <p className="text-xs text-muted-foreground">
                    <Trans>Only the first 200 contacts are listed.</Trans>
                </p>
            )}
        </div>
    );
}
