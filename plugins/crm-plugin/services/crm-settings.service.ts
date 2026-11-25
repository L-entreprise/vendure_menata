import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';

import { CrmRuleError } from '../common/crm-errors';
import { CrmSettingsValues, DEFAULT_CRM_SETTINGS, findSettingsProblem } from '../common/crm-settings-defaults';
import { CrmSettings } from '../entities/crm-settings.entity';

/** Reads and writes the single CRM settings row; defaults apply until the super admin saves. */
@Injectable()
export class CrmSettingsService {
    constructor(private connection: TransactionalConnection) {}

    async get(ctx: RequestContext): Promise<CrmSettingsValues> {
        const stored = await this.findRow(ctx);
        return stored ? toValues(stored) : { ...DEFAULT_CRM_SETTINGS };
    }

    async update(ctx: RequestContext, input: CrmSettingsValues): Promise<CrmSettingsValues> {
        const values = normalize(input);
        const problem = findSettingsProblem(values);
        if (problem) {
            throw new CrmRuleError('crm-settings-invalid', { reason: problem });
        }
        const repository = this.connection.getRepository(ctx, CrmSettings);
        const stored = await this.findRow(ctx);
        const saved = await repository.save(stored ? new CrmSettings({ ...stored, ...values }) : new CrmSettings(values));
        return toValues(saved);
    }

    private findRow(ctx: RequestContext): Promise<CrmSettings | null> {
        return this.connection
            .getRepository(ctx, CrmSettings)
            .findOne({ where: {}, order: { id: 'ASC' } });
    }
}

function toValues(row: CrmSettings): CrmSettingsValues {
    return {
        customerStatuses: row.customerStatuses,
        statusTransitions: row.statusTransitions ?? null,
        defaultStatus: row.defaultStatus,
        dormantThresholdDays: row.dormantThresholdDays ?? null,
        roleOptions: row.roleOptions,
        leadSourceOptions: row.leadSourceOptions,
    };
}

function trimOptions(options: CrmSettingsValues['roleOptions']) {
    return options.map(option => ({ code: option.code.trim(), label: option.label.trim() }));
}

function normalize(input: CrmSettingsValues): CrmSettingsValues {
    return {
        customerStatuses: trimOptions(input.customerStatuses),
        statusTransitions: input.statusTransitions?.length
            ? input.statusTransitions.map(transition => ({ from: transition.from, to: [...new Set(transition.to)] }))
            : null,
        defaultStatus: input.defaultStatus.trim(),
        dormantThresholdDays: input.dormantThresholdDays ?? null,
        roleOptions: trimOptions(input.roleOptions),
        leadSourceOptions: trimOptions(input.leadSourceOptions),
    };
}
