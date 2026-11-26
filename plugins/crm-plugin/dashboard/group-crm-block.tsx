import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api, Button, ConfirmationDialog, PageContextValue, usePermissions } from '@vendure/dashboard';
import { XIcon } from 'lucide-react';

import { CRM_ADMIN_PERMISSION } from './constants';
import { GROUP_TYPE_LABELS, LIFECYCLE_LABELS, MEMBER_SCOPE_LABELS } from './group-labels';
import { EmptyLine, GroupPicker, SectionLabel } from './group-picker';
import { useCrmAction } from './use-crm-action';

const groupCrmDocument = graphql(`
    query CrmGroupSummary($id: ID!) {
        customerGroup(id: $id) {
            id
            crmCode
            crmGroupType
            crmMemberScope
            customFields { lifecycle lifecycleVia lastCountedOrderAt }
            crmBreadcrumb { id name }
            crmParents { id name }
            crmChildren { id name crmGroupType }
        }
        crmGroupTree {
            group { id name crmMemberScope }
        }
    }
`);

const addParentDocument = graphql(`
    mutation CrmAddParent($childId: ID!, $parentId: ID!) {
        addCustomerGroupParent(childId: $childId, parentId: $parentId) { id }
    }
`);

const removeParentDocument = graphql(`
    mutation CrmRemoveParent($childId: ID!, $parentId: ID!) {
        removeCustomerGroupParent(childId: $childId, parentId: $parentId) { id }
    }
`);

type Named = { id: string; name: string; crmGroupType?: string | null; crmMemberScope?: string };

function GroupLink({ group }: Readonly<{ group: Named }>) {
    return (
        <Link to="/customer-groups/$id" params={{ id: group.id }} className="hover:underline">
            {group.name}
        </Link>
    );
}

/** G4 / G7 / R1: code, type, allowed members, place in the hierarchy. Links are super admin only. */
export function GroupCrmBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const { t, i18n } = useLingui();
    const groupId: string | undefined = context.entity?.id;
    const isAdmin = usePermissions().hasPermissions([CRM_ADMIN_PERMISSION]);
    const { run, pending } = useCrmAction();
    const { data } = useQuery({
        queryKey: ['crm-group-summary', groupId],
        queryFn: () => api.query(groupCrmDocument, { id: groupId! }) as Promise<any>,
        enabled: !!groupId,
    });
    const group = data?.customerGroup;
    if (!group) {
        return null;
    }

    const parents: Named[] = group.crmParents;
    const children: Named[] = group.crmChildren;
    const parentIds = new Set(parents.map(parent => parent.id));
    const candidates = (data.crmGroupTree as Array<{ group: Named }>)
        .map(entry => entry.group)
        .filter(other => other.id !== group.id && !parentIds.has(other.id) && other.crmMemberScope !== 'customers');
    const type = group.crmGroupType && GROUP_TYPE_LABELS[group.crmGroupType];
    const count = children.length;
    const lifecycle: string | null = group.customFields?.lifecycle ?? null;

    return (
        <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted-foreground"><Trans>Code</Trans></dt>
                <dd className="font-mono tabular-nums">{group.crmCode}</dd>
                <dt className="text-muted-foreground"><Trans>Type</Trans></dt>
                <dd>{type ? i18n._(type) : <Trans>None</Trans>}</dd>
                <dt className="text-muted-foreground"><Trans>Members</Trans></dt>
                <dd>{i18n._(MEMBER_SCOPE_LABELS[group.crmMemberScope] ?? MEMBER_SCOPE_LABELS.both)}</dd>
                {lifecycle && LIFECYCLE_LABELS[lifecycle] && (
                    <>
                        <dt className="text-muted-foreground"><Trans>Status</Trans></dt>
                        <dd className="font-medium">
                            {i18n._(LIFECYCLE_LABELS[lifecycle])}
                            {lifecycle !== 'prospect' && group.customFields.lifecycleVia === 'subsidiary' && <span className="font-normal text-muted-foreground"> · <Trans>through a subsidiary</Trans></span>}
                        </dd>
                    </>
                )}
            </dl>
            {group.crmBreadcrumb.length > 0 && (
                <p className="text-muted-foreground">
                    {group.crmBreadcrumb.map((item: Named) => item.name).join(' › ')} › <span className="text-foreground">{context.entity?.name}</span>
                </p>
            )}
            <div>
                <SectionLabel><Trans>Parent groups</Trans></SectionLabel>
                {parents.length === 0 && <EmptyLine><Trans>Top-level group.</Trans></EmptyLine>}
                <ul className="space-y-1">
                    {parents.map(parent => (
                        <li key={parent.id} className="flex items-center justify-between gap-2">
                            <GroupLink group={parent} />
                            {isAdmin && (
                                <ConfirmationDialog
                                    title={t`Unlink from this parent group?`}
                                    description={t`"${group.name}" is no longer a child of "${parent.name}". You can link it again later.`}
                                    confirmText={t`Unlink`}
                                    onConfirm={() => run(() => api.mutate(removeParentDocument, { childId: group.id, parentId: parent.id }))}
                                >
                                    <Button variant="ghost" size="icon" disabled={pending} aria-label={t`Unlink`}>
                                        <XIcon />
                                    </Button>
                                </ConfirmationDialog>
                            )}
                        </li>
                    ))}
                </ul>
                {isAdmin && (
                    <div className="mt-2">
                        <GroupPicker groups={candidates} placeholder={parents.length ? t`Add another parent` : t`Choose a parent`}
                            actionLabel={t`Link`} disabled={pending}
                            onPick={parentId => run(() => api.mutate(addParentDocument, { childId: group.id, parentId }), t`Group linked`)} />
                    </div>
                )}
            </div>
            <div>
                <SectionLabel><Trans>Sub-groups</Trans></SectionLabel>
                {children.length === 0 && <EmptyLine><Trans>No sub-group.</Trans></EmptyLine>}
                <ul className="space-y-1">
                    {children.map(child => <li key={child.id}><GroupLink group={child} /></li>)}
                </ul>
                {children.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        <Trans>Deleting this group leaves its {count} sub-group(s) without this parent.</Trans>
                    </p>
                )}
            </div>
        </div>
    );
}
