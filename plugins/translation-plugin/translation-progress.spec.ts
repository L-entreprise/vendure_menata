import { describe, expect, it } from 'vitest';

import {
    countProgress,
    hasText,
    isCountableField,
    needsTranslation,
    progressRatio,
    sumProgress,
} from './translation-progress';

describe('hasText', () => {
    it('ignores blanks, empty rich text and empty option lists', () => {
        expect(['', '   ', '<p></p>', '<p>&nbsp;</p>', '[]', '[" "]', null, undefined].map(hasText)).toEqual(
            Array(8).fill(false),
        );
    });

    it('sees plain text, rich text and options', () => {
        expect(['48 h', '<p>Délai</p>', '["Cessna"]', '[not json'].map(hasText)).toEqual([true, true, true, true]);
    });
});

describe('needsTranslation', () => {
    it('is true only when the source has text and the target has none', () => {
        expect(needsTranslation('48 h', '')).toBe(true);
        expect(needsTranslation('48 h', '<p></p>')).toBe(true);
        expect(needsTranslation('48 h', '48 Std.')).toBe(false);
        expect(needsTranslation('', '')).toBe(false);
        expect(needsTranslation(undefined, undefined)).toBe(false);
    });
});

describe('isCountableField', () => {
    it('leaves out page settings and image swaps', () => {
        expect(isCountableField('name', { pageField: true })).toBe(false);
        expect(isCountableField('image')).toBe(false);
        expect(isCountableField('photo', { collectionImageKeys: new Set(['photo']) })).toBe(false);
    });

    it('counts text, alt text and image descriptions', () => {
        const options = { collectionImageKeys: new Set(['photo']) };
        expect(['textContent', 'altText', 'photo__alt', 'gallery:3:description'].map(f => isCountableField(f, options))).toEqual(
            [true, true, true, true],
        );
    });
});

describe('countProgress', () => {
    it('counts only fields with source text', () => {
        expect(
            countProgress([
                { source: 'Délai', target: 'Lieferzeit' },
                { source: '48 h', target: '' },
                { source: '', target: 'orphan' },
            ]),
        ).toEqual({ total: 2, translated: 1 });
    });

    it('adds up pages', () => {
        expect(sumProgress([{ total: 2, translated: 1 }, { total: 3, translated: 3 }])).toEqual({ total: 5, translated: 4 });
    });
});

describe('progressRatio', () => {
    it('is null when there is nothing to translate', () => {
        expect(progressRatio({ total: 0, translated: 0 })).toBeNull();
    });

    it('never shows 100 % before the last field', () => {
        expect(progressRatio({ total: 1000, translated: 999 })).toBe(0.99);
        expect(progressRatio({ total: 4, translated: 4 })).toBe(1);
        expect(progressRatio({ total: 3, translated: 1 })).toBe(0.33);
    });
});
