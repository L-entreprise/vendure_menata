import { graphql } from '@/graphql/graphql';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { api, Button, DashboardAlertDefinition } from '@vendure/dashboard';

const summaryDocument = graphql(`
    query ContentI18nProductSummary {
        productTranslationSummary {
            languageCode
            incompleteProducts
        }
    }
`);

interface Summary {
    languageCode: string;
    incompleteProducts: number;
}

const RECHECK_MS = 5 * 60 * 1000;

function describe(rows: Summary[]): string {
    return rows
        .filter(row => row.incompleteProducts > 0)
        .map(row => `${row.languageCode.toUpperCase()} ${row.incompleteProducts}`)
        .join(', ');
}

/** Bell alert: products whose translation is not finished, per language. */
export const productTranslationsAlert: DashboardAlertDefinition<Summary[]> = {
    id: 'content-i18n-incomplete-products',
    title: () => i18n._(msg`Products not fully translated`),
    // The dashboard calls these before the first check resolves (data undefined).
    description: rows => describe(rows ?? []),
    severity: 'info',
    check: async () => {
        try {
            const result: any = await api.query(summaryDocument, {});
            return result?.productTranslationSummary ?? [];
        } catch {
            // No product permission, or the server is unreachable: no alert.
            return [];
        }
    },
    shouldShow: rows => (rows ?? []).some(row => row.incompleteProducts > 0),
    recheckInterval: RECHECK_MS,
    actions: [
        {
            component: ({ dismiss }) => (
                <Button size="sm" variant="outline" render={<Link to="/products" onClick={() => dismiss()} />}>
                    <Trans>See products</Trans>
                </Button>
            ),
        },
    ],
};
