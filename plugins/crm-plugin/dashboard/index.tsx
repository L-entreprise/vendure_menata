import { i18n } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import { Trans } from '@lingui/react/macro';
import { defineDashboardExtension } from '@vendure/dashboard';
import { ContactIcon } from 'lucide-react';

import { CRM_NAV_SECTION } from './constants';
import { CustomerCompanyBlock, DraftOrderCompanyBlock } from './customer-company-block';
import { CustomerCrmBlock } from './customer-crm-block';
import { GroupRulesBlock } from './group-rules-block';
import { LeadSourceSelectInput, RoleSelectInput } from './option-inputs';
import { crmSettingsRoute } from './settings-page';
import { StatusHistoryEntry } from './status-history-entry';

// Plugin .po catalogs reach the production dashboard as raw (uncompiled) ICU strings;
// let Lingui compile them at runtime so placeholders render.
i18n.setMessagesCompiler(compileMessage);

const hasEntity = (context: { entity?: { id?: string } }) => !!context.entity?.id;

defineDashboardExtension({
    navSections: [{ id: CRM_NAV_SECTION, title: 'CRM', icon: ContactIcon, order: 350 }],
    routes: [crmSettingsRoute],
    customFormComponents: {
        customFields: [
            { id: 'crm-role-select', component: RoleSelectInput },
            { id: 'crm-lead-source-select', component: LeadSourceSelectInput },
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
            id: 'crm-customer-company',
            title: <Trans>Company</Trans>,
            location: { pageId: 'customer-detail', column: 'side', position: { blockId: 'groups', order: 'before' } },
            component: CustomerCompanyBlock,
            shouldRender: hasEntity,
        },
        {
            id: 'crm-group-rules',
            title: <Trans>CRM rules</Trans>,
            location: { pageId: 'customer-group-detail', column: 'side', position: { blockId: 'main-form', order: 'after' } },
            component: GroupRulesBlock,
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
