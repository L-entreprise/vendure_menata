import { gql } from 'graphql-tag';
import { Channel, LanguageCode, TransactionalConnection } from '@vendure/core';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS } from '../../../deploy/e2e/test-environment';
import { AuditLogPlugin } from '../../audit-log-plugin/audit-log.plugin';
import { CmsPageTranslation } from '../../cms-plugin/entities/cms-page-translation.entity';
import { ContentBlockTranslation } from '../../cms-plugin/entities/content-block-translation.entity';
import { FormSubmissionTranslation } from '../../cms-plugin/entities/form-submission-translation.entity';
import { CmsPlugin } from '../../cms-plugin/cms.plugin';
import { migrateLegacyTranslations } from '../migration/migrate-legacy-translations';

const CREATE_PAGE = gql`
    mutation CreateCmsPage($input: CreateCmsPageInput!) {
        createCmsPage(input: $input) {
            id
            contentBlocks {
                id
                key
            }
        }
    }
`;

const CREATE_ENTRY = gql`
    mutation CreateEntry($input: CreateCollectionEntryInput!) {
        createCollectionEntry(input: $input) {
            id
        }
    }
`;

const raw = (id: string) => Number(String(id).replace('T_', ''));

// The tables the removed translation-plugin created (TypeORM default naming).
const LEGACY_SCHEMA = [
    `CREATE TABLE "translation_language" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "code" varchar(10) NOT NULL, "name" varchar(100) NOT NULL, "enabled" boolean NOT NULL DEFAULT (1), "isDefault" boolean NOT NULL DEFAULT (0), "position" integer NOT NULL DEFAULT (0))`,
    `CREATE TABLE "translation_language_channels_channel" ("translationLanguageId" integer NOT NULL, "channelId" integer NOT NULL, PRIMARY KEY ("translationLanguageId", "channelId"))`,
    `CREATE TABLE "cms_translation_entry" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "languageCode" varchar(10) NOT NULL, "pageId" integer NOT NULL, "contentBlockId" integer, "entryId" integer, "fieldName" varchar(100) NOT NULL, "value" text NOT NULL DEFAULT (''))`,
    `CREATE TABLE "cms_translation_entry_channels_channel" ("cmsTranslationEntryId" integer NOT NULL, "channelId" integer NOT NULL, PRIMARY KEY ("cmsTranslationEntryId", "channelId"))`,
];

