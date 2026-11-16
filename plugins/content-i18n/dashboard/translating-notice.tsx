import { Trans } from '@lingui/react/macro';

import { useContentLanguages } from './use-languages';

/**
 * One line at the top of an editor while a translation is edited, so nobody overwrites
 * the original by mistake. Shared with the CMS plugin.
 */
export function TranslatingNotice({ creating = false }: { creating?: boolean }) {
    const { contentLanguage, defaultLanguage, isTranslating } = useContentLanguages();
    if (!isTranslating) return null;
    const target = contentLanguage.toUpperCase();
    const source = defaultLanguage.toUpperCase();
    if (creating) {
        // A new record has no original yet: what is typed now becomes the original.
        return (
            <p className="mt-4 rounded-md border bg-muted/40 px-4 py-2.5 text-sm">
                <Trans>This new entry is saved as the {source} original. Translate it into {target} once it exists.</Trans>
            </p>
        );
    }
    return (
        <p className="mt-4 rounded-md border bg-muted/40 px-4 py-2.5 text-sm">
            <Trans>
                You are editing the {target} translation. Empty fields show the {source} original on the site.
            </Trans>
        </p>
    );
}
