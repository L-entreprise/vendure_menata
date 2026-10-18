import { Injectable } from '@nestjs/common';
import { DeletionResponse, DeletionResult } from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import {
    ChannelService,
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
import { sanitizeBlockTranslations } from './sanitize-rich-text';

const MAX_KEY_LENGTH = 255;

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
        onlyEnabled = false,
    ): Promise<PaginatedList<ContentBlock>> {
        const qb = this.listQueryBuilder
            .build(ContentBlock, options, {
                relations: ['featuredAsset', 'channels'],
                ctx,
                channelId: ctx.channelId,
            });
        if (onlyEnabled) {
            qb.andWhere('contentblock.enabled = :enabled', { enabled: true });
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
    ): Promise<ContentBlock | undefined> {
        const block = await this.connection.findOneInChannel(
            ctx,
            ContentBlock,
            id,
            ctx.channelId,
            { relations: ['featuredAsset', 'channels'] },
        );
        if (!block) return undefined;
        if (onlyEnabled && !block.enabled) return undefined;
        return translateDeep(block, ctx.languageCode);
    }

    async findByKey(
        ctx: RequestContext,
        key: string,
        onlyEnabled = false,
    ): Promise<ContentBlock | undefined> {
        const qb = this.listQueryBuilder
            .build(ContentBlock, {}, {
                ctx,
                channelId: ctx.channelId,
                relations: ['featuredAsset', 'channels'],
            })
            .andWhere('contentblock.key = :key', { key });
        if (onlyEnabled) {
            qb.andWhere('contentblock.enabled = :enabled', { enabled: true });
        }
        const block = await qb.getOne();
        return block ? translateDeep(block, ctx.languageCode) : undefined;
    }

    async create(ctx: RequestContext, input: {
        key: string;
        type: string;
        enabled?: boolean;
        featuredAssetId?: ID | null;
        metadata?: Record<string, unknown> | null;
        translations: Array<{
            languageCode: LanguageCode;
            name: string;
            textContent?: string;
            altText?: string;
        }>;
    }): Promise<ContentBlock> {
        if (input.key && input.key.length > MAX_KEY_LENGTH) {
            throw new UserInputError(`Key must not exceed ${MAX_KEY_LENGTH} characters`);
        }
        sanitizeBlockTranslations(input.type, input.translations);
        const block = await this.translatableSaver.create({
            ctx,
            input,
            entityType: ContentBlock,
            translationType: ContentBlockTranslation,
            beforeSave: async b => {
                await this.channelService.assignToCurrentChannel(b, ctx);
            },
        });
        const result = await this.findOne(ctx, block.id);
        if (!result) {
            throw new InternalServerError('Failed to retrieve created ContentBlock');
        }
        return result;
    }

    async update(ctx: RequestContext, input: {
        id: ID;
        key?: string;
        enabled?: boolean;
        featuredAssetId?: ID | null;
        metadata?: Record<string, unknown> | null;
        translations?: Array<{
            id?: ID;
            languageCode: LanguageCode;
            name: string;
            textContent?: string;
            altText?: string;
        }>;
    }): Promise<ContentBlock> {
        if (input.key && input.key.length > MAX_KEY_LENGTH) {
            throw new UserInputError(`Key must not exceed ${MAX_KEY_LENGTH} characters`);
        }
        if (input.translations?.length) {
            const existing = await this.connection.getEntityOrThrow(ctx, ContentBlock, input.id);
            sanitizeBlockTranslations(existing.type, input.translations);
        }
        await this.translatableSaver.update({
            ctx,
            input,
            entityType: ContentBlock,
            translationType: ContentBlockTranslation,
        });
        const result = await this.findOne(ctx, input.id);
        if (!result) {
            throw new InternalServerError('Failed to retrieve updated ContentBlock');
        }
        return result;
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
