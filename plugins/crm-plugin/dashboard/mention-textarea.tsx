import { graphql } from '@/graphql/graphql';
import { useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { api, Textarea } from '@vendure/dashboard';
import { KeyboardEvent, useRef, useState } from 'react';

const mentionableDocument = graphql(`
    query CrmMentionable {
        crmMentionableAdministrators { id firstName lastName }
    }
`);

const MAX_SUGGESTIONS = 6;
/** "@" followed by up to two words being typed, at the caret. */
const TRIGGER = /@([\p{L}'-]*(?: [\p{L}'-]*)?)$/u;

interface MentionTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
}

/** K3: note input that suggests colleagues after "@" and inserts "@Prénom Nom". */
export function MentionTextarea({ value, onChange, placeholder, rows = 3 }: Readonly<MentionTextareaProps>) {
    const { t } = useLingui();
    const ref = useRef<HTMLTextAreaElement>(null);
    const [query, setQuery] = useState<string | null>(null);
    const [active, setActive] = useState(0);
    const { data } = useQuery({
        queryKey: ['crm-mentionable'],
        queryFn: () => api.query(mentionableDocument, {}) as Promise<any>,
        staleTime: 300_000,
    });
    const people: Array<{ id: string; name: string }> = (data?.crmMentionableAdministrators ?? []).map((p: any) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`.trim(),
    }));
    const matches = query === null ? [] : people.filter(p => p.name.toLowerCase().startsWith(query.toLowerCase())).slice(0, MAX_SUGGESTIONS);

    const update = (next: string, caret: number) => {
        onChange(next);
        const match = TRIGGER.exec(next.slice(0, caret));
        setQuery(match ? match[1] : null);
        setActive(0);
    };
    const insert = (name: string) => {
        const caret = ref.current?.selectionStart ?? value.length;
        const before = value.slice(0, caret).replace(TRIGGER, `@${name} `);
        onChange(before + value.slice(caret));
        setQuery(null);
        requestAnimationFrame(() => ref.current?.setSelectionRange(before.length, before.length));
    };
    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (matches.length === 0) {
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(index => (index + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
        } else if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            insert(matches[active].name);
        } else if (event.key === 'Escape') {
            setQuery(null);
        }
    };

    return (
        <div className="relative">
            <Textarea ref={ref} value={value} rows={rows} placeholder={placeholder} onKeyDown={onKeyDown}
                onChange={event => update(event.target.value, event.target.selectionStart)}
                aria-autocomplete="list" />
            {matches.length > 0 && (
                <ul role="listbox" aria-label={t`Colleagues`} className="absolute z-20 mt-1 w-64 rounded-md border bg-popover p-1 text-sm shadow-sm">
                    {matches.map((person, index) => (
                        <li key={person.id} role="option" aria-selected={index === active}>
                            <button type="button" className={`w-full rounded px-2 py-1 text-left ${index === active ? 'bg-accent text-accent-foreground' : ''}`}
                                onMouseDown={event => { event.preventDefault(); insert(person.name); }}>
                                {person.name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
