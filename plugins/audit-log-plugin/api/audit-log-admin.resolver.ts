import { Args, Query, Resolver } from '@nestjs/graphql';
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
}
