import { Trans, useLingui } from '@lingui/react/macro';
import { Checkbox, DashboardFormComponent, NativeSelect, NativeSelectOption } from '@vendure/dashboard';

import { CrmOption, useCrmSettings } from './use-crm-settings';

function withUnknown(options: CrmOption[], codes: string[]): CrmOption[] {
    const known = new Set(options.map(option => option.code));
    return [...options, ...codes.filter(code => !known.has(code)).map(code => ({ code, label: code }))];
}

/** C6: several roles per contact, picked from the list of the CRM settings. */
export const RoleSelectInput: DashboardFormComponent = ({ value, onChange, disabled }) => {
    const { data: settings } = useCrmSettings();
    const selected: string[] = Array.isArray(value) ? value : [];
    const options = withUnknown(settings?.roleOptions ?? [], selected);

    const toggle = (code: string, checked: boolean) => {
        const next = checked ? [...selected, code] : selected.filter(item => item !== code);
        onChange(next);
    };

    if (options.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                <Trans>No roles defined in the CRM settings.</Trans>
            </p>
        );
    }
    return (
        <div className="flex flex-wrap gap-x-5 gap-y-2">
            {options.map(option => (
                <label key={option.code} className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={selected.includes(option.code)}
                        disabled={disabled}
                        onCheckedChange={checked => toggle(option.code, checked === true)}
                    />
                    {option.label}
                </label>
            ))}
        </div>
    );
};
RoleSelectInput.metadata = { isListInput: true };

/** C7: lead source picked from the list of the CRM settings. */
export const LeadSourceSelectInput: DashboardFormComponent = ({ value, onChange, disabled }) => {
    const { t } = useLingui();
    const { data: settings } = useCrmSettings();
    const current: string = typeof value === 'string' ? value : '';
    const options = withUnknown(settings?.leadSourceOptions ?? [], current ? [current] : []);

    return (
        <NativeSelect
            value={current}
            disabled={disabled}
            onChange={event => onChange(event.target.value || null)}
        >
            <NativeSelectOption value="">{t`Not specified`}</NativeSelectOption>
            {options.map(option => (
                <NativeSelectOption key={option.code} value={option.code}>
                    {option.label}
                </NativeSelectOption>
            ))}
        </NativeSelect>
    );
};
