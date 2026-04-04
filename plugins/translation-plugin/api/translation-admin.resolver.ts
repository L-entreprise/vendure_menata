import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, Transaction } from '@vendure/core';

import { cmsPagePermission } from '../../cms-plugin/constants';
import { CmsTranslationService } from '../services/cms-translation.service';
import { TranslationLanguageService } from '../services/translation-language.service';
import {
    TranslationLanguageInput,
    UpdateCmsPageTranslationsInput,
    UpdateCollectionEntryTranslationsInput,
} from './types';

@Resolver()
export class TranslationAdminResolver {
    constructor(
        private translationLanguageService: TranslationLanguageService,
        private cmsTranslationService: CmsTranslationService,
    ) {}

    @Query()
    @Allow(cmsPagePermission.Read)
    async translationLanguages(@Ctx() ctx: RequestContext) {
        return this.translationLanguageService.findAll(ctx);
    }

    @Query()
    @Allow(cmsPagePermission.Read)
    async cmsPageTranslatableFields(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageId: string },
    ) {
        return this.cmsTranslationService.getTranslatableFields(ctx, args.pageId);
    }

    @Query()
    @Allow(cmsPagePermission.Read)
    async cmsPageTranslations(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageId: string; languageCode?: string },
    ) {
        return this.cmsTranslationService.findByPage(ctx, args.pageId, args.languageCode);
    }

    @Query()
    @Allow(cmsPagePermission.Read)
    async cmsPageDefaultContent(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageId: string },
    ) {
        return this.cmsTranslationService.getDefaultContent(ctx, args.pageId);
    }

    @Query()
    @Allow(cmsPagePermission.Read)
    async collectionEntryTranslatableFields(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageId: string },
    ) {
        return this.cmsTranslationService.getCollectionEntryTranslatableFields(ctx, args.pageId);
    }

    @Query()
    @Allow(cmsPagePermission.Read)
    async collectionEntryTranslations(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageId: string; entryId: string; languageCode?: string },
    ) {
        return this.cmsTranslationService.findByEntry(ctx, args.pageId, args.entryId, args.languageCode);
    }

    @Query()
    @Allow(cmsPagePermission.Read)
    async collectionEntryDefaultContent(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageId: string; entryId: string },
    ) {
        return this.cmsTranslationService.getCollectionEntryDefaultContent(ctx, args.pageId, args.entryId);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async setTranslationLanguages(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: TranslationLanguageInput[] },
    ) {
        return this.translationLanguageService.setLanguages(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Update)
    async updateCmsPageTranslations(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: UpdateCmsPageTranslationsInput },
    ) {
        return this.cmsTranslationService.updateTranslations(
            ctx,
            args.input.pageId,
            args.input.languageCode,
            args.input.entries,
        );
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Update)
    async updateCollectionEntryTranslations(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: UpdateCollectionEntryTranslationsInput },
    ) {
        return this.cmsTranslationService.updateCollectionEntryTranslations(
            ctx,
            args.input.pageId,
            args.input.entryId,
            args.input.languageCode,
            args.input.entries,
        );
    }
}
