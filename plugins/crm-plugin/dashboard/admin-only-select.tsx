import { useLingui } from '@lingui/react/macro';
import { DashboardFormComponent, NativeSelect, NativeSelectOption, usePermissions } from '@vendure/dashboard';

import { CRM_ADMIN_PERMISSION } from './constants';

type LocalizedLabel = Array<{ languageCode: string; value: string }>;
type FieldOption = { value: string; label?: LocalizedLabel };

function labelFor(option: FieldOption, locale: string): string {
    const labels = option.label ?? [];
    return (labels.find(label => locale.startsWith(label.languageCode)) ?? labels[0])?.value ?? option.value;
}

/**
 * Group type / allowed members: a select for the super admin, read-only text for everyone
 * else (the server refuses their changes anyway, see CustomerGroupGuardResolver).
 */
export const AdminOnlySelect: DashboardFormComponent = ({ value, onChange, fieldDef }) => {
    const { t, i18n } = useLingui();
    const isAdmin = usePermissions().hasPermissions([CRM_ADMIN_PERMISSION]);
    const options = ((fieldDef as { options?: FieldOption[] } | undefined)?.options ?? []) as FieldOption[];
    const current = typeof value === 'string' ? value : '';
    const currentOption = options.find(option => option.value === current);

    if (!isAdmin) {
        return (
            <p className="py-2 text-sm">
                {currentOption ? labelFor(currentOption, i18n.locale) : <span className="text-muted-foreground">{t`Not set`}</span>}
            </p>
        );
    }
    return (
        <NativeSelect value={current} onChange={event => onChange(event.target.value || null)}>
            <NativeSelectOption value="">{t`Not set`}</NativeSelectOption>
            {options.map(option => (
                <NativeSelectOption key={option.value} value={option.value}>
                    {labelFor(option, i18n.locale)}
                </NativeSelectOption>
            ))}
        </NativeSelect>
    );
};
