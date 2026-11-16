import { LanguageCode, RequestContext } from '@vendure/core';

/** The channel's default language: where the original CMS content lives. */
export function channelDefaultLanguage(ctx: RequestContext): LanguageCode {
    return ctx.channel.defaultLanguageCode;
}

/** The channel's other languages: the ones content gets translated into. */
export function channelTargetLanguages(ctx: RequestContext): LanguageCode[] {
    const defaultLanguage = channelDefaultLanguage(ctx);
    return (ctx.channel.availableLanguageCodes ?? []).filter(code => code !== defaultLanguage);
}

const TRANSLATED_METADATA_KEYS = ['description', 'imageMeta'] as const;

/** Keeps only the metadata keys a language may override (image texts). */
export function cleanTranslatedMetadata(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const source = value as Record<string, unknown>;
    const kept = Object.fromEntries(
        TRANSLATED_METADATA_KEYS.filter(key => source[key] != null).map(key => [key, source[key]]),
    );
    return Object.keys(kept).length ? kept : null;
}
