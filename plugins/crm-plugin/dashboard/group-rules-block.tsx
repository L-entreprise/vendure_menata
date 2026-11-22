import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { api, PageContextValue } from '@vendure/dashboard';

import { GROUP_TYPE_LABELS, MEMBER_SCOPE_LABELS } from './group-labels';

const groupRulesDocument = graphql(`
    query CrmGroupRules($id: ID!) {
        customerGroup(id: $id) {
            id
            crmGroupType
            crmMemberScope
        }
    }
`);

/**
 * R1: the type of the group and who may join it, read through the CRM fields so sales
 * reps see it too (the custom fields themselves are super admin only).
 */
export function GroupRulesBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const { i18n } = useLingui();
    const groupId = context.entity?.id;
    const { data, isPending, isError } = useQuery({
        queryKey: ['crm-group-rules', groupId],
        queryFn: () => api.query(groupRulesDocument, { id: groupId }),
        enabled: !!groupId,
    });

    if (isPending) {
        return null;
    }
    if (isError) {
        return (
            <p className="text-sm text-destructive">
                <Trans>Could not load the CRM rules.</Trans>
            </p>
        );
    }

    const group = (data as any)?.customerGroup;
    const groupType: string | null = group?.crmGroupType ?? null;
    const scope: string = group?.crmMemberScope ?? 'both';

    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">
                <Trans>Type</Trans>
            </dt>
            <dd>{groupType && GROUP_TYPE_LABELS[groupType] ? i18n._(GROUP_TYPE_LABELS[groupType]) : <Trans>None</Trans>}</dd>
            <dt className="text-muted-foreground">
                <Trans>Members</Trans>
            </dt>
            <dd>{MEMBER_SCOPE_LABELS[scope] ? i18n._(MEMBER_SCOPE_LABELS[scope]) : scope}</dd>
        </dl>
    );
}
