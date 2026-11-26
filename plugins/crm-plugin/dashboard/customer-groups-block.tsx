import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api, Button, ConfirmationDialog, PageContextValue, usePermissions } from '@vendure/dashboard';
import { XIcon } from 'lucide-react';

import { GROUP_TYPE_LABELS } from './group-labels';
import { EmptyLine, GroupPicker, SectionLabel } from './group-picker';
import { useCrmAction } from './use-crm-action';

const membershipDocument = graphql(`
    query CrmCustomerMembership($id: ID!) {
        customer(id: $id) {
            id
            groups {
                id
                name
                crmGroupType
                crmAncestors {
                    id
                    name
                }
            }
        }
        crmCompanySuggestions(customerId: $id) {
            id
            name
        }
        crmEligibleGroups(customerId: $id) {
            id
            name
            crmGroupType
        }
        crmGroupTree {
            group {
                id
                name
                crmGroupType
                crmMemberScope
            }
        }
    }
`);

const addDocument = graphql(`
    mutation CrmAddCustomerToGroup($groupId: ID!, $customerId: ID!) {
        addCustomersToGroup(customerGroupId: $groupId, customerIds: [$customerId]) {
            id
        }
    }
`);

const removeDocument = graphql(`
    mutation CrmRemoveCustomerFromGroup($groupId: ID!, $customerId: ID!) {
        removeCustomersFromGroup(customerGroupId: $groupId, customerIds: [$customerId]) {
            id
        }
    }
`);

const moveDocument = graphql(`
    mutation CrmMoveCustomer($customerId: ID!, $companyId: ID!) {
        moveCustomerToCompany(customerId: $customerId, companyId: $companyId) {
            id
        }
    }
`);

interface GroupRow {
    id: string;
    name: string;
    crmGroupType?: string | null;
    crmMemberScope?: string;
    crmAncestors?: Array<{ id: string; name: string }>;
}

/**
 * Replaces the native "Customer groups" block (C5, R3, R4): the single company first with
 * the groups above it greyed out, then the other groups. The pickers only offer what the
 * rules allow, and changing company is a move, never a second company.
 */
export function CustomerGroupsBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const { t, i18n } = useLingui();
    const customerId: string | undefined = context.entity?.id;
    const { hasPermissions } = usePermissions();
    const canEdit = hasPermissions(['UpdateCustomerGroup']);
    const { run, pending } = useCrmAction();
    const { data } = useQuery({
        queryKey: ['crm-customer-membership', customerId],
        queryFn: () => api.query(membershipDocument, { id: customerId! }) as Promise<any>,
        enabled: !!customerId,
    });
    if (!data || !customerId) {
        return null;
    }

    const groups: GroupRow[] = data.customer?.groups ?? [];
    const company = groups.find(group => group.crmGroupType === 'company');
    const others = groups.filter(group => group !== company);
    const companies = (data.crmGroupTree as Array<{ group: GroupRow }>)
        .map(entry => entry.group)
        .filter(group => group.crmGroupType === 'company' && group.crmMemberScope !== 'groups' && group.id !== company?.id);
    const eligible = (data.crmEligibleGroups as GroupRow[]).filter(group => group.crmGroupType !== 'company');
    const typeLabel = (type?: string | null) => (type && GROUP_TYPE_LABELS[type] ? i18n._(GROUP_TYPE_LABELS[type]) : '');

    return (
        <div className="space-y-5 text-sm">
            <div>
                <SectionLabel><Trans>Company</Trans></SectionLabel>
                {company ? (
                    <>
                        <Link to="/customer-groups/$id" params={{ id: company.id }} className="font-medium hover:underline">
                            {company.name}
                        </Link>
                        {!!company.crmAncestors?.length && (
                            <p className="text-muted-foreground">{company.crmAncestors.map(a => a.name).join(' · ')}</p>
                        )}
                    </>
                ) : (
                    <EmptyLine><Trans>No company yet.</Trans></EmptyLine>
                )}
                {!company && canEdit && (data.crmCompanySuggestions as GroupRow[]).map(suggestion => (
                    <div key={suggestion.id} className="mt-2 flex flex-wrap items-center gap-2">
                        <span><Trans>Similar company:</Trans> <span className="font-medium">{suggestion.name}</span> ?</span>
                        <Button size="sm" variant="outline" disabled={pending}
                            onClick={() => run(() => api.mutate(moveDocument, { customerId, companyId: suggestion.id }), t`Company updated`)}>
                            <Trans>Link</Trans>
                        </Button>
                    </div>
                ))}
                {canEdit && (
                    <div className="mt-2">
                        <GroupPicker
                            groups={companies}
                            placeholder={t`Choose a company`}
                            actionLabel={company ? t`Move` : t`Link`}
                            disabled={pending}
                            onPick={companyId => run(() => api.mutate(moveDocument, { customerId, companyId }), t`Company updated`)}
                        />
                    </div>
                )}
            </div>
            <div>
                <SectionLabel><Trans>Other groups</Trans></SectionLabel>
                {others.length === 0 && <EmptyLine><Trans>No other group.</Trans></EmptyLine>}
                <ul className="space-y-1">
                    {others.map(group => (
                        <li key={group.id} className="flex items-center justify-between gap-2">
                            <span>
                                <Link to="/customer-groups/$id" params={{ id: group.id }} className="hover:underline">{group.name}</Link>
                                {typeLabel(group.crmGroupType) && <span className="text-muted-foreground"> · {typeLabel(group.crmGroupType)}</span>}
                            </span>
                            {canEdit && (
                                <ConfirmationDialog
                                    title={t`Remove from the group?`}
                                    description={t`The customer leaves the group "${group.name}". You can add them back later.`}
                                    confirmText={t`Remove`}
                                    onConfirm={() => run(() => api.mutate(removeDocument, { groupId: group.id, customerId }))}
                                >
                                    <Button variant="ghost" size="icon" aria-label={t`Remove from the group`} disabled={pending}>
                                        <XIcon />
                                    </Button>
                                </ConfirmationDialog>
                            )}
                        </li>
                    ))}
                </ul>
                {canEdit && (
                    <div className="mt-2">
                        <GroupPicker
                            groups={eligible}
                            placeholder={t`Add to a group`}
                            actionLabel={t`Add`}
                            disabled={pending}
                            onPick={groupId => run(() => api.mutate(addDocument, { groupId, customerId }))}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
