/** C4: custom customer history entry type, declared in the schema via `extend enum HistoryEntryType`. */
export const CUSTOMER_STATUS_CHANGED = 'CUSTOMER_STATUS_CHANGED';

/** D3: a duplicate was merged into this customer. */
export const CUSTOMER_MERGED = 'CUSTOMER_MERGED';

declare module '@vendure/core' {
    interface CustomerHistoryEntryData {
        [CUSTOMER_STATUS_CHANGED]: { from: string; to: string };
        [CUSTOMER_MERGED]: { sourceCode: string; sourceEmail: string };
    }
}
