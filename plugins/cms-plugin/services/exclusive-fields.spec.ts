import { describe, expect, it } from 'vitest';

import { exclusiveKeysTurnedOn, isExclusiveToggle, turnOffKeys } from './exclusive-fields';

const blocks = [
    { key: 'title', type: 'TEXT_SHORT', metadata: { exclusive: true } },
    { key: 'featured', type: 'BOOLEAN', metadata: { exclusive: true } },
    { key: 'pinned', type: 'BOOLEAN', metadata: {} },
    { key: 'hero', type: 'BOOLEAN', metadata: { exclusive: true } },
    { key: null, type: 'BOOLEAN', metadata: { exclusive: true } },
];

describe('isExclusiveToggle', () => {
    it('only accepts keyed BOOLEAN fields flagged exclusive', () => {
        expect(blocks.map(isExclusiveToggle)).toEqual([false, true, false, true, false]);
    });

    it('ignores a truthy flag that is not exactly true', () => {
        expect(isExclusiveToggle({ key: 'x', type: 'BOOLEAN', metadata: { exclusive: 'true' } })).toBe(false);
    });
});

describe('exclusiveKeysTurnedOn', () => {
    it('lists the exclusive fields the data turns on', () => {
        expect(exclusiveKeysTurnedOn(blocks, { featured: true, pinned: true, hero: false, title: true })).toEqual([
            'featured',
        ]);
    });

    it('returns nothing for empty data', () => {
        expect(exclusiveKeysTurnedOn(blocks, null)).toEqual([]);
    });
});

describe('turnOffKeys', () => {
    it('returns a copy with the on fields turned off', () => {
        const data = { title: 'A', featured: true, hero: true };
        const result = turnOffKeys(data, ['featured']);
        expect(result).toEqual({ title: 'A', featured: false, hero: true });
        expect(data.featured).toBe(true);
    });

    it('returns null when no field was on', () => {
        expect(turnOffKeys({ featured: false }, ['featured'])).toBeNull();
        expect(turnOffKeys({}, ['featured'])).toBeNull();
        expect(turnOffKeys(null, ['featured'])).toBeNull();
    });
});
