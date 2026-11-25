import { describe, expect, it } from 'vitest';

import { emailDomainStem, namesMatch, normalizeCompanyName } from './company-matching';

describe('company matching (C2)', () => {
    it('normalizes accents, punctuation and legal forms', () => {
        expect(normalizeCompanyName('Société Générale S.A.')).toBe('societe generale');
        expect(normalizeCompanyName('Safran Munich GmbH')).toBe('safran munich');
    });

    it('reads the employer from a professional e-mail only', () => {
        expect(emailDomainStem('anna@safran-munich.de')).toBe('safran munich');
        expect(emailDomainStem('jb@gmail.com')).toBeNull();
        expect(emailDomainStem('broken')).toBeNull();
    });

    it('matches whole words, not fragments', () => {
        expect(namesMatch('safran munich gmbh', 'Safran Munich')).toBe(true);
        expect(namesMatch('MENATA', 'MENATA-Colmar')).toBe(true);
        expect(namesMatch('menatacolmar', 'MENATA-Colmar')).toBe(true);
        expect(namesMatch('Saf', 'Safran Munich')).toBe(false);
    });
});