describe('migrateLegacyTranslations', () => {
    const { server, adminClient } = createPluginTestEnvironment({
        plugins: [AuditLogPlugin.init({}), CmsPlugin],
    });
    let dataSource: DataSource;
    let pageId: number;
    let titleId: number;
    let imageId: number;
    let galleryId: number;
    let entryId: number;

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
        dataSource = server.app.get(TransactionalConnection).rawConnection;

        const { createCmsPage } = await adminClient.query(CREATE_PAGE, {
            input: {
                key: 'about',
                translations: [{ languageCode: 'en', name: 'À propos', slug: 'a-propos' }],
                contentBlocks: [
                    { key: 'title', type: 'TEXT_SHORT', position: 0, translations: [{ languageCode: 'en', name: 'Titre', textContent: 'Bonjour' }] },
                    {
                        key: 'photo',
                        type: 'IMAGE',
                        position: 1,
                        metadata: { description: 'Hangar' },
                        translations: [{ languageCode: 'en', name: 'Photo', altText: 'Avion' }],
                    },
                    {
                        key: 'gallery',
                        type: 'IMAGE_GALLERY',
                        position: 2,
                        metadata: { assetIds: ['9'], imageMeta: { '9': { alt: 'Piste' } } },
                        translations: [{ languageCode: 'en', name: 'Galerie' }],
                    },
                ],
            },
        });
        pageId = raw(createCmsPage.id);
        const blockId = (key: string) => raw(createCmsPage.contentBlocks.find((b: any) => b.key === key).id);
        titleId = blockId('title');
        imageId = blockId('photo');
        galleryId = blockId('gallery');

        const { createCmsPage: list } = await adminClient.query(CREATE_PAGE, {
            input: {
                key: 'oils',
                isCollection: true,
                translations: [{ languageCode: 'en', name: 'Huiles', slug: 'huiles' }],
                contentBlocks: [
                    { key: 'name', type: 'TEXT_SHORT', position: 0, translations: [{ languageCode: 'en', name: 'Nom' }] },
                    { key: 'grades', type: 'ENUM', position: 1, translations: [{ languageCode: 'en', name: 'Grades' }] },
                ],
            },
        });
        const { createCollectionEntry } = await adminClient.query(CREATE_ENTRY, {
            input: { pageId: list.id, data: { name: 'Huile moteur', grades: ['5W30'] } },
        });
        entryId = raw(createCollectionEntry.id);
        const listId = raw(list.id);

        // The old CMS editor always saved the original as 'en'; the channel's language is French.
        const channelRepo = dataSource.getRepository(Channel);
        const channel = (await channelRepo.find())[0];
        await channelRepo.save({
            ...channel,
            defaultLanguageCode: LanguageCode.fr,
            availableLanguageCodes: [LanguageCode.fr, LanguageCode.en],
        });

        for (const sql of LEGACY_SCHEMA) await dataSource.query(sql);
        await dataSource.query(
            `INSERT INTO "translation_language" ("code", "name", "isDefault") VALUES ('fr', 'Français', 1), ('en', 'English', 0), ('de', 'Deutsch', 0)`,
        );
        await dataSource.query(`INSERT INTO "translation_language_channels_channel" VALUES (1, 1), (2, 1), (3, 1)`);
        const legacy: Array<[string, number, number | null, number | null, string, string]> = [
            ['en', pageId, null, null, 'name', 'About'],
            ['en', pageId, null, null, 'slug', 'about'],
            ['en', pageId, titleId, null, 'textContent', 'Hello'],
            ['en', pageId, imageId, null, 'altText', 'Plane'],
            ['en', pageId, imageId, null, 'description', 'Hangar photo'],
            ['en', pageId, galleryId, null, `gallery:9:alt`, 'Runway'],
            ['en', listId, null, entryId, 'name', 'Engine oil'],
            ['en', listId, null, entryId, 'grades', '["5W-30"]'],
            ['de', pageId, titleId, null, 'textContent', 'Hallo'],
        ];
        for (const [index, [lang, page, block, entry, field, value]] of legacy.entries()) {
            await dataSource.query(
                `INSERT INTO "cms_translation_entry" ("languageCode", "pageId", "contentBlockId", "entryId", "fieldName", "value") VALUES (?, ?, ?, ?, ?, ?)`,
                [lang, page, block, entry, field, value],
            );
            await dataSource.query(`INSERT INTO "cms_translation_entry_channels_channel" VALUES (?, 1)`, [index + 1]);
        }
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('moves the original to the channel language and copies translations to native rows', async () => {
        const report = await migrateLegacyTranslations(dataSource);

        expect(report.relabeled).toBe(7);
        expect(report.copied).toEqual({ pages: 1, blocks: 3, entries: 1 });
        expect(report.skipped).toEqual([{ languageCode: 'de', reason: 'not-available', count: 1 }]);

        const pageRows = await dataSource.getRepository(CmsPageTranslation).find({ where: { base: { id: pageId } } });
        expect(pageRows.map(r => [r.languageCode, r.name, r.slug]).sort()).toEqual([
            ['en', 'About', 'about'],
            ['fr', 'À propos', 'a-propos'],
        ]);

        const blockRows = await dataSource.getRepository(ContentBlockTranslation).find({ relations: ['base'] });
        const row = (blockId: number, lang: string) =>
            blockRows.find(r => r.base.id === blockId && r.languageCode === lang);
        expect(row(titleId, 'fr')?.textContent).toBe('Bonjour');
        expect(row(titleId, 'en')?.textContent).toBe('Hello');
        expect(row(imageId, 'en')).toMatchObject({ altText: 'Plane', translatedMetadata: { description: 'Hangar photo' } });
        expect(row(galleryId, 'en')?.translatedMetadata).toEqual({ imageMeta: { '9': { alt: 'Runway' } } });

        const entryRows = await dataSource.getRepository(FormSubmissionTranslation).find({ where: { baseId: entryId } });
        expect(entryRows.map(r => [r.languageCode, r.data])).toEqual([['en', { name: 'Engine oil', grades: ['5W-30'] }]]);
    });

    it('changes nothing when run again, and keeps translations edited since', async () => {
        const repo = dataSource.getRepository(ContentBlockTranslation);
        const edited = await repo.findOne({ where: { base: { id: titleId }, languageCode: LanguageCode.en } });
        await repo.update(edited!.id, { textContent: 'Hi there' });

        const report = await migrateLegacyTranslations(dataSource);

        expect(report.relabeled).toBe(0);
        expect(await repo.count()).toBe(8);
        expect((await repo.findOne({ where: { id: edited!.id } }))?.textContent).toBe('Hi there');
    });

    it('refuses to drop the legacy tables while entries were skipped', async () => {
        await expect(migrateLegacyTranslations(dataSource, { dropLegacyTables: true })).rejects.toThrow(/skipped/);
        const runner = dataSource.createQueryRunner();
        expect(await runner.hasTable('cms_translation_entry')).toBe(true);
        await runner.release();
    });

    it('drops the legacy tables when forced', async () => {
        await migrateLegacyTranslations(dataSource, { dropLegacyTables: true, force: true });
        const runner = dataSource.createQueryRunner();
        expect(await runner.hasTable('cms_translation_entry')).toBe(false);
        expect(await runner.hasTable('translation_language')).toBe(false);
        await runner.release();
    });
});
