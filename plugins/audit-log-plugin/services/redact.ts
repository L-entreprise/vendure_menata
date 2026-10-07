/** Keys never written to the trail (credentials and secrets). */
export const SECRET_KEYS = new Set([
    'password',
    'currentPassword',
    'newPassword',
    'passwordHash',
    'token',
    'verificationToken',
    'passwordResetToken',
    'identifierChangeToken',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
]);

/**
 * Personal data keys (GDPR art. 5.1.c, data minimisation). The trail keeps the fact
 * that the field changed, never its value: entity ids are enough to trace the subject.
 * `identifier` is not listed: login identifiers are masked upstream (j***@domain).
 */
export const PERSONAL_DATA_KEYS = new Set([
    'emailAddress',
    'email',
    'firstName',
    'lastName',
    'fullName',
    'phoneNumber',
    'phone',
    'company',
    'streetLine1',
    'streetLine2',
    'city',
    'province',
    'postalCode',
]);

export const REDACTED = '[redacted]';

const MAX_DEPTH = 6;

/**
 * Applied to every entry's `detail`, whoever writes it (event subscribers or another
 * plugin calling AuditLogService.log), so no caller can bypass the redaction.
 */
export function redactPersonalData(value: unknown, depth = 0): unknown {
    if (value === null || typeof value !== 'object' || depth > MAX_DEPTH) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(item => redactPersonalData(item, depth + 1));
    }
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        if (SECRET_KEYS.has(key)) continue;
        result[key] =
            PERSONAL_DATA_KEYS.has(key) && item !== null && item !== undefined
                ? REDACTED
                : redactPersonalData(item, depth + 1);
    }
    return result;
}
