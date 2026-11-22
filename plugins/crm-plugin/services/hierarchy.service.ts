import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    CustomerGroup,
    CustomerGroupEvent,
    EventBus,
    ID,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { In } from 'typeorm';

import { CrmRuleError } from '../common/crm-errors';
import {
    ancestorsOf,
    breadcrumbOf,
    buildGraph,
    descendantsOf,
    GroupGraph,
    linkProblem,
    MAX_HIERARCHY_LEVELS,
} from '../common/group-graph';
import { CustomerGroupEdge } from '../entities/customer-group-edge.entity';

import { JournalService } from './journal.service';
import { MembershipRulesService, resolveMemberScope } from './membership-rules.service';

export interface TreeEntry {
    group: CustomerGroup;
    parentIds: string[];
}

/** G1-G6: the customer group hierarchy, stored as parent → child edges. */
@Injectable()
export class HierarchyService implements OnModuleInit {
    constructor(
        private connection: TransactionalConnection,
        private membershipRules: MembershipRulesService,
        private eventBus: EventBus,
        private journal: JournalService,
    ) {}

    onModuleInit() {
        // G6: links of a deleted group disappear, its children become orphans. The FK cascade
        // does it on Postgres; this also covers databases that do not enforce foreign keys.
        this.eventBus.ofType(CustomerGroupEvent).subscribe(event => {
            if (event.type === 'deleted') {
                void this.removeEdgesOf(event.ctx, (event.entity as CustomerGroup).id ?? (event.input as ID));
            }
        });
    }

    async graph(ctx: RequestContext): Promise<GroupGraph> {
        const edges = await this.connection.getRepository(ctx, CustomerGroupEdge).find({ order: { id: 'ASC' } });
        return buildGraph(edges);
    }

    async addParent(ctx: RequestContext, childId: ID, parentId: ID): Promise<CustomerGroup> {
        const child = await this.membershipRules.loadProfile(ctx, childId);
        const parent = await this.membershipRules.loadProfile(ctx, parentId);
        const problem = linkProblem(await this.graph(ctx), childId, parentId);
        if (problem === 'self') {
            throw new CrmRuleError('crm-hierarchy-self');
        }
        if (problem === 'cycle') {
            throw new CrmRuleError('crm-hierarchy-cycle', { parentName: parent.name, childName: child.name });
        }
        if (problem === 'too-deep') {
            throw new CrmRuleError('crm-hierarchy-too-deep', { max: MAX_HIERARCHY_LEVELS });
        }
        if (resolveMemberScope(parent) === 'customers') {
            throw new CrmRuleError('crm-group-accepts-customers-only', { groupName: parent.name });
        }
        const repository = this.connection.getRepository(ctx, CustomerGroupEdge);
        const existing = await repository.findOne({ where: { parentId, childId } });
        if (!existing) {
            await repository.save(new CustomerGroupEdge({ parentId, childId }));
            await this.journal.record(ctx, childId, 'parent-added', { parentId, parentName: parent.name });
        }
        return this.connection.getEntityOrThrow(ctx, CustomerGroup, childId);
    }

    async removeParent(ctx: RequestContext, childId: ID, parentId: ID): Promise<CustomerGroup> {
        const result = await this.connection.getRepository(ctx, CustomerGroupEdge).delete({ parentId, childId });
        if (result.affected) {
            const parent = await this.membershipRules.loadProfile(ctx, parentId);
            await this.journal.record(ctx, childId, 'parent-removed', { parentId, parentName: parent.name });
        }
        return this.connection.getEntityOrThrow(ctx, CustomerGroup, childId);
    }

    async removeEdgesOf(ctx: RequestContext, groupId: ID): Promise<void> {
        const repository = this.connection.getRepository(ctx, CustomerGroupEdge);
        await repository.delete({ parentId: groupId });
        await repository.delete({ childId: groupId });
    }

    async parents(ctx: RequestContext, id: ID): Promise<CustomerGroup[]> {
        return this.load(ctx, (await this.graph(ctx)).parents.get(String(id)) ?? []);
    }

    async children(ctx: RequestContext, id: ID): Promise<CustomerGroup[]> {
        return this.load(ctx, (await this.graph(ctx)).children.get(String(id)) ?? []);
    }

    async ancestors(ctx: RequestContext, id: ID): Promise<CustomerGroup[]> {
        return this.load(ctx, ancestorsOf(await this.graph(ctx), id));
    }

    async descendantIds(ctx: RequestContext, id: ID): Promise<string[]> {
        return descendantsOf(await this.graph(ctx), id);
    }

    async breadcrumb(ctx: RequestContext, id: ID): Promise<CustomerGroup[]> {
        return this.load(ctx, breadcrumbOf(await this.graph(ctx), id));
    }

    async tree(ctx: RequestContext): Promise<TreeEntry[]> {
        const graph = await this.graph(ctx);
        const groups = await this.connection.getRepository(ctx, CustomerGroup).find({ order: { name: 'ASC' } });
        return groups.map(group => ({ group, parentIds: graph.parents.get(String(group.id)) ?? [] }));
    }

    /** Loads groups keeping the order of `ids`. */
    private async load(ctx: RequestContext, ids: string[]): Promise<CustomerGroup[]> {
        if (ids.length === 0) {
            return [];
        }
        const groups = await this.connection.getRepository(ctx, CustomerGroup).find({ where: { id: In(ids) } });
        const byId = new Map(groups.map(group => [String(group.id), group]));
        return ids.map(id => byId.get(id)).filter((group): group is CustomerGroup => !!group);
    }
}
