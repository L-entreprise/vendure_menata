import { Administrator, CustomFieldConfig, CustomFields, LanguageCode } from '@vendure/core';

const label = (en: string, fr: string) => [
    { languageCode: LanguageCode.en, value: en },
    { languageCode: LanguageCode.fr, value: fr },
];

/** Never exposed on the Shop API (CDC N6, A5: nothing CRM on the storefront). */
const adminOnly = { public: false, nullable: true } as const;

const accountManager: CustomFieldConfig = {
    ...adminOnly,
    name: 'accountManager',
    type: 'relation',
    entity: Administrator,
    label: label('Account manager', 'Commercial attitré'),
    description: label('Used for orders placed without a sales rep', 'Utilisé pour les commandes passées sans commercial'),
};

const leadSource: CustomFieldConfig = {
    ...adminOnly,
    name: 'leadSource',
    type: 'string',
    label: label('Lead source', 'Source du lead'),
    ui: { component: 'crm-lead-source-select' },
};

const text = (name: string, en: string, fr: string): CustomFieldConfig => ({
    ...adminOnly,
    name,
    type: 'string',
    label: label(en, fr),
});

/**
 * CRM custom fields. The structure fields (`groupType`, `memberScope`) are readable by
 * everyone: `requiresPermission` would hide them from sales reps too, so their writes are
 * guarded in CustomerGroupGuardResolver instead (super admin only).
 */
export const crmCustomFields: CustomFields = {
    Customer: [
        {
            ...adminOnly,
            name: 'crmStatus',
            type: 'string',
            internal: true,
            label: label('CRM status', 'Statut CRM'),
        },
        {
            ...text('companyNameHint', 'Company (as stated)', 'Entreprise (indicatif)'),
            description: label(
                'Free text, never used to link the customer to a company',
                'Texte libre, jamais utilisé pour rattacher le client à une entreprise',
            ),
        },
        {
            ...adminOnly,
            name: 'companyRoles',
            type: 'string',
            list: true,
            label: label('Roles in the company', 'Rôles dans l’entreprise'),
            ui: { component: 'crm-role-select' },
        },
        leadSource,
        accountManager,
    ],
    CustomerGroup: [
        {
            ...adminOnly,
            name: 'groupType',
            type: 'string',
            label: label('Group type', 'Type de groupe'),
            ui: { component: 'crm-admin-only-select' },
            options: [
                { value: 'company', label: label('Company', 'Entreprise') },
                { value: 'companyGroup', label: label('Group of companies', "Groupe d'entreprises") },
                { value: 'portfolio', label: label('Sales portfolio', 'Portefeuille commercial') },
                { value: 'segment', label: label('Segment', 'Segment') },
                { value: 'other', label: label('Other', 'Autre') },
            ],
        },
        {
            ...adminOnly,
            name: 'memberScope',
            type: 'string',
            label: label('Allowed members', 'Membres autorisés'),
            ui: { component: 'crm-admin-only-select' },
            description: label('Empty: derived from the group type', 'Vide : déduit du type de groupe'),
            options: [
                { value: 'customers', label: label('Customers only', 'Clients seulement') },
                { value: 'groups', label: label('Groups only', 'Groupes seulement') },
                { value: 'both', label: label('Customers and groups', 'Clients et groupes') },
            ],
        },
        text('siret', 'SIRET', 'SIRET'),
        text('vatNumber', 'VAT number', 'N° de TVA'),
        text('website', 'Website', 'Site web'),
        text('phone', 'Main phone', 'Téléphone standard'),
        leadSource,
        accountManager,
    ],
};
