/** C4: custom customer history entry type, declared in the schema via `extend enum HistoryEntryType`. */
export const CUSTOMER_STATUS_CHANGED = 'CUSTOMER_STATUS_CHANGED';

declare module '@vendure/core' {
    interface CustomerHistoryEntryData {
        [CUSTOMER_STATUS_CHANGED]: { from: string; to: string };
    }
}
