# CMS Page Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the CMS plugin with a CmsPage entity that groups ordered, typed content blocks into composable pages, with a dashboard page builder UI and "Créer" nav shortcut.

**Architecture:** CmsPage owns ContentBlocks via OneToMany (nullable FK for backward compat). ContentBlockType enum expands with RICH_TEXT, DATE, NUMBER. CmsPageService manages nested block create/update/delete in a single mutation. Dashboard uses custom React form (not DetailPage) for the page builder.

**Tech Stack:** TypeORM entities, NestJS resolvers, GraphQL schema extensions, React dashboard with Vendure dashboard components, Lucide icons.

**Design doc:** `docs/plans/2026-02-25-cms-page-builder-design.md`

---

### Task 1: Expand constants

**Files:**
- Modify: `plugins/cms-plugin/constants.ts`

**Step 1: Add new enum values and CmsPage permission**

```typescript
import { CrudPermissionDefinition } from '@vendure/core';

export const contentBlockPermission = new CrudPermissionDefinition('ContentBlock');
export const cmsPagePermission = new CrudPermissionDefinition('CmsPage');

export enum ContentBlockType {
    IMAGE = 'IMAGE',
    TEXT = 'TEXT',
    RICH_TEXT = 'RICH_TEXT',
    DATE = 'DATE',
    NUMBER = 'NUMBER',
}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/constants.ts
git commit -m "feat(cms-plugin): Expand ContentBlockType enum and add CmsPage permission"
```

---

### Task 2: Create CmsPageTranslation entity

**Files:**
- Create: `plugins/cms-plugin/entities/cms-page-translation.entity.ts`

**Step 1: Write the entity**

Follow the exact pattern from `content-block-translation.entity.ts`. Key differences: fields are `name` and `slug` (not textContent/altText).

```typescript
import { DeepPartial } from '@vendure/common/lib/shared-types';
import { HasCustomFields, LanguageCode, Translation, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { CmsPage } from './cms-page.entity';

export class CustomCmsPageTranslationFields {}

@Entity()
export class CmsPageTranslation
    extends VendureEntity
    implements Translation<CmsPage>, HasCustomFields
{
    constructor(input?: DeepPartial<CmsPageTranslation>) {
        super(input);
    }

    @Column('varchar')
    languageCode: LanguageCode;

    @Column()
    name: string;

    @Column({ default: '' })
    slug: string;

    @Index()
    @ManyToOne(() => CmsPage, base => base.translations, { onDelete: 'CASCADE' })
    base: CmsPage;

    @Column(() => CustomCmsPageTranslationFields)
    customFields: CustomCmsPageTranslationFields;
}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/entities/cms-page-translation.entity.ts
git commit -m "feat(cms-plugin): Add CmsPageTranslation entity"
```

---

### Task 3: Create CmsPage entity

**Files:**
- Create: `plugins/cms-plugin/entities/cms-page.entity.ts`

**Step 1: Write the entity**

Follow the ContentBlock entity pattern. CmsPage has: key, enabled, translations (OneToMany eager), contentBlocks (OneToMany ordered by position), channels (ManyToMany), customFields.

```typescript
import { DeepPartial } from '@vendure/common/lib/shared-types';
import {
    Channel,
    HasCustomFields,
    LocaleString,
    Translatable,
    Translation,
    VendureEntity,
} from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany, OneToMany } from 'typeorm';

import { ContentBlock } from './content-block.entity';
import { CmsPageTranslation } from './cms-page-translation.entity';

export class CustomCmsPageFields {}

@Entity()
export class CmsPage extends VendureEntity implements Translatable, HasCustomFields {
    constructor(input?: DeepPartial<CmsPage>) {
        super(input);
    }

    @Column()
    @Index({ unique: true })
    key: string;

    @Column({ default: true })
    enabled: boolean;

    name: LocaleString;
    slug: LocaleString;

    @OneToMany(() => CmsPageTranslation, translation => translation.base, { eager: true })
    translations: Array<Translation<CmsPage>>;

    @OneToMany(() => ContentBlock, block => block.page)
    contentBlocks: ContentBlock[];

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Column(() => CustomCmsPageFields)
    customFields: CustomCmsPageFields;
}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/entities/cms-page.entity.ts
git commit -m "feat(cms-plugin): Add CmsPage entity"
```

---

### Task 4: Modify ContentBlock entity

