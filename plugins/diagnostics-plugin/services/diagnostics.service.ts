import { Inject, Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';

import {
    DEFAULT_CACHE_TTL_MS,
    DEFAULT_REQUEST_TIMEOUT_MS,
    DIAGNOSTICS_PLUGIN_OPTIONS,
} from '../constants';
import { DiagnosticResult, DiagnosticsPluginOptions, MenataDiagnosticResponse } from '../types';

const loggerCtx = 'DiagnosticsPlugin';

interface CacheEntry {
    expiresAt: number;
    value: DiagnosticResult;
}

/**
 * Talks server-to-server to the Menata central authority to fetch this client's
 * frozen web-diagnostic HTML. The signed URL / HTML never reaches the browser:
 * the admin app only ever sees the normalised {@link DiagnosticResult}, and the
 * dashboard renders the HTML inside a sandboxed iframe.
 */
@Injectable()
export class DiagnosticsService {
    private cache: CacheEntry | null = null;

    constructor(
        @Inject(DIAGNOSTICS_PLUGIN_OPTIONS)
        private readonly options: DiagnosticsPluginOptions,
    ) {}

    async getDiagnostic(): Promise<DiagnosticResult> {
        const now = Date.now();
        if (this.cache && this.cache.expiresAt > now) {
            return this.cache.value;
        }

        const value = await this.fetchFromMenata();
        const ttl = this.options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
        this.cache = { expiresAt: now + ttl, value };
        return value;
    }

    private async fetchFromMenata(): Promise<DiagnosticResult> {
        const { apiBaseUrl, apiKey, clientId, ctaUrl } = this.options;
        const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/client/diagnostic`;
        const timeoutMs = this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${apiKey}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ clientId }),
                signal: controller.signal,
            });

            if (!response.ok) {
                Logger.warn(
                    `Menata diagnostic endpoint returned ${response.status} for client ${clientId}`,
                    loggerCtx,
                );
                return this.unavailable(ctaUrl);
            }

            const data = (await response.json()) as MenataDiagnosticResponse;
            return this.normalise(data, ctaUrl);
        } catch (error) {
            // Network/timeout failures must not break the admin page — degrade to CTA.
            Logger.error(
                `Failed to fetch diagnostic from Menata: ${error instanceof Error ? error.message : String(error)}`,
                loggerCtx,
            );
            return this.unavailable(ctaUrl);
        } finally {
            clearTimeout(timer);
        }
    }

    private normalise(data: MenataDiagnosticResponse, ctaUrl?: string): DiagnosticResult {
        if (data.notFound) {
            return this.unavailable(ctaUrl);
        }
        if (data.expired || !data.html) {
            return {
                available: false,
                expired: true,
                title: data.title,
                validUntil: this.toIso(data.validUntil),
                ctaUrl,
            };
        }
        return {
            available: true,
            expired: false,
            title: data.title,
            html: data.html,
            validUntil: this.toIso(data.validUntil),
            ctaUrl,
        };
    }

    private unavailable(ctaUrl?: string): DiagnosticResult {
        return { available: false, expired: false, ctaUrl };
    }

    private toIso(validUntil?: number): string | undefined {
        if (!validUntil || !Number.isFinite(validUntil)) return undefined;
        return new Date(validUntil * 1000).toISOString();
    }
}
