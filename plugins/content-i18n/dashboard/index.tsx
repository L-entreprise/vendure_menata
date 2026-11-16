import { i18n } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import { Trans } from '@lingui/react/macro';
import { defineDashboardExtension } from '@vendure/dashboard';

import { productTranslationsAlert } from './alerts';
import { LanguageSwitcher } from './language-switcher';
import { ProductTranslationsBlock } from './product-translations-block';
import { ProgressCell } from './progress-cell';
import { TranslatedRichTextInput, TranslatedTextInput } from './translated-input';

// Plugin .po catalogs reach the production dashboard as raw (uncompiled) ICU strings;
// let Lingui compile them at runtime so placeholders render.
i18n.setMessagesCompiler(compileMessage);

defineDashboardExtension({
    toolbarItems: [
        {
            id: 'content-language-switcher',
            component: LanguageSwitcher,
            position: { itemId: 'alerts', order: 'before' },
        },
    ],
    alerts: [productTranslationsAlert],
    dataTables: [
        {
            pageId: 'product-list',
            extendListDocument: `
                query {
                    products {
                        items {
                            translationProgress {
                                languageCode
                                translated
                                total
                            }
                        }
                    }
                }
            `,
            displayComponents: [{ column: 'translationProgress', component: ProgressCell }],
            viewOptionDefaults: { columnVisibility: { translationProgress: true } },
        },
    ],
    pageBlocks: [
        {
            id: 'content-i18n-product-translations',
            title: <Trans>Translations</Trans>,
            location: {
                pageId: 'product-detail',
                column: 'side',
                position: { blockId: 'facet-values', order: 'before' },
            },
            component: ProductTranslationsBlock,
            shouldRender: context => !!context.entity?.id,
        },
    ],
    detailForms: [
        {
            pageId: 'product-detail',
            inputs: [
                { blockId: 'main-form', field: 'name', component: TranslatedTextInput },
                { blockId: 'main-form', field: 'description', component: TranslatedRichTextInput },
            ],
        },
        {
            pageId: 'product-variant-detail',
            inputs: [{ blockId: 'main-form', field: 'name', component: TranslatedTextInput }],
        },
    ],
});
