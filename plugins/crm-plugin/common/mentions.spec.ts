import { describe, expect, it } from 'vitest';

import { findMentionedNames } from './mentions';

const names = ['Jean Paul', 'Jean Paul Martin', 'Élouann Durand', ''];

describe('mentions (K3)', () => {
    it('keeps only the longest name at each @', () => {
        expect([...findMentionedNames('@Jean Paul Martin please call back', names)]).toEqual(['Jean Paul Martin']);
    });

    it('still finds the shorter name when it is the one written', () => {
        expect([...findMentionedNames('@Jean Paul, can you check?', names)]).toEqual(['Jean Paul']);
    });

    it('ignores case and finds several mentions', () => {
        const found = findMentionedNames('@élouann durand and @jean paul martin', names);
        expect([...found].sort()).toEqual(['Jean Paul Martin', 'Élouann Durand']);
    });

    it('does not match a name followed by another letter', () => {
        expect(findMentionedNames('@Jean Pauline', names).size).toBe(0);
    });

    it('never matches an empty name on an e-mail address', () => {
        expect(findMentionedNames('write to claire@menata.test', names).size).toBe(0);
    });
});