**Files:**
- Modify: `plugins/cms-plugin/entities/content-block.entity.ts`

**Step 1: Add imports and new columns**

Add these imports at the top (merge with existing):
- Import `CmsPage` from `./cms-page.entity`

Add these columns/relations to the entity class:

```typescript
// Add to existing imports from 'typeorm':
// Column, Entity, Index, JoinTable, ManyToMany, ManyToOne, OneToMany

// Add new import:
import { CmsPage } from './cms-page.entity';

// Add these fields to the ContentBlock class:

@ManyToOne(() => CmsPage, page => page.contentBlocks, { nullable: true, onDelete: 'CASCADE' })
page: CmsPage | null;

@Column({ nullable: true })
pageId: ID | null;

@Column({ default: 0 })
position: number;

@Column('datetime', { nullable: true })
dateValue: Date | null;

@Column('float', { nullable: true })
numberValue: number | null;
```

Place these after the `metadata` field and before the `name: LocaleString` line.

**Important:** The `page` relation uses `onDelete: 'CASCADE'` — deleting a CmsPage deletes its content blocks. The `pageId` is nullable to keep standalone blocks working.

**Step 2: Commit**

```bash
git add plugins/cms-plugin/entities/content-block.entity.ts
git commit -m "feat(cms-plugin): Add page FK, position, dateValue, numberValue to ContentBlock"
```

---

### Task 5: Expand GraphQL schema

**Files:**
- Modify: `plugins/cms-plugin/api/api-extensions.ts`

**Step 1: Update the entire file**

Replace the full content. Changes from v1:
- ContentBlockType enum gains RICH_TEXT, DATE, NUMBER
- ContentBlock type gains page, position, dateValue, numberValue fields
- New CmsPage/CmsPageTranslation/CmsPageList types
- New CmsPageListOptions input
- Shop API gains cmsPage, cmsPageByKey, cmsPages queries
- Admin API gains cmsPage, cmsPages queries + createCmsPage, updateCmsPage, deleteCmsPage mutations
- New inputs: CmsPageTranslationInput, CreateCmsPageInput, UpdateCmsPageInput, UpdatePageContentBlockInput

```typescript
import { gql } from 'graphql-tag';

const commonApiExtensions = gql`
    enum ContentBlockType {
        IMAGE
        TEXT
        RICH_TEXT
        DATE
        NUMBER
    }

    type ContentBlockTranslation {
        id: ID!
        languageCode: LanguageCode!
        name: String!
        textContent: String
        altText: String
    }

    type ContentBlock implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        key: String!
        type: ContentBlockType!
        enabled: Boolean!
        featuredAsset: Asset
        metadata: JSON
        translations: [ContentBlockTranslation!]!
        name: String!
        textContent: String
        altText: String
        page: CmsPage
        position: Int!
        dateValue: DateTime
        numberValue: Float
    }

    type ContentBlockList implements PaginatedList {
        items: [ContentBlock!]!
        totalItems: Int!
    }

    # Auto-generated at runtime by ListQueryBuilder
    input ContentBlockListOptions

    type CmsPageTranslation {
        id: ID!
        languageCode: LanguageCode!
        name: String!
        slug: String!
    }

    type CmsPage implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        key: String!
        enabled: Boolean!
        name: String!
        slug: String!
        translations: [CmsPageTranslation!]!
        contentBlocks: [ContentBlock!]!
    }

    type CmsPageList implements PaginatedList {
        items: [CmsPage!]!
        totalItems: Int!
    }

    # Auto-generated at runtime by ListQueryBuilder
    input CmsPageListOptions
`;

export const shopApiExtensions = gql`
    ${commonApiExtensions}

    extend type Query {
        contentBlock(id: ID!): ContentBlock
        contentBlockByKey(key: String!): ContentBlock
        contentBlocks(options: ContentBlockListOptions): ContentBlockList!
        cmsPage(id: ID!): CmsPage
        cmsPageByKey(key: String!): CmsPage
        cmsPages(options: CmsPageListOptions): CmsPageList!
    }
