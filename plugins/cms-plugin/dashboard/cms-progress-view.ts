export interface ProgressPartView {
    pageId: string;
    name: string;
    advanced: boolean;
    total: number;
    translated: number;
}

export interface PageProgressView {
    languageCode: string;
    total: number;
    translated: number;
    parts?: ProgressPartView[] | null;
}

/**
 * The page progress as the editor sees it: in simple mode, advanced tabs are hidden, so
 * they leave the total too (a page must not look translated thanks to a tab the client
 * never sees).
 */
export function visibleProgress<T extends PageProgressView>(rows: T[], simple: boolean): T[] {
    if (!simple) return rows;
    return rows.map(row => {
        if (!row.parts) return row;
        const parts = row.parts.filter(part => !part.advanced);
        return {
            ...row,
            parts,
            total: parts.reduce((sum, part) => sum + part.total, 0),
            translated: parts.reduce((sum, part) => sum + part.translated, 0),
        };
    });
}
