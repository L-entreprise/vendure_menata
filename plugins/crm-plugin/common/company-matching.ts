/** C2: fuzzy matching between what a contact states and the company groups. Pure functions. */

const LEGAL_FORMS = new Set(['sa', 'sas', 'sasu', 'sarl', 'eurl', 'sci', 'snc', 'gmbh', 'ag', 'ltd', 'inc', 'llc', 'bv', 'srl', 'spa', 'cie', 'et']);

/** Webmail domains say nothing about the employer. */
const PERSONAL_DOMAINS = new Set([
    'gmail', 'googlemail', 'outlook', 'hotmail', 'live', 'msn', 'yahoo', 'icloud', 'me', 'aol', 'gmx', 'proton', 'protonmail',
    'orange', 'wanadoo', 'free', 'sfr', 'laposte', 'bbox', 'neuf', 'club-internet', 'numericable',
]);

/** "Safran Munich GmbH" → "safran munich" (accents, punctuation and legal forms removed). */
export function normalizeCompanyName(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\./g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .filter(word => word && !LEGAL_FORMS.has(word))
        .join(' ');
}

/** "anna@safran-munich.de" → "safran munich"; null for webmail addresses. */
export function emailDomainStem(email: string): string | null {
    const domain = email.split('@')[1]?.toLowerCase() ?? '';
    const labels = domain.split('.').filter(Boolean);
    if (labels.length < 2) {
        return null;
    }
    const stem = labels[labels.length - 2];
    return PERSONAL_DOMAINS.has(stem) ? null : normalizeCompanyName(stem);
}

/** True when one normalized name contains the other as whole words, or both are equal without spaces. */
export function namesMatch(stated: string, companyName: string): boolean {
    const a = normalizeCompanyName(stated);
    const b = normalizeCompanyName(companyName);
    if (!a || !b) {
        return false;
    }
    const contains = (outer: string, inner: string) => ` ${outer} `.includes(` ${inner} `);
    return contains(a, b) || contains(b, a) || a.replace(/ /g, '') === b.replace(/ /g, '');
}
