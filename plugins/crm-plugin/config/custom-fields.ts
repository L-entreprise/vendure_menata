import { Administrator, CustomerGroup, CustomFieldConfig, CustomFields, LanguageCode } from '@vendure/core';

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
    Order: [
        {
            ...adminOnly,
            name: 'companyGroup',
            type: 'relation',
            entity: CustomerGroup,
            readonly: true,
            // Read through Order.crmCompany; hidden from the native form, the CRM block shows it.
            internal: true,
            label: label('Company', 'Entreprise'),
            ui: { component: 'crm-readonly-value' },
            description: label('Frozen when the order is placed', 'Figée au passage de la commande'),
        },
        {
            ...adminOnly,
            name: 'salesRep',
            type: 'relation',
            entity: Administrator,
            readonly: true,
            // Read through Order.crmSalesRepName (no Administrator exposed to sales reps).
            internal: true,
            label: label('Sales rep', 'Commercial'),
            ui: { component: 'crm-readonly-value' },
        },
    ],
    HistoryEntry: [
        {
            ...adminOnly,
            name: 'pinned',
            type: 'boolean',
            readonly: true,
            defaultValue: false,
            label: label('Pinned', 'Épinglée'),
        },
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
        {
            ...adminOnly,
            name: 'lifecycle',
            type: 'string',
            readonly: true,
            label: label('Prospect / client', 'Prospect / client'),
            ui: { component: 'crm-readonly-value' },
            options: [
                { value: 'prospect', label: label('Prospect', 'Prospect') },
                { value: 'client', label: label('Client', 'Client') },
                { value: 'dormant', label: label('Dormant', 'Dormant') },
            ],
        },
        {
            ...adminOnly,
            name: 'lifecycleVia',
            type: 'string',
            readonly: true,
            label: label('Client through', 'Client via'),
            ui: { component: 'crm-readonly-value' },
            options: [
                { value: 'direct', label: label('Direct orders', 'Commandes en direct') },
                { value: 'subsidiary', label: label('A subsidiary', 'Une filiale') },
            ],
        },
        {
            ...adminOnly,
            name: 'lastCountedOrderAt',
            type: 'datetime',
            readonly: true,
            label: label('Last counted order', 'Dernière commande comptée'),
            ui: { component: 'crm-readonly-value' },
        },
        text('siret', 'SIRET', 'SIRET'),
        text('vatNumber', 'VAT number', 'N° de TVA'),
        text('website', 'Website', 'Site web'),
        text('phone', 'Main phone', 'Téléphone standard'),
        leadSource,
        accountManager,
    ],
};
