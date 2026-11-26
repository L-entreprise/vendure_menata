import { graphql } from '@/graphql/graphql';
import { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { api, Button, Checkbox, ConfirmationDialog, Input, NativeSelect, NativeSelectOption, PageContextValue, usePermissions } from '@vendure/dashboard';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import { useCrmAction } from './use-crm-action';

const listDocument = graphql(`
    query CrmGroupAddresses($groupId: ID!) {
        customerGroupAddresses(groupId: $groupId) { id kind label fullName company streetLine1 streetLine2 city province postalCode countryCode phoneNumber defaultShipping defaultBilling }
    }
`);
const createDocument = graphql(`
    mutation CrmCreateGroupAddress($groupId: ID!, $input: CrmGroupAddressInput!) {
        createCustomerGroupAddress(groupId: $groupId, input: $input) { id }
    }
`);
const updateDocument = graphql(`
    mutation CrmUpdateGroupAddress($id: ID!, $input: CrmGroupAddressInput!) {
        updateCustomerGroupAddress(id: $id, input: $input) { id }
    }
`);
const deleteDocument = graphql(`
    mutation CrmDeleteGroupAddress($id: ID!) { deleteCustomerGroupAddress(id: $id) { result } }
`);

export const KIND_LABELS: Record<string, MessageDescriptor> = {
    headquarters: msg`Head office`,
    shipping: msg`Delivery`,
    billing: msg`Billing`,
};

export interface GroupAddress {
    id: string;
    kind: string;
    label: string;
    fullName: string;
    company: string;
    streetLine1: string;
    streetLine2: string;
    city: string;
    province: string;
    postalCode: string;
    countryCode: string;
    phoneNumber: string;
    defaultShipping: boolean;
    defaultBilling: boolean;
}

const EMPTY: Omit<GroupAddress, 'id'> = {
    kind: 'shipping', label: '', fullName: '', company: '', streetLine1: '', streetLine2: '', city: '', province: '',
    postalCode: '', countryCode: 'FR', phoneNumber: '', defaultShipping: false, defaultBilling: false,
};

export function addressLines(address: Omit<GroupAddress, 'id'>): string {
    return [address.streetLine1, address.streetLine2, `${address.postalCode} ${address.city}`.trim(), address.countryCode].filter(Boolean).join(', ');
}

function AddressForm({ initial, onSave, onCancel, pending }: Readonly<{ initial: Omit<GroupAddress, 'id'>; onSave: (input: Omit<GroupAddress, 'id'>) => void; onCancel: () => void; pending: boolean }>) {
    const { t, i18n } = useLingui();
    const [draft, setDraft] = useState(initial);
    const field = (key: keyof typeof EMPTY, label: string) => (
        <Input value={String(draft[key] ?? '')} placeholder={label} aria-label={label} onChange={event => setDraft({ ...draft, [key]: event.target.value })} />
    );
    return (
        <div className="space-y-2 rounded-md bg-muted/40 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
                <NativeSelect value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value })} aria-label={t`Use`}>
                    {Object.entries(KIND_LABELS).map(([kind, label]) => <NativeSelectOption key={kind} value={kind}>{i18n._(label)}</NativeSelectOption>)}
                </NativeSelect>
                {field('label', t`Name of the address (e.g. Main warehouse)`)}
                {field('fullName', t`Recipient`)}
                {field('company', t`Company name`)}
                {field('streetLine1', t`Street`)}
                {field('streetLine2', t`Street (line 2)`)}
                {field('postalCode', t`Postal code`)}
                {field('city', t`City`)}
                {field('countryCode', t`Country code (FR)`)}
                {field('phoneNumber', t`Phone`)}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <label className="flex items-center gap-2"><Checkbox checked={draft.defaultShipping} onCheckedChange={c => setDraft({ ...draft, defaultShipping: c === true })} /><Trans>Default delivery address</Trans></label>
                <label className="flex items-center gap-2"><Checkbox checked={draft.defaultBilling} onCheckedChange={c => setDraft({ ...draft, defaultBilling: c === true })} /><Trans>Default billing address</Trans></label>
            </div>
            <div className="flex gap-2">
                <Button size="sm" disabled={pending || !draft.streetLine1.trim()} onClick={() => onSave(draft)}><Trans>Save</Trans></Button>
                <Button size="sm" variant="ghost" onClick={onCancel}><Trans>Cancel</Trans></Button>
            </div>
        </div>
    );
}

/** A1: the address book of a company (head office, delivery, billing). */
export function GroupAddressesBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const { t, i18n } = useLingui();
    const groupId: string | undefined = context.entity?.id;
    const canEdit = usePermissions().hasPermissions(['UpdateCustomerGroup']);
    const { run, pending } = useCrmAction();
    const [editing, setEditing] = useState<string | 'new' | null>(null);
    const { data } = useQuery({
        queryKey: ['crm-group-addresses', groupId],
        queryFn: async () => ((await api.query(listDocument, { groupId: groupId! })) as any).customerGroupAddresses as GroupAddress[],
        enabled: !!groupId,
    });
    if (!data || !groupId) {
        return null;
    }
    const save = async (input: Omit<GroupAddress, 'id'>, id?: string) => {
        const ok = await run(() => (id ? api.mutate(updateDocument, { id, input }) : api.mutate(createDocument, { groupId, input })), t`Address saved`);
        if (ok) setEditing(null);
    };

    return (
        <div className="space-y-3 text-sm">
            {data.length === 0 && editing !== 'new' && <p className="text-muted-foreground"><Trans>No address yet.</Trans></p>}
            <ul className="divide-y">
                {data.map(address => (
                    <li key={address.id} className="py-2">
                        {editing === address.id ? (
                            <AddressForm initial={address} pending={pending} onCancel={() => setEditing(null)} onSave={input => save(input, address.id)} />
                        ) : (
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-medium">
                                        {address.label || (KIND_LABELS[address.kind] ? i18n._(KIND_LABELS[address.kind]) : address.kind)}
                                        {address.defaultShipping && <span className="font-normal text-muted-foreground"> · <Trans>default delivery</Trans></span>}
                                        {address.defaultBilling && <span className="font-normal text-muted-foreground"> · <Trans>default billing</Trans></span>}
                                    </p>
                                    <p className="text-muted-foreground">{addressLines(address)}</p>
                                </div>
                                {canEdit && (
                                    <span className="flex shrink-0">
                                        <Button variant="ghost" size="icon" aria-label={t`Edit`} onClick={() => setEditing(address.id)}><PencilIcon /></Button>
                                        <ConfirmationDialog
                                            title={t`Delete this address?`}
                                            description={t`The address is removed from the group for good. This cannot be undone.`}
                                            confirmText={t`Delete`}
                                            onConfirm={() => run(() => api.mutate(deleteDocument, { id: address.id }))}
                                        >
                                            <Button variant="ghost" size="icon" aria-label={t`Delete`} disabled={pending}><Trash2Icon /></Button>
                                        </ConfirmationDialog>
                                    </span>
                                )}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            {editing === 'new' && <AddressForm initial={EMPTY} pending={pending} onCancel={() => setEditing(null)} onSave={input => save(input)} />}
            {canEdit && editing === null && (
                <Button variant="outline" size="sm" onClick={() => setEditing('new')}><PlusIcon /><Trans>Add an address</Trans></Button>
            )}
        </div>
    );
}

