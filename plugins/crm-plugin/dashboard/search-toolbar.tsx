import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api, Input } from '@vendure/dashboard';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';

const searchDocument = graphql(`
    query CrmToolbarSearch($term: String!) {
        crmSearch(term: $term) {
            customers { id crmCode firstName lastName emailAddress }
            groups { id crmCode name crmGroupType }
        }
    }
`);

const DEBOUNCE_MS = 250;
const MIN_LENGTH = 2;

interface Hit {
    key: string;
    to: '/customers/$id' | '/customer-groups/$id';
    id: string;
    title: string;
    detail: string;
}

/** S1: one field for customers, companies, e-mails and CLI- / GRP- codes, results grouped by type. */
export function SearchToolbarItem() {
    const { t } = useLingui();
    const navigate = useNavigate();
    const box = useRef<HTMLDivElement>(null);
    const [value, setValue] = useState('');
    const [term, setTerm] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    useEffect(() => {
        const timer = setTimeout(() => setTerm(value.trim()), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [value]);
    useEffect(() => {
        const close = (event: MouseEvent) => box.current && !box.current.contains(event.target as Node) && setOpen(false);
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);
    const { data } = useQuery({
        queryKey: ['crm-search', term],
        queryFn: async () => ((await api.query(searchDocument, { term })) as any).crmSearch,
        enabled: term.length >= MIN_LENGTH,
    });

    const customers: Hit[] = (data?.customers ?? []).map((c: any) => ({ key: `c${c.id}`, to: '/customers/$id', id: c.id, title: `${c.firstName} ${c.lastName}`, detail: `${c.crmCode} · ${c.emailAddress}` }));
    const groups: Hit[] = (data?.groups ?? []).map((g: any) => ({ key: `g${g.id}`, to: '/customer-groups/$id', id: g.id, title: g.name, detail: g.crmCode }));
    const hits = [...customers, ...groups];
    const go = async (hit: Hit) => {
        setOpen(false);
        setValue('');
        await navigate({ to: hit.to, params: { id: hit.id } });
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(index => (hits.length ? (index + (event.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length : 0));
        } else if (event.key === 'Enter' && hits[active]) {
            void go(hits[active]);
        } else if (event.key === 'Escape') {
            setOpen(false);
        }
    };
    const section = (title: React.ReactNode, list: Hit[], offset: number) =>
        list.length > 0 && (
            <div>
                <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">{title}</p>
                <ul>
                    {list.map((hit, index) => (
                        <li key={hit.key}>
                            <button type="button" onMouseDown={event => { event.preventDefault(); void go(hit); }}
                                className={`w-full px-3 py-1.5 text-left ${offset + index === active ? 'bg-accent text-accent-foreground' : ''}`}>
                                <span className="block truncate">{hit.title}</span>
                                <span className={`block truncate text-xs ${offset + index === active ? 'opacity-85' : 'text-muted-foreground'}`}>{hit.detail}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        );

    return (
        <div ref={box} className="relative hidden md:block">
            <Input value={value} placeholder={t`Search the CRM…`} aria-label={t`Search the CRM`} className="h-8 w-56"
                onChange={event => { setValue(event.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
            {open && term.length >= MIN_LENGTH && data && (
                <div className="absolute right-0 z-50 mt-1 w-80 rounded-md border bg-popover pb-2 text-sm text-popover-foreground shadow-sm">
                    {hits.length === 0 && <p className="px-3 pt-2 text-muted-foreground"><Trans>No result.</Trans></p>}
                    {section(<Trans>Customers</Trans>, customers, 0)}
                    {section(<Trans>Groups and companies</Trans>, groups, customers.length)}
                </div>
            )}
        </div>
    );
}
