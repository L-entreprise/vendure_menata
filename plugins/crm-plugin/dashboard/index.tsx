import { i18n } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import { Trans } from '@lingui/react/macro';
import { defineDashboardExtension } from '@vendure/dashboard';
import { ContactIcon } from 'lucide-react';

import { AdminOnlySelect } from './admin-only-select';
import { CRM_NAV_SECTION } from './constants';
import { CompanyContactsBlock } from './company-contacts-block';
import { DraftOrderCompanyBlock } from './customer-company-block';
import { CustomerCrmBlock } from './customer-crm-block';
import { CustomerGroupsBlock } from './customer-groups-block';
import { GroupCrmBlock } from './group-crm-block';
import { LeadSourceSelectInput, RoleSelectInput } from './option-inputs';
import { crmSettingsRoute } from './settings-page';
import { StatusHistoryEntry } from './status-history-entry';
import { crmTreeRoute } from './tree-page';

// Plugin .po catalogs reach the production dashboard as raw (uncompiled) ICU strings;
// let Lingui compile them at runtime so placeholders render.
i18n.setMessagesCompiler(compileMessage);

const hasEntity = (context: { entity?: { id?: string } }) => !!context.entity?.id;

defineDashboardExtension({
    navSections: [{ id: CRM_NAV_SECTION, title: 'CRM', icon: ContactIcon, order: 350 }],
    routes: [crmTreeRoute, crmSettingsRoute],
    customFormComponents: {
        customFields: [
            { id: 'crm-role-select', component: RoleSelectInput },
            { id: 'crm-lead-source-select', component: LeadSourceSelectInput },
            { id: 'crm-admin-only-select', component: AdminOnlySelect },
        ],
    },
    historyEntries: [{ type: 'CUSTOMER_STATUS_CHANGED', component: StatusHistoryEntry }],
    pageBlocks: [
        {
            id: 'crm-customer-summary',
            title: <Trans>CRM</Trans>,
            location: { pageId: 'customer-detail', column: 'side', position: { blockId: 'status', order: 'after' } },
            component: CustomerCrmBlock,
            shouldRender: hasEntity,
        },
        {
            id: 'crm-customer-groups',
            title: <Trans>Company and groups</Trans>,
            location: { pageId: 'customer-detail', column: 'side', position: { blockId: 'groups', order: 'replace' } },
            component: CustomerGroupsBlock,
            shouldRender: hasEntity,
        },
        {
            id: 'crm-group-summary',
            title: <Trans>CRM</Trans>,
            location: { pageId: 'customer-group-detail', column: 'side', position: { blockId: 'main-form', order: 'after' } },
            component: GroupCrmBlock,
            shouldRender: hasEntity,
        },
        {
            id: 'crm-company-contacts',
            title: <Trans>Contacts and roles</Trans>,
            location: { pageId: 'customer-group-detail', column: 'main', position: { blockId: 'customers', order: 'before' } },
            component: CompanyContactsBlock,
            shouldRender: hasEntity,
        },
        {
            id: 'crm-draft-order-company',
            title: <Trans>Company</Trans>,
            location: { pageId: 'draft-order-detail', column: 'side', position: { blockId: 'customer', order: 'after' } },
            component: DraftOrderCompanyBlock,
            shouldRender: hasEntity,
        },
    ],
});
