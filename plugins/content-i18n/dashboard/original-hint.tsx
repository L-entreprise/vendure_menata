import { Trans } from '@lingui/react/macro';

import { plainText } from './plain-text';

export interface OriginalHintProps {
    /** Language of the original (the channel default). */
    languageCode: string;
    value: unknown;
    /** Puts the original into the field being translated. */
    onCopy?: () => void;
}

/**
 * The original text, shown under a field while translating it. Shared with the CMS
 * plugin, which renders it under its own editors.
 */
export function OriginalHint({ languageCode, value, onCopy }: OriginalHintProps) {
    const text = plainText(value);
    if (!text) return null;
    return (
        <div className="mt-1.5 flex items-baseline gap-2 text-xs text-muted-foreground">
            <span className="shrink-0 font-semibold">{languageCode.toUpperCase()}</span>
            <span className="line-clamp-2 min-w-0 flex-1" title={text}>
                {text}
            </span>
            {onCopy && (
                <button
                    type="button"
                    className="shrink-0 font-medium text-foreground/70 transition-colors hover:text-foreground"
                    onClick={onCopy}
                >
                    <Trans>Copy</Trans>
                </button>
            )}
        </div>
    );
}
