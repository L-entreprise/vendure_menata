import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { ActivityIcon, ClockIcon, ExternalLinkIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    api,
    Button,
    Card,
    CardContent,
    CardHeader,
    DashboardRouteDefinition,
    Page,
    PageActionBar,
    PageTitle,
} from '@vendure/dashboard';

const getDiagnosticDocument = graphql(`
    query GetDiagnostic {
        diagnostic {
            available
            expired
            title
            html
            validUntil
            ctaUrl
        }
    }
`);

interface Diagnostic {
    available: boolean;
    expired: boolean;
    title?: string | null;
    html?: string | null;
    validUntil?: string | null;
    ctaUrl?: string | null;
}

function CtaCard({ expired, ctaUrl }: { expired: boolean; ctaUrl?: string | null }) {
    return (
        <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <ActivityIcon className="h-10 w-10 text-muted-foreground" />
                <div className="space-y-1">
                    <p className="text-lg font-semibold">
                        {expired ? (
                            <Trans>Your diagnostic has expired</Trans>
                        ) : (
                            <Trans>No diagnostic available yet</Trans>
                        )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {expired ? (
                            <Trans>Order a fresh web diagnostic to see your updated report here.</Trans>
                        ) : (
                            <Trans>Order a web diagnostic and it will appear here automatically.</Trans>
                        )}
                    </p>
                </div>
                {ctaUrl && (
                    <Button asChild>
                        <a href={ctaUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon className="mr-2 h-4 w-4" />
                            <Trans>Order on menata.fr</Trans>
                        </a>
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

function DiagnosticsPageContent() {
    const { t } = useLingui();
    const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.query(getDiagnosticDocument, {});
            setDiagnostic(result.diagnostic as Diagnostic);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <Page>
            <PageTitle>{diagnostic?.title || t`Web Diagnostic`}</PageTitle>
            <PageActionBar>
                {diagnostic?.available && diagnostic.validUntil && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <ClockIcon className="h-4 w-4" />
                        <Trans>
                            Available until {new Date(diagnostic.validUntil).toLocaleDateString()}
                        </Trans>
                    </span>
                )}
            </PageActionBar>

            <div className="mt-4 w-full">
                {loading ? (
                    <Card>
                        <CardHeader />
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <Trans>Loading diagnostic…</Trans>
                        </CardContent>
                    </Card>
                ) : diagnostic?.available && diagnostic.html ? (
                    // Sandboxed: the diagnostic HTML is isolated from the admin app — no
                    // hostile JS can reach the Vendure session. allow-scripts WITHOUT
                    // allow-same-origin keeps it in an opaque origin.
                    <iframe
                        title={diagnostic.title || t`Web Diagnostic`}
                        srcDoc={diagnostic.html}
                        sandbox="allow-scripts allow-popups"
                        className="h-[calc(100vh-220px)] w-full rounded-lg border bg-white"
                    />
                ) : (
                    <CtaCard expired={!!diagnostic?.expired} ctaUrl={diagnostic?.ctaUrl} />
                )}
            </div>
        </Page>
    );
}

export const diagnosticsPage: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'diagnostics',
        id: 'diagnostics',
        url: '/diagnostics',
        title: 'Web Diagnostic',
        order: 0,
    },
    path: '/diagnostics',
    loader: () => ({ breadcrumb: 'Web Diagnostic' }),
    component: () => <DiagnosticsPageContent />,
};
