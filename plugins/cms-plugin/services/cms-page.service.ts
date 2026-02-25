import { Injectable } from '@nestjs/common';
import { DeletionResponse, DeletionResult } from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import {
    ChannelService,
    LanguageCode,
    ListQueryBuilder,
    ListQueryOptions,
    RequestContext,
    TransactionalConnection,
    TranslatableSaver,
    translateDeep,
} from '@vendure/core';

import { ContentBlockTranslation } from '../entities/content-block-translation.entity';
import { ContentBlock } from '../entities/content-block.entity';
import { CmsPageTranslation } from '../entities/cms-page-translation.entity';
import { CmsPage } from '../entities/cms-page.entity';

interface ContentBlockInput {
    id?: ID;
    type: string;
    key: string;
    position: number;
    enabled?: boolean;
    featuredAssetId?: ID | null;
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
    ): Promise<PaginatedList<CmsPage>> {
        return this.listQueryBuilder
            .build(CmsPage, options, {
                relations: ['channels'],
                ctx,
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({
                items: items.map(item => translateDeep(item, ctx.languageCode)),
                totalItems,
            }));
    }

    async findOne(ctx: RequestContext, id: ID): Promise<CmsPage | undefined> {
        const page = await this.connection.findOneInChannel(
            ctx,
            CmsPage,
            id,
            ctx.channelId,
            { relations: ['channels', 'contentBlocks', 'contentBlocks.featuredAsset'] },
        );
        if (!page) return undefined;
        page.contentBlocks = (page.contentBlocks || []).sort((a, b) => a.position - b.position);
        const translated = translateDeep(page, ctx.languageCode);
        translated.contentBlocks = translated.contentBlocks.map(
            block => translateDeep(block, ctx.languageCode),
        );
        return translated;
    }

    async findByKey(ctx: RequestContext, key: string): Promise<CmsPage | undefined> {
        const page = await this.listQueryBuilder
            .build(CmsPage, {}, {
                ctx,
                channelId: ctx.channelId,
                relations: ['channels', 'contentBlocks', 'contentBlocks.featuredAsset'],
            })
            .andWhere('cms_page.key = :key', { key })
            .getOne();
        if (!page) return undefined;
        page.contentBlocks = (page.contentBlocks || []).sort((a, b) => a.position - b.position);
        const translated = translateDeep(page, ctx.languageCode);
        translated.contentBlocks = translated.contentBlocks.map(
            block => translateDeep(block, ctx.languageCode),
        );
        return translated;
    }

    async create(ctx: RequestContext, input: {
        key: string;
        enabled?: boolean;
        translations: Array<{
            languageCode: LanguageCode;
            name: string;
            slug: string;
        }>;
        contentBlocks?: ContentBlockInput[];
    }): Promise<CmsPage> {
        const pageInput = {
            key: input.key,
            enabled: input.enabled ?? true,
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

        return this.findOne(ctx, page.id) as Promise<CmsPage>;
    }

    async update(ctx: RequestContext, input: {
        id: ID;
        key?: string;
        enabled?: boolean;
        translations?: Array<{
            id?: ID;
            languageCode: LanguageCode;
            name: string;
            slug: string;
        }>;
        contentBlocks?: ContentBlockInput[];
    }): Promise<CmsPage> {
        const updateInput = {
            id: input.id,
            ...(input.key !== undefined && { key: input.key }),
            ...(input.enabled !== undefined && { enabled: input.enabled }),
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

        return this.findOne(ctx, input.id) as Promise<CmsPage>;
    }

    async delete(ctx: RequestContext, id: ID): Promise<DeletionResponse> {
        const page = await this.connection.getEntityOrThrow(ctx, CmsPage, id, {
            channelId: ctx.channelId,
        });
        await this.connection.getRepository(ctx, CmsPage).remove(page);
        return { result: DeletionResult.DELETED };
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
        const existingBlocks = await blockRepo.find({ where: { pageId: pageId as any } });
        const existingIds = new Set(existingBlocks.map(b => b.id.toString()));
        const incomingIds = new Set(
            incomingBlocks.filter(b => b.id).map(b => b.id!.toString()),
        );

        for (const existing of existingBlocks) {
            if (!incomingIds.has(existing.id.toString())) {
                await blockRepo.remove(existing);
            }
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
}
