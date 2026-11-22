import { ID } from '@vendure/core';

/**
 * I1 / I2: readable internal codes derived from the entity id. The id never changes and
 * is unique per table, so the code is immutable and unique without a sequence table.
 */
export type CrmCodePrefix = 'CLI' | 'GRP';

const CODE_DIGITS = 6;
const CODE_PATTERN = /^(CLI|GRP)-0*(\d+)$/i;

export function crmCode(prefix: CrmCodePrefix, id: ID): string {
    return `${prefix}-${String(id).padStart(CODE_DIGITS, '0')}`;
}

export interface ParsedCrmCode {
    kind: 'customer' | 'group';
    id: string;
}

/** Accepts `CLI-000482`, `cli-482`, `GRP-57`; returns null for anything else. */
export function parseCrmCode(code: string): ParsedCrmCode | null {
    const match = CODE_PATTERN.exec(code.trim());
    if (!match) {
        return null;
    }
    return { kind: match[1].toUpperCase() === 'CLI' ? 'customer' : 'group', id: match[2] };
}
