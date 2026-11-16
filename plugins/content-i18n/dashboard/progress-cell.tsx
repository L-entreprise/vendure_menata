import { Tooltip, TooltipContent, TooltipTrigger } from '@vendure/dashboard';

import { useFormatProgress } from './progress-format';

interface ProgressPartValue {
    pageId: string;
    name: string;
    translated: number;
    total: number;
}

interface LanguageProgressValue {
    languageCode: string;
    translated: number;
    total: number;
    /** CMS pages: the page and each tab the total is made of. */
    parts?: ProgressPartValue[] | null;
}

/**
 * List column: "EN 80 %  DE 0 %", complete languages dimmed. When a total adds up
 * several parts (a CMS page and its tabs), hovering a language shows each part.
 */
export function ProgressCell({ value }: { value?: LanguageProgressValue[] | null }) {
    const format = useFormatProgress();
    const rows = (value ?? []).filter(row => row.total > 0);
    if (rows.length === 0) return null;
    return (
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums whitespace-nowrap">
            {rows.map(row => {
                const label = (
                    <span className={row.translated >= row.total ? 'text-muted-foreground' : 'font-medium'}>
                        {row.languageCode.toUpperCase()} {format(row)}
                    </span>
                );
                const parts = (row.parts ?? []).filter(part => part.total > 0);
                if (parts.length < 2) return <span key={row.languageCode}>{label}</span>;
                return (
                    <Tooltip key={row.languageCode}>
                        <TooltipTrigger render={<span className="cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-4" />}>
                            {label}
                        </TooltipTrigger>
                        <TooltipContent>
                            <ul className="tabular-nums">
                                {parts.map(part => (
                                    <li key={part.pageId} className="flex justify-between gap-4">
                                        <span>{part.name}</span>
                                        <span>
                                            {format(part)} ({part.translated}/{part.total})
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </span>
    );
}
