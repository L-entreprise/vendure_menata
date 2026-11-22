import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS, waitFor } from '../../../deploy/e2e/test-environment';
import { CrmPlugin } from '../crm.plugin';

import {
    ADD_CUSTOMERS_TO_GROUP,
    ADD_NOTE_TO_CUSTOMER,
    Commercial,
    COMMERCIAL_PASSWORD,
    CREATE_CUSTOMER_GROUP,
    createCommercialFactory,
    createCustomer,
    CUSTOMER_HISTORY,
} from './helpers';

const PIN_CUSTOMER_NOTE = gql`
    mutation Pin($noteId: ID!, $pinned: Boolean!) {
        setCustomerNotePinned(noteId: $noteId, pinned: $pinned) { id customFields { pinned } }
    }
`;
const GROUP_NOTES = gql`
    query GroupNotes($groupId: ID!) {
        customerGroupNotes(groupId: $groupId) { id note pinned authorName isMine }
    }
`;
const ADD_GROUP_NOTE = gql`
    mutation AddGroupNote($groupId: ID!, $note: String!) {
        addCustomerGroupNote(groupId: $groupId, note: $note) { id note authorName isMine }
    }
`;
const UPDATE_GROUP_NOTE = gql`
    mutation UpdateGroupNote($noteId: ID!, $note: String!) {
        updateCustomerGroupNote(noteId: $noteId, note: $note) { id note }
    }
`;
const DELETE_GROUP_NOTE = gql`
    mutation DeleteGroupNote($noteId: ID!) {
        deleteCustomerGroupNote(noteId: $noteId) { result }
    }
`;
const PIN_GROUP_NOTE = gql`
    mutation PinGroupNote($noteId: ID!, $pinned: Boolean!) {
        setCustomerGroupNotePinned(noteId: $noteId, pinned: $pinned) { id pinned }
    }
`;
const JOURNAL = gql`
    query Journal($groupId: ID!) {
        crmJournal(groupId: $groupId) { totalItems items { type data authorName } }
    }
`;
const CREATE_DRAFT = gql`
    mutation { createDraftOrder { id } }
`;
const ADD_ORDER_NOTE = gql`
    mutation AddOrderNote($input: AddNoteToOrderInput!) {
        addNoteToOrder(input: $input) { id history { items { id type } } }
    }
`;
const UPDATE_ORDER_NOTE = gql`
    mutation UpdateOrderNote($input: UpdateOrderNoteInput!) {
        updateOrderNote(input: $input) { id }
    }
`;
const DELETE_ORDER_NOTE = gql`
    mutation DeleteOrderNote($id: ID!) {
        deleteOrderNote(id: $id) { result }
    }
`;

