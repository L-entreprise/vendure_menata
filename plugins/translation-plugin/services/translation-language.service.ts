import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { TranslationLanguage } from '../entities/translation-language.entity';

export interface LanguageInput {
    code: string;
    name: string;
    enabled?: boolean;
    isDefault?: boolean;
    position?: number;
}

@Injectable()
export class TranslationLanguageService {
    constructor(
        private connection: TransactionalConnection,
        private channelService: ChannelService,
    ) {}

    async findAll(ctx: RequestContext): Promise<TranslationLanguage[]> {
        return this.connection
            .getRepository(ctx, TranslationLanguage)
            .createQueryBuilder('lang')
            .innerJoin('lang.channels', 'channel', 'channel.id = :channelId', {
                channelId: ctx.channelId,
            })
            .orderBy('lang.position', 'ASC')
            .addOrderBy('lang.id', 'ASC')
            .getMany();
    }

    async findEnabled(ctx: RequestContext): Promise<TranslationLanguage[]> {
        return this.connection
            .getRepository(ctx, TranslationLanguage)
            .createQueryBuilder('lang')
            .innerJoin('lang.channels', 'channel', 'channel.id = :channelId', {
                channelId: ctx.channelId,
            })
            .where('lang.enabled = :enabled', { enabled: true })
            .orderBy('lang.position', 'ASC')
            .addOrderBy('lang.id', 'ASC')
            .getMany();
    }

    async setLanguages(ctx: RequestContext, inputs: LanguageInput[]): Promise<TranslationLanguage[]> {
        this.validateInputs(inputs);
        const repo = this.connection.getRepository(ctx, TranslationLanguage);

        const existing = await this.findAll(ctx);
        const existingByCode = new Map(existing.map(l => [l.code, l]));
        const incomingCodes = new Set(inputs.map(i => i.code));

        const toDelete = existing.filter(l => !incomingCodes.has(l.code));
        if (toDelete.length > 0) {
            await repo.remove(toDelete);
        }

        const results: TranslationLanguage[] = [];
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const existingLang = existingByCode.get(input.code);
            if (existingLang) {
                existingLang.name = input.name;
                existingLang.enabled = input.enabled ?? true;
                existingLang.isDefault = input.isDefault ?? false;
                existingLang.position = input.position ?? i;
                results.push(await repo.save(existingLang));
            } else {
                const lang = new TranslationLanguage({
                    code: input.code,
                    name: input.name,
                    enabled: input.enabled ?? true,
                    isDefault: input.isDefault ?? false,
                    position: input.position ?? i,
                });
                await this.channelService.assignToCurrentChannel(lang, ctx);
                results.push(await repo.save(lang));
            }
        }

        return results;
    }

    async seedIfEmpty(ctx: RequestContext, defaults: LanguageInput[]): Promise<void> {
        const existing = await this.findAll(ctx);
        if (existing.length > 0) return;
        await this.setLanguages(ctx, defaults);
    }

    private validateInputs(inputs: LanguageInput[]): void {
        const codes = inputs.map(i => i.code);
        const uniqueCodes = new Set(codes);
        if (codes.length !== uniqueCodes.size) {
            throw new UserInputError('Duplicate language codes are not allowed');
        }
        for (const input of inputs) {
            if (!input.code || input.code.length > 10) {
                throw new UserInputError('Language code must be between 1 and 10 characters');
            }
            if (!input.name || input.name.length > 100) {
                throw new UserInputError('Language name must be between 1 and 100 characters');
            }
        }
    }
}
