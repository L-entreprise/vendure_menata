import { RequestContextService } from '@vendure/core';
import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS, waitFor } from '../../../deploy/e2e/test-environment';
import { localDate } from '../common/local-date';
import { CrmPlugin } from '../crm.plugin';
import { NotificationService } from '../services/notification.service';

import {
    ADD_NOTE_TO_CUSTOMER,
    Commercial,
    COMMERCIAL_PASSWORD,
    CREATE_CUSTOMER_GROUP,
    createCommercialFactory,
    createCustomer,
} from './helpers';

const CREATE_TASK = gql`
    mutation CreateTask($input: CreateCrmTaskInput!) {
        createCrmTask(input: $input) { id title dueDate done assigneeName isMine }
    }
`;
const SET_DONE = gql`
    mutation SetDone($id: ID!, $done: Boolean!) {
        setCrmTaskDone(id: $id, done: $done) { id done }
    }
`;
const DELETE_TASK = gql`
    mutation DeleteTask($id: ID!) {
        deleteCrmTask(id: $id) { result }
    }
`;
const MY_TASKS = gql`
    query MyTasks($bucket: CrmTaskBucket!) {
        myCrmTasks(bucket: $bucket) { id title }
    }
`;
const TASKS_FOR = gql`
    query TasksFor($customerId: ID) {
        crmTasksFor(customerId: $customerId) { id title assigneeName }
    }
`;
const MENTIONABLE = gql`
    query { crmMentionableAdministrators { id firstName lastName } }
`;
const MY_NOTIFICATIONS = gql`
    query { myCrmNotifications { unreadCount items { id type read data } } }
`;
const MARK_READ = gql`
    mutation MarkRead($ids: [ID!]) { markCrmNotificationsRead(ids: $ids) }
`;
const ADD_GROUP_NOTE = gql`
    mutation AddGroupNote($groupId: ID!, $note: String!) {
        addCustomerGroupNote(groupId: $groupId, note: $note) { id }
    }
`;

