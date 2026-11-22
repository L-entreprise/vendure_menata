import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
    MutationDeleteCustomerNoteArgs,
    MutationUpdateCustomerNoteArgs,
    Permission,
} from '@vendure/common/lib/generated-types';
import { Allow, Ctx, CustomerService, RequestContext, Transaction } from '@vendure/core';

import { NoteOwnershipService } from '../services/note-ownership.service';

/**
 * Replaces the native `updateCustomerNote` and `deleteCustomerNote` mutations (same
 * names, same permissions, same service calls) to enforce N3: Vendure itself only checks
 * `UpdateCustomer`, so any sales rep could rewrite a colleague's note.
 */
@Resolver()
export class CustomerNoteGuardResolver {
    constructor(
        private customerService: CustomerService,
        private noteOwnership: NoteOwnershipService,
    ) {}

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer)
    async updateCustomerNote(@Ctx() ctx: RequestContext, @Args() args: MutationUpdateCustomerNoteArgs) {
        await this.noteOwnership.assertCanEdit(ctx, args.input.noteId);
        return this.customerService.updateCustomerNote(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer)
    async deleteCustomerNote(@Ctx() ctx: RequestContext, @Args() args: MutationDeleteCustomerNoteArgs) {
        await this.noteOwnership.assertCanDelete(ctx, args.id);
        return this.customerService.deleteCustomerNote(ctx, args.id);
    }
}
