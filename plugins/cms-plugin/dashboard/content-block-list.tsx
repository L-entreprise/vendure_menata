import { graphql } from '@/graphql/graphql';
import { Link } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { Button, DashboardRouteDefinition, DetailPageButton, ListPage, PageActionBarRight } from '@vendure/dashboard';

const getContentBlockList = graphql(`
    query GetContentBlocks($options: ContentBlockListOptions) {
        contentBlocks(options: $options) {
            items {
                id
                createdAt
                updatedAt
                key
                type
                enabled
                name
                textContent
                altText
                featuredAsset {
                    id
                    preview
                }
            }
            totalItems
        }
    }
`);

const deleteContentBlockDocument = graphql(`
    mutation DeleteContentBlock($id: ID!) {
        deleteContentBlock(id: $id) {
            result
            message
        }
    }
`);

export const contentBlockList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'cms',
        id: 'content-blocks',
        url: '/content-blocks',
        title: 'Content Blocks',
        requiresPermission: ['ReadContentBlock'],
    },
    path: '/content-blocks',
    loader: () => ({
        breadcrumb: 'Content Blocks',
    }),
    component: route => (
        <ListPage
            pageId="content-block-list"
            title="Content Blocks"
            listQuery={getContentBlockList}
            deleteMutation={deleteContentBlockDocument}
            route={route}
            defaultVisibility={{
                textContent: false,
                altText: false,
                featuredAsset: false,
            }}
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
                        New Content Block
                    </Link>
                </Button>
            </PageActionBarRight>
        </ListPage>
    ),
};
