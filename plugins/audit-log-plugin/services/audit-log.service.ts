import { Injectable } from '@nestjs/common';
import { PaginatedList } from '@vendure/common/lib/shared-types';
import {
    ChannelService,
    ListQueryBuilder,
    ListQueryOptions,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { AuditLogEntry } from '../entities/audit-log-entry.entity';

@Injectable()
export class AuditLogService {
    constructor(
        private connection: TransactionalConnection,
        private channelService: ChannelService,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<AuditLogEntry>,
    ): Promise<PaginatedList<AuditLogEntry>> {
        return this.listQueryBuilder
            .build(AuditLogEntry, options, {
                ctx,
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async log(
        ctx: RequestContext | undefined,
        input: {
            action: string;
            entityType?: string;
            entityId?: string;
            detail?: Record<string, unknown>;
        },
    ): Promise<void> {
        const entry = new AuditLogEntry();
        entry.action = input.action;
        entry.entityType = input.entityType ?? '';
        entry.entityId = input.entityId ?? undefined as any;
        entry.userId = ctx?.activeUserId?.toString() ?? null as any;
        entry.userName = this.extractUserName(ctx);
        entry.detail = input.detail ?? null as any;
        if (ctx) {
            await this.channelService.assignToCurrentChannel(entry, ctx);
        }
        await this.connection.rawConnection.getRepository(AuditLogEntry).save(entry);
    }

    async pruneOldEntries(retentionDays: number): Promise<number> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);
        const result = await this.connection.rawConnection
            .getRepository(AuditLogEntry)
            .createQueryBuilder()
            .delete()
            .where('createdAt < :cutoff', { cutoff })
            .execute();
        return result.affected ?? 0;
    }

    private extractUserName(ctx?: RequestContext): string {
        if (!ctx?.activeUserId) return 'system';
        return `User #${ctx.activeUserId}`;
    }
}
