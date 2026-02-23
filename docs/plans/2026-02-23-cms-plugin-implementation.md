# CMS Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Vendure CMS plugin with typed content blocks (IMAGE, TEXT) supporting translations, channel-awareness, and CRUD permissions.

**Architecture:** Single `ContentBlock` entity with type discriminator, `ContentBlockTranslation` for i18n (FR/EN), ChannelAware for multi-store, CrudPermissionDefinition for auth. Lives in `plugins/cms-plugin/` alongside `menata-branding`.

**Tech Stack:** TypeORM entities, NestJS resolvers, GraphQL schema extensions, Vendure core services (TranslatableSaver, ListQueryBuilder, TransactionalConnection, ChannelService).

---

### Task 1: Create plugin directory and constants

**Files:**
- Create: `plugins/cms-plugin/constants.ts`

**Step 1: Create the constants file with permission definition**

```typescript
// plugins/cms-plugin/constants.ts
import { CrudPermissionDefinition } from '@vendure/core';

export const contentBlockPermission = new CrudPermissionDefinition('ContentBlock');

export enum ContentBlockType {
    IMAGE = 'IMAGE',
    TEXT = 'TEXT',
}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/constants.ts
git commit -m "feat(cms-plugin): add permission definition and content block types"
```

---

### Task 2: Create ContentBlock entity

**Files:**
- Create: `plugins/cms-plugin/entities/content-block.entity.ts`

**Reference:** `packages/core/src/entity/collection/collection.entity.ts` for ChannelAware + Translatable + Asset pattern.

**Step 1: Write the entity**

```typescript
// plugins/cms-plugin/entities/content-block.entity.ts
import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import {
    Asset,
    Channel,
    HasCustomFields,
    LocaleString,
    Translatable,
    Translation,
    VendureEntity,
} from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';

import { ContentBlockType } from '../constants';
import { ContentBlockTranslation } from './content-block-translation.entity';

export class CustomContentBlockFields {}

@Entity()
export class ContentBlock extends VendureEntity implements Translatable, HasCustomFields {
    constructor(input?: DeepPartial<ContentBlock>) {
        super(input);
    }

    @Column()
    @Index({ unique: false })
    key: string;

    @Column('varchar')
    type: ContentBlockType;

    @Column({ default: true })
    enabled: boolean;

    @ManyToOne(() => Asset, { nullable: true, onDelete: 'SET NULL' })
    featuredAsset: Asset | null;

    @Column({ nullable: true })
    featuredAssetId: ID | null;

    @Column('simple-json', { nullable: true })
    metadata: Record<string, unknown> | null;

    // Translatable fields (resolved from translations)
    name: LocaleString;
    textContent: LocaleString;
    altText: LocaleString;

    @OneToMany(() => ContentBlockTranslation, translation => translation.base, { eager: true })
    translations: Array<Translation<ContentBlock>>;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Column(() => CustomContentBlockFields)
    customFields: CustomContentBlockFields;
}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/entities/content-block.entity.ts
git commit -m "feat(cms-plugin): add ContentBlock entity"
```

---

### Task 3: Create ContentBlockTranslation entity

**Files:**
- Create: `plugins/cms-plugin/entities/content-block-translation.entity.ts`

**Reference:** `packages/dev-server/test-plugins/reviews/entities/product-review-translation.entity.ts`

**Step 1: Write the translation entity**

