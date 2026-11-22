import { CustomFields, LanguageCode } from '@vendure/core';

import { crmAdminPermission } from '../constants';

const label = (en: string, fr: string) => [
    { languageCode: LanguageCode.en, value: en },
    { languageCode: LanguageCode.fr, value: fr },
];

/**
 * CRM custom fields. Only the super admin edits the structure of a group (CDC
 * "Permissions"), hence `requiresPermission` on the type and the member scope.
 */
export const crmCustomFields: CustomFields = {
    CustomerGroup: [
        {
            name: 'groupType',
            type: 'string',
            nullable: true,
            label: label('Group type', 'Type de groupe'),
            options: [
                { value: 'company', label: label('Company', 'Entreprise') },
                { value: 'companyGroup', label: label('Group of companies', "Groupe d'entreprises") },
                { value: 'portfolio', label: label('Sales portfolio', 'Portefeuille commercial') },
                { value: 'segment', label: label('Segment', 'Segment') },
                { value: 'other', label: label('Other', 'Autre') },
            ],
            requiresPermission: [crmAdminPermission.Permission],
        },
        {
            name: 'memberScope',
            type: 'string',
            nullable: true,
            label: label('Allowed members', 'Membres autorisés'),
            description: label(
                'Empty: derived from the group type',
                'Vide : déduit du type de groupe',
            ),
            options: [
                { value: 'customers', label: label('Customers only', 'Clients seulement') },
                { value: 'groups', label: label('Groups only', 'Groupes seulement') },
                { value: 'both', label: label('Customers and groups', 'Clients et groupes') },
            ],
            requiresPermission: [crmAdminPermission.Permission],
        },
    ],
};
