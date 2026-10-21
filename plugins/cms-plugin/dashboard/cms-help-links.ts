export type HelpPart =
    | { kind: 'text'; text: string }
    | { kind: 'link'; label: string; href: string; internal: boolean };

const LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/**
 * Splits a field's help text into plain text and `[label](target)` links. A target
 * starting with one "/" is a dashboard route (e.g. `/products`); http(s) URLs open
 * outside. Any other target stays plain text, so help can never inject a script URL.
 */
export function parseHelpText(help: string): HelpPart[] {
    const parts: HelpPart[] = [];
    let last = 0;
    for (const match of help.matchAll(LINK_PATTERN)) {
        const [whole, label, href] = match;
        const start = match.index ?? 0;
        const internal = href.startsWith('/') && !href.startsWith('//');
        const external = /^https?:\/\//i.test(href);
        if (!internal && !external) continue;
        if (start > last) parts.push({ kind: 'text', text: help.slice(last, start) });
        parts.push({ kind: 'link', label, href, internal });
        last = start + whole.length;
    }
    if (last < help.length) parts.push({ kind: 'text', text: help.slice(last) });
    return parts;
}
