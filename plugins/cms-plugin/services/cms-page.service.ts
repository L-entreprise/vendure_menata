import { Injectable } from '@nestjs/common';
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
        });
        await this.connection.getRepository(ctx, CmsPage).remove(page);
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
