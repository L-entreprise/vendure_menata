import { graphql } from '@/graphql/graphql';
import { DashboardRouteDefinition, DetailPage, detailPageRouteLoader } from '@vendure/dashboard';

const contentBlockDetailDocument = graphql(`
    query GetContentBlockDetail($id: ID!) {
        contentBlock(id: $id) {
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
            translations {
                id
                languageCode
                name
                textContent
                altText
            }
        }
    }
`);

const updateContentBlockDocument = graphql(`
    mutation UpdateContentBlock($input: UpdateContentBlockInput!) {
        updateContentBlock(input: $input) {
            id
        }
    }
`);

const createContentBlockDocument = graphql(`
    mutation CreateContentBlock($input: CreateContentBlockInput!) {
        createContentBlock(input: $input) {
            id
        }
    }
`);

export const contentBlockDetail: DashboardRouteDefinition = {
    path: '/content-blocks/$id',
    loader: detailPageRouteLoader({
        queryDocument: contentBlockDetailDocument,
        breadcrumb: (isNew, entity) => [
            { path: '/content-blocks', label: 'Content Blocks' },
            isNew ? 'New content block' : entity?.name,
        ],
    }),
    component: route => (
        <DetailPage
            pageId="content-block-detail"
            queryDocument={contentBlockDetailDocument}
            updateDocument={updateContentBlockDocument}
            createDocument={createContentBlockDocument}
            route={route}
            title={block => block?.name ?? 'New Content Block'}
            setValuesForUpdate={block => ({
                id: block.id,
                key: block.key,
                enabled: block.enabled,
                featuredAssetId: block.featuredAsset?.id,
                translations: block.translations,
            })}
            setValuesForCreate={() => ({
                key: '',
                type: 'TEXT' as const,
                enabled: true,
                translations: [],
            })}
        />
    ),
};
