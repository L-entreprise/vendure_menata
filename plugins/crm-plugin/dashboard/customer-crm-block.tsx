import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, NativeSelect, NativeSelectOption, PageContextValue, usePermissions } from '@vendure/dashboard';
import { useState } from 'react';
import { toast } from 'sonner';

import { errorMessage, useCrmSettings } from './use-crm-settings';

const customerCrmDocument = graphql(`
    query CrmCustomerSummary($id: ID!) {
        customer(id: $id) {
            id
            crmCode
            crmStatus
        }
    }
`);

const setStatusDocument = graphql(`
    mutation CrmSetCustomerStatus($customerId: ID!, $status: String!) {
        setCustomerStatus(customerId: $customerId, status: $status) {
            id
            crmStatus
        }
    }
`);

/** I1 + C3: internal code and CRM status of the customer. */
export function CustomerCrmBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const { t } = useLingui();
    const customerId: string | undefined = context.entity?.id;
    const queryClient = useQueryClient();
    const { hasPermissions } = usePermissions();
    const { data: settings } = useCrmSettings();
    const [saving, setSaving] = useState(false);
    const { data } = useQuery({
        queryKey: ['crm-customer-summary', customerId],
        queryFn: async () => ((await api.query(customerCrmDocument, { id: customerId! })) as any).customer,
        enabled: !!customerId,
    });

    if (!data || !settings) {
        return null;
    }
    const current: string = data.crmStatus;
    const transitions = settings.statusTransitions;
    const allowed = new Set([current, ...(transitions ? (transitions.find(tr => tr.from === current)?.to ?? []) : settings.customerStatuses.map(s => s.code))]);
    const canEdit = hasPermissions(['UpdateCustomer']);

    const changeStatus = async (status: string) => {
        setSaving(true);
        try {
            await api.mutate(setStatusDocument, { customerId: customerId!, status });
            // Refreshes this block and the native timeline, which shows the status change entry.
            await queryClient.invalidateQueries();
            toast.success(t`Status updated`);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted-foreground">
                <Trans>Code</Trans>
            </dt>
            <dd className="font-mono tabular-nums">{data.crmCode}</dd>
            <dt className="text-muted-foreground">
                <Trans>Status</Trans>
            </dt>
            <dd>
                <NativeSelect
                    value={current}
                    disabled={!canEdit || saving}
                    onChange={event => changeStatus(event.target.value)}
                    aria-label={t`Customer status`}
                >
                    {settings.customerStatuses
                        .filter(status => allowed.has(status.code))
                        .map(status => (
                            <NativeSelectOption key={status.code} value={status.code}>
                                {status.label}
                            </NativeSelectOption>
                        ))}
                </NativeSelect>
            </dd>
        </dl>
    );
}
