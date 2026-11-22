import { Trans, useLingui } from '@lingui/react/macro';
import { Button, Input } from '@vendure/dashboard';
import { PlusIcon, Trash2Icon } from 'lucide-react';

import { CrmOption } from './use-crm-settings';

/** Turns a label into a stable code: "Décideur final" -> "decideur-final". */
export function codeFromLabel(label: string): string {
    return label
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

interface OptionsEditorProps {
    options: CrmOption[];
    onChange: (options: CrmOption[]) => void;
    /** Codes already stored on records keep their code when the label changes. */
    lockedCodes?: Set<string>;
}

/** Editable list of code/label pairs (statuses, roles, lead sources). The code follows the label until saved. */
export function OptionsEditor({ options, onChange, lockedCodes }: Readonly<OptionsEditorProps>) {
    const { t } = useLingui();

    const update = (index: number, label: string) => {
        const next = options.map((option, i) =>
            i === index ? { label, code: lockedCodes?.has(option.code) ? option.code : codeFromLabel(label) } : option,
        );
        onChange(next);
    };

    return (
        <div className="space-y-2">
            {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                    <Input
                        value={option.label}
                        onChange={event => update(index, event.target.value)}
                        aria-label={t`Label`}
                        className="max-w-xs"
                    />
                    <code className="text-xs text-muted-foreground">{option.code}</code>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t`Remove`}
                        onClick={() => onChange(options.filter((_, i) => i !== index))}
                    >
                        <Trash2Icon />
                    </Button>
                </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => onChange([...options, { code: '', label: '' }])}>
                <PlusIcon />
                <Trans>Add</Trans>
            </Button>
        </div>
    );
}
