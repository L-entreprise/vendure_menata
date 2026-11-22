import { graphql } from '@/graphql/graphql';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import {
    api,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Checkbox,
    DashboardRouteDefinition,
    Input,
    NativeSelect,
    NativeSelectOption,
    Page,
    PageTitle,
    Switch,
} from '@vendure/dashboard';
import { SettingsIcon } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { CRM_ADMIN_PERMISSION, CRM_NAV_SECTION } from './constants';
import { OptionsEditor } from './options-editor';
import { CrmSettings, errorMessage, useCrmSettings } from './use-crm-settings';

const updateSettingsDocument = graphql(`
    mutation CrmUpdateSettings($input: UpdateCrmSettingsInput!) {
        updateCrmSettings(input: $input) {
            defaultStatus
        }
    }
`);

function Section({ title, description, children }: Readonly<{ title: ReactNode; description?: ReactNode; children: ReactNode }>) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

function TransitionsEditor({ draft, onChange }: Readonly<{ draft: CrmSettings; onChange: (next: CrmSettings) => void }>) {
    const statuses = draft.customerStatuses.filter(status => status.code);
    const free = draft.statusTransitions === null;
    const targets = (from: string) => draft.statusTransitions?.find(tr => tr.from === from)?.to ?? [];
    const toggle = (from: string, to: string, checked: boolean) => {
        const nextTargets = checked ? [...targets(from), to] : targets(from).filter(code => code !== to);
        const others = (draft.statusTransitions ?? []).filter(tr => tr.from !== from);
        onChange({ ...draft, statusTransitions: [...others, { from, to: nextTargets }] });
    };

    return (
        <div className="space-y-4">
            <label className="flex items-center gap-3 text-sm">
                <Switch
                    checked={free}
                    onCheckedChange={checked => onChange({ ...draft, statusTransitions: checked ? null : [] })}
                />
                <Trans>Any status can follow any other</Trans>
            </label>
            {!free && (
                <table className="text-sm">
                    <thead>
                        <tr>
                            <th className="pr-4 text-left font-medium text-muted-foreground"><Trans>From → to</Trans></th>
                            {statuses.map(status => (
                                <th key={status.code} className="px-3 font-medium">{status.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {statuses.map(from => (
                            <tr key={from.code}>
                                <td className="py-1 pr-4 font-medium">{from.label}</td>
                                {statuses.map(to => (
                                    <td key={to.code} className="px-3 text-center">
                                        {from.code !== to.code && (
                                            <Checkbox
                                                checked={targets(from.code).includes(to.code)}
                                                onCheckedChange={checked => toggle(from.code, to.code, checked === true)}
                                            />
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

function SettingsForm({ initial }: Readonly<{ initial: CrmSettings }>) {
    const { t } = useLingui();
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<CrmSettings>(initial);
    const [saving, setSaving] = useState(false);
    const savedStatusCodes = new Set(initial.customerStatuses.map(status => status.code));
    useEffect(() => setDraft(initial), [initial]);

    const save = async () => {
        setSaving(true);
        try {
            await api.mutate(updateSettingsDocument, { input: draft });
            await queryClient.invalidateQueries();
            toast.success(t`CRM settings saved`);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mt-4 grid max-w-4xl gap-6">
            <Section title={<Trans>Customer statuses</Trans>} description={<Trans>Codes of statuses already in use stay unchanged when you rename them.</Trans>}>
                <OptionsEditor options={draft.customerStatuses} lockedCodes={savedStatusCodes} onChange={customerStatuses => setDraft({ ...draft, customerStatuses })} />
                <label className="mt-5 flex items-center gap-3 text-sm">
                    <Trans>Status of new customers</Trans>
                    <NativeSelect value={draft.defaultStatus} onChange={event => setDraft({ ...draft, defaultStatus: event.target.value })}>
                        {draft.customerStatuses.filter(status => status.code).map(status => (
                            <NativeSelectOption key={status.code} value={status.code}>{status.label}</NativeSelectOption>
                        ))}
                    </NativeSelect>
                </label>
            </Section>
            <Section title={<Trans>Allowed status changes</Trans>}>
                <TransitionsEditor draft={draft} onChange={setDraft} />
            </Section>
            <Section title={<Trans>Dormant companies</Trans>} description={<Trans>A client company with no counted order for this many days becomes dormant. Leave empty to disable.</Trans>}>
                <Input
                    type="number"
                    min={1}
                    className="max-w-[10rem]"
                    value={draft.dormantThresholdDays ?? ''}
                    aria-label={t`Days without an order`}
                    onChange={event => setDraft({ ...draft, dormantThresholdDays: event.target.value ? Number(event.target.value) : null })}
                />
            </Section>
            <Section title={<Trans>Roles in the company</Trans>}>
                <OptionsEditor options={draft.roleOptions} lockedCodes={new Set(initial.roleOptions.map(o => o.code))} onChange={roleOptions => setDraft({ ...draft, roleOptions })} />
            </Section>
            <Section title={<Trans>Lead sources</Trans>}>
                <OptionsEditor options={draft.leadSourceOptions} lockedCodes={new Set(initial.leadSourceOptions.map(o => o.code))} onChange={leadSourceOptions => setDraft({ ...draft, leadSourceOptions })} />
            </Section>
            <div>
                <Button onClick={save} disabled={saving}>
                    <Trans>Save the CRM settings</Trans>
                </Button>
            </div>
        </div>
    );
}

function SettingsPage() {
    const { data } = useCrmSettings();
    return (
        <Page pageId="crm-settings">
            <PageTitle>
                <Trans>CRM settings</Trans>
            </PageTitle>
            {data && <SettingsForm initial={data} />}
        </Page>
    );
}

export const crmSettingsRoute: DashboardRouteDefinition = {
    path: '/crm/settings',
    loader: () => ({ breadcrumb: () => i18n._(msg`CRM settings`) }),
    component: () => <SettingsPage />,
    navMenuItem: {
        id: 'crm-settings',
        title: 'Réglages CRM',
        sectionId: CRM_NAV_SECTION,
        icon: SettingsIcon,
        order: 900,
        requiresPermission: CRM_ADMIN_PERMISSION,
    },
};
