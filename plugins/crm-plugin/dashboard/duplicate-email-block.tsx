import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api, PageContextValue } from '@vendure/dashboard';
import { useEffect, useState } from 'react';

const byEmailDocument = graphql(`
    query CrmCustomerByEmail($email: String!) {
        crmCustomerByEmail(email: $email) { id crmCode firstName lastName }
    }
`);

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEBOUNCE_MS = 400;

/**
 * D2: on the new customer page, warns as soon as the e-mail is already known and links to
 * the existing customer, instead of the bare "e-mail already exists" error on save.
 */
export function DuplicateEmailBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const watched: string = context.form?.watch('emailAddress') ?? '';
    const [email, setEmail] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setEmail(watched.trim()), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [watched]);
    const { data } = useQuery({
        queryKey: ['crm-customer-by-email', email.toLowerCase()],
        queryFn: async () => ((await api.query(byEmailDocument, { email })) as any).crmCustomerByEmail,
        enabled: EMAIL_LIKE.test(email),
    });
    if (!data || !EMAIL_LIKE.test(email)) {
        return <p className="text-sm text-muted-foreground"><Trans>The e-mail is checked against existing customers as you type.</Trans></p>;
    }
    const name = `${data.firstName} ${data.lastName}`.trim();
    return (
        <p className="text-sm text-destructive">
            <Trans>This e-mail already belongs to</Trans>{' '}
            <Link to="/customers/$id" params={{ id: data.id }} className="font-medium underline">{name || data.crmCode}</Link> ({data.crmCode})
        </p>
    );
}
