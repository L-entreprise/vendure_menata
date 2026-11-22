import { Injectable } from '@nestjs/common';
import { Customer, CustomerGroup, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { Brackets, IsNull } from 'typeorm';

import { ParsedCrmCode, parseCrmCode } from '../common/crm-codes';

const MAX_RESULTS = 8;
const MIN_TERM_LENGTH = 2;

export interface CrmSearchResult {
    customers: Customer[];
    groups: CustomerGroup[];
}

function likePattern(term: string): string {
    return `%${term.toLowerCase().replace(/[\\%_]/g, character => `\\${character}`)}%`;
}

/** S1 / I3: one search box for customers and groups, by name, e-mail or CLI- / GRP- code. */
@Injectable()
export class SearchService {
    constructor(private connection: TransactionalConnection) {}

    async search(ctx: RequestContext, rawTerm: string): Promise<CrmSearchResult> {
        const term = rawTerm.trim();
        const code = parseCrmCode(term);
        if (code) {
            return this.byCode(ctx, code);
        }
        if (term.length < MIN_TERM_LENGTH) {
            return { customers: [], groups: [] };
        }
        const pattern = likePattern(term);
        const customers = await this.connection
            .getRepository(ctx, Customer)
            .createQueryBuilder('customer')
            .where('customer.deletedAt IS NULL')
            .andWhere(
                new Brackets(qb => {
                    qb.where('LOWER(customer.firstName) LIKE :pattern', { pattern })
                        .orWhere('LOWER(customer.lastName) LIKE :pattern', { pattern })
                        .orWhere('LOWER(customer.emailAddress) LIKE :pattern', { pattern })
                        .orWhere("LOWER(customer.firstName || ' ' || customer.lastName) LIKE :pattern", { pattern });
                }),
            )
            .orderBy('customer.lastName', 'ASC')
            .take(MAX_RESULTS)
            .getMany();
        const groups = await this.connection
            .getRepository(ctx, CustomerGroup)
            .createQueryBuilder('grp')
            .where('LOWER(grp.name) LIKE :pattern', { pattern })
            .orderBy('grp.name', 'ASC')
            .take(MAX_RESULTS)
            .getMany();
        return { customers, groups };
    }

    async resolveCode(ctx: RequestContext, code: string): Promise<{ kind: string; id: ID } | null> {
        const parsed = parseCrmCode(code);
        if (!parsed) {
            return null;
        }
        const found = await this.byCode(ctx, parsed);
        const entity = parsed.kind === 'customer' ? found.customers[0] : found.groups[0];
        return entity ? { kind: parsed.kind, id: entity.id } : null;
    }

    private async byCode(ctx: RequestContext, code: ParsedCrmCode): Promise<CrmSearchResult> {
        if (code.kind === 'customer') {
            const customer = await this.connection.getRepository(ctx, Customer).findOne({ where: { id: code.id, deletedAt: IsNull() } });
            return { customers: customer ? [customer] : [], groups: [] };
        }
        const group = await this.connection.getRepository(ctx, CustomerGroup).findOne({ where: { id: code.id } });
        return { customers: [], groups: group ? [group] : [] };
    }
}
