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

import { ExpertModeSwitch, useCmsSimpleMode } from './cms-simple-mode';

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
                children {
                    id
                }
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
    const mode = useCmsSimpleMode();
    return (
        <ListPage
            pageId="cms-page-list"
            title={t`CMS Pages`}
            listQuery={getCmsPageList}
            // Simple mode: no page creation or deletion, those are structure changes.
            deleteMutation={mode.simple ? undefined : deleteCmsPageDocument}
            route={route}
            transformQueryKey={queryKey => [...queryKey, mode.simple]}
            transformVariables={variables => {
                // Child pages open as tabs of their parent; a search still finds every page.
                // Advanced pages (agency only) stay out of simple mode.
                const filter = variables.options?.filter ?? {};
                const searching = Object.keys(filter).length > 0;
                return {
                    ...variables,
                    options: {
                        ...variables.options,
                        filter: {
                            ...filter,
                            ...(!searching && { parentId: { isNull: true } }),
                            ...(mode.simple && { advanced: { eq: false } }),
                        },
                    },
                };
            }}
            defaultVisibility={mode.simple ? { id: false, createdAt: false, updatedAt: false, key: false } : undefined}
            customizeColumns={{
                children: {
                    header: t`Tabs`,
                    cell: ({ row }) => row.original.children?.length || '',
                },
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
                <ExpertModeSwitch mode={mode} />
                {!mode.simple && (
                    <Button render={<Link to="./new" />}>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        <Trans>New Page</Trans>
                    </Button>
                )}
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
