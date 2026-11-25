import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

export interface CrmOption {
    code: string;
    label: string;
}

export interface CrmStatusTransition {
    from: string;
    to: string[];
}

/**
 * Single-row CRM configuration edited by the super admin on the "Réglages CRM" page
 * (CDC: statuses and transitions adjustable with the client without touching the code).
 */
@Entity()
export class CrmSettings extends VendureEntity {
    constructor(input?: DeepPartial<CrmSettings>) {
        super(input);
    }

    @Column('simple-json')
    customerStatuses: CrmOption[];

    /** null: free transitions (CDC default). */
    @Column('simple-json', { nullable: true })
    statusTransitions: CrmStatusTransition[] | null;

    @Column('varchar')
    defaultStatus: string;

    /** null: dormant state disabled (CDC: no threshold yet). */
    @Column('int', { nullable: true })
    dormantThresholdDays: number | null;

    @Column('simple-json')
    roleOptions: CrmOption[];

    @Column('simple-json')
    leadSourceOptions: CrmOption[];
}