`;

export const adminApiExtensions = gql`
    ${commonApiExtensions}

    input ContentBlockTranslationInput {
        id: ID
        languageCode: LanguageCode!
        name: String!
        textContent: String
        altText: String
    }

    input CreateContentBlockInput {
        key: String!
        type: ContentBlockType!
        enabled: Boolean
        featuredAssetId: ID
        metadata: JSON
        translations: [ContentBlockTranslationInput!]!
    }

    input UpdateContentBlockInput {
        id: ID!
        key: String
        enabled: Boolean
        featuredAssetId: ID
        metadata: JSON
        translations: [ContentBlockTranslationInput!]
    }

    input CmsPageTranslationInput {
        id: ID
        languageCode: LanguageCode!
        name: String!
        slug: String!
    }

    input UpdatePageContentBlockInput {
        id: ID
        type: ContentBlockType!
        key: String!
        position: Int!
        enabled: Boolean
        featuredAssetId: ID
        dateValue: DateTime
        numberValue: Float
        translations: [ContentBlockTranslationInput!]
    }

    input CreateCmsPageInput {
        key: String!
        enabled: Boolean
        translations: [CmsPageTranslationInput!]!
        contentBlocks: [UpdatePageContentBlockInput!]
    }

    input UpdateCmsPageInput {
        id: ID!
        key: String
        enabled: Boolean
        translations: [CmsPageTranslationInput!]
        contentBlocks: [UpdatePageContentBlockInput!]
    }

    extend type Query {
        contentBlock(id: ID!): ContentBlock
        contentBlocks(options: ContentBlockListOptions): ContentBlockList!
        cmsPage(id: ID!): CmsPage
        cmsPages(options: CmsPageListOptions): CmsPageList!
    }

    extend type Mutation {
        createContentBlock(input: CreateContentBlockInput!): ContentBlock!
        updateContentBlock(input: UpdateContentBlockInput!): ContentBlock!
        deleteContentBlock(id: ID!): DeletionResponse!
        createCmsPage(input: CreateCmsPageInput!): CmsPage!
        updateCmsPage(input: UpdateCmsPageInput!): CmsPage!
        deleteCmsPage(id: ID!): DeletionResponse!
    }
`;
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/api/api-extensions.ts
git commit -m "feat(cms-plugin): Add CmsPage GraphQL schema and expand ContentBlock type"
```

---

### Task 6: Create CmsPage service

**Files:**
- Create: `plugins/cms-plugin/services/cms-page.service.ts`

**Step 1: Write the service**

This is the most complex file. It manages CmsPage CRUD with nested ContentBlock operations. On update, it diffs the incoming blocks against existing ones: creates new blocks, updates existing ones, deletes removed ones.

