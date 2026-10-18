import {
    ConfigService,
    EventBus,
    Product,
    ProductEvent,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';
import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    createPluginTestEnvironment,
    initialData,
    TEST_SETUP_TIMEOUT_MS,
    waitFor,
} from '../../../deploy/e2e/test-environment';
import { AuditLogPlugin } from '../audit-log.plugin';
import { AuditLogEntry } from '../entities/audit-log-entry.entity';
import { AuditLogService } from '../services/audit-log.service';

const AUDIT_LOG = gql`
    query AuditLog($options: AuditLogEntryListOptions) {
        auditLog(options: $options) {
            totalItems
            items {
                id
                action
                category
                entityType
                entityId
                severity
                detail
            }
        }
    }
`;

const CREATE_PRODUCT = gql`
    mutation CreateProduct($name: String!) {
        createProduct(
            input: { translations: [{ languageCode: en, name: $name, slug: $name, description: "" }] }
        ) {
            id
        }
    }
`;

const CREATE_CUSTOMER = gql`
    mutation CreateCustomer($input: CreateCustomerInput!) {
        createCustomer(input: $input) {
            ... on Customer {
                id
            }
        }
    }
`;

const SHOP_LOGIN = gql`
    mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
            ... on ErrorResult {
                errorCode
            }
        }
    }
`;

const CLEAR_AUDIT_LOG = gql`
    mutation {
        clearAuditLog
    }
`;

/** The e2e id strategy prefixes GraphQL ids (T_1) while the trail stores the raw id (1). */
const rawId = (id: string) => id.replace(/^T_/, '');

type AuditLogResult = {
    auditLog: {
        totalItems: number;
        items: Array<{
            id: string;
            action: string;
            entityId: string;
            severity: string;
            detail: Record<string, any>;
        }>;
    };
};

describe('AuditLogPlugin', () => {
    const { server, adminClient, shopClient } = createPluginTestEnvironment({
        plugins: [AuditLogPlugin.init({ retentionDays: 90 })],
    });

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    function entriesFor(action: string) {
        return adminClient.query<AuditLogResult>(AUDIT_LOG, {
            options: { filter: { action: { eq: action } }, take: 100 },
        });
    }

    it('logs a product creation with the entity id', async () => {
        const { createProduct } = await adminClient.query(CREATE_PRODUCT, { name: 'audit-product' });

        const { auditLog } = await waitFor(
            () => entriesFor('ProductCreated'),
            r => r.auditLog.items.some(e => e.entityId === rawId(createProduct.id)),
        );
        const entry = auditLog.items.find(e => e.entityId === rawId(createProduct.id))!;
        expect(entry.detail.changes.translations[0].name).toBe('audit-product');
    });

    it('keeps every event when several arrive at the same time', async () => {
        const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
        const ids = ['9001', '9002', '9003', '9004', '9005'];

        // Same tick, no await between them: the subscriber receives them back to back.
        await Promise.all(
            ids.map(id =>
                server.app
                    .get(EventBus)
                    .publish(new ProductEvent(ctx, { id } as unknown as Product, 'created', {} as any)),
            ),
        );

        const { auditLog } = await waitFor(
            () => entriesFor('ProductCreated'),
            r => ids.every(id => r.auditLog.items.some(e => e.entityId === id)),
        );
        expect(auditLog.items.filter(e => ids.includes(e.entityId))).toHaveLength(ids.length);
    });

    it('stores customer personal data as [redacted], never in clear', async () => {
        const input = {
            emailAddress: 'jane.doe@example.com',
            firstName: 'Jane',
            lastName: 'Doe',
            phoneNumber: '+33600000000',
        };
        const { createCustomer } = await adminClient.query(CREATE_CUSTOMER, { input });

        const { auditLog } = await waitFor(
            () => entriesFor('CustomerCreated'),
            r => r.auditLog.items.some(e => e.entityId === rawId(createCustomer.id)),
        );
        const entry = auditLog.items.find(e => e.entityId === rawId(createCustomer.id))!;
        const serialized = JSON.stringify(entry.detail);

        expect(entry.detail.changes).toMatchObject({
            emailAddress: '[redacted]',
            firstName: '[redacted]',
            lastName: '[redacted]',
            phoneNumber: '[redacted]',
        });
        for (const value of Object.values(input)) {
            expect(serialized).not.toContain(value);
        }
    });

    it('masks the identifier of a failed login', async () => {
        await shopClient.query(SHOP_LOGIN, { username: 'john.smith@example.com', password: 'wrong' });

        const { auditLog } = await waitFor(
            () => entriesFor('AttemptedLogin'),
            r => r.auditLog.items.some(e => e.detail.identifier === 'j***@example.com'),
        );
        expect(JSON.stringify(auditLog.items)).not.toContain('john.smith');
    });

    it('never stores passwords', async () => {
        const { auditLog } = await entriesFor('AttemptedLogin');
        expect(JSON.stringify(auditLog.items)).not.toContain('wrong');
    });

    it('registers the nightly purge task', () => {
        const tasks = server.app.get(ConfigService).schedulerOptions.tasks;
        expect(tasks.map(t => t.id)).toContain('prune-audit-log');
    });

    it('purges entries older than the retention period and keeps recent ones', async () => {
        const repo = server.app.get(TransactionalConnection).rawConnection.getRepository(AuditLogEntry);
        const old = await repo.save(
            new AuditLogEntry({ action: 'OldEntry', category: 'other', entityType: '', detail: {} }),
        );
        await repo
            .createQueryBuilder()
            .update()
            .set({ createdAt: new Date('2000-01-01') })
            .where('id = :id', { id: old.id })
            .execute();
        const recentCount = await repo.count();

        const deleted = await server.app.get(AuditLogService).pruneOldEntries(90);

        expect(deleted).toBe(1);
        expect(await repo.findOne({ where: { id: old.id } })).toBeNull();
        expect(await repo.count()).toBe(recentCount - 1);
    });

    it('lets only a SuperAdmin clear the log', async () => {
        await adminClient.asAnonymousUser();
        await expect(adminClient.query(CLEAR_AUDIT_LOG)).rejects.toThrow();

        await adminClient.asSuperAdmin();
        const { clearAuditLog } = await adminClient.query(CLEAR_AUDIT_LOG);
        expect(clearAuditLog).toBeGreaterThan(0);
    });
});
