import { graphql } from '@/graphql/graphql';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';

import { useFormatProgress } from '../../content-i18n/dashboard/progress-format';
import { useContentLanguages } from '../../content-i18n/dashboard/use-languages';

const tabProgressDocument = graphql(`
    query CmsTabProgress($pageIds: [ID!]!) {
        cmsTranslationProgress(pageIds: $pageIds) {
            languageCode
            parts {
                pageId
                total
                translated
            }
        }
    }
`);

const TAB_PROGRESS_KEY = 'cms-tab-progress';

interface PartProgress {
    total: number;
    translated: number;
}

/**
 * Progress of a page and of each of its tabs in the content language, keyed by page id.
 * Empty while editing the original: there is nothing to translate there.
 */
export function useCmsTabProgress(pageId: string | undefined): Map<string, PartProgress> {
    const { contentLanguage, isTranslating } = useContentLanguages();
    const { data } = useQuery({
        queryKey: [TAB_PROGRESS_KEY, pageId, contentLanguage],
        queryFn: () => api.query(tabProgressDocument, { pageIds: [pageId!] }),
        enabled: !!pageId && isTranslating,
    });
    const row = (data as any)?.cmsTranslationProgress?.find((r: any) => r.languageCode === contentLanguage);
    return new Map((row?.parts ?? []).map((part: any) => [String(part.pageId), part]));
}

/** Call after saving a page or a tab so the tab percentages follow. */
export function useRefreshCmsTabProgress(): () => void {
    const queryClient = useQueryClient();
    return () => void queryClient.invalidateQueries({ queryKey: [TAB_PROGRESS_KEY] });
}

/** "96 %" next to a tab title; dimmed when complete. Nothing to translate: nothing shown. */
export function TabProgress({ progress }: { progress?: PartProgress }) {
    const format = useFormatProgress();
    const text = progress ? format(progress) : null;
    if (!progress || !text) return null;
    const complete = progress.translated >= progress.total;
    return (
        <span className={`ml-1.5 text-xs tabular-nums ${complete ? 'text-muted-foreground' : 'font-medium'}`}>
            {text}
        </span>
    );
}
