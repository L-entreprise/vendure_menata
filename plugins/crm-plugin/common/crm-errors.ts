import { I18nError, LogLevel } from '@vendure/core';

/**
 * CRM rule violations. The message is an i18n key resolved by Vendure's I18nService
 * (see {@link crmErrorTranslations}), so the dashboard shows it in the admin's language.
 * Interpolation uses Vendure's single-brace syntax: `{ name }`.
 */
export class CrmRuleError extends I18nError {
    constructor(key: CrmErrorKey, variables: Record<string, string | number> = {}) {
        super(`error.${key}`, variables, 'CRM_RULE_VIOLATION', LogLevel.Verbose);
    }
}

export class CrmForbiddenError extends I18nError {
    constructor(key: CrmErrorKey, variables: Record<string, string | number> = {}) {
        super(`error.${key}`, variables, 'FORBIDDEN', LogLevel.Verbose);
    }
}

const en = {
    'crm-group-accepts-groups-only': 'The group "{ groupName }" only accepts groups, not customers',
    'crm-group-accepts-customers-only': 'The group "{ groupName }" only accepts customers, not groups',
    'crm-customer-already-in-company':
        '{ customerName } already belongs to the company "{ companyName }": move them instead',
    'crm-note-only-author': 'Only the author of a note can change it',
    'crm-settings-invalid': 'Invalid CRM settings: { reason }',
    'crm-status-unknown': 'Unknown customer status "{ status }"',
    'crm-status-transition-not-allowed': 'Changing the status from "{ from }" to "{ to }" is not allowed',
    'crm-structure-admin-only': 'Only the super admin can change the type or the allowed members of a group',
    'crm-scope-change-has-customers':
        'The group "{ groupName }" still has { count } customer(s): remove them before accepting groups only',
    'crm-scope-change-has-groups':
        'The group "{ groupName }" still has { count } sub-group(s): remove them before accepting customers only',
    'crm-hierarchy-self': 'A group cannot be its own parent',
    'crm-hierarchy-cycle': '"{ parentName }" is already below "{ childName }": this link would create a loop',
    'crm-hierarchy-too-deep': 'This link would make the hierarchy deeper than { max } levels',
    'crm-not-a-company': 'The group "{ groupName }" is not a company',
    'crm-only-own-task': 'Only the person a follow-up is assigned to can change it',
    'crm-merge-same-customer': 'A customer cannot be merged into itself',
    'crm-merge-company-conflict':
        'The two customers belong to different companies ("{ sourceCompany }" and "{ targetCompany }"): move one first',
} as const;

export type CrmErrorKey = keyof typeof en;

const fr: Record<CrmErrorKey, string> = {
    'crm-group-accepts-groups-only': 'Le groupe « { groupName } » accepte seulement des groupes, pas des clients',
    'crm-group-accepts-customers-only': 'Le groupe « { groupName } » accepte seulement des clients, pas des groupes',
    'crm-customer-already-in-company':
        '{ customerName } appartient déjà à l’entreprise « { companyName } » : déplacez-le plutôt',
    'crm-note-only-author': 'Seul l’auteur d’une note peut la modifier',
    'crm-settings-invalid': 'Réglages CRM invalides : { reason }',
    'crm-status-unknown': 'Statut client inconnu « { status } »',
    'crm-status-transition-not-allowed': 'Le passage du statut « { from } » à « { to } » n’est pas autorisé',
    'crm-structure-admin-only': 'Seul le super admin peut changer le type ou les membres autorisés d’un groupe',
    'crm-scope-change-has-customers':
        'Le groupe « { groupName } » contient encore { count } client(s) : retirez-les avant de n’accepter que des groupes',
    'crm-scope-change-has-groups':
        'Le groupe « { groupName } » contient encore { count } sous-groupe(s) : retirez-les avant de n’accepter que des clients',
    'crm-hierarchy-self': 'Un groupe ne peut pas être son propre parent',
    'crm-hierarchy-cycle': '« { parentName } » est déjà sous « { childName } » : ce lien créerait une boucle',
    'crm-hierarchy-too-deep': 'Ce lien rendrait la hiérarchie plus profonde que { max } niveaux',
    'crm-not-a-company': 'Le groupe « { groupName } » n’est pas une entreprise',
    'crm-only-own-task': 'Seule la personne à qui la relance est assignée peut la modifier',
    'crm-merge-same-customer': 'Un client ne peut pas être fusionné avec lui-même',
    'crm-merge-company-conflict':
        'Les deux clients appartiennent à des entreprises différentes (« { sourceCompany } » et « { targetCompany } ») : déplacez-en un d’abord',
};

/** Registered for each language in {@link CrmPlugin}. */
export const crmErrorTranslations: Record<'en' | 'fr', { error: Record<CrmErrorKey, string> }> = {
    en: { error: en },
    fr: { error: fr },
};
