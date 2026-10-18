import { Injectable } from '@nestjs/common';
import { ID } from '@vendure/common/lib/shared-types';
import { RequestContext, TransactionalConnection } from '@vendure/core';

import { CmsPage } from '../../cms-plugin/entities/cms-page.entity';
import { ContentBlock } from '../../cms-plugin/entities/content-block.entity';
import { FormSubmission } from '../../cms-plugin/entities/form-submission.entity';
import { CmsTranslationEntry } from '../entities/cms-translation-entry.entity';

import { CmsTranslationService } from './cms-translation.service';
import { collectionEntryDefaultValues, collectionGalleryAssetIds } from './collection-entry-values';

/** Field name of the synthetic entry carrying a page gallery's ordered asset ids. */
export const PAGE_GALLERY_FIELD_NAME = 'gallery';

export interface ShopTranslationEntry {
    id: ID;
    languageCode: string;
    pageId: ID;
    contentBlockId: ID | null;
    entryId: ID | null;
    fieldName: string;
    value: string;
    blockKey: string | null;
    blockType: string | null;
}

export interface ShopPageTranslations {
    pageId: ID;
    languageCode: string;
    entries: ShopTranslationEntry[];
}

export interface ShopCollectionEntryTranslations extends ShopPageTranslations {
    entryId: ID;
}

type PageLookup = { id: ID } | { key: string };

/**
 * Shop API view of the translations. Compared with the raw admin data it:
 * - adds `blockKey` / `blockType` to every entry, so a storefront addresses content by
 *   key instead of by (unstable) block id;
 * - adds the ordered asset ids of every IMAGE_GALLERY (a JSON array value), which are
 *   structure rather than translatable text but are needed to render the page;
 * - drops entries of disabled blocks, mirroring the cms-plugin Shop API;
 * - only exposes enabled pages of the current channel, and only real collections
 *   (never form submissions) for the collection queries.
 */
@Injectable()
export class ShopTranslationService {
    constructor(
        private connection: TransactionalConnection,
        private cmsTranslationService: CmsTranslationService,
    ) {}

    async pageTranslations(
        ctx: RequestContext,
        lookup: PageLookup,
        languageCode: string,
    ): Promise<ShopPageTranslations | null> {
        const page = await this.findEnabledPage(ctx, lookup);
        if (!page) return null;
        const [groups, blocks] = await Promise.all([
            this.cmsTranslationService.findByPage(ctx, page.id, languageCode),
            this.loadBlocks(ctx, page.id),
        ]);
        const enabledBlocks = blocks.filter(b => b.enabled);
        const blocksById = new Map(enabledBlocks.map(b => [String(b.id), b]));

        const translated = (groups[0]?.entries ?? []).flatMap(entry => {
            if (entry.contentBlockId == null) return [toShopEntry(entry, null)];
            const block = blocksById.get(String(entry.contentBlockId));
            return block ? [toShopEntry(entry, block)] : [];
        });
        const galleries = enabledBlocks
            .filter(b => b.type === 'IMAGE_GALLERY')
            .map(block =>
                galleryEntry({
                    id: `gallery:${page.id}:${block.id}`,
                    languageCode,
                    pageId: page.id,
                    contentBlockId: block.id,
                    entryId: null,
                    fieldName: PAGE_GALLERY_FIELD_NAME,
                    assetIds: ((block.metadata as { assetIds?: unknown[] } | null)?.assetIds ?? []).map(String),
                    block,
                }),
            );

        return {
            pageId: page.id,
            languageCode,
            entries: sortByBlockPosition([...translated, ...galleries], blocks),
        };
    }

