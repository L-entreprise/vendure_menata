import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { AuditLogService } from '../services/audit-log.service';
import { ListQueryArgs } from './types';

@Resolver()
export class AuditLogAdminResolver {
    constructor(private auditLogService: AuditLogService) {}

    @Query()
    @Allow(Permission.SuperAdmin)
    async auditLog(@Ctx() ctx: RequestContext, @Args() args: ListQueryArgs) {
        return this.auditLogService.findAll(ctx, args.options);
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async auditLogStats(@Ctx() ctx: RequestContext) {
        return this.auditLogService.getStats(ctx);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async clearAuditLog(): Promise<number> {
        return this.auditLogService.clearAll();
    }
}
