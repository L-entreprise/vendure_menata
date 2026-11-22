import { gql } from 'graphql-tag';

import { createPluginTestEnvironment } from '../../../deploy/e2e/test-environment';

type AdminClient = ReturnType<typeof createPluginTestEnvironment>['adminClient'];

/** Unit price (tax excluded, minor units) of the product created by `createTestVariant`. */
export const UNIT_PRICE = 10_000;

const CREATE_PRODUCT = gql`
    mutation {
        createProduct(input: { translations: [{ languageCode: en, name: "CRM test product", slug: "crm-test-product", description: "" }] }) {
            id
        }
    }
`;
const CREATE_VARIANT = gql`
    mutation CreateVariant($productId: ID!, $price: Money!) {
        createProductVariants(
            input: [{ productId: $productId, sku: "CRM-1", price: $price, trackInventory: FALSE, translations: [{ languageCode: en, name: "CRM test variant" }] }]
        ) {
            id
        }
    }
`;
const CREATE_DRAFT = gql`
    mutation { createDraftOrder { id } }
`;
const SET_CUSTOMER = gql`
    mutation SetCustomer($orderId: ID!, $customerId: ID!) {
        setCustomerForDraftOrder(orderId: $orderId, customerId: $customerId) { ... on Order { id } }
    }
`;
const ADD_ITEM = gql`
    mutation AddItem($orderId: ID!, $variantId: ID!) {
        addItemToDraftOrder(orderId: $orderId, input: { productVariantId: $variantId, quantity: 1 }) { ... on Order { id } }
    }
`;
const SET_ADDRESS = gql`
    mutation SetAddress($orderId: ID!) {
        setDraftOrderShippingAddress(orderId: $orderId, input: { streetLine1: "1 rue du Test", city: "Colmar", postalCode: "68000", countryCode: "FR" }) { id }
    }
`;
const SHIPPING_METHODS = gql`
    query Methods($orderId: ID!) { eligibleShippingMethodsForDraftOrder(orderId: $orderId) { id } }
`;
const SET_SHIPPING = gql`
    mutation SetShipping($orderId: ID!, $methodId: ID!) {
        setDraftOrderShippingMethod(orderId: $orderId, shippingMethodId: $methodId) { ... on Order { id } }
    }
`;
const TRANSITION = gql`
    mutation Transition($id: ID!, $state: String!) {
        transitionOrderToState(id: $id, state: $state) {
            ... on Order { id state }
            ... on OrderStateTransitionError { transitionError }
        }
    }
`;
const PAY = gql`
    mutation Pay($orderId: ID!) {
        addManualPaymentToOrder(input: { orderId: $orderId, method: "manual", transactionId: "t-1", metadata: {} }) {
            ... on Order { id state totalWithTax payments { id } }
        }
    }
`;
const REFUND = gql`
    mutation Refund($paymentId: ID!, $amount: Money!) {
        refundOrder(input: { paymentId: $paymentId, amount: $amount, lines: [], shipping: 0, adjustment: 0, reason: "test" }) {
            ... on Refund { id state }
            ... on ErrorResult { message }
        }
    }
`;
const SETTLE_REFUND = gql`
    mutation Settle($id: ID!) {
        settleRefund(input: { id: $id, transactionId: "r-1" }) { ... on Refund { id state } }
    }
`;

export async function createTestVariant(superAdmin: AdminClient): Promise<string> {
    const { createProduct } = await superAdmin.query(CREATE_PRODUCT);
    const { createProductVariants } = await superAdmin.query(CREATE_VARIANT, { productId: createProduct.id, price: UNIT_PRICE });
    return createProductVariants[0].id;
}

/** Creates a draft for `customerId` with whoever is logged in on `creator`. */
export async function createDraft(creator: AdminClient, customerId: string, variantId: string): Promise<string> {
    const { createDraftOrder } = await creator.query(CREATE_DRAFT);
    const orderId = createDraftOrder.id;
    await creator.query(SET_CUSTOMER, { orderId, customerId });
    await creator.query(ADD_ITEM, { orderId, variantId });
    await creator.query(SET_ADDRESS, { orderId });
    const { eligibleShippingMethodsForDraftOrder } = await creator.query(SHIPPING_METHODS, { orderId });
    await creator.query(SET_SHIPPING, { orderId, methodId: eligibleShippingMethodsForDraftOrder[0].id });
    return orderId;
}

export interface PaidOrder {
    orderId: string;
    paymentId: string;
    totalWithTax: number;
}

/** Completes the draft and settles a manual payment (super admin). */
export async function payDraft(superAdmin: AdminClient, orderId: string): Promise<PaidOrder> {
    const { transitionOrderToState } = await superAdmin.query(TRANSITION, { id: orderId, state: 'ArrangingPayment' });
    if (transitionOrderToState.transitionError) {
        throw new Error(transitionOrderToState.transitionError);
    }
    const { addManualPaymentToOrder } = await superAdmin.query(PAY, { orderId });
    return { orderId, paymentId: addManualPaymentToOrder.payments[0].id, totalWithTax: addManualPaymentToOrder.totalWithTax };
}

export async function refund(superAdmin: AdminClient, paymentId: string, amount: number): Promise<void> {
    const { refundOrder } = await superAdmin.query(REFUND, { paymentId, amount });
    if (!refundOrder.id) {
        throw new Error(refundOrder.message);
    }
    await superAdmin.query(SETTLE_REFUND, { id: refundOrder.id });
}

export async function cancelOrder(superAdmin: AdminClient, orderId: string): Promise<void> {
    await superAdmin.query(
        gql`
            mutation Cancel($orderId: ID!) {
                cancelOrder(input: { orderId: $orderId, cancelShipping: true }) { ... on Order { id state } }
            }
        `,
        { orderId },
    );
}