describe('CrmPlugin — notes and company journal (N2-N5)', () => {
    const { server, adminClient } = createPluginTestEnvironment({ plugins: [CrmPlugin] });
    let alexandre: Commercial;
    let elouann: Commercial;

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
        const create = await createCommercialFactory(adminClient);
        alexandre = await create('Alexandre', 'Martin');
        elouann = await create('Elouann', 'Durand');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    const as = (who: Commercial) => adminClient.asUserWithCredentials(who.username, COMMERCIAL_PASSWORD);

    async function company(name: string, groupType = 'company'): Promise<string> {
        await adminClient.asSuperAdmin();
        const { createCustomerGroup } = await adminClient.query(CREATE_CUSTOMER_GROUP, {
            input: { name, customFields: { groupType } },
        });
        return createCustomerGroup.id;
    }

    it('pins a customer note so the notes block can show it first (N2)', async () => {
        await as(alexandre);
        const customerId = await createCustomer(adminClient, 'pin@menata.test');
        await adminClient.query(ADD_NOTE_TO_CUSTOMER, { input: { id: customerId, note: 'Important', isPublic: false } });
        const { customer } = await adminClient.query(CUSTOMER_HISTORY, { id: customerId });
        const noteId = customer.history.items.find((item: any) => item.data?.note === 'Important').id;

        await as(elouann);
        const { setCustomerNotePinned } = await adminClient.query(PIN_CUSTOMER_NOTE, { noteId, pinned: true });

        expect(setCustomerNotePinned.customFields.pinned).toBe(true);
    });

    it('applies the author rule to order notes too (N3)', async () => {
        await as(alexandre);
        const { createDraftOrder } = await adminClient.query(CREATE_DRAFT);
        const { addNoteToOrder } = await adminClient.query(ADD_ORDER_NOTE, {
            input: { id: createDraftOrder.id, note: 'Livraison urgente', isPublic: false },
        });
        const noteId = addNoteToOrder.history.items.find((item: any) => item.type === 'ORDER_NOTE').id;

        await as(elouann);
        await expect(adminClient.query(UPDATE_ORDER_NOTE, { input: { noteId, note: 'Réécrite' } })).rejects.toThrow(/only the author/i);
        await expect(adminClient.query(DELETE_ORDER_NOTE, { id: noteId })).rejects.toThrow(/only the author/i);
        await adminClient.asSuperAdmin();
        const { deleteOrderNote } = await adminClient.query(DELETE_ORDER_NOTE, { id: noteId });
        expect(deleteOrderNote.result).toBe('DELETED');
    });

    it('keeps group notes per group, pinned first, with author rules (N4)', async () => {
        const groupId = await company('Notes company');
        const otherGroupId = await company('Other notes company');
        await as(alexandre);
        const { addCustomerGroupNote: first } = await adminClient.query(ADD_GROUP_NOTE, { groupId, note: 'Première' });
        const { addCustomerGroupNote: second } = await adminClient.query(ADD_GROUP_NOTE, { groupId, note: 'Seconde' });
        await adminClient.query(PIN_GROUP_NOTE, { noteId: first.id, pinned: true });
        expect(first).toMatchObject({ authorName: 'Alexandre Martin', isMine: true });

        await as(elouann);
        const { customerGroupNotes } = await adminClient.query(GROUP_NOTES, { groupId });
        expect(customerGroupNotes.map((n: any) => n.note)).toEqual(['Première', 'Seconde']);
        expect(customerGroupNotes[0].isMine).toBe(false);
        const { customerGroupNotes: otherNotes } = await adminClient.query(GROUP_NOTES, { groupId: otherGroupId });
        expect(otherNotes).toEqual([]);
        await expect(adminClient.query(UPDATE_GROUP_NOTE, { noteId: second.id, note: 'x' })).rejects.toThrow(/only the author/i);
        await expect(adminClient.query(DELETE_GROUP_NOTE, { noteId: second.id })).rejects.toThrow(/only the author/i);

        await as(alexandre);
        const { updateCustomerGroupNote } = await adminClient.query(UPDATE_GROUP_NOTE, { noteId: second.id, note: 'Seconde corrigée' });
        expect(updateCustomerGroupNote.note).toBe('Seconde corrigée');
        await adminClient.asSuperAdmin();
        await expect(adminClient.query(UPDATE_GROUP_NOTE, { noteId: second.id, note: 'admin' })).rejects.toThrow(/only the author/i);
        const { deleteCustomerGroupNote } = await adminClient.query(DELETE_GROUP_NOTE, { noteId: second.id });
        expect(deleteCustomerGroupNote.result).toBe('DELETED');
    });

    it('journals a rename as an update, not as a type change (N5)', async () => {
        const companyId = await company('Rename company');
        await adminClient.query(
            gql`mutation Rename($input: UpdateCustomerGroupInput!) { updateCustomerGroup(input: $input) { id } }`,
            { input: { id: companyId, name: 'Renamed company', customFields: { siret: '123' } } },
        );

        const { crmJournal } = await adminClient.query(JOURNAL, { groupId: companyId });
        const types = crmJournal.items.map((item: any) => item.type);
        expect(types).toContain('updated');
        expect(types).not.toContain('type-changed');
        expect(crmJournal.items.find((item: any) => item.type === 'updated').data.fields).toBe('name, siret');
    });

    it('journals what happens to a company, and nothing for other group types (N5)', async () => {
        const companyId = await company('Journal company');
        const segmentId = await company('Journal segment', 'segment');
        const customerId = await createCustomer(adminClient, 'journal@menata.test');
        await as(alexandre);
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: companyId, customerIds: [customerId] });
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: segmentId, customerIds: [customerId] });
        await adminClient.query(ADD_GROUP_NOTE, { groupId: companyId, note: 'Rendez-vous pris' });
        await adminClient.query(ADD_GROUP_NOTE, { groupId: segmentId, note: 'Segment note' });

        const { crmJournal } = await waitFor(
            () => adminClient.query(JOURNAL, { groupId: companyId }),
            result => result.crmJournal.items.some((item: any) => item.type === 'member-added'),
        );
        const types = crmJournal.items.map((item: any) => item.type);
        expect(types).toEqual(expect.arrayContaining(['created', 'member-added', 'note-added']));
        const memberEntry = crmJournal.items.find((item: any) => item.type === 'member-added');
        expect(memberEntry.authorName).toBe('Alexandre Martin');

        const { crmJournal: segmentJournal } = await adminClient.query(JOURNAL, { groupId: segmentId });
        expect(segmentJournal.totalItems).toBe(0);
    });
});
