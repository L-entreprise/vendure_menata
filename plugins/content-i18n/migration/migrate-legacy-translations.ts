import { Channel, LanguageCode } from '@vendure/core';
import { DataSource, EntityManager } from 'typeorm';

import { CmsPageTranslation } from '../../cms-plugin/entities/cms-page-translation.entity';
import { CmsPage } from '../../cms-plugin/entities/cms-page.entity';
import { ContentBlockTranslation } from '../../cms-plugin/entities/content-block-translation.entity';
import { ContentBlock } from '../../cms-plugin/entities/content-block.entity';
import { FormSubmissionTranslation } from '../../cms-plugin/entities/form-submission-translation.entity';
import { FormSubmission } from '../../cms-plugin/entities/form-submission.entity';

/**
 * One-off move of the removed translation-plugin's data onto Vendure's native rows.
 *
 * - The old CMS editor saved every original as `en`. When a channel's default language is
 *   another one, those rows are relabelled to it (unless a row already exists in it).
 * - Each `cms_translation_entry` is copied: page name/slug → CmsPageTranslation; block
 *   textContent/altText → ContentBlockTranslation; image description and gallery alt/
 *   description → `translatedMetadata`; per-language image → `featuredAssetId`; list
 *   entries → FormSubmissionTranslation.
 * - Languages the channel does not offer, or codes Vendure does not know, are skipped and
 *   reported; channel settings are never changed.
 *
 * Safe to run again: it only fills fields that are still empty, so translations edited
 * since are kept. Legacy tables are only dropped with `dropLegacyTables`, and not while
 * entries were skipped unless `force`.
 */

export interface MigrationReport {
    relabeled: number;
    copied: { pages: number; blocks: number; entries: number };
    skipped: Array<{ languageCode: string; reason: SkipReason; count: number }>;
}

export interface MigrationOptions {
    dropLegacyTables?: boolean;
    /** Drop the legacy tables even when some entries were skipped (their data is lost). */
    force?: boolean;
}

type SkipReason = 'not-available' | 'default-language' | 'invalid-code';

interface LegacyEntry {
    id: number;
    languageCode: string;
    pageId: number;
    contentBlockId: number | null;
    entryId: number | null;
    fieldName: string;
    value: string;
}

const ENTRY_TABLE = 'cms_translation_entry';
const LANGUAGE_TABLE = 'translation_language';
const LEGACY_TABLES = [`${ENTRY_TABLE}_channels_channel`, `${LANGUAGE_TABLE}_channels_channel`, ENTRY_TABLE, LANGUAGE_TABLE];
const KNOWN_CODES = new Set<string>(Object.values(LanguageCode));
const GALLERY_FIELD = /^gallery:(.+):(alt|description)$/;
const ENTRY_GALLERY_FIELD = /^(.+)__(.+)__(alt|description)$/;

export async function migrateLegacyTranslations(
    dataSource: DataSource,
    options: MigrationOptions = {},
): Promise<MigrationReport> {
    const empty: MigrationReport = { relabeled: 0, copied: { pages: 0, blocks: 0, entries: 0 }, skipped: [] };
    if (!(await hasTable(dataSource, ENTRY_TABLE))) return empty;

    const report = await dataSource.transaction(async manager => {
        const channels = await manager.getRepository(Channel).find();
        const entries = await readLegacyEntries(manager, channels);
        await assertSameDefaultLanguage(manager, channels);
        const relabeled = await relabelOriginals(manager, channels);
        const { copied, skipped } = await copyEntries(manager, entries);
        return { relabeled, copied, skipped };
    });

    if (options.dropLegacyTables) {
        if (report.skipped.length > 0 && !options.force) {
            throw new Error(
                `Copy done, legacy tables kept: ${report.skipped.reduce((n, s) => n + s.count, 0)} entries were skipped ` +
                    `(${report.skipped.map(s => `${s.languageCode}: ${s.reason}`).join(', ')}). ` +
                    'Add those languages to the channel and run again, or pass --force to drop them anyway.',
            );
        }
        await dropLegacyTables(dataSource);
    }
    return report;
}

