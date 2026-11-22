import { graphql } from '@/graphql/graphql';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';

export interface CrmOption {
    code: string;
    label: string;
}

export interface CrmSettings {
    customerStatuses: CrmOption[];
    statusTransitions: Array<{ from: string; to: string[] }> | null;
    defaultStatus: string;
    dormantThresholdDays: number | null;
    roleOptions: CrmOption[];
    leadSourceOptions: CrmOption[];
}

export const CRM_SETTINGS_KEY = ['crm-settings'];

export const crmSettingsDocument = graphql(`
    query CrmSettings {
        crmSettings {
            customerStatuses {
                code
                label
            }
            statusTransitions {
                from
                to
            }
            defaultStatus
            dormantThresholdDays
            roleOptions {
                code
                label
            }
            leadSourceOptions {
                code
                label
            }
        }
    }
`);

/** CRM settings shared by every CRM block (option lists, statuses). */
export function useCrmSettings() {
    return useQuery({
        queryKey: CRM_SETTINGS_KEY,
        queryFn: async () => ((await api.query(crmSettingsDocument, {})) as any).crmSettings as CrmSettings,
        staleTime: 60_000,
    });
}

export function optionLabel(options: CrmOption[] | undefined, code: string | null | undefined): string {
    if (!code) {
        return '';
    }
    return options?.find(option => option.code === code)?.label ?? code;
}

/** Error message of a failed GraphQL call, for toasts. */
export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
