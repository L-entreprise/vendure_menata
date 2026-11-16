import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, Product, RequestContext } from '@vendure/core';

import { ProductTranslationService } from '../services/product-translation.service';

@Resolver('Product')
export class ProductProgressEntityResolver {
    constructor(private productTranslationService: ProductTranslationService) {}

    @ResolveField()
    @Allow(Permission.ReadCatalog, Permission.ReadProduct)
    async translationProgress(@Ctx() ctx: RequestContext, @Parent() product: Product) {
        return this.productTranslationService.progressFor(ctx, product.id);
    }
}

@Resolver()
export class ProductProgressResolver {
    constructor(private productTranslationService: ProductTranslationService) {}

    @Query()
    @Allow(Permission.ReadCatalog, Permission.ReadProduct)
    async productTranslationSummary(@Ctx() ctx: RequestContext) {
        return this.productTranslationService.summary(ctx);
    }
}