async function hasTable(dataSource: DataSource, table: string): Promise<boolean> {
    const runner = dataSource.createQueryRunner();
    try {
        return await runner.hasTable(table);
    } finally {
        await runner.release();
    }
}

async function dropLegacyTables(dataSource: DataSource): Promise<void> {
    const runner = dataSource.createQueryRunner();
    try {
        for (const table of LEGACY_TABLES) {
            if (await runner.hasTable(table)) await runner.dropTable(table);
        }
    } finally {
        await runner.release();
    }
}

interface ChannelEntry extends LegacyEntry {
    channel: Channel;
}

async function readLegacyEntries(manager: EntityManager, channels: Channel[]): Promise<ChannelEntry[]> {
    const rows: LegacyEntry[] = await manager.createQueryBuilder().select('*').from(ENTRY_TABLE, 'e').getRawMany();
    const links: Array<{ cmsTranslationEntryId: number; channelId: number }> = await manager
        .createQueryBuilder()
        .select('*')
        .from(`${ENTRY_TABLE}_channels_channel`, 'l')
        .getRawMany();
    const fallback = channels.find(c => c.code === '__default_channel__') ?? channels[0];
    return rows.map(row => {
        const link = links.find(l => Number(l.cmsTranslationEntryId) === Number(row.id));
        const channel = channels.find(c => Number(c.id) === Number(link?.channelId)) ?? fallback;
        return { ...row, channel };
    });
}

async function assertSameDefaultLanguage(manager: EntityManager, channels: Channel[]): Promise<void> {
    if (!(await hasTable(manager.connection, LANGUAGE_TABLE))) return;
    const languages: Array<{ id: number; code: string; isDefault: unknown; enabled: unknown }> = await manager
        .createQueryBuilder()
        .select('*')
        .from(LANGUAGE_TABLE, 'l')
        .getRawMany();
    const links: Array<{ translationLanguageId: number; channelId: number }> = await manager
        .createQueryBuilder()
        .select('*')
        .from(`${LANGUAGE_TABLE}_channels_channel`, 'l')
        .getRawMany();
    for (const channel of channels) {
        const legacyDefault = languages.find(
            l => truthy(l.isDefault) && links.some(k => Number(k.translationLanguageId) === Number(l.id) && Number(k.channelId) === Number(channel.id)),
        );
        if (legacyDefault && legacyDefault.code !== channel.defaultLanguageCode) {
            throw new Error(
                `Channel "${channel.code}": the translation plugin's default language is "${legacyDefault.code}" ` +
                    `but the channel's is "${channel.defaultLanguageCode}". Align them in Settings → Channels, then run again.`,
            );
        }
    }
}

/** The old editor wrote originals as `en`: move them to the channel language when it has none. */
async function relabelOriginals(manager: EntityManager, channels: Channel[]): Promise<number> {
    const inChannel = <T extends { channels: Channel[] }>(items: T[], channel: Channel) =>
        items.filter(item => item.channels?.some(c => Number(c.id) === Number(channel.id)));
    const pages = await manager.getRepository(CmsPage).find({ relations: ['channels'] });
    const blocks = await manager.getRepository(ContentBlock).find({ relations: ['channels'] });
    let count = 0;
    for (const channel of channels.filter(c => c.defaultLanguageCode !== LanguageCode.en)) {
        count += await relabel(manager, CmsPageTranslation, inChannel(pages, channel), channel.defaultLanguageCode);
        count += await relabel(manager, ContentBlockTranslation, inChannel(blocks, channel), channel.defaultLanguageCode);
    }
    return count;
}

async function relabel(
    manager: EntityManager,
    rowType: typeof CmsPageTranslation | typeof ContentBlockTranslation,
    owners: Array<{ translations: Array<{ id: unknown; languageCode: string }> }>,
    target: LanguageCode,
): Promise<number> {
    const toMove = owners
        .filter(owner => !owner.translations.some(t => t.languageCode === target))
        .map(owner => owner.translations.find(t => t.languageCode === LanguageCode.en))
        .filter((row): row is { id: unknown; languageCode: string } => !!row);
    for (const row of toMove) {
        await manager.getRepository(rowType).update(row.id as number, { languageCode: target });
    }
    return toMove.length;
}

