import { Permission } from '@vendure/common/lib/generated-types';
import { ForbiddenError, RequestContext } from '@vendure/core';

/**
 * `@Allow(A, B)` lets through anyone holding A *or* B. Operations that reach customers or
 * groups depending on their arguments check the matching permission here as well.
 */
export function assertPermission(ctx: RequestContext, permission: Permission): void {
    if (!ctx.userHasPermissions([permission])) {
        throw new ForbiddenError();
    }
}

export function canRead(ctx: RequestContext) {
    return {
        customers: ctx.userHasPermissions([Permission.ReadCustomer]),
        groups: ctx.userHasPermissions([Permission.ReadCustomerGroup]),
    };
}
