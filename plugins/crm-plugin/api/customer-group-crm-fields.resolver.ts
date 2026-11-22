import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { CustomerGroup } from '@vendure/core';

import { crmCode } from '../common/crm-codes';
import { MemberScope } from '../constants';
import { resolveMemberScope, StructureFields } from '../services/membership-rules.service';

function structureOf(group: CustomerGroup): StructureFields {
    return (group.customFields ?? {}) as StructureFields;
}

/** Field resolvers for the read-only CRM fields of CustomerGroup (see ./api-extensions.ts). */
@Resolver('CustomerGroup')
export class CustomerGroupCrmFieldsResolver {
    @ResolveField()
    crmCode(@Parent() group: CustomerGroup): string {
        return crmCode('GRP', group.id);
    }

    @ResolveField()
    crmGroupType(@Parent() group: CustomerGroup): string | null {
        return structureOf(group).groupType ?? null;
    }

    @ResolveField()
    crmMemberScope(@Parent() group: CustomerGroup): MemberScope {
        return resolveMemberScope(structureOf(group));
    }
}