```typescript
// plugins/cms-plugin/entities/content-block-translation.entity.ts
import { DeepPartial } from '@vendure/common/lib/shared-types';
import { HasCustomFields, LanguageCode, Translation, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { ContentBlock } from './content-block.entity';

export class CustomContentBlockTranslationFields {}

@Entity()
export class ContentBlockTranslation
    extends VendureEntity
    implements Translation<ContentBlock>, HasCustomFields
{
    constructor(input?: DeepPartial<ContentBlockTranslation>) {
        super(input);
    }

    @Column('varchar')
    languageCode: LanguageCode;

    @Column()
    name: string;

    @Column('text', { nullable: true })
    textContent: string | null;

    @Column('varchar', { nullable: true })
    altText: string | null;

    @Index()
    @ManyToOne(() => ContentBlock, base => base.translations, { onDelete: 'CASCADE' })
    base: ContentBlock;

    @Column(() => CustomContentBlockTranslationFields)
    customFields: CustomContentBlockTranslationFields;
}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/entities/content-block-translation.entity.ts
git commit -m "feat(cms-plugin): add ContentBlockTranslation entity"
```

---

### Task 4: Create GraphQL schema extensions

**Files:**
- Create: `plugins/cms-plugin/api/api-extensions.ts`

**Reference:** `packages/dev-server/test-plugins/reviews/api/api-extensions.ts`

**Step 1: Write the schema**

```typescript
// plugins/cms-plugin/api/api-extensions.ts
import { gql } from 'graphql-tag';

const commonApiExtensions = gql`
    enum ContentBlockType {
        IMAGE
        TEXT
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
    }

    type ContentBlockList implements PaginatedList {
        items: [ContentBlock!]!
        totalItems: Int!
    }

    # Auto-generated at runtime by ListQueryBuilder
    input ContentBlockListOptions
