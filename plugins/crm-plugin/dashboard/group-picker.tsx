import { useLingui } from '@lingui/react/macro';
import { Button, NativeSelect, NativeSelectOption } from '@vendure/dashboard';
import { useState } from 'react';

export interface PickableGroup {
    id: string;
    name: string;
}

interface GroupPickerProps {
    groups: PickableGroup[];
    actionLabel: string;
    placeholder: string;
    disabled?: boolean;
    onPick: (groupId: string) => Promise<boolean>;
}

/** A group select plus an action button; resets after a successful action. */
export function GroupPicker({ groups, actionLabel, placeholder, disabled, onPick }: Readonly<GroupPickerProps>) {
    const { t } = useLingui();
    const [selected, setSelected] = useState('');

    if (groups.length === 0) {
        return null;
    }
    const pick = async () => {
        if (selected && (await onPick(selected))) {
            setSelected('');
        }
    };
    return (
        <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
                value={selected}
                onChange={event => setSelected(event.target.value)}
                disabled={disabled}
                aria-label={placeholder}
                className="max-w-full"
            >
                <NativeSelectOption value="">{placeholder}</NativeSelectOption>
                {groups.map(group => (
                    <NativeSelectOption key={group.id} value={group.id}>
                        {group.name}
                    </NativeSelectOption>
                ))}
            </NativeSelect>
            <Button variant="outline" size="sm" disabled={disabled || !selected} onClick={pick} title={t`Confirm`}>
                {actionLabel}
            </Button>
        </div>
    );
}

export function EmptyLine({ children }: Readonly<{ children: React.ReactNode }>) {
    return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function SectionLabel({ children }: Readonly<{ children: React.ReactNode }>) {
    return <p className="mb-1 text-xs font-medium text-muted-foreground">{children}</p>;
}
