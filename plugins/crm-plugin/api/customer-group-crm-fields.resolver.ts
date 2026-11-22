import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { CustomerGroup } from '@vendure/core';

import { MemberScope } from '../constants';
import { resolveMemberScope } from '../services/membership-rules.service';

type CrmCustomFields = { groupType?: string | null; memberScope?: string | null };

function crmCustomFields(group: CustomerGroup): CrmCustomFields {
    return (group.customFields ?? {}) as CrmCustomFields;
}

/** Field resolvers for the read-only CRM fields declared in ./api-extensions.ts. */
@Resolver('CustomerGroup')
export class CustomerGroupCrmFieldsResolver {
    @ResolveField()
    crmGroupType(@Parent() group: CustomerGroup): string | null {
        return crmCustomFields(group).groupType ?? null;
    }

    @ResolveField()
    crmMemberScope(@Parent() group: CustomerGroup): MemberScope {
        return resolveMemberScope(crmCustomFields(group));
    }
}
