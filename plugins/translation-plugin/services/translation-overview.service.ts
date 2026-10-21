import { Injectable } from '@nestjs/common';
import { ID } from '@vendure/common/lib/shared-types';
import { RequestContext, TransactionalConnection } from '@vendure/core';

import { CmsPage } from '../../cms-plugin/entities/cms-page.entity';
import { ContentBlock } from '../../cms-plugin/entities/content-block.entity';
import { FormSubmission } from '../../cms-plugin/entities/form-submission.entity';
import { CmsTranslationEntry } from '../entities/cms-translation-entry.entity';
import { TranslationLanguage } from '../entities/translation-language.entity';
import { countProgress, isCountableField } from '../translation-progress';

import { blockDefaultValues } from './block-default-values';
import { collectionEntryDefaultValues } from './collection-entry-values';

export interface PageTranslationProgress {
    pageId: ID;
    languageCode: string;
    total: number;
    translated: number;
}

export interface CollectionEntryTranslationGroup {
    entryId: ID;
    languageCode: string;
    entries: CmsTranslationEntry[];
}

interface SourceField {
    /** `b|<blockId>|<field>` for page blocks, `e|<entryId>|<field>` for collection entries. */
    key: string;
    value: string;
}

/**
 * Bulk, read-only views for the translation dashboard: progress per page and language,
 * and every entry of a list with its values in all languages. A fixed number of queries
 * however many pages, blocks or entries, so the list and the list tabs stay fast.
 */
@Injectable()
export class TranslationOverviewService {
    constructor(private connection: TransactionalConnection) {}

