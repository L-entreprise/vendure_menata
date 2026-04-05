import { Injectable, Optional } from '@nestjs/common';
import { ID } from '@vendure/common/lib/shared-types';
import {
    ChannelService,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { AuditLogService } from '../../audit-log-plugin/services/audit-log.service';

import { PAGE_TRANSLATABLE_FIELDS, TRANSLATABLE_BLOCK_FIELDS } from '../constants';
import { CmsTranslationEntry } from '../entities/cms-translation-entry.entity';

// Import CMS plugin entities directly — they are registered with TypeORM at runtime
import { CmsPage } from '../../cms-plugin/entities/cms-page.entity';
import { CmsPageTranslation } from '../../cms-plugin/entities/cms-page-translation.entity';
import { ContentBlock } from '../../cms-plugin/entities/content-block.entity';
import { ContentBlockTranslation } from '../../cms-plugin/entities/content-block-translation.entity';
import { FormSubmission } from '../../cms-plugin/entities/form-submission.entity';

export interface TranslatableField {
    contentBlockId: ID | null;
    fieldName: string;
    blockKey: string | null;
    blockType: string | null;
}

export interface TranslationEntryInput {
    contentBlockId?: ID | null;
    entryId?: ID | null;
    fieldName: string;
    value: string;
}

export interface CollectionEntryTranslatableField {
    fieldName: string;
    blockType: string | null;
}

export interface PageTranslations {
    pageId: ID;
    languageCode: string;
    entries: CmsTranslationEntry[];
}

@Injectable()
export class CmsTranslationService {
    constructor(
        private connection: TransactionalConnection,
        private channelService: ChannelService,
        @Optional() private auditLogService?: AuditLogService,
    ) {}

    async getTranslatableFields(ctx: RequestContext, pageId: ID): Promise<TranslatableField[]> {
        const fields: TranslatableField[] = [];

        for (const fieldName of PAGE_TRANSLATABLE_FIELDS) {
            fields.push({ contentBlockId: null, fieldName, blockKey: null, blockType: null });
        }

        const blocks = await this.connection
            .getRepository(ctx, ContentBlock)
            .createQueryBuilder('block')
            .where('block.pageId = :pageId', { pageId })
            .orderBy('block.position', 'ASC')
            .getMany();

        for (const block of blocks) {
            const translatableFields = TRANSLATABLE_BLOCK_FIELDS[block.type];
            if (!translatableFields) continue;
            for (const fieldName of translatableFields) {
                fields.push({
                    contentBlockId: block.id,
                    fieldName,
                    blockKey: block.key,
                    blockType: block.type,
                });
            }
        }

        return fields;
    }

    async findByPage(
        ctx: RequestContext,
        pageId: ID,
        languageCode?: string,
    ): Promise<PageTranslations[]> {
        const qb = this.connection
            .getRepository(ctx, CmsTranslationEntry)
            .createQueryBuilder('entry')
            .innerJoin('entry.channels', 'channel', 'channel.id = :channelId', {
                channelId: ctx.channelId,
            })
            .where('entry.pageId = :pageId', { pageId });

        if (languageCode) {
            qb.andWhere('entry.languageCode = :languageCode', { languageCode });
        }

        const entries = await qb.getMany();

        const grouped = new Map<string, CmsTranslationEntry[]>();
        for (const entry of entries) {
            const existing = grouped.get(entry.languageCode) ?? [];
            grouped.set(entry.languageCode, [...existing, entry]);
        }

        return Array.from(grouped.entries()).map(([code, items]) => ({
            pageId,
            languageCode: code,
            entries: items,
        }));
    }

    async findByPageKey(
        ctx: RequestContext,
        pageKey: string,
        languageCode: string,
    ): Promise<PageTranslations | undefined> {
        const page = await this.connection
            .getRepository(ctx, CmsPage)
            .createQueryBuilder('page')
            .innerJoin('page.channels', 'channel', 'channel.id = :channelId', {
                channelId: ctx.channelId,
            })
            .where('page.key = :key', { key: pageKey })
            .andWhere('page.enabled = :enabled', { enabled: true })
            .getOne();

        if (!page) return undefined;

        const results = await this.findByPage(ctx, page.id, languageCode);
        return results[0];
    }

    async updateTranslations(
        ctx: RequestContext,
        pageId: ID,
        languageCode: string,
        entries: TranslationEntryInput[],
    ): Promise<CmsTranslationEntry[]> {
        const repo = this.connection.getRepository(ctx, CmsTranslationEntry);

        const existing = await repo
            .createQueryBuilder('entry')
            .innerJoin('entry.channels', 'channel', 'channel.id = :channelId', {
                channelId: ctx.channelId,
            })
            .where('entry.pageId = :pageId', { pageId })
            .andWhere('entry.languageCode = :languageCode', { languageCode })
            .getMany();

        const existingMap = new Map(
            existing.map(e => [`${e.contentBlockId ?? 'page'}|${e.fieldName}`, e]),
        );

        const results: CmsTranslationEntry[] = [];
        const changes: Record<string, { from: string | null; to: string }> = {};
        for (const input of entries) {
            const key = `${input.contentBlockId ?? 'page'}|${input.fieldName}`;
            const existingEntry = existingMap.get(key);

            if (existingEntry) {
                if (existingEntry.value !== input.value) {
                    changes[input.fieldName] = { from: existingEntry.value, to: input.value };
                }
                existingEntry.value = input.value;
                results.push(await repo.save(existingEntry));
            } else {
                changes[input.fieldName] = { from: null, to: input.value };
                const entry = new CmsTranslationEntry({
                    languageCode,
                    pageId,
                    contentBlockId: input.contentBlockId ?? null,
                    fieldName: input.fieldName,
                    value: input.value,
                });
                await this.channelService.assignToCurrentChannel(entry, ctx);
                results.push(await repo.save(entry));
            }
        }

        if (Object.keys(changes).length > 0) {
            this.auditLogService?.log(ctx, {
                action: 'TranslationUpdated',
                category: 'translation',
                entityType: 'CmsTranslation',
                entityId: pageId.toString(),
                detail: { languageCode, pageId: pageId.toString(), changes },
            }).catch(() => {});
        }

        return results;
    }

    /**
     * Reads the existing CMS content (from Vendure's built-in translation tables)
     * and returns it as pseudo-translation entries so the default language column
     * can be pre-populated on the dashboard.
     */
    async getDefaultContent(ctx: RequestContext, pageId: ID): Promise<Array<{
        languageCode: string;
        pageId: ID;
        contentBlockId: ID | null;
        fieldName: string;
        value: string;
    }>> {
        const entries: Array<{
            languageCode: string;
            pageId: ID;
            contentBlockId: ID | null;
            fieldName: string;
            value: string;
        }> = [];

        // Get page translations (name, slug)
        const pageTranslations = await this.connection
            .getRepository(ctx, CmsPageTranslation)
            .createQueryBuilder('pt')
            .where('pt.baseId = :pageId', { pageId })
            .getMany();

        const pageTrans = pageTranslations[0];
        if (pageTrans) {
            for (const fieldName of PAGE_TRANSLATABLE_FIELDS) {
                const value = (pageTrans as any)[fieldName];
                if (value != null) {
                    entries.push({
                        languageCode: '__default__',
                        pageId,
                        contentBlockId: null,
                        fieldName,
                        value: String(value),
                    });
                }
            }
        }

        // Get block translations (textContent, altText)
        const blocks = await this.connection
            .getRepository(ctx, ContentBlock)
            .createQueryBuilder('block')
            .where('block.pageId = :pageId', { pageId })
            .orderBy('block.position', 'ASC')
            .getMany();

        for (const block of blocks) {
            const translatableFields = TRANSLATABLE_BLOCK_FIELDS[block.type];
            if (!translatableFields) continue;

            // IMAGE blocks: the translatable value is the asset ID (featuredAssetId)
            if (block.type === 'IMAGE') {
                if (block.featuredAssetId) {
                    entries.push({
                        languageCode: '__default__',
                        pageId,
                        contentBlockId: block.id,
                        fieldName: 'image',
                        value: String(block.featuredAssetId),
                    });
                }
                continue;
            }

            const blockTranslations = await this.connection
                .getRepository(ctx, ContentBlockTranslation)
                .createQueryBuilder('bt')
                .where('bt.baseId = :blockId', { blockId: block.id })
                .getMany();

            const blockTrans = blockTranslations[0];
            if (blockTrans) {
                for (const fieldName of translatableFields) {
                    const value = (blockTrans as any)[fieldName];
                    if (value != null) {
                        entries.push({
                            languageCode: '__default__',
                            pageId,
                            contentBlockId: block.id,
                            fieldName,
                            value: String(value),
                        });
                    }
                }
            }
        }

        return entries;
    }

    /**
     * Returns the translatable field names for a collection page.
     * Collection entries store data as JSON keyed by block key,
     * so translatable fields are the text-type blocks.
     */
    async getCollectionEntryTranslatableFields(
        ctx: RequestContext,
        pageId: ID,
    ): Promise<CollectionEntryTranslatableField[]> {
        const blocks = await this.connection
            .getRepository(ctx, ContentBlock)
            .createQueryBuilder('block')
            .where('block.pageId = :pageId', { pageId })
            .orderBy('block.position', 'ASC')
            .getMany();

        const fields: CollectionEntryTranslatableField[] = [];
        for (const block of blocks) {
            if (TRANSLATABLE_BLOCK_FIELDS[block.type]) {
                fields.push({
                    fieldName: block.key,
                    blockType: block.type,
                });
            }
        }
        return fields;
    }

    /**
     * Returns the default content for a collection entry from its JSON data.
     */
    async getCollectionEntryDefaultContent(
        ctx: RequestContext,
        pageId: ID,
        entryId: ID,
    ): Promise<Array<{
        languageCode: string;
        pageId: ID;
        contentBlockId: ID | null;
        fieldName: string;
        value: string;
    }>> {
        const entry = await this.connection
            .getRepository(ctx, FormSubmission)
            .findOne({ where: { id: entryId, pageId } });

        if (!entry) return [];

        const blocks = await this.connection
            .getRepository(ctx, ContentBlock)
            .createQueryBuilder('block')
            .where('block.pageId = :pageId', { pageId })
            .orderBy('block.position', 'ASC')
            .getMany();

        const entries: Array<{
            languageCode: string;
            pageId: ID;
            contentBlockId: ID | null;
            fieldName: string;
            value: string;
        }> = [];

        for (const block of blocks) {
            if (!TRANSLATABLE_BLOCK_FIELDS[block.type]) continue;
            const value = entry.data[block.key];
            if (value != null && typeof value === 'string') {
                entries.push({
                    languageCode: '__default__',
                    pageId,
                    contentBlockId: null,
                    fieldName: block.key,
                    value,
                });
            }
        }

        return entries;
    }

    async findByEntry(
        ctx: RequestContext,
        pageId: ID,
        entryId: ID,
        languageCode?: string,
    ): Promise<PageTranslations[]> {
        const qb = this.connection
            .getRepository(ctx, CmsTranslationEntry)
            .createQueryBuilder('entry')
            .innerJoin('entry.channels', 'channel', 'channel.id = :channelId', {
                channelId: ctx.channelId,
            })
            .where('entry.pageId = :pageId', { pageId })
            .andWhere('entry.entryId = :entryId', { entryId });

        if (languageCode) {
            qb.andWhere('entry.languageCode = :languageCode', { languageCode });
        }

        const entries = await qb.getMany();

        const grouped = new Map<string, CmsTranslationEntry[]>();
        for (const e of entries) {
            const existing = grouped.get(e.languageCode) ?? [];
            grouped.set(e.languageCode, [...existing, e]);
        }

        return Array.from(grouped.entries()).map(([code, items]) => ({
            pageId,
            languageCode: code,
            entries: items,
        }));
    }

    async updateCollectionEntryTranslations(
        ctx: RequestContext,
        pageId: ID,
        entryId: ID,
        languageCode: string,
        inputEntries: TranslationEntryInput[],
    ): Promise<CmsTranslationEntry[]> {
        const repo = this.connection.getRepository(ctx, CmsTranslationEntry);

        const existing = await repo
            .createQueryBuilder('entry')
            .innerJoin('entry.channels', 'channel', 'channel.id = :channelId', {
                channelId: ctx.channelId,
            })
            .where('entry.pageId = :pageId', { pageId })
            .andWhere('entry.entryId = :entryId', { entryId })
            .andWhere('entry.languageCode = :languageCode', { languageCode })
            .getMany();

        const existingMap = new Map(
            existing.map(e => [e.fieldName, e]),
        );

        const results: CmsTranslationEntry[] = [];
        const changes: Record<string, { from: string | null; to: string }> = {};
        for (const input of inputEntries) {
            const existingEntry = existingMap.get(input.fieldName);

            if (existingEntry) {
                if (existingEntry.value !== input.value) {
                    changes[input.fieldName] = { from: existingEntry.value, to: input.value };
                }
                existingEntry.value = input.value;
                results.push(await repo.save(existingEntry));
            } else {
                changes[input.fieldName] = { from: null, to: input.value };
                const entry = new CmsTranslationEntry({
                    languageCode,
                    pageId,
                    entryId,
                    contentBlockId: null,
                    fieldName: input.fieldName,
                    value: input.value,
                });
                await this.channelService.assignToCurrentChannel(entry, ctx);
                results.push(await repo.save(entry));
            }
        }

        if (Object.keys(changes).length > 0) {
            this.auditLogService?.log(ctx, {
                action: 'EntryTranslationUpdated',
                category: 'translation',
                entityType: 'CollectionEntryTranslation',
                entityId: entryId.toString(),
                detail: { languageCode, pageId: pageId.toString(), entryId: entryId.toString(), changes },
            }).catch(() => {});
        }

        return results;
    }

    async deleteByPage(ctx: RequestContext, pageId: ID): Promise<void> {
        await this.connection
            .getRepository(ctx, CmsTranslationEntry)
            .createQueryBuilder()
            .delete()
            .where('pageId = :pageId', { pageId })
            .execute();
    }
}