```typescript
import { Injectable } from '@nestjs/common';
import { DeletionResponse, DeletionResult } from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import {
    ChannelService,
    LanguageCode,
    ListQueryBuilder,
    ListQueryOptions,
    RequestContext,
    TransactionalConnection,
    TranslatableSaver,
    translateDeep,
} from '@vendure/core';

import { ContentBlockTranslation } from '../entities/content-block-translation.entity';
import { ContentBlock } from '../entities/content-block.entity';
import { CmsPageTranslation } from '../entities/cms-page-translation.entity';
import { CmsPage } from '../entities/cms-page.entity';

interface ContentBlockInput {
    id?: ID;
    type: string;
    key: string;
    position: number;
    enabled?: boolean;
    featuredAssetId?: ID | null;
    dateValue?: Date | string | null;
    numberValue?: number | null;
    translations?: Array<{
        id?: ID;
        languageCode: LanguageCode;
        name: string;
        textContent?: string;
        altText?: string;
    }>;
}

@Injectable()
export class CmsPageService {
    constructor(
        private connection: TransactionalConnection,
        private translatableSaver: TranslatableSaver,
        private listQueryBuilder: ListQueryBuilder,
        private channelService: ChannelService,
    ) {}

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<CmsPage>,
    ): Promise<PaginatedList<CmsPage>> {
        return this.listQueryBuilder
            .build(CmsPage, options, {
                relations: ['channels'],
                ctx,
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({
                items: items.map(item => translateDeep(item, ctx.languageCode)),
                totalItems,
            }));
    }

    async findOne(ctx: RequestContext, id: ID): Promise<CmsPage | undefined> {
        const page = await this.connection.findOneInChannel(
            ctx,
            CmsPage,
            id,
            ctx.channelId,
            { relations: ['channels', 'contentBlocks', 'contentBlocks.featuredAsset'] },
        );
        if (!page) return undefined;
        // Sort blocks by position
        page.contentBlocks = (page.contentBlocks || []).sort((a, b) => a.position - b.position);
        // Translate page and nested blocks
        const translated = translateDeep(page, ctx.languageCode);
        translated.contentBlocks = translated.contentBlocks.map(
            block => translateDeep(block, ctx.languageCode),
        );
        return translated;
    }

    async findByKey(ctx: RequestContext, key: string): Promise<CmsPage | undefined> {
        const page = await this.listQueryBuilder
            .build(CmsPage, {}, {
                ctx,
                channelId: ctx.channelId,
                relations: ['channels', 'contentBlocks', 'contentBlocks.featuredAsset'],
            })
            .andWhere('cms_page.key = :key', { key })
            .getOne();
        if (!page) return undefined;
        page.contentBlocks = (page.contentBlocks || []).sort((a, b) => a.position - b.position);
        const translated = translateDeep(page, ctx.languageCode);
        translated.contentBlocks = translated.contentBlocks.map(
            block => translateDeep(block, ctx.languageCode),
        );
        return translated;
    }

    async create(ctx: RequestContext, input: {
        key: string;
        enabled?: boolean;
        translations: Array<{
            languageCode: LanguageCode;
            name: string;
            slug: string;
        }>;
        contentBlocks?: ContentBlockInput[];
    }): Promise<CmsPage> {
        const page = await this.translatableSaver.create({
            ctx,
            input: {
                key: input.key,
                enabled: input.enabled ?? true,
                translations: input.translations,
            },
            entityType: CmsPage,
            translationType: CmsPageTranslation,
            beforeSave: async p => {
                await this.channelService.assignToCurrentChannel(p, ctx);
            },
        });

        if (input.contentBlocks?.length) {
            await this.saveContentBlocks(ctx, page.id, input.contentBlocks);
        }

        return this.findOne(ctx, page.id) as Promise<CmsPage>;
    }

    async update(ctx: RequestContext, input: {
        id: ID;
        key?: string;
        enabled?: boolean;
        translations?: Array<{
            id?: ID;
            languageCode: LanguageCode;
            name: string;
            slug: string;
        }>;
        contentBlocks?: ContentBlockInput[];
    }): Promise<CmsPage> {
        await this.translatableSaver.update({
            ctx,
            input: {
                id: input.id,
                ...(input.key !== undefined && { key: input.key }),
                ...(input.enabled !== undefined && { enabled: input.enabled }),
                ...(input.translations && { translations: input.translations }),
            },
            entityType: CmsPage,
            translationType: CmsPageTranslation,
        });

        if (input.contentBlocks !== undefined) {
            await this.syncContentBlocks(ctx, input.id, input.contentBlocks);
        }

        return this.findOne(ctx, input.id) as Promise<CmsPage>;
    }

    async delete(ctx: RequestContext, id: ID): Promise<DeletionResponse> {
        const page = await this.connection.getEntityOrThrow(ctx, CmsPage, id, {
            channelId: ctx.channelId,
        });
        await this.connection.getRepository(ctx, CmsPage).remove(page);
        return { result: DeletionResult.DELETED };
    }

    /**
     * Creates content blocks for a new page.
     */
    private async saveContentBlocks(
        ctx: RequestContext,
        pageId: ID,
        blocks: ContentBlockInput[],
    ): Promise<void> {
        for (const blockInput of blocks) {
            await this.translatableSaver.create({
                ctx,
                input: {
                    key: blockInput.key,
                    type: blockInput.type,
                    enabled: blockInput.enabled ?? true,
                    position: blockInput.position,
                    pageId,
                    featuredAssetId: blockInput.featuredAssetId ?? null,
                    dateValue: blockInput.dateValue ?? null,
                    numberValue: blockInput.numberValue ?? null,
                    translations: blockInput.translations ?? [],
                },
                entityType: ContentBlock,
                translationType: ContentBlockTranslation,
                beforeSave: async b => {
                    await this.channelService.assignToCurrentChannel(b, ctx);
                },
            });
        }
    }

    /**
     * Syncs content blocks for an existing page: creates new, updates existing, deletes removed.
     */
    private async syncContentBlocks(
        ctx: RequestContext,
        pageId: ID,
        incomingBlocks: ContentBlockInput[],
    ): Promise<void> {
        const blockRepo = this.connection.getRepository(ctx, ContentBlock);

        // Get existing blocks for this page
        const existingBlocks = await blockRepo.find({ where: { pageId: pageId as any } });
        const existingIds = new Set(existingBlocks.map(b => b.id.toString()));
        const incomingIds = new Set(
            incomingBlocks.filter(b => b.id).map(b => b.id!.toString()),
        );

        // Delete blocks not in incoming list
        for (const existing of existingBlocks) {
            if (!incomingIds.has(existing.id.toString())) {
                await blockRepo.remove(existing);
            }
        }

        // Create or update blocks
        for (const blockInput of incomingBlocks) {
            if (blockInput.id && existingIds.has(blockInput.id.toString())) {
                // Update existing block
                await this.translatableSaver.update({
                    ctx,
                    input: {
                        id: blockInput.id,
                        key: blockInput.key,
                        type: blockInput.type,
                        enabled: blockInput.enabled ?? true,
                        position: blockInput.position,
                        featuredAssetId: blockInput.featuredAssetId ?? null,
                        dateValue: blockInput.dateValue ?? null,
                        numberValue: blockInput.numberValue ?? null,
                        translations: blockInput.translations,
                    },
                    entityType: ContentBlock,
                    translationType: ContentBlockTranslation,
                });
            } else {
                // Create new block
                await this.translatableSaver.create({
                    ctx,
                    input: {
                        key: blockInput.key,
                        type: blockInput.type,
                        enabled: blockInput.enabled ?? true,
                        position: blockInput.position,
                        pageId,
                        featuredAssetId: blockInput.featuredAssetId ?? null,
                        dateValue: blockInput.dateValue ?? null,
                        numberValue: blockInput.numberValue ?? null,
                        translations: blockInput.translations ?? [],
                    },
                    entityType: ContentBlock,
                    translationType: ContentBlockTranslation,
                    beforeSave: async b => {
                        await this.channelService.assignToCurrentChannel(b, ctx);
                    },
                });
            }
        }
    }
}
```