    async collectionEntryTranslations(
        ctx: RequestContext,
        pageId: ID,
        entryId: ID,
        languageCode: string,
    ): Promise<ShopCollectionEntryTranslations | null> {
        const page = await this.findCollectionPage(ctx, { id: pageId });
        if (!page) return null;
        const [entries, blocks] = await Promise.all([
            this.loadCollectionEntries(ctx, page.id, [entryId]),
            this.loadBlocks(ctx, page.id),
        ]);
        const entry = entries[0];
        if (!entry) return null;
        const groups = await this.cmsTranslationService.findByEntry(ctx, page.id, entry.id, languageCode);
        return this.buildEntryGroup(page.id, entry, blocks, languageCode, groups[0]?.entries ?? []);
    }

    async collectionTranslationsByKey(
        ctx: RequestContext,
        pageKey: string,
        languageCode: string,
    ): Promise<ShopCollectionEntryTranslations[]> {
        const page = await this.findCollectionPage(ctx, { key: pageKey });
        if (!page) return [];
        const [entries, blocks, defaultCode] = await Promise.all([
            this.loadCollectionEntries(ctx, page.id),
            this.loadBlocks(ctx, page.id),
            this.cmsTranslationService.getDefaultLanguageCode(ctx),
        ]);
        if (entries.length === 0) return [];

        const isDefaultLanguage = defaultCode != null && languageCode === defaultCode;
        const storedByEntry = isDefaultLanguage
            ? new Map<string, CmsTranslationEntry[]>()
            : await this.loadStoredEntryTranslations(ctx, page.id, languageCode);

        return entries.map(entry => {
            const translations = isDefaultLanguage
                ? defaultEntryTranslations(page.id, entry, blocks, languageCode)
                : storedByEntry.get(String(entry.id)) ?? [];
            return this.buildEntryGroup(page.id, entry, blocks, languageCode, translations);
        });
    }

    private buildEntryGroup(
        pageId: ID,
        entry: FormSubmission,
        blocks: ContentBlock[],
        languageCode: string,
        translations: CmsTranslationEntry[],
    ): ShopCollectionEntryTranslations {
        const translated = translations.map(t => toShopEntry(t, findBlockForField(blocks, t.fieldName)));
        const galleries = blocks
            .filter(b => b.type === 'IMAGE_GALLERY')
            .map(block =>
                galleryEntry({
                    id: `gallery:${pageId}:${entry.id}:${block.key}`,
                    languageCode,
                    pageId,
                    contentBlockId: null,
                    entryId: entry.id,
                    fieldName: block.key,
                    assetIds: collectionGalleryAssetIds(entry.data, block.key),
                    block,
                }),
            );
        return {
            pageId,
            entryId: entry.id,
            languageCode,
            entries: sortByBlockPosition([...translated, ...galleries], blocks),
        };
    }

    private findEnabledPage(ctx: RequestContext, lookup: PageLookup): Promise<CmsPage | null> {
        return this.pageQuery(ctx, lookup).getOne();
    }

    private findCollectionPage(ctx: RequestContext, lookup: PageLookup): Promise<CmsPage | null> {
        return this.pageQuery(ctx, lookup)
            .andWhere('page.isCollection = :isCollection', { isCollection: true })
            .andWhere('page.acceptsSubmissions = :acceptsSubmissions', { acceptsSubmissions: false })
            .getOne();
    }

