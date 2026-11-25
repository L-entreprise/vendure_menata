const fold = (value: string) => value.normalize('NFC').toLocaleLowerCase('fr');

/**
 * K3: the names mentioned as `@First Last` in `text`. At each `@` only the longest matching
 * name counts, so `@Jean Paul Martin` does not also mention "Jean Paul"; a name must not be
 * followed by another letter; empty names never match.
 */
export function findMentionedNames(text: string, names: string[]): Set<string> {
    const haystack = fold(text);
    const candidates = names
        .map(name => ({ name, needle: fold(name.trim()) }))
        .filter(candidate => candidate.needle.length > 0)
        .sort((a, b) => b.needle.length - a.needle.length);
    const found = new Set<string>();
    for (let at = haystack.indexOf('@'); at !== -1; at = haystack.indexOf('@', at + 1)) {
        const rest = haystack.slice(at + 1);
        const match = candidates.find(({ needle }) => rest.startsWith(needle) && !/\p{L}/u.test(rest.charAt(needle.length)));
        if (match) {
            found.add(match.name);
        }
    }
    return found;
}
