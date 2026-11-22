import { Injectable } from '@nestjs/common';
import { Customer, CustomerGroup, ID, normalizeEmailAddress, RequestContext, TransactionalConnection } from '@vendure/core';
import { IsNull } from 'typeorm';

import { emailDomainStem, namesMatch } from '../common/company-matching';

import { isCompany, MembershipRulesService } from './membership-rules.service';

const MAX_SUGGESTIONS = 3;

export interface DuplicateEmail {
    email: string;
    customers: Customer[];
}

export interface CompanyConflict {
    customer: Customer;
    companies: CustomerGroup[];
}

/** C2 suggestions, D2 duplicate check at entry, and the migration audits (D3, R3). */
@Injectable()
export class CustomerInsightService {
    constructor(
        private connection: TransactionalConnection,
        private membershipRules: MembershipRulesService,
    ) {}

    /** C2: "Entreprise ressemblante : MENATA-Colmar ?" — never applied without a click. */
    async companySuggestions(ctx: RequestContext, customerId: ID): Promise<CustomerGroup[]> {
        const customer = await this.connection.getEntityOrThrow(ctx, Customer, customerId);
        if (await this.membershipRules.companyOf(ctx, customerId)) {
            return [];
        }
        const hint = ((customer.customFields ?? {}) as { companyNameHint?: string | null }).companyNameHint ?? '';
        const domain = emailDomainStem(customer.emailAddress) ?? '';
        if (!hint && !domain) {
            return [];
        }
        const companies = (await this.connection.getRepository(ctx, CustomerGroup).find({ order: { name: 'ASC' } })).filter(isCompany);
        return companies
            .filter(company => (hint && namesMatch(hint, company.name)) || (domain && namesMatch(domain, company.name)))
            .slice(0, MAX_SUGGESTIONS);
    }

    /** D2: the customer already using this e-mail, typed with any case or spacing. */
    customerByEmail(ctx: RequestContext, email: string): Promise<Customer | null> {
        return this.connection
            .getRepository(ctx, Customer)
            .createQueryBuilder('customer')
            .where('customer.deletedAt IS NULL')
            .andWhere('LOWER(TRIM(customer.emailAddress)) = :email', { email: normalizeEmailAddress(email) })
            .getOne();
    }

    /** D3 audit: e-mails shared by several customers once normalized (data from before the plugin). */
    async duplicateEmails(ctx: RequestContext): Promise<DuplicateEmail[]> {
        const customers = await this.connection
            .getRepository(ctx, Customer)
            .find({ where: { deletedAt: IsNull() }, order: { id: 'ASC' } });
        const byEmail = new Map<string, Customer[]>();
        for (const customer of customers) {
            const key = normalizeEmailAddress(customer.emailAddress ?? '');
            byEmail.set(key, [...(byEmail.get(key) ?? []), customer]);
        }
        return [...byEmail.entries()].filter(([, list]) => list.length > 1).map(([email, list]) => ({ email, customers: list }));
    }

    /** R3 migration audit: customers already in more than one company. */
    async companyConflicts(ctx: RequestContext): Promise<CompanyConflict[]> {
        const customers = await this.connection
            .getRepository(ctx, Customer)
            .find({ where: { deletedAt: IsNull() }, relations: { groups: true } });
        return customers
            .map(customer => ({ customer, companies: customer.groups.filter(isCompany) }))
            .filter(conflict => conflict.companies.length > 1);
    }
}
