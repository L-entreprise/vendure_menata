import { graphql } from '@/graphql/graphql';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { api, DashboardRouteDefinition, Page, PageTitle } from '@vendure/dashboard';
import { useEffect } from 'react';

const resolveDocument = graphql(`
    query CrmResolveCode($code: String!) { crmResolveCode(code: $code) { kind id } }
`);

/** I3: /crm/code/CLI-000123 opens the customer, /crm/code/GRP-000045 the group. */
function CodePage() {
    const { code } = useParams({ strict: false }) as { code: string };
    const navigate = useNavigate();
    const { data, isPending } = useQuery({
        queryKey: ['crm-resolve-code', code],
        queryFn: async () => ((await api.query(resolveDocument, { code })) as any).crmResolveCode,
    });
    useEffect(() => {
        if (data?.kind === 'customer') {
            void navigate({ to: '/customers/$id', params: { id: data.id }, replace: true });
        } else if (data?.kind === 'group') {
            void navigate({ to: '/customer-groups/$id', params: { id: data.id }, replace: true });
        }
    }, [data, navigate]);
    return (
        <Page pageId="crm-code">
            <PageTitle>{code}</PageTitle>
            {!isPending && !data && <p className="mt-4 text-sm text-muted-foreground"><Trans>No customer or group has this code.</Trans></p>}
        </Page>
    );
}

export const crmCodeRoute: DashboardRouteDefinition = {
    path: '/crm/code/$code',
    loader: () => ({ breadcrumb: () => i18n._(msg`CRM code`) }),
    component: () => <CodePage />,
};