async function copyEntries(
    manager: EntityManager,
    entries: ChannelEntry[],
): Promise<Pick<MigrationReport, 'copied' | 'skipped'>> {
    const skippedCounts = new Map<string, number>();
    const kept = entries.filter(entry => {
        const reason = skipReason(entry);
        if (reason) skippedCounts.set(`${entry.languageCode}|${reason}`, (skippedCounts.get(`${entry.languageCode}|${reason}`) ?? 0) + 1);
        return !reason && entry.value !== '' && entry.value != null;
    });
    const groups = groupBy(kept, e => `${kind(e)}|${ownerId(e)}|${e.languageCode}`);
    const touched = { pages: new Set<number>(), blocks: new Set<number>(), entries: new Set<number>() };
    for (const group of groups) {
        const first = group[0];
        const lang = first.languageCode as LanguageCode;
        if (kind(first) === 'page') {
            await copyPageFields(manager, first.pageId, lang, group);
            touched.pages.add(first.pageId);
        } else if (kind(first) === 'block') {
            await copyBlockFields(manager, first.contentBlockId!, lang, group);
            touched.blocks.add(first.contentBlockId!);
        } else {
            await copyEntryFields(manager, first.entryId!, lang, group);
            touched.entries.add(first.entryId!);
        }
    }
    const skipped = [...skippedCounts.entries()].map(([key, count]) => {
        const [languageCode, reason] = key.split('|');
        return { languageCode, reason: reason as SkipReason, count };
    });
    return { copied: { pages: touched.pages.size, blocks: touched.blocks.size, entries: touched.entries.size }, skipped };
}

function skipReason(entry: ChannelEntry): SkipReason | null {
    if (!KNOWN_CODES.has(entry.languageCode)) return 'invalid-code';
    if (entry.languageCode === entry.channel.defaultLanguageCode) return 'default-language';
    if (!(entry.channel.availableLanguageCodes ?? []).includes(entry.languageCode as LanguageCode)) return 'not-available';
    return null;
}

async function copyPageFields(manager: EntityManager, pageId: number, lang: LanguageCode, group: LegacyEntry[]) {
    const repo = manager.getRepository(CmsPageTranslation);
    const existing = await repo.findOne({ where: { base: { id: pageId }, languageCode: lang } });
    const row = existing ?? Object.assign(new CmsPageTranslation(), { languageCode: lang, name: '', slug: '', base: { id: pageId } });
    await repo.save(Object.assign(row, onlyEmpty(row, fieldValues(group, ['name', 'slug']))));
}

async function copyBlockFields(manager: EntityManager, blockId: number, lang: LanguageCode, group: LegacyEntry[]) {
    const repo = manager.getRepository(ContentBlockTranslation);
    const block = await manager.getRepository(ContentBlock).findOne({ where: { id: blockId } });
    if (!block) return;
    const existing = await repo.findOne({ where: { base: { id: blockId }, languageCode: lang } });
    const row =
        existing ??
        Object.assign(new ContentBlockTranslation(), { languageCode: lang, name: '', textContent: '', altText: '', base: { id: blockId } });
    const metadata = group.reduce<Record<string, any>>((meta, entry) => {
        if (entry.fieldName === 'description') return { ...meta, description: entry.value };
        const gallery = GALLERY_FIELD.exec(entry.fieldName);
        if (!gallery) return meta;
        const [, assetId, field] = gallery;
        const imageMeta = meta.imageMeta ?? {};
        return { ...meta, imageMeta: { ...imageMeta, [assetId]: { ...(imageMeta[assetId] ?? {}), [field]: entry.value } } };
    }, {});
    const translatedMetadata = mergeKeepingExisting((row.translatedMetadata as Record<string, any>) ?? {}, metadata);
    const image = group.find(e => e.fieldName === 'image')?.value;
    const swapsImage = image && !row.featuredAssetId && String(image) !== String(block.featuredAssetId ?? '');
    await repo.save(
        Object.assign(row, onlyEmpty(row, fieldValues(group, ['textContent', 'altText'])), {
            ...(Object.keys(translatedMetadata).length && { translatedMetadata }),
            ...(swapsImage && { featuredAssetId: image }),
        }),
    );
}

