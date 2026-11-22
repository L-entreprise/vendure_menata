import { Order } from '@vendure/core';

/**
 * CDC "Commandes qui comptent": payment settled and every later state. Cancelled orders
 * and fully refunded ones are excluded; a partial refund keeps the order.
 */
export const COUNTED_ORDER_STATES = ['PaymentSettled', 'PartiallyShipped', 'Shipped', 'PartiallyDelivered', 'Delivered'];

/** Needs `payments.refunds` loaded. */
export function settledRefundTotal(order: Order): number {
    return (order.payments ?? [])
        .flatMap(payment => payment.refunds ?? [])
        .filter(refund => refund.state === 'Settled')
        .reduce((sum, refund) => sum + refund.total, 0);
}

export function isCountedOrder(order: Order): boolean {
    if (!COUNTED_ORDER_STATES.includes(order.state)) {
        return false;
    }
    return order.totalWithTax <= 0 || settledRefundTotal(order) < order.totalWithTax;
}
