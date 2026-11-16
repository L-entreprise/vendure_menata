import { describe, expect, it } from 'vitest';

import { clearStaleInput, staleBlocks } from './cms-stale';

const apiBlocks = [
    {
        id: '1',
        key: 'title',
        type: 'TEXT_SHORT',
        position: 0,
        metadata: { maxLength: 255 },
        translations: [
            { id: '10', languageCode: 'fr', name: 'Titre', textContent: 'Bonjour', altText: '' },
            { id: '11', languageCode: 'en', name: 'Title', textContent: 'Hello', altText: '' },
        ],
    },
    {
        id: '2',
        key: 'photo',
        type: 'IMAGE',
        position: 1,
        metadata: { description: 'Hangar' },
        featuredAsset: { id: '7', preview: '/7.jpg' },
        translations: [
            { id: '20', languageCode: 'fr', name: 'Photo', textContent: '', altText: 'Avion' },
            { id: '21', languageCode: 'en', name: 'Photo', textContent: '', altText: '', translatedMetadata: { description: 'Shed' } },
        ],
    },
];

describe('staleBlocks', () => {
    it('lists blocks whose original changed while translated', () => {
        const submitted = [
            { id: '1', metadata: { maxLength: 255 }, translations: [{ languageCode: 'fr', name: 'Titre', textContent: 'Salut', altText: '' }] },
            { id: '2', metadata: { description: 'Hangar neuf' }, translations: [{ languageCode: 'fr', name: 'Photo', textContent: '', altText: 'Avion' }] },
        ];
        expect(staleBlocks(apiBlocks, submitted, 'fr')).toEqual([
            { blockId: '1', label: 'Titre', fields: ['textContent'], languages: ['en'] },
            { blockId: '2', label: 'Photo', fields: ['description'], languages: ['en'] },
        ]);
    });

    it('ignores unchanged blocks and new ones', () => {
        const submitted = [
            { id: '1', metadata: {}, translations: [{ languageCode: 'fr', name: 'Titre', textContent: 'Bonjour', altText: '' }] },
            { key: 'new', translations: [{ languageCode: 'fr', name: 'Nouveau', textContent: 'x' }] },
        ];
        expect(staleBlocks(apiBlocks, submitted, 'fr')).toEqual([]);
    });
});

describe('clearStaleInput', () => {
    it('empties the stale fields in those languages and leaves every other row alone', () => {
        const input = clearStaleInput(
            apiBlocks,
            [{ blockId: '2', label: 'Photo', fields: ['description'], languages: ['en'] }],
            'fr',
        );
        expect(input.map((b: any) => [b.id, b.translations])).toEqual([
            ['1', []],
            ['2', [{ id: '21', languageCode: 'en', name: 'Photo', textContent: '', altText: '', translatedMetadata: null }]],
        ]);
        expect(input[1]).toMatchObject({ key: 'photo', type: 'IMAGE', position: 1, featuredAssetId: '7', metadata: { description: 'Hangar' } });
    });
});
