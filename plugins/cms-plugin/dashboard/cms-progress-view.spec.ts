import { describe, expect, it } from 'vitest';

import { visibleProgress } from './cms-progress-view';

const part = (pageId: string, advanced: boolean, translated: number, total: number) => ({
    pageId,
    name: pageId,
    advanced,
    translated,
    total,
});

describe('visibleProgress', () => {
    const rows = [
        {
            languageCode: 'de',
            total: 466,
            translated: 429,
            parts: [part('site', false, 0, 17), part('ui', true, 429, 449)],
        },
    ];

    it('drops advanced tabs from the total and the breakdown in simple mode', () => {
        expect(visibleProgress(rows, true)).toEqual([
            { languageCode: 'de', total: 17, translated: 0, parts: [part('site', false, 0, 17)] },
        ]);
    });

    it('keeps everything in expert mode', () => {
        expect(visibleProgress(rows, false)).toBe(rows);
    });

    it('keeps rows that come without a breakdown', () => {
        const plain = [{ languageCode: 'en', total: 2, translated: 1 }];
        expect(visibleProgress(plain, true)).toEqual(plain);
    });
});
