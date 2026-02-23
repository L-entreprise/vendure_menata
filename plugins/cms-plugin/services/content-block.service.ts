import { Injectable } from '@nestjs/common';
import { DeletionResponse, DeletionResult } from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import {
    ChannelService,
    ListQueryBuilder,
    ListQueryOptions,
    RequestContext,
    TransactionalConnection,
    TranslatableSaver,
    translateDeep,
} from '@vendure/core';

import { ContentBlockTranslation } from '../entities/content-block-translation.entity';
import { ContentBlock } from '../entities/content-block.entity';

@Injectable()
export class ContentBlockService {
    constructor(
        private connection: TransactionalConnection,
        private translatableSaver: TranslatableSaver,
        private listQueryBuilder: ListQueryBuilder,
        private channelService: ChannelService,
    ) {}

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<ContentBlock>,
    ): Promise<PaginatedList<ContentBlock>> {
        return this.listQueryBuilder
            .build(ContentBlock, options, {
                relations: ['featuredAsset', 'channels'],
                ctx,
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({
                items: items.map(item => translateDeep(item, ctx.languageCode)),
                totalItems,
            }));
    }

    async findOne(ctx: RequestContext, id: ID): Promise<ContentBlock | undefined> {
        const block = await this.connection.findOneInChannel(
            ctx,
            ContentBlock,
            id,
            ctx.channelId,
            { relations: ['featuredAsset', 'channels'] },
        );
        return block ? translateDeep(block, ctx.languageCode) : undefined;
    }

    async findByKey(ctx: RequestContext, key: string): Promise<ContentBlock | undefined> {
        const block = await this.listQueryBuilder
            .build(ContentBlock, {}, {
                ctx,
                channelId: ctx.channelId,
                relations: ['featuredAsset', 'channels'],
            })
            .andWhere('content_block.key = :key', { key })
            .getOne();
        return block ? translateDeep(block, ctx.languageCode) : undefined;
    }

    async create(ctx: RequestContext, input: {
        key: string;
        type: string;
        enabled?: boolean;
        featuredAssetId?: ID | null;
        metadata?: Record<string, unknown> | null;
        translations: Array<{
            languageCode: string;
            name: string;
            textContent?: string | null;
            altText?: string | null;
        }>;
    }): Promise<ContentBlock> {
        const block = await this.translatableSaver.create({
            ctx,
            input,
            entityType: ContentBlock,
            translationType: ContentBlockTranslation,
            beforeSave: async b => {
                await this.channelService.assignToCurrentChannel(b, ctx);
            },
        });
        return this.findOne(ctx, block.id) as Promise<ContentBlock>;
    }

    async update(ctx: RequestContext, input: {
        id: ID;
        key?: string;
        enabled?: boolean;
        featuredAssetId?: ID | null;
        metadata?: Record<string, unknown> | null;
        translations?: Array<{
            id?: ID;
            languageCode: string;
            name: string;
            textContent?: string | null;
            altText?: string | null;
        }>;
    }): Promise<ContentBlock> {
        await this.translatableSaver.update({
            ctx,
            input,
            entityType: ContentBlock,
            translationType: ContentBlockTranslation,
        });
        return this.findOne(ctx, input.id) as Promise<ContentBlock>;
    }

    async delete(ctx: RequestContext, id: ID): Promise<DeletionResponse> {
        const block = await this.connection.getEntityOrThrow(ctx, ContentBlock, id, {
            channelId: ctx.channelId,
        });
        await this.connection.getRepository(ctx, ContentBlock).remove(block);
        return {
            result: DeletionResult.DELETED,
        };
    }
}
