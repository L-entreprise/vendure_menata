import { graphql } from '@/graphql/graphql';
import { useLingui } from '@lingui/react/macro';
import { api } from '@vendure/dashboard';
import { ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { StaleTranslationsDialog } from '../../content-i18n/dashboard/stale-translations-dialog';
import { useContentLanguages } from '../../content-i18n/dashboard/use-languages';
import { clearStaleInput, StaleBlock, staleBlocks } from './cms-stale';

const pageBlocksDocument = graphql(`
    query GetCmsPageBlocksForStaleClear($id: ID!) {
        cmsPage(id: $id) {
            id
            contentBlocks {
                id
                key
                type
                enabled
                position
                metadata
                dateValue
                numberValue
                featuredAsset {
                    id
                    preview
                }
                translations {
                    id
                    languageCode
                    name
                    textContent
                    altText
                    translatedMetadata
                }
            }
        }
    }
`);

const clearDocument = graphql(`
    mutation ClearStaleCmsTranslations($input: UpdateCmsPageInput!) {
        updateCmsPage(input: $input) {
            id
        }
    }
`);

/**
 * After the original text of a page was saved: if translations of the changed fields
 * exist, ask whether to keep them, clear them, or translate now.
 */
export function useCmsStaleCheck(pageId: string, onCleared?: () => void): {
    check: (before: any[], submitted: any[]) => void;
    dialog: ReactNode;
} {
    const { t } = useLingui();
    const { defaultLanguage, isTranslating, setContentLanguage } = useContentLanguages();
    const [stale, setStale] = useState<StaleBlock[]>([]);
    const [busy, setBusy] = useState(false);
    const languages = [...new Set(stale.flatMap(s => s.languages))];

    const check = (before: any[], submitted: any[]) => {
        if (isTranslating) return;
        setStale(staleBlocks(before ?? [], submitted ?? [], defaultLanguage));
    };

    const clear = async () => {
        setBusy(true);
        try {
            const result: any = await api.query(pageBlocksDocument, { id: pageId });
            const blocks = result?.cmsPage?.contentBlocks ?? [];
            await api.mutate(clearDocument, {
                input: { id: pageId, contentBlocks: clearStaleInput(blocks, stale, defaultLanguage) },
            });
            toast.success(t`Translations cleared`);
            setStale([]);
            onCleared?.();
        } catch (error) {
            toast.error(t`Could not clear the translations`, {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setBusy(false);
        }
    };

    const dialog = (
        <StaleTranslationsDialog
            open={stale.length > 0}
            fields={stale.map(s => s.label)}
            sourceLanguage={defaultLanguage}
            languages={languages}
            busy={busy}
            onKeep={() => setStale([])}
            onClear={clear}
            onTranslate={code => {
                setContentLanguage(code);
                setStale([]);
            }}
        />
    );
    return { check, dialog };
}
