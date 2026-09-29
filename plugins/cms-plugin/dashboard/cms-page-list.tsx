import { graphql } from '@/graphql/graphql';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import {
    Button,
    DashboardRouteDefinition,
    DetailPageButton,
    ListPage,
    PageActionBarRight,
} from '@vendure/dashboard';

const getCmsPageList = graphql(`
    query GetCmsPages($options: CmsPageListOptions) {
        cmsPages(options: $options) {
            items {
                id
                createdAt
                updatedAt
                key
                enabled
                name
                slug
            }
            totalItems
        }
    }
`);

const deleteCmsPageDocument = graphql(`
    mutation DeleteCmsPage($id: ID!) {
        deleteCmsPage(id: $id) {
            result
            message
        }
    }
`);

function CmsPageListContent({ route }: { route: any }) {
    const { t } = useLingui();
    return (
        <ListPage
            pageId="cms-page-list"
            title={t`CMS Pages`}
            listQuery={getCmsPageList}
            deleteMutation={deleteCmsPageDocument}
            route={route}
            customizeColumns={{
                key: {
                    header: t`Key`,
                },
                name: {
                    header: t`Name`,
                    cell: ({ row }) => (
                        <DetailPageButton
                            id={row.original.id}
                            label={row.original.name || row.original.key || row.original.id}
                        />
                    ),
                },
            }}
        >
            <PageActionBarRight>
                <Button asChild>
                    <Link to="./new">
                        <PlusIcon className="mr-2 h-4 w-4" />
                        <Trans>New Page</Trans>
                    </Link>
                </Button>
            </PageActionBarRight>
        </ListPage>
    );
}

export const cmsPageList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'cms',
        id: 'cms-pages',
        url: '/cms-pages',
        title: 'Pages',
        order: 0,
        requiresPermission: ['ReadCmsPage'],
    },
    path: '/cms-pages',
    loader: () => ({
        // A function (not <Trans>) so the browser tab title also gets the translated text.
        breadcrumb: () => i18n._(msg`Pages`),
    }),
    component: route => <CmsPageListContent route={route} />,
};
