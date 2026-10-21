import { UserInputError } from '@vendure/core';

const MAX_PREVIEW_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Validates the "View on site" address of a page. The dashboard renders it as a link,
 * so only absolute http(s) URLs are accepted (no `javascript:` or relative paths).
 * `undefined` means "leave unchanged"; an empty string clears the address.
 */
export function normalizePreviewUrl(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return null;
    if (trimmed.length > MAX_PREVIEW_URL_LENGTH) {
        throw new UserInputError(`Preview URL must not exceed ${MAX_PREVIEW_URL_LENGTH} characters`);
    }
    let protocol: string;
    try {
        protocol = new URL(trimmed).protocol;
    } catch {
        protocol = '';
    }
    if (!ALLOWED_PROTOCOLS.has(protocol)) {
        throw new UserInputError('Preview URL must be an absolute http(s) address');
    }
    return trimmed;
}
