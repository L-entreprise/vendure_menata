import { CustomerGroup, DeepPartial, EntityId, ID, VendureEntity } from '@vendure/core';
import { Entity, Index, ManyToOne, Unique } from 'typeorm';

/**
 * G1 / G2: a parent → child link between two customer groups. A group may have several
 * parents (e.g. its company group and a sales portfolio). Deleting either side removes
 * the link, so the children of a deleted parent become orphans (G6).
 */
@Entity()
@Unique(['parentId', 'childId'])
export class CustomerGroupEdge extends VendureEntity {
    constructor(input?: DeepPartial<CustomerGroupEdge>) {
        super(input);
    }

    @ManyToOne(() => CustomerGroup, { onDelete: 'CASCADE' })
    parent: CustomerGroup;

    @EntityId()
    @Index()
    parentId: ID;

    @ManyToOne(() => CustomerGroup, { onDelete: 'CASCADE' })
    child: CustomerGroup;

    @EntityId()
    @Index()
    childId: ID;
}
