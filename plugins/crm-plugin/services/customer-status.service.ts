import { Injectable } from '@nestjs/common';
import { Customer, HistoryService, ID, RequestContext, TransactionalConnection } from '@vendure/core';

import { CrmRuleError } from '../common/crm-errors';
import { CUSTOMER_STATUS_CHANGED } from '../common/history-types';

import { CrmSettingsService } from './crm-settings.service';

type StatusFields = { crmStatus?: string | null };

/** C3 / C4: custom customer status with optional allowed transitions, logged in the history. */
@Injectable()
export class CustomerStatusService {
    constructor(
        private connection: TransactionalConnection,
        private settingsService: CrmSettingsService,
        private historyService: HistoryService,
    ) {}

    async effectiveStatus(ctx: RequestContext, customer: Customer): Promise<string> {
        const stored = (customer.customFields as StatusFields | undefined)?.crmStatus;
        return stored ?? (await this.settingsService.get(ctx)).defaultStatus;
    }

    async setStatus(ctx: RequestContext, customerId: ID, status: string): Promise<Customer> {
        const customer = await this.connection.getEntityOrThrow(ctx, Customer, customerId);
        const settings = await this.settingsService.get(ctx);
        const from = await this.effectiveStatus(ctx, customer);
        if (!settings.customerStatuses.some(option => option.code === status)) {
            throw new CrmRuleError('crm-status-unknown', { status });
        }
        if (from === status) {
            return customer;
        }
        // A status removed from the settings has no transitions left: any listed status is allowed
        // from it, otherwise its customers would be stuck.
        const fromIsListed = settings.customerStatuses.some(option => option.code === from);
        const allowed = settings.statusTransitions?.find(transition => transition.from === from)?.to;
        if (settings.statusTransitions && fromIsListed && !allowed?.includes(status)) {
            throw new CrmRuleError('crm-status-transition-not-allowed', { from, to: status });
        }
        await this.connection
            .getRepository(ctx, Customer)
            .update({ id: customer.id }, { customFields: { crmStatus: status } } as any);
        await this.historyService.createHistoryEntryForCustomer({
            ctx,
            customerId: customer.id,
            type: CUSTOMER_STATUS_CHANGED as any,
            data: { from, to: status },
        });
        return this.connection.getEntityOrThrow(ctx, Customer, customer.id);
    }
}
