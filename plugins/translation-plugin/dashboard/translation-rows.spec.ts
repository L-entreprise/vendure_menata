import { describe, expect, it } from 'vitest';

import {
    BlockInfo,
    buildEntryRows,
    buildPageRows,
    changedKeys,
    groupRowsBySection,
    rowsProgress,
    visibleRows,
} from './translation-rows';

const block = (id: string, key: string, type: string, name: string, metadata: Record<string, unknown> | null = null): BlockInfo => ({
    id,
    key,
    type,
    name,
    metadata,
});

const delays = new Map([
    ['1', block('1', 'delayTitle', 'TEXT_SHORT', 'Délai 1 : titre', { section: 'Délais', help: 'Affiché en gras' })],
    ['2', block('2', 'delay2Value', 'TEXT_SHORT', 'Délai 2 : chiffre', { section: 'Délais' })],
    ['3', block('3', 'photo', 'IMAGE', 'Photo', { section: 'Haut de page' })],
    ['4', block('4', 'seoTitle', 'TEXT_SHORT', 'Titre Google', { section: 'Référencement Google', sectionCollapsed: true })],
]);

const pageFields = [
    { contentBlockId: null, fieldName: 'name', blockType: null },
    { contentBlockId: null, fieldName: 'slug', blockType: null },
    { contentBlockId: '1', fieldName: 'textContent', blockType: 'TEXT_SHORT' },
    { contentBlockId: '2', fieldName: 'textContent', blockType: 'TEXT_SHORT' },
    { contentBlockId: '3', fieldName: 'image', blockType: 'IMAGE' },
    { contentBlockId: '3', fieldName: 'altText', blockType: 'IMAGE' },
    { contentBlockId: '4', fieldName: 'textContent', blockType: 'TEXT_SHORT' },
];

describe('buildPageRows', () => {
    it('hides the page name and slug in simple mode only', () => {
        const simple = buildPageRows(pageFields, delays, { simple: true });
        const expert = buildPageRows(pageFields, delays, { simple: false });

        expect(simple.some(r => r.pageField)).toBe(false);
        expect(expert.filter(r => r.pageField).map(r => r.key)).toEqual(['page|name', 'page|slug']);
    });

    it('labels fields with the block name and keeps help and section', () => {
        const [title] = buildPageRows(pageFields, delays, { simple: true });

        expect(title).toMatchObject({
            key: '1|textContent',
            label: 'Délai 1 : titre',
            technicalKey: 'delayTitle',
            part: 'value',
            help: 'Affiché en gras',
            countable: true,
        });
    });

    it('marks image swaps as not counted and alt text as counted', () => {
        const rows = buildPageRows(pageFields, delays, { simple: true });

        expect(rows.find(r => r.key === '3|image')).toMatchObject({ part: 'image', countable: false });
        expect(rows.find(r => r.key === '3|altText')).toMatchObject({ part: 'alt', countable: true });
    });

    it('reads gallery images from the field name', () => {
        const gallery = new Map([['5', block('5', 'hangar', 'IMAGE_GALLERY', 'Photos du hangar')]]);
        const [row] = buildPageRows(
            [{ contentBlockId: '5', fieldName: 'gallery:42:description', blockType: 'IMAGE_GALLERY' }],
            gallery,
            { simple: true },
        );

        expect(row).toMatchObject({ part: 'description', assetId: '42', label: 'Photos du hangar' });
    });
});

describe('groupRowsBySection', () => {
    it('follows the CMS sections and their collapsed state', () => {
        const sections = groupRowsBySection(buildPageRows(pageFields, delays, { simple: true }));

        expect(sections.map(s => [s.title, s.collapsed, s.rows.length])).toEqual([
            ['Délais', false, 2],
            ['Haut de page', false, 2],
            ['Référencement Google', true, 1],
        ]);
    });
});

describe('visibleRows', () => {
    const rows = buildPageRows(pageFields, delays, { simple: true });
    const source = { '1|textContent': 'Délais', '2|textContent': '48 h', '3|image': '7', '3|altText': 'Hangar', '4|textContent': '' };
    const german = { '1|textContent': 'Lieferzeiten', '3|altText': '  ' };

    it('shows every row when the filter is off', () => {
        expect(visibleRows(rows, source, german, false)).toHaveLength(rows.length);
    });

    it('keeps only text with a source and no translation', () => {
        expect(visibleRows(rows, source, german, true).map(r => r.key)).toEqual(['2|textContent', '3|altText']);
    });

    it('counts the same fields as the filter', () => {
        expect(rowsProgress(rows, source, german)).toEqual({ total: 3, translated: 1 });
    });
});

describe('buildEntryRows', () => {
    const team = new Map([
        ['name', block('10', 'name', 'TEXT_SHORT', 'Nom')],
        ['portrait', block('11', 'portrait', 'IMAGE', 'Portrait', { help: 'Photo carrée' })],
        ['photos', block('12', 'photos', 'IMAGE_GALLERY', 'Photos')],
    ]);
    const fields = [
        { fieldName: 'name', blockType: 'TEXT_SHORT' },
        { fieldName: 'portrait', blockType: 'IMAGE' },
        { fieldName: 'portrait__alt', blockType: 'IMAGE' },
        { fieldName: 'photos', blockType: 'IMAGE_GALLERY' },
    ];

    it('expands gallery images from the entry data and labels companions by their field', () => {
        const rows = buildEntryRows(fields, team, { name: 'Marc', portrait: '3', photos: ['8', '9'] });

        expect(rows.map(r => [r.key, r.label, r.part, r.countable])).toEqual([
            ['name', 'Nom', 'value', true],
            ['portrait', 'Portrait', 'image', false],
            ['portrait__alt', 'Portrait', 'alt', true],
            ['photos__8__alt', 'Photos', 'alt', true],
            ['photos__8__description', 'Photos', 'description', true],
            ['photos__9__alt', 'Photos', 'alt', true],
            ['photos__9__description', 'Photos', 'description', true],
        ]);
        expect(rows[1].help).toBe('Photo carrée');
        expect(rows[2].help).toBeUndefined();
    });
});

describe('changedKeys', () => {
    it('sends only the fields that differ from what was loaded', () => {
        expect(changedKeys({ a: 'x', b: 'y' }, { a: 'x', b: 'z', c: '', d: 'new' })).toEqual(['b', 'd']);
    });
});
