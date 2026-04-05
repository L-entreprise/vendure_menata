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

export interface AuditLogInput {
    action: string;
    category?: string;
    entityType?: string;
    entityId?: string;
    severity?: 'info' | 'warning' | 'critical';
    success?: boolean;
    detail?: Record<string, unknown>;
}

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

    async log(ctx: RequestContext | undefined, input: AuditLogInput): Promise<void> {
        const entry = new AuditLogEntry();
        entry.action = input.action;
        entry.category = input.category ?? 'other';
        entry.entityType = input.entityType ?? '';
        entry.entityId = input.entityId ?? '';
        entry.severity = input.severity ?? 'info';
        entry.success = input.success ?? true;
        entry.userId = ctx?.activeUserId?.toString() ?? '';
        entry.userName = this.extractUserName(ctx);
        entry.apiType = ctx?.apiType ?? '';
        entry.ipAddress = this.extractIpAddress(ctx) ?? '';
        entry.detail = input.detail ?? ({} as any);
        if (ctx) {
            await this.channelService.assignToCurrentChannel(entry, ctx);
        }
        await this.connection.rawConnection.getRepository(AuditLogEntry).save(entry);
    }

    async clearAll(): Promise<number> {
        const repo = this.connection.rawConnection.getRepository(AuditLogEntry);
        const count = await repo.count();
        // Delete via query builder to handle foreign key constraints (join table)
        await repo.createQueryBuilder()
            .delete()
            .execute();
        return count;
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

    async getStats(ctx: RequestContext): Promise<{
        totalEntries: number;
        todayEntries: number;
        categories: Array<{ category: string; count: number }>;
        topUsers: Array<{ userName: string; count: number }>;
        recentCritical: AuditLogEntry[];
    }> {
        const repo = this.connection.rawConnection.getRepository(AuditLogEntry);

        const totalEntries = await repo.count();

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEntries = await repo
            .createQueryBuilder('entry')
            .where('entry.createdAt >= :todayStart', { todayStart })
            .getCount();

        const categories = await repo
            .createQueryBuilder('entry')
            .select('entry.category', 'category')
            .addSelect('COUNT(*)', 'count')
            .groupBy('entry.category')
            .orderBy('count', 'DESC')
            .getRawMany();

        const topUsers = await repo
            .createQueryBuilder('entry')
            .select('entry.userName', 'userName')
            .addSelect('COUNT(*)', 'count')
            .where('entry.userName IS NOT NULL')
            .groupBy('entry.userName')
            .orderBy('count', 'DESC')
            .limit(10)
            .getRawMany();

        const recentCritical = await repo.find({
            where: { severity: 'critical' },
            order: { createdAt: 'DESC' },
            take: 5,
        });

        return { totalEntries, todayEntries, categories, topUsers, recentCritical };
    }

    private extractUserName(ctx?: RequestContext): string {
        if (!ctx?.activeUserId) return 'system';
        return `User #${ctx.activeUserId}`;
    }

    private extractIpAddress(ctx?: RequestContext): string {
        try {
            const req = (ctx as any)?._req;
            if (!req) return '';
            const forwarded = req.headers?.['x-forwarded-for'];
            if (forwarded) {
                return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
            }
            return req.ip ?? req.socket?.remoteAddress ?? '';
        } catch {
            return '';
        }
    }
}
