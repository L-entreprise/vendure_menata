import { useLingui } from '@lingui/react/macro';
import { DashboardFormComponent } from '@vendure/dashboard';

type LocalizedLabel = Array<{ languageCode: string; value: string }>;
type FieldOption = { value: string; label?: LocalizedLabel };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

function optionLabel(options: FieldOption[], value: string, locale: string): string | undefined {
    const labels = options.find(option => option.value === value)?.label ?? [];
    return (labels.find(label => locale.startsWith(label.languageCode)) ?? labels[0])?.value;
}

/**
 * Values the CRM computes or freezes (prospect / client state, company and sales rep of an
 * order): shown as text in the native forms, never as an input that looks editable.
 */
export const ReadonlyValue: DashboardFormComponent = ({ value, fieldDef }) => {
    const { t, i18n } = useLingui();
    const options = ((fieldDef as { options?: FieldOption[] } | undefined)?.options ?? []) as FieldOption[];
    let text: string | undefined;
    if (value && typeof value === 'object') {
        const record = value as { name?: string; firstName?: string; lastName?: string };
        text = record.name ?? ([record.firstName, record.lastName].filter(Boolean).join(' ') || undefined);
    } else if (typeof value === 'string' && value) {
        text = optionLabel(options, value, i18n.locale) ?? (ISO_DATE.test(value) ? new Date(value).toLocaleDateString(i18n.locale) : undefined);
    } else if (value instanceof Date) {
        text = value.toLocaleDateString(i18n.locale);
    }
    return (
        <p className="py-2 text-sm">
            {text ?? <span className="text-muted-foreground">{value ? t`See the CRM block` : t`Not set`}</span>}
        </p>
    );
};
