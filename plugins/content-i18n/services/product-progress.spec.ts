import { describe, expect, it } from 'vitest';

import { productProgress } from './product-progress';

const row = (languageCode: string, values: Record<string, unknown>) => ({ languageCode, ...values });

describe('productProgress', () => {
    it('counts product texts, variant names and translatable custom fields per language', () => {
        const progress = productProgress(
            {
                translations: [
                    row('en', { name: 'Oil', description: '<p>Engine oil</p>', customFields: { subtitle: '5W30' } }),
                    row('fr', { name: 'Huile', description: '', customFields: { subtitle: '' } }),
                ],
                variants: [{ id: '7', translations: [row('en', { name: 'Oil 1L' })] }],
                customFieldNames: ['subtitle'],
            },
            'en',
            ['fr', 'de'],
        );
        expect(progress).toEqual([
            {
                languageCode: 'fr',
                total: 4,
                translated: 1,
                missing: ['description', 'customFields.subtitle', 'variant:7:name'],
            },
            {
                languageCode: 'de',
                total: 4,
                translated: 0,
                missing: ['name', 'description', 'customFields.subtitle', 'variant:7:name'],
            },
        ]);
    });

    it('skips fields without original text, so an empty product is complete', () => {
        const progress = productProgress(
            { translations: [row('en', { name: 'Oil', description: '' })], variants: [], customFieldNames: [] },
            'en',
            ['fr'],
        );
        expect(progress).toEqual([{ languageCode: 'fr', total: 1, translated: 0, missing: ['name'] }]);
    });

    it('uses the first row as original when the default language has none', () => {
        const progress = productProgress(
            { translations: [row('en', { name: 'Huile' }), row('de', { name: 'Öl' })], variants: [], customFieldNames: [] },
            'fr',
            ['de'],
        );
        expect(progress).toEqual([{ languageCode: 'de', total: 1, translated: 1, missing: [] }]);
    });
});