async function copyEntryFields(manager: EntityManager, entryId: number, lang: LanguageCode, group: LegacyEntry[]) {
    const entry = await manager.getRepository(FormSubmission).findOne({ where: { id: entryId } });
    if (!entry) return;
    const galleryKeys = new Set(
        (await manager.getRepository(ContentBlock).find({ where: { pageId: entry.pageId } }))
            .filter(b => b.type === 'IMAGE_GALLERY')
            .map(b => b.key),
    );
    const repo = manager.getRepository(FormSubmissionTranslation);
    const existing = await repo.findOne({ where: { baseId: entryId, languageCode: lang } });
    const data = group.reduce<Record<string, any>>((acc, legacy) => {
        const gallery = ENTRY_GALLERY_FIELD.exec(legacy.fieldName);
        if (gallery && galleryKeys.has(gallery[1])) {
            const [, key, assetId, field] = gallery;
            const metaKey = `${key}__imageMeta`;
            const meta = acc[metaKey] ?? {};
            return { ...acc, [metaKey]: { ...meta, [assetId]: { ...(meta[assetId] ?? {}), [field]: legacy.value } } };
        }
        return { ...acc, [legacy.fieldName]: entryValue(entry.data?.[legacy.fieldName], legacy.value) };
    }, {});
    await repo.save(
        Object.assign(existing ?? new FormSubmissionTranslation(), {
            languageCode: lang,
            data: mergeKeepingExisting(existing?.data ?? {}, data),
            base: { id: entryId },
            baseId: entryId,
        }),
    );
}

/** Options lists were stored as JSON text by the old plugin; the entry keeps an array. */
function entryValue(base: unknown, value: string): unknown {
    if (!Array.isArray(base)) return value;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : value;
    } catch {
        return value;
    }
}

function fieldValues(group: LegacyEntry[], fields: string[]): Record<string, string> {
    return Object.fromEntries(group.filter(e => fields.includes(e.fieldName)).map(e => [e.fieldName, e.value]));
}

function kind(entry: LegacyEntry): 'page' | 'block' | 'entry' {
    if (entry.entryId != null) return 'entry';
    return entry.contentBlockId != null ? 'block' : 'page';
}

function ownerId(entry: LegacyEntry): number {
    return entry.entryId ?? entry.contentBlockId ?? entry.pageId;
}

function groupBy<T>(items: T[], key: (item: T) => string): T[][] {
    const groups = items.reduce((map, item) => map.set(key(item), [...(map.get(key(item)) ?? []), item]), new Map<string, T[]>());
    return [...groups.values()];
}

function truthy(value: unknown): boolean {
    return value === true || value === 1 || value === '1' || value === 't' || value === 'true';
}

/** The legacy values for fields the row has not filled yet (translations edited since win). */
function onlyEmpty(row: object, values: Record<string, string>): Record<string, string> {
    const current = row as Record<string, unknown>;
    return Object.fromEntries(Object.entries(values).filter(([field]) => isEmpty(current[field])));
}

/** Legacy values under the current ones: a key (or an image's alt/description) already set is kept. */
function mergeKeepingExisting(current: Record<string, any>, legacy: Record<string, any>): Record<string, any> {
    return Object.entries(legacy).reduce<Record<string, any>>((acc, [key, value]) => {
        const existing = acc[key];
        if (value && typeof value === 'object' && !Array.isArray(value) && existing && typeof existing === 'object') {
            return { ...acc, [key]: mergeKeepingExisting(existing, value) };
        }
        return isEmpty(existing) ? { ...acc, [key]: value } : acc;
    }, { ...current });
}

function isEmpty(value: unknown): boolean {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    return false;
}
