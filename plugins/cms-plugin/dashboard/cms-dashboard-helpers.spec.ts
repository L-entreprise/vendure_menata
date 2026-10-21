import { describe, expect, it } from 'vitest';

import { groupBlocksBySection } from './cms-block-utils';
import { parseHelpText } from './cms-help-links';

const block = (key: string, metadata: Record<string, unknown> | null = null) => ({ key, metadata });

describe('groupBlocksBySection', () => {
    it('keeps one untitled section when no field has a section', () => {
        const sections = groupBlocksBySection([block('a'), block('b')]);

        expect(sections).toEqual([
            { title: null, collapsed: false, items: [{ block: block('a'), index: 0 }, { block: block('b'), index: 1 }] },
        ]);
    });

    it('orders sections by first appearance and merges split ones', () => {
        const sections = groupBlocksBySection([
            block('title', { section: 'Haut de page' }),
            block('hangar', { section: 'Bloc hangar' }),
            block('subtitle', { section: ' Haut de page ' }),
        ]);

        expect(sections.map(s => s.title)).toEqual(['Haut de page', 'Bloc hangar']);
        expect(sections[0].items.map(i => i.index)).toEqual([0, 2]);
    });

    it('collapses a section when one of its fields asks for it', () => {
        const sections = groupBlocksBySection([
            block('seoTitle', { section: 'Référencement Google', sectionCollapsed: true }),
            block('seoText', { section: 'Référencement Google' }),
        ]);

        expect(sections[0].collapsed).toBe(true);
    });

    it('treats a blank section like no section', () => {
        expect(groupBlocksBySection([block('a', { section: '  ' })])[0].title).toBeNull();
    });
});

describe('parseHelpText', () => {
    it('returns plain text unchanged', () => {
        expect(parseHelpText('Délai affiché sur la page')).toEqual([
            { kind: 'text', text: 'Délai affiché sur la page' },
        ]);
    });

    it('turns dashboard routes and http(s) URLs into links', () => {
        expect(parseHelpText('Voir [les avions](/products) ou [le site](https://example.com).')).toEqual([
            { kind: 'text', text: 'Voir ' },
            { kind: 'link', label: 'les avions', href: '/products', internal: true },
            { kind: 'text', text: ' ou ' },
            { kind: 'link', label: 'le site', href: 'https://example.com', internal: false },
            { kind: 'text', text: '.' },
        ]);
    });

    it('leaves script and protocol-relative targets as text', () => {
        const help = '[x](javascript:alert(1)) [y](//evil.example)';

        expect(parseHelpText(help).every(part => part.kind === 'text')).toBe(true);
        expect(parseHelpText(help).map(p => (p.kind === 'text' ? p.text : '')).join('')).toBe(help);
    });
});
