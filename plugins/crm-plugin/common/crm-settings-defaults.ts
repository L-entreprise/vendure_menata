import { CrmOption, CrmStatusTransition } from '../entities/crm-settings.entity';

export interface CrmSettingsValues {
    customerStatuses: CrmOption[];
    statusTransitions: CrmStatusTransition[] | null;
    defaultStatus: string;
    dormantThresholdDays: number | null;
    roleOptions: CrmOption[];
    leadSourceOptions: CrmOption[];
}

/** CDC defaults: simple statuses with free transitions, no dormant threshold yet. */
export const DEFAULT_CRM_SETTINGS: Readonly<CrmSettingsValues> = {
    customerStatuses: [
        { code: 'active', label: 'Actif' },
        { code: 'inactive', label: 'Inactif' },
        { code: 'left', label: 'Parti' },
    ],
    statusTransitions: null,
    defaultStatus: 'active',
    dormantThresholdDays: null,
    roleOptions: [
        { code: 'buyer', label: 'Acheteur' },
        { code: 'accountant', label: 'Comptable' },
        { code: 'decision-maker', label: 'Décideur' },
    ],
    leadSourceOptions: [
        { code: 'form', label: 'Formulaire' },
        { code: 'trade-show', label: 'Salon' },
        { code: 'referral', label: 'Recommandation' },
    ],
};

const MAX_THRESHOLD_DAYS = 3650;
const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

function optionsProblem(name: string, options: CrmOption[], allowEmpty: boolean): string | null {
    if (!allowEmpty && options.length === 0) {
        return `${name} needs at least one entry`;
    }
    const codes = options.map(option => option.code);
    if (codes.some(code => !CODE_PATTERN.test(code))) {
        return `${name} codes must be lowercase letters, digits or dashes`;
    }
    if (new Set(codes).size !== codes.length) {
        return `${name} codes must be unique`;
    }
    if (options.some(option => !option.label.trim())) {
        return `${name} labels cannot be empty`;
    }
    return null;
}

function transitionsProblem(values: CrmSettingsValues): string | null {
    const codes = new Set(values.customerStatuses.map(status => status.code));
    const unknown = (values.statusTransitions ?? []).some(
        transition => !codes.has(transition.from) || transition.to.some(code => !codes.has(code)),
    );
    return unknown ? 'transitions can only use listed statuses' : null;
}

/** Returns the first problem found, or null when the settings are valid. */
export function findSettingsProblem(values: CrmSettingsValues): string | null {
    const threshold = values.dormantThresholdDays;
    return (
        optionsProblem('statuses', values.customerStatuses, false) ??
        (values.customerStatuses.some(status => status.code === values.defaultStatus)
            ? null
            : 'the default status must be one of the statuses') ??
        transitionsProblem(values) ??
        (threshold !== null && (!Number.isInteger(threshold) || threshold < 1 || threshold > MAX_THRESHOLD_DAYS)
            ? `the dormant threshold must be between 1 and ${MAX_THRESHOLD_DAYS} days`
            : null) ??
        optionsProblem('roles', values.roleOptions, true) ??
        optionsProblem('lead sources', values.leadSourceOptions, true)
    );
}
