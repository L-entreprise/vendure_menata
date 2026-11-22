import { Injectable } from '@nestjs/common';
import { Country, Customer, CustomerGroup, ID, idsAreEqual, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';

import { CrmRuleError } from '../common/crm-errors';
import { ancestorsOf } from '../common/group-graph';
import { CustomerGroupAddress, GroupAddressKind } from '../entities/customer-group-address.entity';

import { HierarchyService } from './hierarchy.service';
import { JournalService } from './journal.service';
import { isCompany, MembershipRulesService } from './membership-rules.service';

const KINDS: GroupAddressKind[] = ['headquarters', 'shipping', 'billing'];
const TEXT_FIELDS = ['label', 'fullName', 'company', 'streetLine1', 'streetLine2', 'city', 'province', 'postalCode', 'phoneNumber'] as const;

export interface GroupAddressInput {
    kind: GroupAddressKind;
    label?: string | null;
    fullName?: string | null;
    company?: string | null;
    streetLine1: string;
    streetLine2?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    countryCode: string;
    phoneNumber?: string | null;
    defaultShipping?: boolean | null;
    defaultBilling?: boolean | null;
}

export interface AddressSuggestion {
    source: 'company' | 'ancestor';
    groupId: ID;
    groupName: string;
    address: CustomerGroupAddress;
}

/** A1-A3: company address books and the addresses proposed when ordering for a contact. */
@Injectable()
export class GroupAddressService {
    constructor(
        private connection: TransactionalConnection,
        private hierarchy: HierarchyService,
        private journal: JournalService,
        private membershipRules: MembershipRulesService,
    ) {}

    list(ctx: RequestContext, groupId: ID): Promise<CustomerGroupAddress[]> {
        return this.connection.getRepository(ctx, CustomerGroupAddress).find({ where: { groupId }, order: { id: 'ASC' } });
    }

    async create(ctx: RequestContext, groupId: ID, input: GroupAddressInput): Promise<CustomerGroupAddress> {
        await this.connection.getEntityOrThrow(ctx, CustomerGroup, groupId);
        const values = await this.validate(ctx, input);
        const saved = await this.connection.getRepository(ctx, CustomerGroupAddress).save(new CustomerGroupAddress({ ...values, groupId }));
        await this.keepSingleDefaults(ctx, saved);
        await this.journal.record(ctx, groupId, 'address-added', { label: saved.label || saved.streetLine1 });
        return saved;
    }

    async update(ctx: RequestContext, id: ID, input: GroupAddressInput): Promise<CustomerGroupAddress> {
        const existing = await this.connection.getEntityOrThrow(ctx, CustomerGroupAddress, id);
        const values = await this.validate(ctx, input);
        await this.connection.getRepository(ctx, CustomerGroupAddress).update({ id: existing.id }, values);
        const saved = await this.connection.getEntityOrThrow(ctx, CustomerGroupAddress, id);
        await this.keepSingleDefaults(ctx, saved);
        await this.journal.record(ctx, saved.groupId, 'address-updated', { label: saved.label || saved.streetLine1 });
        return saved;
    }

    async remove(ctx: RequestContext, id: ID): Promise<void> {
        const existing = await this.connection.getEntityOrThrow(ctx, CustomerGroupAddress, id);
        await this.connection.getRepository(ctx, CustomerGroupAddress).delete({ id: existing.id });
        await this.journal.record(ctx, existing.groupId, 'address-removed', { label: existing.label || existing.streetLine1 });
    }

    /** A3: the contact's company first, then each group above it, nearest first. */
    async suggestions(ctx: RequestContext, customerId: ID): Promise<AddressSuggestion[]> {
        await this.connection.getEntityOrThrow(ctx, Customer, customerId);
        const company = await this.membershipRules.companyOf(ctx, customerId);
        if (!company) {
            return [];
        }
        const graph = await this.hierarchy.graph(ctx);
        const order = [String(company.id), ...ancestorsOf(graph, company.id)];
        const groups = await this.connection.getRepository(ctx, CustomerGroup).find({ where: { id: In(order) } });
        const names = new Map(groups.map(group => [String(group.id), group.name]));
        const addresses = await this.connection.getRepository(ctx, CustomerGroupAddress).find({ where: { groupId: In(order) }, order: { id: 'ASC' } });
        return order.flatMap(groupId =>
            addresses
                .filter(address => String(address.groupId) === groupId)
                .sort((a, b) => Number(b.defaultShipping) - Number(a.defaultShipping))
                .map(address => ({
                    source: groupId === String(company.id) ? ('company' as const) : ('ancestor' as const),
                    groupId,
                    groupName: names.get(groupId) ?? '',
                    address,
                })),
        );
    }

    /** A2: a draft can start from a company; its contacts and addresses are then proposed. */
    async setDraftOrderCompany(ctx: RequestContext, orderId: ID, companyId: ID): Promise<Order> {
        const company = await this.connection.getEntityOrThrow(ctx, CustomerGroup, companyId);
        if (!isCompany(company)) {
            throw new CrmRuleError('crm-not-a-company', { groupName: company.name });
        }
        const order = await this.connection.getEntityOrThrow(ctx, Order, orderId, { relations: { customer: true } });
        if (order.state !== 'Draft') {
            throw new CrmRuleError('crm-order-not-draft');
        }
        // O1: the order goes to the customer's own company, so a draft whose customer belongs to
        // another company cannot be started for this one.
        const customerCompany = order.customer ? await this.membershipRules.companyOf(ctx, order.customer.id) : undefined;
        if (customerCompany && !idsAreEqual(customerCompany.id, company.id)) {
            throw new CrmRuleError('crm-draft-customer-other-company', {
                customerName: `${order.customer!.firstName} ${order.customer!.lastName}`.trim(),
                companyName: customerCompany.name,
            });
        }
        await this.connection.getRepository(ctx, Order).update({ id: order.id }, { customFields: { companyGroup: { id: company.id } } } as any);
        return this.connection.getEntityOrThrow(ctx, Order, orderId, { relations: { customFields: { companyGroup: true } } as any });
    }

    private async validate(ctx: RequestContext, input: GroupAddressInput) {
        if (!KINDS.includes(input.kind)) {
            throw new CrmRuleError('crm-address-invalid', { reason: 'kind' });
        }
        if (!input.streetLine1?.trim()) {
            throw new CrmRuleError('crm-address-invalid', { reason: 'street' });
        }
        const countryCode = input.countryCode.trim().toUpperCase();
        if ((await this.connection.getRepository(ctx, Country).count({ where: { code: countryCode } })) === 0) {
            throw new CrmRuleError('crm-address-unknown-country', { countryCode });
        }
        const text = Object.fromEntries(TEXT_FIELDS.map(field => [field, (input[field] ?? '').trim()]));
        return { ...text, kind: input.kind, countryCode, defaultShipping: !!input.defaultShipping, defaultBilling: !!input.defaultBilling };
    }

    private async keepSingleDefaults(ctx: RequestContext, saved: CustomerGroupAddress) {
        const repository = this.connection.getRepository(ctx, CustomerGroupAddress);
        const others = (await this.list(ctx, saved.groupId)).filter(address => String(address.id) !== String(saved.id));
        for (const flag of ['defaultShipping', 'defaultBilling'] as const) {
            if (saved[flag]) {
                for (const other of others.filter(address => address[flag])) {
                    await repository.update({ id: other.id }, { [flag]: false });
                }
            }
        }
    }
}
