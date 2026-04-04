import { DeepPartial } from '@vendure/common/lib/shared-types';
import { Channel, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

@Entity()
export class TranslationLanguage extends VendureEntity {
    constructor(input?: DeepPartial<TranslationLanguage>) {
        super(input);
    }

    @Column({ length: 10 })
    @Index({ unique: false })
    code: string;

    @Column({ length: 100 })
    name: string;

    @Column({ default: true })
    enabled: boolean;

    @Column({ default: false })
    isDefault: boolean;

    @Column({ default: 0 })
    position: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
