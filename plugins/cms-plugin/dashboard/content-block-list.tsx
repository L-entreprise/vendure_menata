import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
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

function ContentBlockListContent({ route }: { route: any }) {
    const { t } = useLingui();
    return (
        <ListPage
            pageId="content-block-list"
            title={t`Content Blocks`}
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
                    header: t`ID`,
                    cell: ({ row }) => (
                        <DetailPageButton id={row.original.id} label={row.original.id} />
                    ),
                },
                name: {
                    header: t`Name`,
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
                        <Trans>New Content Block</Trans>
                    </Link>
                </Button>
            </PageActionBarRight>
        </ListPage>
    );
}

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
    component: route => <ContentBlockListContent route={route} />,
};