**Key design decisions:**
- `syncContentBlocks` does a full diff: removes blocks not in input, creates new ones, updates existing ones
- Blocks are identified by `id` — if input block has no `id`, it's new
- `saveContentBlocks` (for create) is simpler — just creates all blocks
- Each block still gets its own channel assignment
- `findOne` sorts blocks by position and translates both page and nested blocks

**Step 2: Commit**

```bash
git add plugins/cms-plugin/services/cms-page.service.ts
git commit -m "feat(cms-plugin): Add CmsPageService with nested block management"
```

---

### Task 7: Create CmsPage admin resolver

**Files:**
- Create: `plugins/cms-plugin/api/cms-page-admin.resolver.ts`

**Step 1: Write the resolver**

Follow the exact pattern from `content-block-admin.resolver.ts`.

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    RequestContext,
    Transaction,
} from '@vendure/core';

import { cmsPagePermission } from '../constants';
import { CmsPageService } from '../services/cms-page.service';

@Resolver()
export class CmsPageAdminResolver {
    constructor(private cmsPageService: CmsPageService) {}

    @Query()
    @Allow(cmsPagePermission.Read)
    async cmsPage(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.cmsPageService.findOne(ctx, args.id);
    }

    @Query()
    @Allow(cmsPagePermission.Read)
    async cmsPages(@Ctx() ctx: RequestContext, @Args() args: { options: any }) {
        return this.cmsPageService.findAll(ctx, args.options);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Create)
    async createCmsPage(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.cmsPageService.create(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Update)
    async updateCmsPage(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.cmsPageService.update(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Delete)
    async deleteCmsPage(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.cmsPageService.delete(ctx, args.id);
    }
}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/api/cms-page-admin.resolver.ts
git commit -m "feat(cms-plugin): Add CmsPage admin resolver"
```

---

### Task 8: Create CmsPage shop resolver

**Files:**
- Create: `plugins/cms-plugin/api/cms-page-shop.resolver.ts`

**Step 1: Write the resolver**

Read-only, public access. Follow `content-block-shop.resolver.ts` pattern.

```typescript
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { CmsPageService } from '../services/cms-page.service';

@Resolver()
export class CmsPageShopResolver {
    constructor(private cmsPageService: CmsPageService) {}

    @Query()
    @Allow(Permission.Public)
    async cmsPage(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.cmsPageService.findOne(ctx, args.id);
    }

    @Query()
    @Allow(Permission.Public)
    async cmsPageByKey(@Ctx() ctx: RequestContext, @Args() args: { key: string }) {
        return this.cmsPageService.findByKey(ctx, args.key);
    }

    @Query()
    @Allow(Permission.Public)
    async cmsPages(@Ctx() ctx: RequestContext, @Args() args: { options: any }) {
        return this.cmsPageService.findAll(ctx, args.options);
    }
}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/api/cms-page-shop.resolver.ts
git commit -m "feat(cms-plugin): Add CmsPage shop resolver"
```

---

### Task 9: Update plugin registration

**Files:**
- Modify: `plugins/cms-plugin/cms.plugin.ts`

**Step 1: Register new entities, resolvers, service, permission**

```typescript
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { CmsPageAdminResolver } from './api/cms-page-admin.resolver';
import { CmsPageShopResolver } from './api/cms-page-shop.resolver';
import { ContentBlockAdminResolver } from './api/content-block-admin.resolver';
import { ContentBlockShopResolver } from './api/content-block-shop.resolver';
import { cmsPagePermission, contentBlockPermission } from './constants';
import { CmsPageTranslation } from './entities/cms-page-translation.entity';
import { CmsPage } from './entities/cms-page.entity';
import { ContentBlockTranslation } from './entities/content-block-translation.entity';
import { ContentBlock } from './entities/content-block.entity';
import { CmsPageService } from './services/cms-page.service';
import { ContentBlockService } from './services/content-block.service';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [ContentBlock, ContentBlockTranslation, CmsPage, CmsPageTranslation],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [ContentBlockAdminResolver, CmsPageAdminResolver],
    },
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [ContentBlockShopResolver, CmsPageShopResolver],
    },
    providers: [ContentBlockService, CmsPageService],
    configuration: config => {
        config.authOptions.customPermissions.push(contentBlockPermission, cmsPagePermission);
        return config;
    },
    compatibility: '^3.0.0',
    dashboard: './dashboard/index.tsx',
})
export class CmsPlugin {}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/cms.plugin.ts
git commit -m "feat(cms-plugin): Register CmsPage entities, resolvers, and service"
```

---

### Task 10: Verify backend

**Step 1: Restart dev server**

```bash
cd packages/dev-server && npm run dev
```

Expected: Server starts without TypeScript errors. New tables `cms_page`, `cms_page_translation` created (or migration warning if `synchronize: false`). New columns added to `content_block` table.

**Step 2: Test via GraphQL (at /graphiql/admin)**

Login first, then test `createCmsPage`:

```graphql
mutation {
    createCmsPage(input: {
        key: "homepage"
        enabled: true
        translations: [
            { languageCode: en, name: "Homepage", slug: "homepage" }
            { languageCode: fr, name: "Page d'accueil", slug: "page-accueil" }
        ]
        contentBlocks: [
            {
                type: TEXT
                key: "hero-title"
                position: 0
                translations: [
                    { languageCode: en, name: "Hero Title", textContent: "Welcome" }
                    { languageCode: fr, name: "Titre Hero", textContent: "Bienvenue" }
                ]
            }
            {
                type: NUMBER
                key: "hero-count"
                position: 1
                numberValue: 42
                translations: [
                    { languageCode: en, name: "Hero Count" }
                    { languageCode: fr, name: "Compteur Hero" }
                ]
            }
        ]
    }) {
        id
        key
        name
        slug
        contentBlocks {
            id
            key
            type
            position
            textContent
            numberValue
        }
    }
}
```

Expected: Returns created page with 2 content blocks ordered by position.

**Step 3: If TypeScript errors occur, fix them before proceeding**

Common issues:
- `Translation<CmsPage>` constraint mismatch → ensure CmsPageTranslation fields use `string` (not `string | null`) with `default: ''`
- Circular import → CmsPage imports ContentBlock, ContentBlock imports CmsPage. Use `() => CmsPage` lazy reference in TypeORM decorator (already done in the code above)

---

### Task 11: Regenerate GraphQL types

**Step 1: Run codegen for the dashboard**

After confirming the server starts and the schema is correct:

```bash
cd packages/dev-server && npx graphql-codegen
```

Or if that's not available, copy the approach used in the project. The dashboard `@/graphql/graphql` imports rely on generated types from `packages/dev-server/graphql/`. The codegen reads the running server's schema.

**Important:** The dev server must be running when you run codegen, because it introspects the live schema.

**Step 2: Commit generated types**

```bash
git add packages/dev-server/graphql/
git commit -m "chore(cms-plugin): Regenerate GraphQL types for CmsPage schema"
```

---

### Task 12: Dashboard — CmsPage list page

**Files:**
- Create: `plugins/cms-plugin/dashboard/cms-page-list.tsx`

**Step 1: Write the list page**

Follow `content-block-list.tsx` pattern. Columns: name, key, slug, enabled.

```tsx
import { graphql } from '@/graphql/graphql';
import { Link } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import {
    Button,
    DashboardRouteDefinition,
    DetailPageButton,
    ListPage,
    PageActionBarRight,
} from '@vendure/dashboard';

