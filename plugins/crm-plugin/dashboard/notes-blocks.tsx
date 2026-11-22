import { graphql } from '@/graphql/graphql';
import { useQuery } from '@tanstack/react-query';
import { api, PageContextValue, usePermissions } from '@vendure/dashboard';

import { CRM_ADMIN_PERMISSION } from './constants';
import { CrmNote, NotesActions, NotesList } from './notes-list';
import { useCrmAction } from './use-crm-action';

const customerNotesDocument = graphql(`
    query CrmCustomerNotes($id: ID!) {
        activeAdministrator { id }
        customer(id: $id) {
            id
            history(options: { filter: { type: { eq: "CUSTOMER_NOTE" } }, take: 200 }) {
                items {
                    id
                    createdAt
                    data
                    administrator { id firstName lastName }
                    customFields { pinned }
                }
            }
        }
    }
`);

const addCustomerNote = graphql(`
    mutation CrmAddCustomerNote($id: ID!, $note: String!) {
        addNoteToCustomer(input: { id: $id, note: $note, isPublic: false }) { id }
    }
`);
const updateCustomerNote = graphql(`
    mutation CrmUpdateCustomerNote($noteId: ID!, $note: String!) {
        updateCustomerNote(input: { noteId: $noteId, note: $note }) { id }
    }
`);
const deleteCustomerNote = graphql(`
    mutation CrmDeleteCustomerNote($id: ID!) {
        deleteCustomerNote(id: $id) { result }
    }
`);
const pinCustomerNote = graphql(`
    mutation CrmPinCustomerNote($noteId: ID!, $pinned: Boolean!) {
        setCustomerNotePinned(noteId: $noteId, pinned: $pinned) { id }
    }
`);

const groupNotesDocument = graphql(`
    query CrmGroupNotes($groupId: ID!) {
        customerGroupNotes(groupId: $groupId) { id createdAt note pinned authorName isMine }
    }
`);
const addGroupNote = graphql(`
    mutation CrmAddGroupNote($groupId: ID!, $note: String!) {
        addCustomerGroupNote(groupId: $groupId, note: $note) { id }
    }
`);
const updateGroupNote = graphql(`
    mutation CrmUpdateGroupNote($noteId: ID!, $note: String!) {
        updateCustomerGroupNote(noteId: $noteId, note: $note) { id }
    }
`);
const deleteGroupNote = graphql(`
    mutation CrmDeleteGroupNote($noteId: ID!) {
        deleteCustomerGroupNote(noteId: $noteId) { result }
    }
`);
const pinGroupNote = graphql(`
    mutation CrmPinGroupNote($noteId: ID!, $pinned: Boolean!) {
        setCustomerGroupNotePinned(noteId: $noteId, pinned: $pinned) { id }
    }
`);

function toCustomerNote(entry: any, currentAdminId: string | undefined): CrmNote {
    const admin = entry.administrator;
    return {
        id: entry.id,
        text: entry.data?.note ?? '',
        createdAt: entry.createdAt,
        authorName: admin ? `${admin.firstName} ${admin.lastName}`.trim() : null,
        pinned: !!entry.customFields?.pinned,
        isMine: !!admin && admin.id === currentAdminId,
    };
}

/** N2: hand-written customer notes, pinned first, apart from the native timeline. */
export function CustomerNotesBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const customerId: string | undefined = context.entity?.id;
    const { hasPermissions } = usePermissions();
    const { run, pending } = useCrmAction();
    const { data } = useQuery({
        queryKey: ['crm-customer-notes', customerId],
        queryFn: () => api.query(customerNotesDocument, { id: customerId! }) as Promise<any>,
        enabled: !!customerId,
    });
    if (!data?.customer || !customerId) {
        return null;
    }
    const notes = (data.customer.history.items as any[]).map(entry => toCustomerNote(entry, data.activeAdministrator?.id));
    const actions: NotesActions = {
        add: note => run(() => api.mutate(addCustomerNote, { id: customerId, note })),
        edit: (noteId, note) => run(() => api.mutate(updateCustomerNote, { noteId, note })),
        remove: id => run(() => api.mutate(deleteCustomerNote, { id })),
        pin: (noteId, pinned) => run(() => api.mutate(pinCustomerNote, { noteId, pinned })),
    };
    return (
        <NotesList notes={notes} actions={actions} pending={pending}
            canWrite={hasPermissions(['UpdateCustomer'])} canDeleteAny={hasPermissions([CRM_ADMIN_PERMISSION])} />
    );
}

/** N4: notes of the group being viewed only. */
export function GroupNotesBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const groupId: string | undefined = context.entity?.id;
    const { hasPermissions } = usePermissions();
    const { run, pending } = useCrmAction();
    const { data } = useQuery({
        queryKey: ['crm-group-notes', groupId],
        queryFn: () => api.query(groupNotesDocument, { groupId: groupId! }) as Promise<any>,
        enabled: !!groupId,
    });
    if (!data || !groupId) {
        return null;
    }
    const notes: CrmNote[] = (data.customerGroupNotes as any[]).map(note => ({ ...note, text: note.note }));
    const actions: NotesActions = {
        add: note => run(() => api.mutate(addGroupNote, { groupId, note })),
        edit: (noteId, note) => run(() => api.mutate(updateGroupNote, { noteId, note })),
        remove: noteId => run(() => api.mutate(deleteGroupNote, { noteId })),
        pin: (noteId, pinned) => run(() => api.mutate(pinGroupNote, { noteId, pinned })),
    };
    return (
        <NotesList notes={notes} actions={actions} pending={pending}
            canWrite={hasPermissions(['UpdateCustomerGroup'])} canDeleteAny={hasPermissions([CRM_ADMIN_PERMISSION])} />
    );
}
