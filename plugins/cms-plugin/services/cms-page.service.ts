import { Injectable, Optional } from '@nestjs/common';
import { DeletionResponse, DeletionResult, Permission } from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import {
    ChannelService,
    ForbiddenError,
    InternalServerError,
    LanguageCode,
    ListQueryBuilder,
    ListQueryOptions,
    RequestContext,
    TransactionalConnection,
    TranslatableSaver,
    UserInputError,
    translateDeep,
} from '@vendure/core';

import { AuditLogService } from '../../audit-log-plugin/services/audit-log.service';
import { ContentBlockTranslation } from '../entities/content-block-translation.entity';
import { ContentBlock } from '../entities/content-block.entity';
import { CmsPageTranslation } from '../entities/cms-page-translation.entity';
import { CmsPage } from '../entities/cms-page.entity';
import { sanitizeBlockTranslations } from './sanitize-rich-text';

const MAX_KEY_LENGTH = 255;
const MAX_METADATA_BYTES = 8192;

interface ContentBlockInput {
    id?: ID;
    type: string;
    key: string;
    position: number;
    enabled?: boolean;
    featuredAssetId?: ID | null;
    metadata?: Record<string, unknown> | null;
    dateValue?: Date | string | null;
    numberValue?: number | null;
    translations?: Array<{
        id?: ID;
        languageCode: LanguageCode;
        name: string;
        textContent?: string;
        altText?: string;
    }>;
}