    private pageQuery(ctx: RequestContext, lookup: PageLookup) {
        const qb = this.connection
            .getRepository(ctx, CmsPage)
            .createQueryBuilder('page')
            .innerJoin('page.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('page.enabled = :enabled', { enabled: true });
        return 'id' in lookup
            ? qb.andWhere('page.id = :id', { id: lookup.id })
            : qb.andWhere('page.key = :key', { key: lookup.key });
    }

    private loadBlocks(ctx: RequestContext, pageId: ID): Promise<ContentBlock[]> {
        return this.connection
            .getRepository(ctx, ContentBlock)
            .createQueryBuilder('block')
            .where('block.pageId = :pageId', { pageId })
            .orderBy('block.position', 'ASC')
            .getMany();
    }

    private loadCollectionEntries(ctx: RequestContext, pageId: ID, ids?: ID[]): Promise<FormSubmission[]> {
        const qb = this.connection
            .getRepository(ctx, FormSubmission)
            .createQueryBuilder('submission')
            .innerJoin('submission.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('submission.pageId = :pageId', { pageId })
            .orderBy('submission.createdAt', 'ASC')
            .addOrderBy('submission.id', 'ASC');
        return (ids ? qb.andWhere('submission.id IN (:...ids)', { ids }) : qb).getMany();
    }

    private async loadStoredEntryTranslations(
        ctx: RequestContext,
        pageId: ID,
        languageCode: string,
    ): Promise<Map<string, CmsTranslationEntry[]>> {
        const rows = await this.connection
            .getRepository(ctx, CmsTranslationEntry)
            .createQueryBuilder('entry')
            .innerJoin('entry.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('entry.pageId = :pageId', { pageId })
            .andWhere('entry.entryId IS NOT NULL')
            .andWhere('entry.languageCode = :languageCode', { languageCode })
            .getMany();
        return rows.reduce((map, row) => {
            const key = String(row.entryId);
            return map.set(key, [...(map.get(key) ?? []), row]);
        }, new Map<string, CmsTranslationEntry[]>());
    }
}

function defaultEntryTranslations(
    pageId: ID,
    entry: FormSubmission,
    blocks: ContentBlock[],
    languageCode: string,
): CmsTranslationEntry[] {
    return collectionEntryDefaultValues(blocks, entry.data).map(
        ({ fieldName, value }) =>
            new CmsTranslationEntry({
                // Same synthetic id shape as CmsTranslationService.findByEntry.
                id: `default:${pageId}:${entry.id}:page:${fieldName}` as unknown as ID,
                languageCode,
                pageId,
                entryId: entry.id,
                contentBlockId: null,
                fieldName,
                value,
            }),
    );
}

function toShopEntry(entry: CmsTranslationEntry, block: ContentBlock | null): ShopTranslationEntry {
    return {
        id: entry.id,
        languageCode: entry.languageCode,
        pageId: entry.pageId,
        contentBlockId: entry.contentBlockId ?? null,
        entryId: entry.entryId ?? null,
        fieldName: entry.fieldName,
        value: entry.value,
        blockKey: block?.key ?? null,
        blockType: block?.type ?? null,
    };
}

function galleryEntry(input: {
    id: string;
    languageCode: string;
    pageId: ID;
    contentBlockId: ID | null;
    entryId: ID | null;
    fieldName: string;
    assetIds: string[];
    block: ContentBlock;
}): ShopTranslationEntry {
    return {
        id: input.id,
        languageCode: input.languageCode,
        pageId: input.pageId,
        contentBlockId: input.contentBlockId,
        entryId: input.entryId,
        fieldName: input.fieldName,
        value: JSON.stringify(input.assetIds),
        blockKey: input.block.key,
        blockType: input.block.type,
    };
}

/**
 * Collection-entry field names are the block key itself or a companion derived from
 * it (`<key>__alt`, `<key>__<assetId>__description`…). The longest matching key wins
 * so `hero` never captures the fields of a sibling `hero__extra` block.
 */
function findBlockForField(blocks: ContentBlock[], fieldName: string): ContentBlock | null {
    return blocks
        .filter(b => fieldName === b.key || fieldName.startsWith(`${b.key}__`))
        .reduce<ContentBlock | null>((best, b) => (!best || b.key.length > best.key.length ? b : best), null);
}

/** Page-level fields (no block) first, then block order; stable within a block. */
function sortByBlockPosition(entries: ShopTranslationEntry[], blocks: ContentBlock[]): ShopTranslationEntry[] {
    const positionByKey = new Map(blocks.map(b => [b.key, b.position]));
    const rank = (e: ShopTranslationEntry) => (e.blockKey == null ? -1 : positionByKey.get(e.blockKey) ?? -1);
    return entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => rank(a.entry) - rank(b.entry) || a.index - b.index)
        .map(({ entry }) => entry);
}
