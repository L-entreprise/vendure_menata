import { useLingui } from '@lingui/react/macro';

import { FieldProgress, progressRatio } from '../shared/translation-progress';

/** "92 %" in the dashboard language, or null when there is nothing to translate. */
export function useFormatProgress(): (progress: FieldProgress) => string | null {
    const { i18n } = useLingui();
    const format = new Intl.NumberFormat(i18n.locale, { style: 'percent' });
    return progress => {
        const ratio = progressRatio(progress);
        return ratio == null ? null : format.format(ratio);
    };
}