@Injectable()
export class CmsPageService {
    constructor(
        private connection: TransactionalConnection,
        private translatableSaver: TranslatableSaver,
        private listQueryBuilder: ListQueryBuilder,
        private channelService: ChannelService,
        @Optional() private auditLogService?: AuditLogService,
    ) {}

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<CmsPage>,
        onlyEnabled = false,
    ): Promise<PaginatedList<CmsPage>> {
        const qb = this.listQueryBuilder
            .build(CmsPage, options, {
                relations: ['channels'],
                ctx,
                channelId: ctx.channelId,
            });
        if (onlyEnabled) {
            qb.andWhere('cmspage.enabled = :enabled', { enabled: true });
        }
        return qb
            .getManyAndCount()
            .then(([items, totalItems]) => ({
                items: items.map(item => translateDeep(item, ctx.languageCode)),
                totalItems,
            }));
    }

    async findOne(
        ctx: RequestContext,
        id: ID,
        onlyEnabled = false,
    ): Promise<CmsPage | undefined> {
        const page = await this.connection.findOneInChannel(
            ctx,
            CmsPage,
            id,
            ctx.channelId,
            { relations: ['channels', 'contentBlocks', 'contentBlocks.featuredAsset'] },
        );
        if (!page) return undefined;
        if (onlyEnabled && !page.enabled) return undefined;
        page.contentBlocks = (page.contentBlocks || [])
            .filter(block => !onlyEnabled || block.enabled)
            .sort((a, b) => a.position - b.position);
        const translated = translateDeep(page, ctx.languageCode);
        translated.contentBlocks = translated.contentBlocks.map(
            block => translateDeep(block, ctx.languageCode),
        );
        return translated;
    }

    async findByKey(
        ctx: RequestContext,
        key: string,
        onlyEnabled = false,
    ): Promise<CmsPage | undefined> {
        const qb = this.listQueryBuilder
            .build(CmsPage, {}, {
                ctx,
                channelId: ctx.channelId,
                relations: ['channels', 'contentBlocks', 'contentBlocks.featuredAsset'],
            })
            .andWhere('cmspage.key = :key', { key });
        if (onlyEnabled) {
            qb.andWhere('cmspage.enabled = :enabled', { enabled: true });
        }
        const page = await qb.getOne();
        if (!page) return undefined;
        page.contentBlocks = (page.contentBlocks || [])
            .filter(block => !onlyEnabled || block.enabled)
            .sort((a, b) => a.position - b.position);
        const translated = translateDeep(page, ctx.languageCode);
        translated.contentBlocks = translated.contentBlocks.map(
            block => translateDeep(block, ctx.languageCode),
        );
        return translated;
    }

    async create(ctx: RequestContext, input: {
        key: string;
        enabled?: boolean;
        acceptsSubmissions?: boolean;
        isCollection?: boolean;
        pinnedInSidebar?: boolean;
        allowCustomerCreation?: boolean;
        sidebarOrder?: number;
        translations: Array<{
            languageCode: LanguageCode;
            name: string;
            slug: string;
        }>;
        contentBlocks?: ContentBlockInput[];
    }): Promise<CmsPage> {
        this.validateKey(input.key);
        await this.assertUniqueKey(ctx, input.key);
        this.validateContentBlocks(input.contentBlocks);
        this.validateMutualExclusivity(input.acceptsSubmissions, input.isCollection);

        const pageInput = {
            key: input.key,
            enabled: input.enabled ?? true,
            acceptsSubmissions: input.acceptsSubmissions ?? false,
            isCollection: input.isCollection ?? false,
            pinnedInSidebar: input.pinnedInSidebar ?? false,
            allowCustomerCreation: input.allowCustomerCreation ?? false,
            sidebarOrder: input.sidebarOrder ?? 0,
            translations: input.translations,
        };
        const page = await this.translatableSaver.create({
            ctx,
            input: pageInput,
            entityType: CmsPage,
            translationType: CmsPageTranslation,
            beforeSave: async p => {
                await this.channelService.assignToCurrentChannel(p, ctx);
            },
        });

        if (input.contentBlocks?.length) {
            await this.saveContentBlocks(ctx, page.id, input.contentBlocks);
        }

        const result = await this.findOne(ctx, page.id);
        if (!result) {
            throw new InternalServerError('Failed to retrieve created CmsPage');
        }
        this.auditLogService?.log(ctx, {
            action: 'CmsPageCreated',
            category: 'cms',
            entityType: 'CmsPage',
            entityId: page.id.toString(),
            detail: {
                key: input.key,
                enabled: input.enabled ?? true,
                acceptsSubmissions: input.acceptsSubmissions ?? false,
                isCollection: input.isCollection ?? false,
                translations: input.translations.map(t => ({ lang: t.languageCode, name: t.name, slug: t.slug })),
                blocks: input.contentBlocks?.map(b => ({ key: b.key, type: b.type })),
            },
        }).catch(() => {});
        return result;
    }

    async update(ctx: RequestContext, input: {
        id: ID;
        key?: string;
        enabled?: boolean;
        acceptsSubmissions?: boolean;
        isCollection?: boolean;
        pinnedInSidebar?: boolean;
        allowCustomerCreation?: boolean;
        sidebarOrder?: number;
        translations?: Array<{
            id?: ID;
            languageCode: LanguageCode;
            name: string;
            slug: string;
        }>;
        contentBlocks?: ContentBlockInput[];
    }): Promise<CmsPage> {
        const oldPage = await this.connection.findOneInChannel(ctx, CmsPage, input.id, ctx.channelId, {
            relations: ['contentBlocks', 'contentBlocks.featuredAsset'],
        });
        const oldTranslations = oldPage ? await this.connection.getRepository(ctx, CmsPageTranslation)
            .createQueryBuilder('pt').where('pt.baseId = :id', { id: input.id }).getMany() : [];
        const oldBlockTranslations = new Map<string, { name: string; textContent: string; altText: string }>();
        if (oldPage?.contentBlocks) {
            for (const block of oldPage.contentBlocks) {
                const bt = await this.connection.getRepository(ctx, ContentBlockTranslation)
                    .createQueryBuilder('bt').where('bt.baseId = :id', { id: block.id }).getMany();
                if (bt[0]) {
                    oldBlockTranslations.set(block.id.toString(), {
                        name: bt[0].name, textContent: bt[0].textContent, altText: bt[0].altText,
                    });
                }
            }
        }
        const isSuperAdmin = ctx.userHasPermissions([Permission.SuperAdmin]);

        if (isSuperAdmin) {
            if (input.key !== undefined) {
                this.validateKey(input.key);
                await this.assertUniqueKey(ctx, input.key, input.id);
            }
            this.validateContentBlocks(input.contentBlocks);
            this.validateMutualExclusivity(input.acceptsSubmissions, input.isCollection);

            const updateInput = {
                id: input.id,
                ...(input.key !== undefined && { key: input.key }),
                ...(input.enabled !== undefined && { enabled: input.enabled }),
                ...(input.acceptsSubmissions !== undefined && { acceptsSubmissions: input.acceptsSubmissions }),
                ...(input.isCollection !== undefined && { isCollection: input.isCollection }),
                ...(input.pinnedInSidebar !== undefined && { pinnedInSidebar: input.pinnedInSidebar }),
                ...(input.allowCustomerCreation !== undefined && { allowCustomerCreation: input.allowCustomerCreation }),
                ...(input.sidebarOrder !== undefined && { sidebarOrder: input.sidebarOrder }),
                ...(input.translations && { translations: input.translations }),
            };
            await this.translatableSaver.update({
                ctx,
                input: updateInput,
                entityType: CmsPage,
                translationType: CmsPageTranslation,
            });

            if (input.contentBlocks !== undefined) {
                await this.syncContentBlocks(ctx, input.id, input.contentBlocks);
            }
        } else {
            // Non-SuperAdmin: only allow content value updates on existing blocks
            if (input.contentBlocks !== undefined) {
                this.validateContentBlocks(input.contentBlocks);
                await this.syncContentBlocksContentOnly(ctx, input.id, input.contentBlocks);
            }
        }

        const result = await this.findOne(ctx, input.id);
        if (!result) {
            throw new InternalServerError('Failed to retrieve updated CmsPage');
        }
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        // Track page-level field changes
        const trackableFields = ['key', 'enabled', 'acceptsSubmissions', 'isCollection', 'pinnedInSidebar', 'allowCustomerCreation', 'sidebarOrder'] as const;
        for (const field of trackableFields) {
            if (input[field] !== undefined && input[field] !== (oldPage as any)?.[field]) {
                changes[field] = { from: (oldPage as any)?.[field], to: input[field] };
            }
        }
        // Track page translation changes (name, slug)
        if (input.translations) {
            for (const t of input.translations) {
                const oldT = oldTranslations.find(ot => ot.languageCode === t.languageCode);
                if (oldT) {
                    if (oldT.name !== t.name) {
                        changes[`name[${t.languageCode}]`] = { from: oldT.name, to: t.name };
                    }
                    if ((oldT as any).slug !== t.slug) {
                        changes[`slug[${t.languageCode}]`] = { from: (oldT as any).slug, to: t.slug };
                    }
                } else {
                    changes[`name[${t.languageCode}]`] = { from: null, to: t.name };
                    changes[`slug[${t.languageCode}]`] = { from: null, to: t.slug };
                }
            }
        }
        // Track content block changes
        if (input.contentBlocks && oldPage?.contentBlocks) {
            const oldBlockMap = new Map(oldPage.contentBlocks.map(b => [b.id.toString(), b]));
            for (const block of input.contentBlocks) {
                const blockLabel = block.key || block.id?.toString() || 'new';
                if (block.id) {
                    const oldBlock = oldBlockMap.get(block.id.toString());
                    if (oldBlock) {
                        if (oldBlock.enabled !== (block.enabled ?? true)) {
                            changes[`block[${blockLabel}].enabled`] = { from: oldBlock.enabled, to: block.enabled ?? true };
                        }
                        if (block.metadata && JSON.stringify(oldBlock.metadata) !== JSON.stringify(block.metadata)) {
                            changes[`block[${blockLabel}].metadata`] = { from: oldBlock.metadata, to: block.metadata };
                        }
                        if (block.numberValue !== undefined && oldBlock.numberValue !== block.numberValue) {
                            changes[`block[${blockLabel}].numberValue`] = { from: oldBlock.numberValue, to: block.numberValue };
                        }
                        if (block.featuredAssetId !== undefined && oldBlock.featuredAssetId?.toString() !== block.featuredAssetId?.toString()) {
                            changes[`block[${blockLabel}].featuredAsset`] = { from: oldBlock.featuredAssetId?.toString() ?? null, to: block.featuredAssetId?.toString() ?? null };
                        }
                        // Track block translation changes (textContent, name, altText)
                        const oldBT = oldBlockTranslations.get(block.id.toString());
                        if (block.translations && oldBT) {
                            for (const bt of block.translations) {
                                if (oldBT.textContent !== (bt.textContent ?? '')) {
                                    changes[`block[${blockLabel}].textContent`] = { from: oldBT.textContent, to: bt.textContent ?? '' };
                                }
                                if (oldBT.name !== bt.name) {
                                    changes[`block[${blockLabel}].name`] = { from: oldBT.name, to: bt.name };
                                }
                                if (oldBT.altText !== (bt.altText ?? '')) {
                                    changes[`block[${blockLabel}].altText`] = { from: oldBT.altText, to: bt.altText ?? '' };
                                }
                            }
                        }
                    }
                } else {
                    changes[`block[${blockLabel}].added`] = { from: null, to: block.type };
                }
            }
            // Track deleted blocks
            const incomingIds = new Set(input.contentBlocks.filter(b => b.id).map(b => b.id!.toString()));
            for (const oldBlock of oldPage.contentBlocks) {
                if (!incomingIds.has(oldBlock.id.toString())) {
                    changes[`block[${oldBlock.key}].removed`] = { from: oldBlock.type, to: null };
                }
            }
        }
        this.auditLogService?.log(ctx, {
            action: 'CmsPageUpdated',
            category: 'cms',
            entityType: 'CmsPage',
            entityId: input.id.toString(),
            detail: {
                key: result.key,
                changes: Object.keys(changes).length > 0 ? changes : undefined,
            },
        }).catch(() => {});
        return result;
    }

    async findPinned(ctx: RequestContext): Promise<CmsPage[]> {
        const pages = await this.connection.getRepository(ctx, CmsPage)
            .createQueryBuilder('page')
            .leftJoinAndSelect('page.translations', 'translation')
            .innerJoin('page.channels', 'channel', 'channel.id = :channelId', {
                channelId: ctx.channelId,
            })
            .where('page.pinnedInSidebar = :pinned', { pinned: true })
            .andWhere('page.enabled = :enabled', { enabled: true })
            .orderBy('page.sidebarOrder', 'ASC')
            .addOrderBy('page.id', 'ASC')
            .getMany();
        return pages.map(page => translateDeep(page, ctx.languageCode));
    }

    async delete(ctx: RequestContext, id: ID): Promise<DeletionResponse> {
        const page = await this.connection.getEntityOrThrow(ctx, CmsPage, id, {
            channelId: ctx.channelId,
            relations: ['contentBlocks'],
        });
        const pageKey = page.key;
        const blockCount = page.contentBlocks?.length ?? 0;
        await this.connection.getRepository(ctx, CmsPage).remove(page);
        this.auditLogService?.log(ctx, {
            action: 'CmsPageDeleted',
            category: 'cms',
            entityType: 'CmsPage',
            entityId: id.toString(),
            severity: 'warning',
            detail: {
                key: pageKey,
                enabled: page.enabled,
                isCollection: page.isCollection,
                acceptsSubmissions: page.acceptsSubmissions,
                blockCount,
            },
        }).catch(() => {});
        return { result: DeletionResult.DELETED };
    }

    private validateMutualExclusivity(acceptsSubmissions?: boolean, isCollection?: boolean): void {
        if (acceptsSubmissions && isCollection) {
            throw new UserInputError('A page cannot be both a collection and accept submissions');
        }
    }

    private validateKey(key: string): void {
        if (!key || key.length > MAX_KEY_LENGTH) {
            throw new UserInputError(`Key must be between 1 and ${MAX_KEY_LENGTH} characters`);
        }
    }

    private async assertUniqueKey(ctx: RequestContext, key: string, excludeId?: ID): Promise<void> {
        const existing = await this.listQueryBuilder
            .build(CmsPage, {}, {
                ctx,
                channelId: ctx.channelId,
            })
            .andWhere('cmspage.key = :key', { key })
            .getOne();
        if (existing && (!excludeId || existing.id.toString() !== excludeId.toString())) {
            throw new UserInputError(`A CMS page with key "${key}" already exists in this channel`);
        }
    }

    private validateContentBlocks(blocks?: ContentBlockInput[]): void {
        if (!blocks) return;
        for (const block of blocks) {
            if (block.key && block.key.length > MAX_KEY_LENGTH) {
                throw new UserInputError(`Block key must not exceed ${MAX_KEY_LENGTH} characters`);
            }
            if (block.metadata) {
                const size = JSON.stringify(block.metadata).length;
                if (size > MAX_METADATA_BYTES) {
                    throw new UserInputError(`Block metadata exceeds maximum size of ${MAX_METADATA_BYTES} bytes`);
                }
            }
            sanitizeBlockTranslations(block.type, block.translations);
        }
    }

    private stripInternalMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
        if (!metadata) return null;
        const { assetPreviews, ...rest } = metadata;
        return Object.keys(rest).length > 0 ? rest : null;
    }

    private async saveContentBlocks(
        ctx: RequestContext,
        pageId: ID,
        blocks: ContentBlockInput[],
    ): Promise<void> {
        for (const blockInput of blocks) {
            const createInput = {
                key: blockInput.key,
                type: blockInput.type,
                enabled: blockInput.enabled ?? true,
                position: blockInput.position,
                pageId,
                featuredAssetId: blockInput.featuredAssetId ?? null,
                metadata: this.stripInternalMetadata(blockInput.metadata),
                dateValue: blockInput.dateValue ?? null,
                numberValue: blockInput.numberValue ?? null,
                translations: blockInput.translations ?? [],
            };
            await this.translatableSaver.create({
                ctx,
                input: createInput,
                entityType: ContentBlock,
                translationType: ContentBlockTranslation,
                beforeSave: async b => {
                    await this.channelService.assignToCurrentChannel(b, ctx);
                },
            });
        }
    }

    private async syncContentBlocks(
        ctx: RequestContext,
        pageId: ID,
        incomingBlocks: ContentBlockInput[],
    ): Promise<void> {
        const blockRepo = this.connection.getRepository(ctx, ContentBlock);
        const existingBlocks = await blockRepo
            .createQueryBuilder('block')
            .where('block.pageId = :pageId', { pageId })
            .getMany();
        const existingIds = new Set(existingBlocks.map(b => b.id.toString()));

        // HIGH-2: Reject foreign block IDs that don't belong to this page
        for (const blockInput of incomingBlocks) {
            if (blockInput.id && !existingIds.has(blockInput.id.toString())) {
                throw new ForbiddenError();
            }
        }

        const incomingIds = new Set(
            incomingBlocks.filter(b => b.id).map(b => b.id!.toString()),
        );

        // Batch delete removed blocks
        const blocksToDelete = existingBlocks.filter(
            existing => !incomingIds.has(existing.id.toString()),
        );
        if (blocksToDelete.length > 0) {
            await blockRepo.remove(blocksToDelete);
        }

        for (const blockInput of incomingBlocks) {
            if (blockInput.id && existingIds.has(blockInput.id.toString())) {
                const updateInput = {
                    id: blockInput.id,
                    key: blockInput.key,
                    type: blockInput.type,
                    enabled: blockInput.enabled ?? true,
                    position: blockInput.position,
                    featuredAssetId: blockInput.featuredAssetId ?? null,
                    metadata: this.stripInternalMetadata(blockInput.metadata),
                    dateValue: blockInput.dateValue ?? null,
                    numberValue: blockInput.numberValue ?? null,
                    translations: blockInput.translations,
                };
                await this.translatableSaver.update({
                    ctx,
                    input: updateInput,
                    entityType: ContentBlock,
                    translationType: ContentBlockTranslation,
                });
            } else {
                const createInput = {
                    key: blockInput.key,
                    type: blockInput.type,
                    enabled: blockInput.enabled ?? true,
                    position: blockInput.position,
                    pageId,
                    featuredAssetId: blockInput.featuredAssetId ?? null,
                    metadata: this.stripInternalMetadata(blockInput.metadata),
                    dateValue: blockInput.dateValue ?? null,
                    numberValue: blockInput.numberValue ?? null,
                    translations: blockInput.translations ?? [],
                };
                await this.translatableSaver.create({
                    ctx,
                    input: createInput,
                    entityType: ContentBlock,
                    translationType: ContentBlockTranslation,
                    beforeSave: async b => {
                        await this.channelService.assignToCurrentChannel(b, ctx);
                    },
                });
            }
        }
    }

    /**
     * Non-SuperAdmin content-only sync: updates values on existing blocks
     * without allowing structural changes (no add/remove/reorder/key changes).
     */
    private async syncContentBlocksContentOnly(
        ctx: RequestContext,
        pageId: ID,
        incomingBlocks: ContentBlockInput[],
    ): Promise<void> {
        const blockRepo = this.connection.getRepository(ctx, ContentBlock);
        const existingBlocks = await blockRepo
            .createQueryBuilder('block')
            .where('block.pageId = :pageId', { pageId })
            .getMany();
        const existingById = new Map(existingBlocks.map(b => [b.id.toString(), b]));

        for (const blockInput of incomingBlocks) {
            if (!blockInput.id) {
                // Non-SuperAdmin cannot add new blocks
                throw new ForbiddenError();
            }
            const existing = existingById.get(blockInput.id.toString());
            if (!existing) {
                // Block doesn't belong to this page
                throw new ForbiddenError();
            }

            // Preserve structural fields from the existing block, only update content values
            // Allow position changes so non-admins can reorder blocks
            const updateInput = {
                id: blockInput.id,
                key: existing.key,
                type: existing.type,
                enabled: existing.enabled,
                position: blockInput.position ?? existing.position,
                featuredAssetId: blockInput.featuredAssetId ?? null,
                metadata: this.stripInternalMetadata(blockInput.metadata),
                dateValue: blockInput.dateValue ?? null,
                numberValue: blockInput.numberValue ?? null,
                translations: blockInput.translations,
            };
            await this.translatableSaver.update({
                ctx,
                input: updateInput,
                entityType: ContentBlock,
                translationType: ContentBlockTranslation,
            });
        }

        // Verify no blocks were removed (all existing blocks must be present)
        const incomingIds = new Set(incomingBlocks.map(b => b.id!.toString()));
        const missingBlocks = existingBlocks.filter(b => !incomingIds.has(b.id.toString()));
        if (missingBlocks.length > 0) {
            throw new ForbiddenError();
        }
    }
}
