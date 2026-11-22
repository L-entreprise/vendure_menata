import { graphql } from '@/graphql/graphql';
import { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { api, PageContextValue } from '@vendure/dashboard';

const journalDocument = graphql(`
    query CrmJournal($groupId: ID!) {
        customerGroup(id: $groupId) { id crmGroupType }
        crmJournal(groupId: $groupId) {
            totalItems
            items { id createdAt type data authorName }
        }
    }
`);

const TYPE_LABELS: Record<string, MessageDescriptor> = {
    created: msg`Company created`,
    updated: msg`Details updated`,
    'type-changed': msg`Type changed`,
    'parent-added': msg`Linked under a group`,
    'parent-removed': msg`Unlinked from a group`,
    'member-added': msg`Contact added`,
    'member-removed': msg`Contact removed`,
    'address-added': msg`Address added`,
    'address-updated': msg`Address updated`,
    'address-removed': msg`Address removed`,
    'lifecycle-changed': msg`Prospect / client status changed`,
    'note-added': msg`Note added`,
    'task-added': msg`Follow-up added`,
    'order-assigned': msg`Order assigned`,
};

/** The most telling detail of an entry, picked from its data. */
function detailOf(data: Record<string, any>): string {
    return data.customerName ?? data.parentName ?? data.label ?? data.orderCode ?? data.title ??
        (data.from || data.to ? `${data.from ?? '–'} → ${data.to ?? '–'}` : '');
}

/** N5: what happened to this company, newest first. */
export function JournalBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const { i18n } = useLingui();
    const groupId: string | undefined = context.entity?.id;
    const { data } = useQuery({
        queryKey: ['crm-journal', groupId],
        queryFn: () => api.query(journalDocument, { groupId: groupId! }) as Promise<any>,
        enabled: !!groupId,
    });
    if (!data || data.customerGroup?.crmGroupType !== 'company') {
        return null;
    }
    const items: any[] = data.crmJournal.items;
    if (items.length === 0) {
        return <p className="text-sm text-muted-foreground"><Trans>Nothing recorded yet.</Trans></p>;
    }
    return (
        <ul className="divide-y text-sm">
            {items.map(item => (
                <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-2">
                    <span>
                        <span className="font-medium">{TYPE_LABELS[item.type] ? i18n._(TYPE_LABELS[item.type]) : item.type}</span>
                        {detailOf(item.data ?? {}) && <span className="text-muted-foreground"> · {detailOf(item.data ?? {})}</span>}
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                        {item.authorName ?? ''} · {new Date(item.createdAt).toLocaleString(i18n.locale, { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                </li>
            ))}
        </ul>
    );
}
