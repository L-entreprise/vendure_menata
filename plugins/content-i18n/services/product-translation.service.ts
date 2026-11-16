import { Injectable } from '@nestjs/common';
import { ID } from '@vendure/common/lib/shared-types';
import {
    ConfigService,
    idsAreEqual,
    LanguageCode,
    Product,
    ProductTranslation,
    ProductVariant,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { In, IsNull } from 'typeorm';

import { isIncomplete, LanguageProgress, productProgress } from './product-progress';

export interface ProductTranslationSummary {
    languageCode: LanguageCode;
    incompleteProducts: number;
}

// SQLite caps bound parameters; keep IN lists well below it.
const ID_CHUNK = 500;

/** Reads products and variants with their translations and counts what is left to translate. */
@Injectable()
export class ProductTranslationService {
    constructor(
        private connection: TransactionalConnection,
        private configService: ConfigService,
    ) {}

    async progressFor(ctx: RequestContext, productId: ID): Promise<LanguageProgress[]> {
        const targets = this.targetLanguages(ctx);
        if (targets.length === 0) return [];
        const [translations, variants] = await Promise.all([
            this.connection.getRepository(ctx, ProductTranslation).find({ where: { base: { id: productId } } }),
            this.connection.getRepository(ctx, ProductVariant).find({
                where: { productId, deletedAt: IsNull() },
                relations: ['translations'],
            }),
        ]);
        return productProgress(
            { translations, variants, customFieldNames: this.customFieldNames() },
            ctx.channel.defaultLanguageCode,
            targets,
        );
    }

    async summary(ctx: RequestContext): Promise<ProductTranslationSummary[]> {
        const targets = this.targetLanguages(ctx);
        if (targets.length === 0) return [];
        const products = await this.connection
            .getRepository(ctx, Product)
            .createQueryBuilder('product')
            .innerJoin('product.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .leftJoinAndSelect('product.translations', 'translation')
            .where('product.deletedAt IS NULL')
            .getMany();
        const variants = await this.variantsOf(ctx, products.map(p => p.id));
        const customFieldNames = this.customFieldNames();
        const progress = products.map(product =>
            productProgress(
                {
                    translations: product.translations,
                    variants: variants.filter(v => idsAreEqual(v.productId, product.id)),
                    customFieldNames,
                },
                ctx.channel.defaultLanguageCode,
                targets,
            ),
        );
        return targets.map(languageCode => ({
            languageCode,
            incompleteProducts: progress.filter(p => isIncomplete(p, languageCode)).length,
        }));
    }

    private async variantsOf(ctx: RequestContext, productIds: ID[]): Promise<ProductVariant[]> {
        const chunks = Array.from({ length: Math.ceil(productIds.length / ID_CHUNK) }, (_, i) =>
            productIds.slice(i * ID_CHUNK, (i + 1) * ID_CHUNK),
        );
        const results = await Promise.all(
            chunks.map(ids =>
                this.connection.getRepository(ctx, ProductVariant).find({
                    where: { productId: In(ids), deletedAt: IsNull() },
                    relations: ['translations'],
                }),
            ),
        );
        return results.flat();
    }

    private targetLanguages(ctx: RequestContext): LanguageCode[] {
        const defaultLanguage = ctx.channel.defaultLanguageCode;
        return (ctx.channel.availableLanguageCodes ?? []).filter(code => code !== defaultLanguage);
    }

    private customFieldNames(): string[] {
        return (this.configService.customFields.Product ?? [])
            .filter(field => (field.type === 'localeString' || field.type === 'localeText') && !field.internal)
            .map(field => field.name);
    }
}