const getCmsPageList = graphql(`
    query GetCmsPages($options: CmsPageListOptions) {
        cmsPages(options: $options) {
            items {
                id
                createdAt
                updatedAt
                key
                enabled
                name
                slug
            }
            totalItems
        }
    }
`);

const deleteCmsPageDocument = graphql(`
    mutation DeleteCmsPage($id: ID!) {
        deleteCmsPage(id: $id) {
            result
            message
        }
    }
`);

export const cmsPageList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'cms',
        id: 'cms-pages',
        url: '/cms-pages',
        title: 'Pages',
        requiresPermission: ['ReadCmsPage'],
    },
    path: '/cms-pages',
    loader: () => ({
        breadcrumb: 'Pages',
    }),
    component: route => (
        <ListPage
            pageId="cms-page-list"
            title="CMS Pages"
            listQuery={getCmsPageList}
            deleteMutation={deleteCmsPageDocument}
            route={route}
            customizeColumns={{
                id: {
                    header: 'ID',
                    cell: ({ row }) => (
                        <DetailPageButton id={row.original.id} label={row.original.id} />
                    ),
                },
                name: {
                    header: 'Name',
                    cell: ({ row }) => (
                        <DetailPageButton id={row.original.id} label={row.original.name} />
                    ),
                },
            }}
        >
            <PageActionBarRight>
                <Button asChild>
                    <Link to="./new">
                        <PlusIcon className="mr-2 h-4 w-4" />
                        New Page
                    </Link>
                </Button>
            </PageActionBarRight>
        </ListPage>
    ),
};
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/dashboard/cms-page-list.tsx
git commit -m "feat(cms-plugin): Add CmsPage list page"
```

---

### Task 13: Dashboard — CmsPage detail page (page builder)

**Files:**
- Create: `plugins/cms-plugin/dashboard/cms-page-detail.tsx`

**Step 1: Write the detail page**

This is the most complex dashboard file. It uses `DetailPage` for the page-level fields (key, name, slug, enabled, translations) and manages content blocks as a nested form section.

**Important:** The `DetailPage` component auto-generates form fields from the query. For the page builder (content blocks), we need to use `setValuesForUpdate` and `setValuesForCreate` to include the blocks in the mutation input. The content blocks section is rendered as part of the form.

Since the `DetailPage` component handles basic fields automatically, we only need to handle the content blocks specially. The blocks are included in the mutation input via `setValuesForUpdate`/`setValuesForCreate`.

```tsx
import { graphql } from '@/graphql/graphql';
import { DashboardRouteDefinition, DetailPage, detailPageRouteLoader } from '@vendure/dashboard';