describe('CrmPlugin — follow-ups, mentions, notifications (K1-K4)', () => {
    const { server, adminClient } = createPluginTestEnvironment({ plugins: [CrmPlugin] });
    let alexandre: Commercial;
    let elouann: Commercial;
    let customerId: string;

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
        const create = await createCommercialFactory(adminClient);
        alexandre = await create('Alexandre', 'Martin');
        elouann = await create('Elouann', 'Durand');
        customerId = await createCustomer(adminClient, 'tasks@menata.test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    const as = (who: Commercial) => adminClient.asUserWithCredentials(who.username, COMMERCIAL_PASSWORD);
    const task = (title: string, dueDate: string) =>
        adminClient.query(CREATE_TASK, { input: { title, dueDate, customerId } }).then(r => r.createCrmTask);
    const titles = (items: Array<{ title: string }>) => items.map(item => item.title);

    it('assigns a follow-up to its author and sorts it by due date (K1, K2)', async () => {
        await as(alexandre);
        const overdue = await task('Relancer le devis', localDate(-1));
        await task('Rappeler MENATA', localDate(0));
        await task('Préparer le salon', localDate(5));

        expect(overdue).toMatchObject({ assigneeName: 'Alexandre Martin', isMine: true, done: false });
        expect(titles((await adminClient.query(MY_TASKS, { bucket: 'OVERDUE' })).myCrmTasks)).toEqual(['Relancer le devis']);
        expect(titles((await adminClient.query(MY_TASKS, { bucket: 'TODAY' })).myCrmTasks)).toEqual(['Rappeler MENATA']);
        expect(titles((await adminClient.query(MY_TASKS, { bucket: 'UPCOMING' })).myCrmTasks)).toEqual(['Préparer le salon']);

        await adminClient.query(SET_DONE, { id: overdue.id, done: true });
        expect(titles((await adminClient.query(MY_TASKS, { bucket: 'OVERDUE' })).myCrmTasks)).toEqual([]);
        expect(titles((await adminClient.query(MY_TASKS, { bucket: 'DONE' })).myCrmTasks)).toEqual(['Relancer le devis']);
    });

    it('lets others see a follow-up but never change it (K1: assigned to self only)', async () => {
        await as(alexandre);
        const mine = await task('Tâche d’Alexandre', localDate(2));
        await as(elouann);

        expect(titles((await adminClient.query(TASKS_FOR, { customerId })).crmTasksFor)).toContain('Tâche d’Alexandre');
        expect(titles((await adminClient.query(MY_TASKS, { bucket: 'UPCOMING' })).myCrmTasks)).not.toContain('Tâche d’Alexandre');
        await expect(adminClient.query(SET_DONE, { id: mine.id, done: true })).rejects.toThrow(/assigned/i);
        await expect(adminClient.query(DELETE_TASK, { id: mine.id })).rejects.toThrow(/assigned/i);
    });

    it('refuses a follow-up without a valid date or target', async () => {
        await as(alexandre);
        await expect(task('Sans date', '12/01/2027')).rejects.toThrow(/date/i);
        await expect(adminClient.query(CREATE_TASK, { input: { title: 'Sans cible', dueDate: localDate(1) } })).rejects.toThrow(
            /customer or a group/i,
        );
    });

    it('lists mentionable accounts with names only (K3)', async () => {
        await as(alexandre);
        const { crmMentionableAdministrators } = await adminClient.query(MENTIONABLE);

        expect(crmMentionableAdministrators.map((p: any) => `${p.firstName} ${p.lastName}`)).toEqual(
            expect.arrayContaining(['Alexandre Martin', 'Elouann Durand']),
        );
        expect(Object.keys(crmMentionableAdministrators[0]).sort()).toEqual(['firstName', 'id', 'lastName']);
    });

    it('notifies the mentioned colleague, not the author (K3, K4)', async () => {
        await as(alexandre);
        await adminClient.query(ADD_NOTE_TO_CUSTOMER, {
            input: { id: customerId, note: 'Voir avec @Elouann Durand pour le tarif', isPublic: false },
        });
        await adminClient.asSuperAdmin();
        const { createCustomerGroup } = await adminClient.query(CREATE_CUSTOMER_GROUP, {
            input: { name: 'Mention company', customFields: { groupType: 'company' } },
        });
        await as(alexandre);
        await adminClient.query(ADD_GROUP_NOTE, { groupId: createCustomerGroup.id, note: '@elouann durand regarde ça' });

        await as(elouann);
        const { myCrmNotifications } = await waitFor(
            () => adminClient.query(MY_NOTIFICATIONS),
            result => result.myCrmNotifications.items.filter((n: any) => n.type === 'mention').length >= 2,
        );
        expect(myCrmNotifications.unreadCount).toBe(2);
        expect(myCrmNotifications.items[0].data.authorName).toBe('Alexandre Martin');

        const { markCrmNotificationsRead } = await adminClient.query(MARK_READ, { ids: null });
        expect(markCrmNotificationsRead).toBe(2);
        await as(alexandre);
        expect((await adminClient.query(MY_NOTIFICATIONS)).myCrmNotifications.unreadCount).toBe(0);
    });

    it('creates one "due today" notification per follow-up, once (K4)', async () => {
        await as(elouann);
        await task('Due today for Elouann', localDate(0));
        const notifications = server.app.get(NotificationService);
        const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });

        await notifications.createDueTaskNotifications(ctx);
        await notifications.createDueTaskNotifications(ctx);

        const { myCrmNotifications } = await adminClient.query(MY_NOTIFICATIONS);
        const due = myCrmNotifications.items.filter((n: any) => n.type === 'task-due');
        expect(due.map((n: any) => n.data.title)).toEqual(['Due today for Elouann']);
    });
});
