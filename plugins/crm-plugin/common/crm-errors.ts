import { I18nError, LogLevel } from '@vendure/core';

/**
 * CRM rule violations. The message is an i18n key resolved by Vendure's I18nService
 * (see {@link crmErrorTranslations}), so the dashboard shows it in the admin's language.
 */
export class CrmRuleError extends I18nError {
    constructor(key: CrmErrorKey, variables: Record<string, string> = {}) {
        super(`error.${key}`, variables, 'CRM_RULE_VIOLATION', LogLevel.Verbose);
    }
}

export class CrmForbiddenError extends I18nError {
    constructor(key: CrmErrorKey) {
        super(`error.${key}`, {}, 'FORBIDDEN', LogLevel.Verbose);
    }
}

export type CrmErrorKey =
    | 'crm-group-accepts-groups-only'
    | 'crm-customer-already-in-company'
    | 'crm-note-only-author';

/** Registered for each language in {@link CrmPlugin}. Keys must match {@link CrmErrorKey}. */
export const crmErrorTranslations: Record<'en' | 'fr', { error: Record<CrmErrorKey, string> }> = {
    en: {
        error: {
            'crm-group-accepts-groups-only': 'The group "{ groupName }" only accepts groups, not customers',
            'crm-customer-already-in-company':
                '{ customerName } already belongs to the company "{ companyName }": move them instead',
            'crm-note-only-author': 'Only the author of a note can change it',
        },
    },
    fr: {
        error: {
            'crm-group-accepts-groups-only': 'Le groupe « { groupName } » accepte seulement des groupes, pas des clients',
            'crm-customer-already-in-company':
                '{ customerName } appartient déjà à l’entreprise « { companyName } » : déplacez-le plutôt',
            'crm-note-only-author': 'Seul l’auteur d’une note peut la modifier',
        },
    },
};