    async progress(ctx: RequestContext, pageIds: ID[]): Promise<PageTranslationProgress[]> {
        if (pageIds.length === 0) return [];
        const languages = await this.enabledLanguages(ctx);
        const defaultCode = languages.find(l => l.isDefault)?.code;
        const targets = languages.filter(l => l.code !== defaultCode).map(l => l.code);
        if (targets.length === 0) return [];

        const pages = await this.connection
            .getRepository(ctx, CmsPage)
            .createQueryBuilder('page')
            .innerJoin('page.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('page.id IN (:...pageIds)', { pageIds })
            .getMany();
        const ids = pages.map(p => p.id);
        if (ids.length === 0) return [];

        const collectionIds = pages.filter(p => p.isCollection && !p.acceptsSubmissions).map(p => p.id);
        const [blocks, submissions, stored] = await Promise.all([
            this.loadBlocks(ctx, ids),
            this.loadSubmissions(ctx, collectionIds),
            this.loadStored(ctx, ids, { languageCodes: targets }),
        ]);

        const storedValues = new Map(
            stored.map(row => [`${row.languageCode}|${storedKey(row)}`, row.value] as const),
        );
        return pages.flatMap(page => {
            const pageBlocks = blocks.filter(b => String(b.pageId) === String(page.id));
            const sources = page.acceptsSubmissions
                ? []
                : page.isCollection
                  ? collectionSources(pageBlocks, submissions.filter(s => String(s.pageId) === String(page.id)))
                  : pageSources(pageBlocks);
            return targets.map(languageCode => ({
                pageId: page.id,
                languageCode,
                ...countProgress(
                    sources.map(s => ({ source: s.value, target: storedValues.get(`${languageCode}|${s.key}`) })),
                ),
            }));
        });
    }

    /**
     * Every entry of a collection page, in creation order, with one group per language:
     * the default language from the entry data, the others from the stored translations.
     */
    async collectionEntriesTranslations(ctx: RequestContext, pageId: ID): Promise<CollectionEntryTranslationGroup[]> {
        const languages = await this.enabledLanguages(ctx);
        const defaultCode = languages.find(l => l.isDefault)?.code ?? null;
        const [blocks, submissions, stored] = await Promise.all([
            this.loadBlocks(ctx, [pageId]),
            this.loadSubmissions(ctx, [pageId]),
            this.loadStored(ctx, [pageId], { entriesOnly: true, excludeLanguage: defaultCode }),
        ]);

        return submissions.flatMap(submission => {
            const defaultGroup: CollectionEntryTranslationGroup[] = defaultCode
                ? [{
                      entryId: submission.id,
                      languageCode: defaultCode,
                      entries: collectionEntryDefaultValues(blocks, submission.data).map(
                          ({ fieldName, value }) =>
                              new CmsTranslationEntry({
                                  // Same synthetic, read-only id shape as CmsTranslationService.findByEntry.
                                  id: `default:${pageId}:${submission.id}:page:${fieldName}` as unknown as ID,
                                  languageCode: defaultCode,
                                  pageId,
                                  entryId: submission.id,
                                  contentBlockId: null,
                                  fieldName,
                                  value,
                              }),
                      ),
                  }]
                : [];
            const rows = stored.filter(row => String(row.entryId) === String(submission.id));
            const codes = [...new Set(rows.map(row => row.languageCode))];
            return [
                ...defaultGroup,
                ...codes.map(languageCode => ({
                    entryId: submission.id,
                    languageCode,
                    entries: rows.filter(row => row.languageCode === languageCode),
                })),
            ];
        });
    }

    private enabledLanguages(ctx: RequestContext): Promise<TranslationLanguage[]> {
        return this.connection
            .getRepository(ctx, TranslationLanguage)
            .createQueryBuilder('lang')
            .innerJoin('lang.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('lang.enabled = :enabled', { enabled: true })
            .orderBy('lang.position', 'ASC')
            .getMany();
    }

    private loadBlocks(ctx: RequestContext, pageIds: ID[]): Promise<ContentBlock[]> {
        return this.connection
            .getRepository(ctx, ContentBlock)
            .createQueryBuilder('block')
            .leftJoinAndSelect('block.translations', 'translation')
            .where('block.pageId IN (:...pageIds)', { pageIds })
            .orderBy('block.position', 'ASC')
            .getMany();
    }

    private async loadSubmissions(ctx: RequestContext, pageIds: ID[]): Promise<FormSubmission[]> {
        if (pageIds.length === 0) return [];
        return this.connection
            .getRepository(ctx, FormSubmission)
            .createQueryBuilder('submission')
            .innerJoin('submission.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('submission.pageId IN (:...pageIds)', { pageIds })
            .orderBy('submission.createdAt', 'ASC')
            .addOrderBy('submission.id', 'ASC')
            .getMany();
    }

    private loadStored(
        ctx: RequestContext,
        pageIds: ID[],
        filter: { languageCodes?: string[]; excludeLanguage?: string | null; entriesOnly?: boolean },
    ): Promise<CmsTranslationEntry[]> {
        const qb = this.connection
            .getRepository(ctx, CmsTranslationEntry)
            .createQueryBuilder('entry')
            .innerJoin('entry.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('entry.pageId IN (:...pageIds)', { pageIds });
        if (filter.languageCodes) qb.andWhere('entry.languageCode IN (:...codes)', { codes: filter.languageCodes });
        if (filter.excludeLanguage) qb.andWhere('entry.languageCode != :exclude', { exclude: filter.excludeLanguage });
        if (filter.entriesOnly) qb.andWhere('entry.entryId IS NOT NULL');
        return qb.getMany();
    }
}

function storedKey(row: CmsTranslationEntry): string {
    return row.entryId != null ? `e|${row.entryId}|${row.fieldName}` : `b|${row.contentBlockId}|${row.fieldName}`;
}

function pageSources(blocks: ContentBlock[]): SourceField[] {
    return blocks.flatMap(block =>
        blockDefaultValues(block, block.translations?.[0] as any)
            .filter(field => isCountableField(field.fieldName))
            .map(field => ({ key: `b|${block.id}|${field.fieldName}`, value: field.value })),
    );
}

function collectionSources(blocks: ContentBlock[], submissions: FormSubmission[]): SourceField[] {
    const collectionImageKeys = new Set(blocks.filter(b => b.type === 'IMAGE').map(b => b.key));
    return submissions.flatMap(submission =>
        collectionEntryDefaultValues(blocks, submission.data)
            .filter(field => isCountableField(field.fieldName, { collectionImageKeys }))
            .map(field => ({ key: `e|${submission.id}|${field.fieldName}`, value: field.value })),
    );
}
