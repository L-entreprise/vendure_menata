import { describe, expect, it } from 'vitest';

import { staleTranslations } from './stale-translations';

const row = (languageCode: string, values: Record<string, unknown>) => ({ languageCode, ...values });

describe('staleTranslations', () => {
    const before = [row('fr', { name: 'Huile', description: '<p>Synthèse</p>' }), row('en', { name: 'Oil', description: '' })];

    it('lists changed original fields and the languages that translated them', () => {
        const after = [row('fr', { name: 'Huile moteur', description: '<p>Synthèse</p>' }), before[1]];
        expect(staleTranslations(before, after, 'fr', ['name', 'description'])).toEqual({
            fields: ['name'],
            languages: ['en'],
        });
    });

    it('ignores a changed field nobody translated', () => {
        const after = [row('fr', { name: 'Huile', description: '<p>Nouveau</p>' }), before[1]];
        expect(staleTranslations(before, after, 'fr', ['name', 'description'])).toEqual({ fields: [], languages: [] });
    });

    it('ignores saves that did not touch the original', () => {
        const after = [before[0], row('en', { name: 'Engine oil', description: '' })];
        expect(staleTranslations(before, after, 'fr', ['name'])).toEqual({ fields: [], languages: [] });
    });

    it('ignores a first original (nothing to compare with)', () => {
        expect(staleTranslations([], before, 'fr', ['name'])).toEqual({ fields: [], languages: [] });
    });
});
