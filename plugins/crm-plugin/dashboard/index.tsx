import { i18n } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import { Trans } from '@lingui/react/macro';
import { defineDashboardExtension } from '@vendure/dashboard';

import { CustomerCompanyBlock, DraftOrderCompanyBlock } from './customer-company-block';
import { GroupRulesBlock } from './group-rules-block';

// Plugin .po catalogs reach the production dashboard as raw (uncompiled) ICU strings;
// let Lingui compile them at runtime so placeholders render.
i18n.setMessagesCompiler(compileMessage);

defineDashboardExtension({
    pageBlocks: [
        {
            id: 'crm-customer-company',
            title: <Trans>Company</Trans>,
            location: {
                pageId: 'customer-detail',
                column: 'side',
                position: { blockId: 'groups', order: 'before' },
            },
            component: CustomerCompanyBlock,
            shouldRender: context => !!context.entity?.id,
        },
        {
            id: 'crm-group-rules',
            title: <Trans>CRM rules</Trans>,
            location: {
                pageId: 'customer-group-detail',
                column: 'side',
                position: { blockId: 'main-form', order: 'after' },
            },
            component: GroupRulesBlock,
            shouldRender: context => !!context.entity?.id,
        },
        {
            id: 'crm-draft-order-company',
            title: <Trans>Company</Trans>,
            location: {
                pageId: 'draft-order-detail',
                column: 'side',
                position: { blockId: 'customer', order: 'after' },
            },
            component: DraftOrderCompanyBlock,
            shouldRender: context => !!context.entity?.id,
        },
    ],
});
