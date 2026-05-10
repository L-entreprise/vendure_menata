import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { InfoIcon, SettingsIcon } from 'lucide-react';
import {
    Badge,
    Button,
    Card,
    CardContent,
    DashboardRouteDefinition,
    DetailPageButton,
    ListPage,
    PageActionBarRight,
} from '@vendure/dashboard';

const getCmsPageListDocument = graphql(`
    query GetCmsPagesForTranslation($options: CmsPageListOptions) {
        cmsPages(options: $options) {
            items {
                id
                createdAt
                updatedAt
                key
                enabled
                name
                acceptsSubmissions
                isCollection
            }
            totalItems
        }
    }
`);

function TranslationListContent({ route }: { route: any }) {
    const { t } = useLingui();
    return (
        <>
        <Card className="mb-4">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
                <InfoIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <div className="font-medium">
                        <Trans>Translating products, collections & facets</Trans>
                    </div>
                    <div className="text-muted-foreground">
                        <Trans>
                            For products, collections, facets and other built-in Vendure entities,
                            switch the content language using the language selector at the top of the dashboard,
                            then open the entity and edit its name, slug or description directly. Saving will store
                            the translation for the selected language.
                        </Trans>
                    </div>
                </div>
            </CardContent>
        </Card>
        <ListPage
            pageId="translation-list"
            title={t`Translations`}
            listQuery={getCmsPageListDocument}
            route={route}
            transformVariables={(vars: any) => ({
                ...vars,
                options: {
                    ...vars.options,
                    filter: {
                        ...vars.options?.filter,
                        acceptsSubmissions: { eq: false },
                    },
                },
            })}
            customizeColumns={{
                name: {
                    header: t`Page`,
                    cell: ({ row }) => (
                        <div className="flex items-center gap-2">
                            <DetailPageButton
                                id={row.original.id}
                                label={row.original.name || row.original.key || row.original.id}
                            />
                            {row.original.isCollection && (
                                <Badge variant="outline"><Trans>Collection</Trans></Badge>
                            )}
                        </div>
                    ),
                },
                acceptsSubmissions: { meta: { disabled: true } },
                isCollection: { meta: { disabled: true } },
            }}
        >
            <PageActionBarRight>
                <Button variant="outline" asChild>
                    <Link to="/cms-translations/settings">
                        <SettingsIcon className="mr-2 h-4 w-4" />
                        <Trans>Languages</Trans>
                    </Link>
                </Button>
            </PageActionBarRight>
        </ListPage>
        </>
    );
}

export const translationList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'translations',
        id: 'cms-translations',
        url: '/cms-translations',
        title: 'Translations',
        requiresPermission: ['ReadCmsPage'],
    },
    path: '/cms-translations',
    loader: () => ({
        breadcrumb: 'Translations',
    }),
    component: route => <TranslationListContent route={route} />,
};
