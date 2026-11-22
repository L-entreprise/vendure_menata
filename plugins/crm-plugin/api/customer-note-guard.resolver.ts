import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
    HistoryEntryType,
    MutationDeleteCustomerNoteArgs,
    MutationDeleteOrderNoteArgs,
    MutationUpdateCustomerNoteArgs,
    MutationUpdateOrderNoteArgs,
    Permission,
} from '@vendure/common/lib/generated-types';
import {
    Allow,
    Ctx,
    CustomerService,
    ID,
    OrderService,
    RequestContext,
    Transaction,
    TransactionalConnection,
} from '@vendure/core';

import { CrmRuleError } from '../common/crm-errors';
import { customerHistoryEntity } from '../common/history-entities';
import { NoteOwnershipService } from '../services/note-ownership.service';

/**
 * Replaces the native note mutations (same names, permissions and service calls) to enforce
 * N3 on customer and order notes: Vendure itself only checks UpdateCustomer / UpdateOrder,
 * so any sales rep could rewrite a colleague's note.
 */
@Resolver()
export class CustomerNoteGuardResolver {
    constructor(
        private customerService: CustomerService,
        private orderService: OrderService,
        private noteOwnership: NoteOwnershipService,
        private connection: TransactionalConnection,
    ) {}

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer)
    async updateCustomerNote(@Ctx() ctx: RequestContext, @Args() args: MutationUpdateCustomerNoteArgs) {
        await this.noteOwnership.assertCanEdit(ctx, args.input.noteId, 'customer');
        return this.customerService.updateCustomerNote(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer)
    async deleteCustomerNote(@Ctx() ctx: RequestContext, @Args() args: MutationDeleteCustomerNoteArgs) {
        await this.noteOwnership.assertCanDelete(ctx, args.id, 'customer');
        return this.customerService.deleteCustomerNote(ctx, args.id);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateOrder)
    async updateOrderNote(@Ctx() ctx: RequestContext, @Args() args: MutationUpdateOrderNoteArgs) {
        await this.noteOwnership.assertCanEdit(ctx, args.input.noteId, 'order');
        return this.orderService.updateOrderNote(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateOrder)
    async deleteOrderNote(@Ctx() ctx: RequestContext, @Args() args: MutationDeleteOrderNoteArgs) {
        await this.noteOwnership.assertCanDelete(ctx, args.id, 'order');
        return this.orderService.deleteOrderNote(ctx, args.id);
    }

    /** N2: pinning is shared and does not change the text, so any sales rep may pin. */
    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer)
    async setCustomerNotePinned(@Ctx() ctx: RequestContext, @Args() args: { noteId: ID; pinned: boolean }) {
        const entity = customerHistoryEntity(this.connection);
        const note = await this.connection.getEntityOrThrow(ctx, entity, args.noteId);
        if (note.type !== HistoryEntryType.CUSTOMER_NOTE) {
            throw new CrmRuleError('crm-pin-not-a-note');
        }
        // Only the pinned column is written: other custom fields keep their current value.
        await this.connection.getRepository(ctx, entity).update({ id: note.id }, { customFields: { pinned: args.pinned } } as any);
        return this.connection.getEntityOrThrow(ctx, entity, note.id);
    }
}
