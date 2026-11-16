import { describe, expect, it } from 'vitest';

import { blockForMutation, editableBlockForLanguage, entryDataForLanguage } from './cms-language';

const apiBlock = {
    id: '3',
    key: 'hero',
    type: 'IMAGE',
    position: 0,
    enabled: true,
    metadata: { section: 'Top', description: 'Photo du hangar' },
    featuredAsset: { id: '10', preview: '/a10.jpg' },
    translations: [
        { id: '30', languageCode: 'fr', name: 'Visuel', textContent: '', altText: 'Avion' },
        {
            id: '31',
            languageCode: 'en',
            name: 'Visual',
            textContent: '',
            altText: 'Plane',
            translatedMetadata: { description: 'Hangar photo' },
            featuredAsset: { id: '11', preview: '/a11.jpg' },
        },
    ],
};

describe('editableBlockForLanguage', () => {
    it('edits the original row in the default language', () => {
        const block = editableBlockForLanguage(apiBlock, 'fr', 'fr');
        expect(block.translations[0]).toMatchObject({ id: '30', languageCode: 'fr', altText: 'Avion' });
        expect(block.metadata.description).toBe('Photo du hangar');
        expect(block.featuredAssetId).toBe('10');
    });

    it('shows the translation, its image texts and its image in another language', () => {
        const block = editableBlockForLanguage(apiBlock, 'en', 'fr');
        expect(block.translations).toHaveLength(1);
        expect(block.translations[0]).toMatchObject({ id: '31', languageCode: 'en', altText: 'Plane' });
        expect(block.metadata).toEqual({ section: 'Top', description: 'Hangar photo', imageMeta: {} });
        expect(block.featuredAssetId).toBe('11');
        expect(block._source).toMatchObject({ altText: 'Avion', description: 'Photo du hangar', featuredAssetId: '10' });
    });

    it('starts an empty row, labelled like the original, for a language not translated yet', () => {
        const block = editableBlockForLanguage(apiBlock, 'de', 'fr');
        expect(block.translations).toEqual([{ languageCode: 'de', name: 'Visuel', textContent: '', altText: '' }]);
        expect(block.metadata.description).toBe('');
        expect(block.featuredAssetId).toBe('10');
    });
});

describe('blockForMutation', () => {
    it('untouched fallback values are not written', () => {
        const input = blockForMutation(editableBlockForLanguage(apiBlock, 'de', 'fr'), 0, 'de', 'fr');
        expect(input.translations).toEqual([
            { languageCode: 'de', name: 'Visuel', textContent: '', altText: '', translatedMetadata: null, featuredAssetId: null },
        ]);
        expect(input.metadata).toEqual({ section: 'Top', description: 'Photo du hangar' });
        expect(input.featuredAssetId).toBe('10');
    });

    it('stores a translated description on the row and keeps the original on the block', () => {
        const edited = editableBlockForLanguage(apiBlock, 'en', 'fr');
        const input = blockForMutation(
            { ...edited, metadata: { ...edited.metadata, description: 'Hangar' }, featuredAssetId: '12' },
            0,
            'en',
            'fr',
        );
        expect(input.translations[0]).toMatchObject({
            id: '31',
            translatedMetadata: { description: 'Hangar' },
            featuredAssetId: '12',
        });
        expect(input.metadata.description).toBe('Photo du hangar');
        expect(input.featuredAssetId).toBe('10');
    });

    it('sends the original row only, without translation-only fields, in the default language', () => {
        const input = blockForMutation(editableBlockForLanguage(apiBlock, 'fr', 'fr'), 0, 'fr', 'fr');
        expect(input.translations).toEqual([{ id: '30', languageCode: 'fr', name: 'Visuel', textContent: '', altText: 'Avion' }]);
    });
});

describe('entryDataForLanguage', () => {
    const blocks = [
        { key: 'name', type: 'TEXT_SHORT' },
        { key: 'photo', type: 'IMAGE' },
        { key: 'price', type: 'NUMBER' },
    ];
    const base = { name: 'Huile', photo: '4', photo__alt: 'Bidon', price: 12 };

    it('keeps structural values and shows the language own texts, empty when missing', () => {
        expect(entryDataForLanguage(blocks, base, { name: 'Oil' }, 'en', 'fr')).toEqual({
            name: 'Oil',
            photo: '4',
            photo__alt: '',
            photo__description: '',
            price: 12,
        });
    });

    it('is the stored data in the default language', () => {
        expect(entryDataForLanguage(blocks, base, undefined, 'fr', 'fr')).toEqual(base);
    });
});
