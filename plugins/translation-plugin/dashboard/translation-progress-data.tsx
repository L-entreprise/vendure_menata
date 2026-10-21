import { graphql } from '@/graphql/graphql';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@vendure/dashboard';

import { FieldProgress, progressRatio, sumProgress } from '../translation-progress';

const progressDocument = graphql(`
    query GetCmsTranslationProgress($pageIds: [ID!]!) {
        cmsTranslationProgress(pageIds: $pageIds) {
            pageId
            languageCode
            total
            translated
        }
    }
`);

export interface PageProgress extends FieldProgress {
    pageId: string;
    languageCode: string;
}

/** Progress of a set of pages (a page and its tabs), refreshed on demand after a save. */
export function useTranslationProgress(pageIds: string[]) {
    const [rows, setRows] = useState<PageProgress[]>([]);
    const idsKey = pageIds.join(',');

    const refresh = useCallback(async () => {
        if (!idsKey) return;
        try {
            const result = await api.query(progressDocument, { pageIds: idsKey.split(',') });
            setRows(
                (result.cmsTranslationProgress ?? []).map((row: any) => ({ ...row, pageId: String(row.pageId) })),
            );
        } catch {
            // Progress is a guide, not needed to translate: the editor keeps working without it.
            setRows([]);
        }
    }, [idsKey]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const forLanguage = (languageCode: string, pageId?: string): FieldProgress =>
        sumProgress(rows.filter(r => r.languageCode === languageCode && (pageId == null || r.pageId === pageId)));

    return { rows, refresh, forLanguage };
}

/** "92 %" in the dashboard language, or null when there is nothing to translate. */
export function useFormatProgress(): (progress: FieldProgress) => string | null {
    const { i18n } = useLingui();
    const format = new Intl.NumberFormat(i18n.locale, { style: 'percent' });
    return progress => {
        const ratio = progressRatio(progress);
        return ratio == null ? null : format.format(ratio);
    };
}
