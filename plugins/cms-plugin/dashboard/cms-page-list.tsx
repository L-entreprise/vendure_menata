import { graphql } from '@/graphql/graphql';
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

export const cmsPageList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'cms',
        id: 'cms-pages',
        url: '/cms-pages',
        title: 'Pages',
        requiresPermission: ['ReadCmsPage'],
    },
    path: '/cms-pages',
    loader: () => ({
        breadcrumb: 'Pages',
    }),
    component: route => (
        <ListPage
            pageId="cms-page-list"
            title="CMS Pages"
            listQuery={getCmsPageList}
            deleteMutation={deleteCmsPageDocument}
            route={route}
            customizeColumns={{
                id: {
                    header: 'ID',
                    cell: ({ row }) => (
                        <DetailPageButton id={row.original.id} label={row.original.id} />
                    ),
                },
                name: {
                    header: 'Name',
                    cell: ({ row }) => (
                        <DetailPageButton id={row.original.id} label={row.original.name} />
                    ),
                },
            }}
        >
            <PageActionBarRight>
                <Button asChild>
                    <Link to="./new">
                        <PlusIcon className="mr-2 h-4 w-4" />
                        New Page
                    </Link>
                </Button>
            </PageActionBarRight>
        </ListPage>
    ),
};
