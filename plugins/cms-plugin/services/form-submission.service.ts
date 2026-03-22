import { Injectable } from '@nestjs/common';
import { DeletionResponse, DeletionResult } from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import {
    ChannelService,
    ListQueryBuilder,
    ListQueryOptions,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { CmsPage } from '../entities/cms-page.entity';
import { FormSubmission } from '../entities/form-submission.entity';

const MAX_FIELDS = 50;
const MAX_FIELD_KEY_LENGTH = 255;
const MAX_FIELD_VALUE_LENGTH = 10_000;
const MAX_PAYLOAD_BYTES = 32_768;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

@Injectable()
export class FormSubmissionService {
    constructor(
        private connection: TransactionalConnection,
        private channelService: ChannelService,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    async findByPage(
        ctx: RequestContext,
        pageId: ID,
        options?: ListQueryOptions<FormSubmission>,
    ): Promise<PaginatedList<FormSubmission>> {
        return this.listQueryBuilder
            .build(FormSubmission, options, {
                ctx,
                channelId: ctx.channelId,
            })
            .andWhere('formsubmission.pageId = :pageId', { pageId })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async delete(ctx: RequestContext, id: ID): Promise<DeletionResponse> {
        const submission = await this.connection.getEntityOrThrow(ctx, FormSubmission, id, {
            channelId: ctx.channelId,
        });
        await this.connection.getRepository(ctx, FormSubmission).remove(submission);
        return { result: DeletionResult.DELETED };
    }

    async submit(
        ctx: RequestContext,
        input: { pageKey: string; fields: Record<string, unknown> },
    ): Promise<{ success: boolean }> {
        const page = await this.connection
            .getRepository(ctx, CmsPage)
            .createQueryBuilder('page')
            .innerJoin('page.channels', 'channel', 'channel.id = :channelId', {
                channelId: ctx.channelId,
            })
            .where('page.key = :key', { key: input.pageKey })
            .andWhere('page.enabled = :enabled', { enabled: true })
            .getOne();

        if (!page) {
            throw new UserInputError('Page not found');
        }
        if (!page.acceptsSubmissions) {
            throw new UserInputError('This page does not accept submissions');
        }

        const sanitized = this.sanitizeFields(input.fields);

        const submission = new FormSubmission();
        submission.pageId = page.id;
        submission.data = sanitized;
        await this.channelService.assignToCurrentChannel(submission, ctx);
        await this.connection.getRepository(ctx, FormSubmission).save(submission);

        return { success: true };
    }

    private sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
            throw new UserInputError('Fields must be a JSON object');
        }

        const keys = Object.keys(fields);
        if (keys.length === 0) {
            throw new UserInputError('At least one field is required');
        }
        if (keys.length > MAX_FIELDS) {
            throw new UserInputError(`Maximum ${MAX_FIELDS} fields allowed`);
        }

        const result: Record<string, unknown> = {};
        for (const key of keys) {
            if (FORBIDDEN_KEYS.has(key)) {
                throw new UserInputError(`Field key "${key}" is not allowed`);
            }
            if (key.length > MAX_FIELD_KEY_LENGTH) {
                throw new UserInputError(`Field key exceeds maximum length of ${MAX_FIELD_KEY_LENGTH}`);
            }
            const value = fields[key];
            this.assertPrimitiveValue(key, value);
            result[key] = typeof value === 'string' ? this.stripHtml(value) : value;
        }

        const serialized = JSON.stringify(result);
        if (serialized.length > MAX_PAYLOAD_BYTES) {
            throw new UserInputError(`Submission payload exceeds maximum size of ${MAX_PAYLOAD_BYTES} bytes`);
        }

        return result;
    }

    private assertPrimitiveValue(key: string, value: unknown): void {
        if (value === null || value === undefined) return;
        if (typeof value === 'string') {
            if (value.length > MAX_FIELD_VALUE_LENGTH) {
                throw new UserInputError(
                    `Field "${key}" exceeds maximum length of ${MAX_FIELD_VALUE_LENGTH}`,
                );
            }
            return;
        }
        if (typeof value === 'number' || typeof value === 'boolean') return;
        if (Array.isArray(value)) {
            for (const item of value) {
                if (item !== null && typeof item === 'object') {
                    throw new UserInputError(
                        `Field "${key}" contains invalid array elements; only primitive values are allowed`,
                    );
                }
            }
            return;
        }
        throw new UserInputError(`Field "${key}" must be a primitive value or array of primitives`);
    }

    private stripHtml(value: string): string {
        return value.replace(/<[^>]*>/g, '');
    }
}
