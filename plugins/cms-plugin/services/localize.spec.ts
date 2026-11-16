import { describe, expect, it } from 'vitest';

import {
    localizeBlock,
    mergeEntryData,
    mergeTranslatedMetadata,
    pruneEntryTranslation,
    splitEntryData,
    withFallback,
} from './localize';

const row = (languageCode: string, values: Record<string, unknown>) => ({ languageCode, ...values });

describe('withFallback', () => {
    it('uses the default language for a field that is empty in the requested one', () => {
        const rows = [row('fr', { textContent: 'Bonjour', name: 'Titre' }), row('en', { textContent: '', name: 'Title' })];
        expect(withFallback(rows, 'en', 'fr', ['name', 'textContent'])).toEqual({
            name: 'Title',
            textContent: 'Bonjour',
        });
    });

    it('fallback uses channel default, not en', () => {
        const rows = [row('en', { name: 'Hello' }), row('fr', { name: 'Bonjour' })];
        expect(withFallback(rows, 'de', 'fr', ['name'])).toEqual({ name: 'Bonjour' });
    });

    it('falls back to the first row when the default language has no row', () => {
        const rows = [row('en', { name: 'Bonjour' })];
        expect(withFallback(rows, 'de', 'fr', ['name'])).toEqual({ name: 'Bonjour' });
    });

    it('returns the default language value as is, even when empty', () => {
        const rows = [row('fr', { name: '' }), row('en', { name: 'Title' })];
        expect(withFallback(rows, 'fr', 'fr', ['name'])).toEqual({ name: '' });
    });
});

describe('mergeTranslatedMetadata', () => {
    it('keeps structural keys and overrides only translated texts', () => {
        const base = {
            section: 'Hero',
            description: 'Photo du hangar',
            imageMeta: { '5': { alt: 'Avion', description: 'Cessna' }, '6': { alt: 'Huile' } },
        };
        const translated = { description: 'Hangar photo', imageMeta: { '5': { alt: 'Plane', description: '' } } };
        expect(mergeTranslatedMetadata(base, translated)).toEqual({
            section: 'Hero',
            description: 'Hangar photo',
            imageMeta: { '5': { alt: 'Plane', description: 'Cessna' }, '6': { alt: 'Huile' } },
        });
    });

    it('returns the base untouched without a translation', () => {
        const base = { description: 'x' };
        expect(mergeTranslatedMetadata(base, null)).toBe(base);
    });
});

describe('localizeBlock', () => {
    const block = {
        id: 1,
        type: 'IMAGE',
        metadata: { description: 'Photo' },
        featuredAssetId: 10,
        featuredAsset: { id: 10 },
        translations: [
            row('fr', { name: 'Image', textContent: '', altText: 'Avion', translatedMetadata: null, featuredAssetId: null }),
            row('en', {
                name: '',
                textContent: '',
                altText: 'Plane',
                translatedMetadata: { description: 'Picture' },
                featuredAssetId: 20,
                featuredAsset: { id: 20 },
            }),
        ],
    };

    it('swaps the image and texts for the requested language', () => {
        const localized = localizeBlock(block as any, 'en', 'fr');
        expect(localized.featuredAssetId).toBe(20);
        expect(localized.featuredAsset).toEqual({ id: 20 });
        expect(localized.altText).toBe('Plane');
        expect(localized.name).toBe('Image');
        expect(localized.metadata).toEqual({ description: 'Picture' });
    });

    it('keeps the block image and metadata without media (Admin API), texts still fall back', () => {
        const localized = localizeBlock(block as any, 'en', 'fr', { media: false });
        expect(localized.featuredAssetId).toBe(10);
        expect(localized.metadata).toEqual({ description: 'Photo' });
        expect(localized.altText).toBe('Plane');
    });

    it('keeps the base image in the default language', () => {
        const localized = localizeBlock(block as any, 'fr', 'fr');
        expect(localized.featuredAssetId).toBe(10);
        expect(localized.metadata).toEqual({ description: 'Photo' });
        expect(block.featuredAssetId).toBe(10);
    });
});

describe('collection entries', () => {
    const blocks = [
        { key: 'title', type: 'TEXT_SHORT' },
        { key: 'photo', type: 'IMAGE' },
        { key: 'gallery', type: 'IMAGE_GALLERY' },
        { key: 'date', type: 'DATE' },
        { key: 'price', type: 'NUMBER' },
    ];

    it('splitEntryData separates translatable texts from structural values', () => {
        const data = { title: 'Huile', photo__alt: 'Bidon', date: '2026-01-01', price: 12, gallery: ['1'] };
        expect(splitEntryData(blocks as any, data)).toEqual({
            translatable: { title: 'Huile', photo__alt: 'Bidon' },
            structural: { date: '2026-01-01', price: 12, gallery: ['1'] },
        });
    });

    it('mergeEntryData keeps the base for empty translated values', () => {
        const base = { title: 'Huile', photo: '3', price: 12, gallery__imageMeta: { '1': { alt: 'Un' } } };
        const translated = { title: '', photo: '4', gallery__imageMeta: { '1': { alt: 'One', description: '' } } };
        expect(mergeEntryData(blocks as any, base, translated)).toEqual({
            title: 'Huile',
            photo: '4',
            price: 12,
            gallery__imageMeta: { '1': { alt: 'One' } },
        });
    });

    it('mergeEntryData ignores structural keys in a translation', () => {
        expect(mergeEntryData(blocks as any, { price: 12 }, { price: 99 })).toEqual({ price: 12 });
    });

    it('pruneEntryTranslation drops empty values and an image equal to the base', () => {
        const base = { title: 'Huile', photo: '3' };
        const translated = { title: 'Oil', photo: '3', photo__alt: '', gallery__imageMeta: { '1': { alt: '' } } };
        expect(pruneEntryTranslation(blocks as any, base, translated)).toEqual({ title: 'Oil' });
    });
});
