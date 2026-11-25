import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS } from '../../../deploy/e2e/test-environment';
import { CrmPlugin } from '../crm.plugin';

import {
    ADD_NOTE_TO_CUSTOMER,
    Commercial,
    COMMERCIAL_PASSWORD,
    createCommercialFactory,
    createCustomer,
    CUSTOMER_HISTORY,
    DELETE_CUSTOMER_NOTE,
    UPDATE_CUSTOMER_NOTE,
} from './helpers';

/**
 * CDC N1 / N3: notes show their author by name, and nobody edits or deletes another
 * person's note, not even through a direct call to the native Vendure mutations.
 * Only the super admin may delete (never edit) someone else's note.
 */
describe('CrmPlugin — note ownership (N1, N3)', () => {
    const { server, adminClient } = createPluginTestEnvironment({ plugins: [CrmPlugin] });

    let alexandre: Commercial;
    let elouann: Commercial;
    let customerId: string;

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
        const createCommercial = await createCommercialFactory(adminClient);
        alexandre = await createCommercial('Alexandre', 'Martin');
        elouann = await createCommercial('Elouann', 'Durand');
        customerId = await createCustomer(adminClient, 'buyer@menata-colmar.test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    async function addNoteAs(commercial: Commercial, note: string): Promise<string> {
        await adminClient.asUserWithCredentials(commercial.username, COMMERCIAL_PASSWORD);
        await adminClient.query(ADD_NOTE_TO_CUSTOMER, { input: { id: customerId, note, isPublic: false } });
        const { customer } = await adminClient.query(CUSTOMER_HISTORY, { id: customerId });
        const entry = customer.history.items.find((item: any) => item.data?.note === note);
        return entry.id;
    }

    it('shows the author by name to another sales rep without ReadAdministrator', async () => {
        await addNoteAs(alexandre, 'Rappeler MENATA le 12/01');

        await adminClient.asUserWithCredentials(elouann.username, COMMERCIAL_PASSWORD);
        const { customer } = await adminClient.query(CUSTOMER_HISTORY, { id: customerId });
        const entry = customer.history.items.find((item: any) => item.data?.note === 'Rappeler MENATA le 12/01');

        expect(entry.administrator).toMatchObject({ firstName: 'Alexandre', lastName: 'Martin' });
    });

    it('lets the author edit their own note', async () => {
        const noteId = await addNoteAs(alexandre, 'Note à corriger');

        const { updateCustomerNote } = await adminClient.query(UPDATE_CUSTOMER_NOTE, {
            input: { noteId, note: 'Note corrigée' },
        });

        expect(updateCustomerNote.data.note).toBe('Note corrigée');
    });

    it('refuses an edit by another sales rep', async () => {
        const noteId = await addNoteAs(alexandre, 'Note d’Alexandre');
        await adminClient.asUserWithCredentials(elouann.username, COMMERCIAL_PASSWORD);

        await expect(
            adminClient.query(UPDATE_CUSTOMER_NOTE, { input: { noteId, note: 'Réécrite par Elouann' } }),
        ).rejects.toThrow(/only the author/i);
    });

    it('refuses a deletion by another sales rep', async () => {
        const noteId = await addNoteAs(alexandre, 'Note à garder');
        await adminClient.asUserWithCredentials(elouann.username, COMMERCIAL_PASSWORD);

        await expect(adminClient.query(DELETE_CUSTOMER_NOTE, { id: noteId })).rejects.toThrow(/only the author/i);
    });

    it('refuses an edit by the super admin', async () => {
        const noteId = await addNoteAs(alexandre, 'Note intouchable');
        await adminClient.asSuperAdmin();

        await expect(
            adminClient.query(UPDATE_CUSTOMER_NOTE, { input: { noteId, note: 'Réécrite par le super admin' } }),
        ).rejects.toThrow(/only the author/i);
    });

    it('lets the super admin delete someone else’s note', async () => {
        const noteId = await addNoteAs(alexandre, 'Note à supprimer');
        await adminClient.asSuperAdmin();

        const { deleteCustomerNote } = await adminClient.query(DELETE_CUSTOMER_NOTE, { id: noteId });

        expect(deleteCustomerNote.result).toBe('DELETED');
    });

    it('lets the author delete their own note', async () => {
        const noteId = await addNoteAs(elouann, 'Note d’Elouann');

        const { deleteCustomerNote } = await adminClient.query(DELETE_CUSTOMER_NOTE, { id: noteId });

        expect(deleteCustomerNote.result).toBe('DELETED');
    });
});
