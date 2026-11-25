import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { Allow, Ctx, RequestContext, Transaction } from '@vendure/core';

import { CrmSettingsValues } from '../common/crm-settings-defaults';
import { crmAdminPermission } from '../constants';
import { CrmSettingsService } from '../services/crm-settings.service';

/** Settings are readable by every admin (sales reps need the option lists), editable by the super admin. */
@Resolver()
export class CrmSettingsResolver {
    constructor(private settingsService: CrmSettingsService) {}

    @Query()
    @Allow(Permission.Authenticated)
    crmSettings(@Ctx() ctx: RequestContext): Promise<CrmSettingsValues> {
        return this.settingsService.get(ctx);
    }

    @Transaction()
    @Mutation()
    @Allow(crmAdminPermission.Permission)
    updateCrmSettings(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CrmSettingsValues },
    ): Promise<CrmSettingsValues> {
        return this.settingsService.update(ctx, args.input);
    }
}
