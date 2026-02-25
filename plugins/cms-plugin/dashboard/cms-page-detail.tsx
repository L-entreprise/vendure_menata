import { graphql } from '@/graphql/graphql';
import { DashboardRouteDefinition, DetailPage, detailPageRouteLoader } from '@vendure/dashboard';

const cmsPageDetailDocument = graphql(`
    query GetCmsPageDetail($id: ID!) {
        cmsPage(id: $id) {
            id
            createdAt
            updatedAt
            key
            enabled
            name
            slug
            translations {
                id
                languageCode
                name
                slug
            }
            contentBlocks {
                id
                key
                type
                enabled
                position
                textContent
                dateValue
                numberValue
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
    }
`);

const updateCmsPageDocument = graphql(`
    mutation UpdateCmsPage($input: UpdateCmsPageInput!) {
        updateCmsPage(input: $input) {
            id
        }
    }
`);

const createCmsPageDocument = graphql(`
    mutation CreateCmsPage($input: CreateCmsPageInput!) {
        createCmsPage(input: $input) {
            id
        }
    }
`);

export const cmsPageDetail: DashboardRouteDefinition = {
    path: '/cms-pages/$id',
    loader: detailPageRouteLoader({
        queryDocument: cmsPageDetailDocument,
        breadcrumb: (isNew, entity) => [
            { path: '/cms-pages', label: 'Pages' },
            isNew ? 'New page' : entity?.name,
        ],
    }),
    component: route => (
        <DetailPage
            pageId="cms-page-detail"
            queryDocument={cmsPageDetailDocument}
            updateDocument={updateCmsPageDocument}
            createDocument={createCmsPageDocument}
            route={route}
            title={page => page?.name ?? 'New Page'}
            setValuesForUpdate={page => ({
                id: page.id,
                key: page.key,
                enabled: page.enabled,
                translations: page.translations,
                contentBlocks: page.contentBlocks.map(block => ({
                    id: block.id,
                    type: block.type,
                    key: block.key,
                    position: block.position,
                    enabled: block.enabled,
                    featuredAssetId: block.featuredAsset?.id,
                    dateValue: block.dateValue,
                    numberValue: block.numberValue,
                    translations: block.translations,
                })),
            })}
            setValuesForCreate={() => ({
                key: '',
                enabled: true,
                translations: [],
                contentBlocks: [],
            })}
        />
    ),
};