const cmsPageDetailDocument = graphql(`
    query GetCmsPageDetail($id: ID!) {
        cmsPage(id: $id) {
            id
            createdAt
            updatedAt
            key
            enabled
            name
            slug
            translations {
                id
                languageCode
                name
                slug
            }
            contentBlocks {
                id
                key
                type
                enabled
                position
                textContent
                dateValue
                numberValue
                featuredAsset {
                    id
                    preview
                }
                translations {
                    id
                    languageCode
                    name
                    textContent
                    altText
                }
            }
        }
    }
`);

const updateCmsPageDocument = graphql(`
    mutation UpdateCmsPage($input: UpdateCmsPageInput!) {
        updateCmsPage(input: $input) {
            id
        }
    }
`);

const createCmsPageDocument = graphql(`
    mutation CreateCmsPage($input: CreateCmsPageInput!) {
        createCmsPage(input: $input) {
            id
        }
    }
`);

export const cmsPageDetail: DashboardRouteDefinition = {
    path: '/cms-pages/$id',
    loader: detailPageRouteLoader({
        queryDocument: cmsPageDetailDocument,
        breadcrumb: (isNew, entity) => [
            { path: '/cms-pages', label: 'Pages' },
            isNew ? 'New page' : entity?.name,
        ],
    }),
    component: route => (
        <DetailPage
            pageId="cms-page-detail"
            queryDocument={cmsPageDetailDocument}
            updateDocument={updateCmsPageDocument}
            createDocument={createCmsPageDocument}
            route={route}
            title={page => page?.name ?? 'New Page'}
            setValuesForUpdate={page => ({
                id: page.id,
                key: page.key,
                enabled: page.enabled,
                translations: page.translations,
                contentBlocks: page.contentBlocks.map(block => ({
                    id: block.id,
                    type: block.type,
                    key: block.key,
                    position: block.position,
                    enabled: block.enabled,
                    featuredAssetId: block.featuredAsset?.id,
                    dateValue: block.dateValue,
                    numberValue: block.numberValue,
                    translations: block.translations,
                })),
            })}
            setValuesForCreate={() => ({
                key: '',
                enabled: true,
                translations: [],
                contentBlocks: [],
            })}
        />
    ),
};
```

**Note on the page builder UI:** The `DetailPage` component auto-generates form fields from the GraphQL query. The content blocks will appear as a nested section. If the auto-generated form doesn't handle the block list well enough (no add/remove/reorder), we may need to build a custom page component instead of using `DetailPage`. This will be evaluated during Task 10 (backend verification) and adjusted if needed.

**Step 2: Commit**

```bash
git add plugins/cms-plugin/dashboard/cms-page-detail.tsx
git commit -m "feat(cms-plugin): Add CmsPage detail page with content block support"
```

---

### Task 14: Dashboard — Update index.tsx with nav items and routes

**Files:**
- Modify: `plugins/cms-plugin/dashboard/index.tsx`

**Step 1: Add imports and routes**

```tsx
import { defineDashboardExtension } from '@vendure/dashboard';
import { FileTextIcon } from 'lucide-react';

