import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS } from '../../../deploy/e2e/test-environment';
import { ContentI18nPlugin } from '../content-i18n.plugin';

const SET_LANGUAGES = gql`
    mutation SetLanguages($codes: [LanguageCode!]!) {
        updateGlobalSettings(input: { availableLanguages: $codes }) {
            ... on GlobalSettings {
                id
            }
        }
        updateChannel(input: { id: "T_1", availableLanguageCodes: $codes, defaultLanguageCode: en }) {
            ... on Channel {
                id
            }
        }
    }
`;

const CREATE_PRODUCT = gql`
    mutation CreateProduct($input: CreateProductInput!) {
        createProduct(input: $input) {
            id
        }
    }
`;

const CREATE_VARIANTS = gql`
    mutation CreateVariants($input: [CreateProductVariantInput!]!) {
        createProductVariants(input: $input) {
            id
        }
    }
`;

const UPDATE_PRODUCT = gql`
    mutation UpdateProduct($input: UpdateProductInput!) {
        updateProduct(input: $input) {
            id
        }
    }
`;

const PRODUCT_PROGRESS = gql`
    query ProductProgress($id: ID!) {
        product(id: $id) {
            translationProgress {
                languageCode
                total
                translated
                missing
            }
        }
    }
`;

const LIST_PROGRESS = gql`
    query ListProgress {
        products {
            items {
                id
                translationProgress {
                    languageCode
                    translated
                    total
                }
            }
        }
    }
`;

const SUMMARY = gql`
    query Summary {
        productTranslationSummary {
            languageCode
            incompleteProducts
        }
    }
`;

describe('ContentI18nPlugin — product translation progress', () => {
    const { server, adminClient } = createPluginTestEnvironment({ plugins: [ContentI18nPlugin] });
    let productId: string;
    let variantId: string;

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
        await adminClient.query(SET_LANGUAGES, { codes: ['en', 'fr'] });
        const { createProduct } = await adminClient.query(CREATE_PRODUCT, {
            input: {
                translations: [
                    { languageCode: 'en', name: 'Engine oil', slug: 'engine-oil', description: '<p>Synthetic</p>' },
                ],
            },
        });
        productId = createProduct.id;
        const { createProductVariants } = await adminClient.query(CREATE_VARIANTS, {
            input: [
                {
                    productId,
                    sku: 'OIL-1L',
                    price: 1000,
                    translations: [{ languageCode: 'en', name: 'Engine oil 1L' }],
                },
            ],
        });
        variantId = createProductVariants[0].id;
        await adminClient.query(UPDATE_PRODUCT, {
            input: { id: productId, translations: [{ languageCode: 'fr', name: 'Huile moteur', slug: 'huile-moteur', description: '' }] },
        });
        // A fully translated product does not count as incomplete.
        const { createProduct: done } = await adminClient.query(CREATE_PRODUCT, {
            input: {
                translations: [
                    { languageCode: 'en', name: 'Filter', slug: 'filter', description: '' },
                    { languageCode: 'fr', name: 'Filtre', slug: 'filtre', description: '' },
                ],
            },
        });
        expect(done.id).toBeDefined();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('reports the fields left to translate on a product', async () => {
        const { product } = await adminClient.query(PRODUCT_PROGRESS, { id: productId });
        expect(product.translationProgress).toEqual([
            { languageCode: 'fr', total: 3, translated: 1, missing: ['description', `variant:${variantId.replace('T_', '')}:name`] },
        ]);
    });

    it('exposes the progress on the product list', async () => {
        const { products } = await adminClient.query(LIST_PROGRESS);
        const oil = products.items.find((p: any) => p.id === productId);
        expect(oil.translationProgress).toEqual([{ languageCode: 'fr', translated: 1, total: 3 }]);
    });

    it('counts incomplete products per language', async () => {
        const { productTranslationSummary } = await adminClient.query(SUMMARY);
        expect(productTranslationSummary).toEqual([{ languageCode: 'fr', incompleteProducts: 1 }]);
    });
});
