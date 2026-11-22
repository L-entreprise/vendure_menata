import { Injectable } from '@nestjs/common';
import { Customer, CustomerGroup, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { Brackets } from 'typeorm';

import { ParsedCrmCode, parseCrmCode } from '../common/crm-codes';

const MAX_RESULTS = 8;
const MIN_TERM_LENGTH = 2;
const MAX_WORDS = 5;

export interface CrmSearchResult {
    customers: Customer[];
    groups: CustomerGroup[];
}

/** What the caller may read: customers need ReadCustomer, groups ReadCustomerGroup. */
export interface SearchScope {
    customers: boolean;
    groups: boolean;
}

const EMPTY: CrmSearchResult = { customers: [], groups: [] };

/**
 * A word for LIKE, lowercased. Wildcards typed by the user are dropped rather than escaped:
 * the ESCAPE clause is written differently on Postgres, MySQL / MariaDB and SQLite, and the
 * query must run unchanged on all three. Returns '' when nothing searchable is left.
 */
function cleanWord(word: string): string {
    return word.toLowerCase().replace(/[%_\\]/g, '');
}

/** Every word must match the first name, the last name or the e-mail ("claire mart" finds Claire Martin). */
function wordsMatchCustomer(words: string[]): Brackets {
    return new Brackets(all => {
        words.forEach((word, index) => {
            const param = `word${index}`;
            all.andWhere(
                new Brackets(one => {
                    one.where(`LOWER(customer.firstName) LIKE :${param}`)
                        .orWhere(`LOWER(customer.lastName) LIKE :${param}`)
                        .orWhere(`LOWER(customer.emailAddress) LIKE :${param}`);
                }),
                { [param]: `%${word}%` },
            );
        });
    });
}

/**
 * S1 / I3: one search box for customers and groups, by name, e-mail or CLI- / GRP- code.
 * Customers are limited to the active channel, like the native customer list.
 */
@Injectable()
export class SearchService {
    constructor(private connection: TransactionalConnection) {}

    async search(ctx: RequestContext, rawTerm: string, scope: SearchScope): Promise<CrmSearchResult> {
        const term = rawTerm.trim();
        const code = parseCrmCode(term);
        if (code) {
            return this.byCode(ctx, code, scope);
        }
        const words = term.split(/\s+/).map(cleanWord).filter(Boolean).slice(0, MAX_WORDS);
        if (words.join('').length < MIN_TERM_LENGTH) {
            return EMPTY;
        }
        const customers = scope.customers
            ? await this.channelCustomers(ctx)
                  .andWhere(wordsMatchCustomer(words))
                  .orderBy('customer.lastName', 'ASC')
                  .take(MAX_RESULTS)
                  .getMany()
            : [];
        const groups = scope.groups
            ? await this.connection
                  .getRepository(ctx, CustomerGroup)
                  .createQueryBuilder('grp')
                  .where('LOWER(grp.name) LIKE :pattern', { pattern: `%${words.join(' ')}%` })
                  .orderBy('grp.name', 'ASC')
                  .take(MAX_RESULTS)
                  .getMany()
            : [];
        return { customers, groups };
    }

    async resolveCode(ctx: RequestContext, code: string, scope: SearchScope): Promise<{ kind: string; id: ID } | null> {
        const parsed = parseCrmCode(code);
        if (!parsed) {
            return null;
        }
        const found = await this.byCode(ctx, parsed, scope);
        const entity = parsed.kind === 'customer' ? found.customers[0] : found.groups[0];
        return entity ? { kind: parsed.kind, id: entity.id } : null;
    }

    private async byCode(ctx: RequestContext, code: ParsedCrmCode, scope: SearchScope): Promise<CrmSearchResult> {
        if (code.kind === 'customer') {
            const customer = scope.customers
                ? await this.channelCustomers(ctx).andWhere('customer.id = :id', { id: code.id }).getOne()
                : null;
            return { customers: customer ? [customer] : [], groups: [] };
        }
        const group = scope.groups ? await this.connection.getRepository(ctx, CustomerGroup).findOne({ where: { id: code.id } }) : null;
        return { customers: [], groups: group ? [group] : [] };
    }

    /** Non-deleted customers of the active channel. */
    private channelCustomers(ctx: RequestContext) {
        return this.connection
            .getRepository(ctx, Customer)
            .createQueryBuilder('customer')
            .innerJoin('customer.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('customer.deletedAt IS NULL');
    }
}

