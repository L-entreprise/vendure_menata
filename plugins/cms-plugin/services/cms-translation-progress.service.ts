import { Injectable } from '@nestjs/common';
import { ID } from '@vendure/common/lib/shared-types';
import { idsAreEqual, LanguageCode, RequestContext, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';

import { FieldProgress, sumProgress } from '../../content-i18n/shared/translation-progress';
import { CmsPage } from '../entities/cms-page.entity';
import { ContentBlock } from '../entities/content-block.entity';
import { FormSubmission } from '../entities/form-submission.entity';
import { channelDefaultLanguage, channelTargetLanguages } from './channel-languages';
import { blocksProgress, entriesProgress } from './cms-translation-progress';
import { withFallback } from './localize';

export interface CmsTranslationProgressPart extends FieldProgress {
    pageId: ID;
    name: string;
    advanced: boolean;
}

export interface CmsTranslationProgress extends FieldProgress {
    pageId: ID;
    languageCode: LanguageCode;
    /** The page's own fields first, then each child page (tab) in tab order. */
    parts: CmsTranslationProgressPart[];
}

/**
 * Translation progress per page and target language, on the native translation rows.
 * A requested top-level page also counts its child pages (shown as its tabs); `parts`
 * says how much each one weighs. Form pages (submissions) are never counted.
 * A fixed number of queries.
 */
@Injectable()
export class CmsTranslationProgressService {
    constructor(private connection: TransactionalConnection) {}

    async progress(ctx: RequestContext, pageIds: ID[]): Promise<CmsTranslationProgress[]> {
        const targets = channelTargetLanguages(ctx);
        if (pageIds.length === 0 || targets.length === 0) return [];
        const defaultLang = channelDefaultLanguage(ctx);

        const pages = await this.connection
            .getRepository(ctx, CmsPage)
            .createQueryBuilder('page')
            .leftJoinAndSelect('page.translations', 'translation')
            .innerJoin('page.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('page.id IN (:...ids)', { ids: pageIds })
            .orWhere('page.parentId IN (:...ids)', { ids: pageIds })
            .orderBy('page.sidebarOrder', 'ASC')
            .addOrderBy('page.id', 'ASC')
            .getMany();
        const counted = pages.filter(p => !p.acceptsSubmissions);
        const countedIds = counted.map(p => p.id);
        if (countedIds.length === 0) return [];

        const [blocks, entries] = await Promise.all([
            this.connection.getRepository(ctx, ContentBlock).find({
                where: { pageId: In(countedIds) },
                relations: ['translations'],
            }),
            this.connection.getRepository(ctx, FormSubmission).find({
                where: { pageId: In(counted.filter(p => p.isCollection).map(p => p.id)) },
                relations: ['translations'],
            }),
        ]);

        const pageProgress = (p: CmsPage, lang: string): FieldProgress => {
            const pageBlocks = blocks.filter(b => idsAreEqual(b.pageId, p.id)) as any[];
            return p.isCollection
                ? entriesProgress(pageBlocks, entries.filter(e => idsAreEqual(e.pageId, p.id)), lang)
                : blocksProgress(pageBlocks, lang, defaultLang);
        };
        const pageName = (p: CmsPage): string =>
            withFallback(p.translations as any[], ctx.languageCode, defaultLang, ['name']).name || p.key;

        const requested = pages.filter(p => pageIds.some(id => idsAreEqual(id, p.id)));
        return requested.flatMap(page => {
            const group = [
                ...counted.filter(p => idsAreEqual(p.id, page.id)),
                ...counted.filter(p => idsAreEqual(p.parentId, page.id)),
            ];
            if (!group.length) return [];
            return targets.map(lang => {
                const parts = group.map(p => ({
                    pageId: p.id,
                    name: pageName(p),
                    advanced: !!p.advanced,
                    ...pageProgress(p, lang),
                }));
                return { pageId: page.id, languageCode: lang, ...sumProgress(parts), parts };
            });
        });
    }
}