`;

export const shopApiExtensions = gql`
    ${commonApiExtensions}

    extend type Query {
        contentBlock(id: ID!): ContentBlock
        contentBlockByKey(key: String!): ContentBlock
        contentBlocks(options: ContentBlockListOptions): ContentBlockList!
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

    extend type Query {
        contentBlock(id: ID!): ContentBlock
        contentBlocks(options: ContentBlockListOptions): ContentBlockList!
    }

    extend type Mutation {
        createContentBlock(input: CreateContentBlockInput!): ContentBlock!
        updateContentBlock(input: UpdateContentBlockInput!): ContentBlock!
        deleteContentBlock(id: ID!): DeletionResponse!
    }
`;
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/api/api-extensions.ts
git commit -m "feat(cms-plugin): add GraphQL schema extensions"
```

---

### Task 5: Create ContentBlockService

**Files:**
- Create: `plugins/cms-plugin/services/content-block.service.ts`

**Reference:** `packages/core/src/service/services/facet.service.ts` for the create/update/delete/list pattern with TranslatableSaver + ChannelService.

**Step 1: Write the service**

```typescript
// plugins/cms-plugin/services/content-block.service.ts
import { Injectable } from '@nestjs/common';
import { DeletionResponse, DeletionResult } from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import {
    ChannelService,
    ListQueryBuilder,
    ListQueryOptions,
    RequestContext,
    TransactionalConnection,
    TranslatableSaver,
    translateDeep,
} from '@vendure/core';

import { ContentBlockTranslation } from '../entities/content-block-translation.entity';
import { ContentBlock } from '../entities/content-block.entity';

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
    ): Promise<PaginatedList<ContentBlock>> {
        return this.listQueryBuilder
            .build(ContentBlock, options, {
                relations: ['featuredAsset', 'channels'],
                ctx,
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({
                items: items.map(item => translateDeep(item, ctx.languageCode)),
                totalItems,
            }));
    }

    async findOne(ctx: RequestContext, id: ID): Promise<ContentBlock | undefined> {
        const block = await this.connection.findOneInChannel(
            ctx,
            ContentBlock,
            id,
            ctx.channelId,
            { relations: ['featuredAsset', 'channels'] },
        );
        return block ? translateDeep(block, ctx.languageCode) : undefined;
    }

    async findByKey(ctx: RequestContext, key: string): Promise<ContentBlock | undefined> {
        const block = await this.listQueryBuilder
            .build(ContentBlock, {}, {
                ctx,
                channelId: ctx.channelId,
                relations: ['featuredAsset', 'channels'],
            })
            .andWhere('content_block.key = :key', { key })
            .getOne();
        return block ? translateDeep(block, ctx.languageCode) : undefined;
    }

    async create(ctx: RequestContext, input: {
        key: string;
        type: string;
        enabled?: boolean;
        featuredAssetId?: ID | null;
        metadata?: Record<string, unknown> | null;
        translations: Array<{
            languageCode: string;
            name: string;
            textContent?: string | null;
            altText?: string | null;
        }>;
    }): Promise<ContentBlock> {
        const block = await this.translatableSaver.create({
            ctx,
            input,
            entityType: ContentBlock,
            translationType: ContentBlockTranslation,
            beforeSave: async b => {
                await this.channelService.assignToCurrentChannel(b, ctx);
            },
        });
        return this.findOne(ctx, block.id) as Promise<ContentBlock>;
    }

    async update(ctx: RequestContext, input: {
        id: ID;
        key?: string;
        enabled?: boolean;
        featuredAssetId?: ID | null;
        metadata?: Record<string, unknown> | null;
        translations?: Array<{
            id?: ID;
            languageCode: string;
            name: string;
            textContent?: string | null;
            altText?: string | null;
        }>;
    }): Promise<ContentBlock> {
        await this.translatableSaver.update({
            ctx,
            input,
            entityType: ContentBlock,
            translationType: ContentBlockTranslation,
        });
        return this.findOne(ctx, input.id) as Promise<ContentBlock>;
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
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/services/content-block.service.ts
git commit -m "feat(cms-plugin): add ContentBlockService with CRUD operations"
```

---

### Task 6: Create Admin API resolver

**Files:**
- Create: `plugins/cms-plugin/api/content-block-admin.resolver.ts`

**Reference:** `packages/dev-server/test-plugins/reviews/api/product-review-admin.resolver.ts`

**Step 1: Write the admin resolver**

```typescript
// plugins/cms-plugin/api/content-block-admin.resolver.ts
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    RequestContext,
    Transaction,
} from '@vendure/core';

import { contentBlockPermission } from '../constants';
import { ContentBlockService } from '../services/content-block.service';

@Resolver()
export class ContentBlockAdminResolver {
    constructor(private contentBlockService: ContentBlockService) {}

    @Query()
    @Allow(contentBlockPermission.Read)
    async contentBlock(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.contentBlockService.findOne(ctx, args.id);
    }

    @Query()
    @Allow(contentBlockPermission.Read)
    async contentBlocks(@Ctx() ctx: RequestContext, @Args() args: { options: any }) {
        return this.contentBlockService.findAll(ctx, args.options);
    }

    @Transaction()
    @Mutation()
    @Allow(contentBlockPermission.Create)
    async createContentBlock(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.contentBlockService.create(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(contentBlockPermission.Update)
    async updateContentBlock(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.contentBlockService.update(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(contentBlockPermission.Delete)
    async deleteContentBlock(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.contentBlockService.delete(ctx, args.id);
    }
}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/api/content-block-admin.resolver.ts
git commit -m "feat(cms-plugin): add Admin API resolver"
```

---

### Task 7: Create Shop API resolver

**Files:**
- Create: `plugins/cms-plugin/api/content-block-shop.resolver.ts`

**Step 1: Write the shop resolver**

```typescript
// plugins/cms-plugin/api/content-block-shop.resolver.ts
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { ContentBlockService } from '../services/content-block.service';

@Resolver()
export class ContentBlockShopResolver {
    constructor(private contentBlockService: ContentBlockService) {}

    @Query()
    @Allow(Permission.Public)
    async contentBlock(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.contentBlockService.findOne(ctx, args.id);
    }

    @Query()
    @Allow(Permission.Public)
    async contentBlockByKey(@Ctx() ctx: RequestContext, @Args() args: { key: string }) {
        return this.contentBlockService.findByKey(ctx, args.key);
    }

    @Query()
    @Allow(Permission.Public)
    async contentBlocks(@Ctx() ctx: RequestContext, @Args() args: { options: any }) {
        return this.contentBlockService.findAll(ctx, args.options);
    }
}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/api/content-block-shop.resolver.ts
git commit -m "feat(cms-plugin): add Shop API resolver"
```

---

### Task 8: Create the plugin entry point

**Files:**
- Create: `plugins/cms-plugin/cms.plugin.ts`

**Reference:** `packages/dev-server/test-plugins/reviews/reviews-plugin.ts`, `plugins/menata-branding/menata-branding.plugin.ts`

**Step 1: Write the plugin**

```typescript
// plugins/cms-plugin/cms.plugin.ts
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { ContentBlockAdminResolver } from './api/content-block-admin.resolver';
import { ContentBlockShopResolver } from './api/content-block-shop.resolver';
import { contentBlockPermission } from './constants';
import { ContentBlockTranslation } from './entities/content-block-translation.entity';
import { ContentBlock } from './entities/content-block.entity';
import { ContentBlockService } from './services/content-block.service';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [ContentBlock, ContentBlockTranslation],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [ContentBlockAdminResolver],
    },
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [ContentBlockShopResolver],
    },
    providers: [ContentBlockService],
    configuration: config => {
        config.authOptions.customPermissions.push(contentBlockPermission);
        return config;
    },
    compatibility: '^3.0.0',
})
export class CmsPlugin {}
```

**Step 2: Commit**

```bash
git add plugins/cms-plugin/cms.plugin.ts
git commit -m "feat(cms-plugin): add CmsPlugin entry point"
```

---

### Task 9: Wire plugin into dev server

**Files:**
- Modify: `packages/dev-server/dev-config.ts`

**Step 1: Add the import and register the plugin**

Add import at the top (after other plugin imports):
```typescript
import { CmsPlugin } from '../../plugins/cms-plugin/cms.plugin';
```

Add to the `plugins` array (after `ReviewsPlugin`):
```typescript
CmsPlugin,
```

**Step 2: Commit**

```bash
git add packages/dev-server/dev-config.ts
git commit -m "feat(cms-plugin): wire CmsPlugin into dev server"
```

---

### Task 10: Test the plugin manually

**Step 1: Start the dev server**

```bash
cd packages/dev-server && npm run dev
```

Expected: Server starts without errors. Check logs for:
- `ContentBlock` entity registered
- `ContentBlockTranslation` entity registered
- Custom permissions `CreateContentBlock`, `ReadContentBlock`, `UpdateContentBlock`, `DeleteContentBlock` registered
- Admin API and Shop API schemas extended

**Step 2: Test via Admin API GraphQL playground**

Open `http://localhost:3000/admin-api` and run:

```graphql
mutation {
    createContentBlock(input: {
        key: "homepage-hero"
        type: IMAGE
        translations: [
            { languageCode: en, name: "Homepage Hero", altText: "Hero banner image" }
            { languageCode: fr, name: "Héros d'accueil", altText: "Image de bannière" }
        ]
    }) {
        id
        key
        type
        name
        altText
    }
}
```

```graphql
mutation {
    createContentBlock(input: {
        key: "welcome-message"
        type: TEXT
        translations: [
            { languageCode: en, name: "Welcome Message", textContent: "Welcome to our store!" }
            { languageCode: fr, name: "Message de bienvenue", textContent: "Bienvenue dans notre boutique !" }
        ]
    }) {
        id
        key
        type
        name
        textContent
    }
}
```

**Step 3: Test Shop API**

Open `http://localhost:3000/shop-api` and run:

```graphql
query {
    contentBlockByKey(key: "homepage-hero") {
        id
        key
        type
        name
        altText
    }
}
```

```graphql
query {
    contentBlocks {
        items {
            id
            key
            type
            name
        }
        totalItems
    }
}
```

**Step 4: Commit if any fixes were needed during testing**

```bash
git add -A && git commit -m "fix(cms-plugin): address issues found during manual testing"
```