import { cmsPageDetail } from './cms-page-detail';
import { cmsPageList } from './cms-page-list';
import { contentBlockDetail } from './content-block-detail';
import { contentBlockList } from './content-block-list';

defineDashboardExtension({
    navSections: [
        {
            id: 'cms',
            title: 'CMS',
            icon: FileTextIcon,
        },
    ],
    routes: [
        // "Créer" nav item — shortcut to create new page
        {
            navMenuItem: {
                sectionId: 'cms',
                id: 'cms-create',
                url: '/cms-pages/new',
                title: 'Créer',
                requiresPermission: ['CreateCmsPage'],
            },
        },
        cmsPageList,
        cmsPageDetail,
        contentBlockList,
        contentBlockDetail,
    ],
});
```

The "Créer" route is a nav-only entry (no `path` or `component`) that navigates to the CmsPage detail page in create mode. It reuses the `cmsPageDetail` route's `path: '/cms-pages/$id'` where `$id` is `new`.

**Important:** If a nav-only route object (without `path`/`component`) causes errors, we may need to add a minimal path/component. Test this during verification and adjust. Alternative approach: just add the Créer entry as a `navMenuItem` on `cmsPageDetail` with a second nav item pointing to `/cms-pages/new`.

**Step 2: Commit**

```bash
git add plugins/cms-plugin/dashboard/index.tsx
git commit -m "feat(cms-plugin): Add Créer nav shortcut, Pages routes to dashboard"
```

---

### Task 15: Verify dashboard

**Step 1: Ensure dev server is running**

```bash
cd packages/dev-server && npm run dev
```

**Step 2: Start Vite dashboard dev server**

In PowerShell:
```powershell
$env:VENDURE_API_PORT=3000; cd packages/dev-server; npm run dashboard:dev
```

Or in bash:
```bash
VENDURE_API_PORT=3000 npm run dashboard:dev
```

**Step 3: Verify in browser at http://localhost:5173**

Check:
1. CMS nav section shows: "Créer", "Pages", "Content Blocks"
2. "Créer" navigates to `/cms-pages/new` (page creation form)
3. "Pages" navigates to `/cms-pages` (list with columns: name, key, slug, enabled)
4. Create a test page with content blocks
5. Edit the page, verify blocks are loaded and can be modified
6. Delete works from the list page

**Step 4: Fix any issues found during verification**

Common issues:
- Nav-only route errors → add minimal `path`/`component` to Créer route
- GraphQL type mismatch → regenerate types (Task 11)
- `contentBlocks` not loaded → check relations in `findOne`
- Block translations not saved → check `syncContentBlocks` logic

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(cms-plugin): Dashboard verification fixes"
```
