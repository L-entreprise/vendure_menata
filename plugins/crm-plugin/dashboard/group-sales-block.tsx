import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api, Button, NativeSelect, NativeSelectOption, PageContextValue, useLocalFormat } from '@vendure/dashboard';
import { useState } from 'react';

const PAGE_SIZE = 25;
const STATES = ['PaymentSettled', 'PartiallyShipped', 'Shipped', 'PartiallyDelivered', 'Delivered', 'Cancelled'];

const salesDocument = graphql(`
    query CrmGroupSales($groupId: ID!, $from: DateTime, $options: CrmGroupOrdersOptions) {
        customerGroup(id: $groupId) { id crmGroupType crmChildren { id name } }
        crmGroupSalesSummary(groupId: $groupId, from: $from) { orderCount total totalWithTax averageWithTax lastOrderAt currencyCode }
        crmGroupOrders(groupId: $groupId, options: $options) {
            totalItems
            items {
                order { id code state orderPlacedAt totalWithTax currencyCode }
                company { id name }
                customer { id firstName lastName }
            }
        }
    }
`);

type Period = '12m' | 'year' | 'all';

function periodStart(period: Period): string | null {
    const now = new Date();
    if (period === 'all') {
        return null;
    }
    return period === 'year' ? new Date(now.getFullYear(), 0, 1).toISOString() : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
}

function Figure({ label, value }: Readonly<{ label: React.ReactNode; value: string }>) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
        </div>
    );
}

/** O2-O5: the orders of the company and its subsidiaries, with totals over the counted ones. */
export function GroupSalesBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const { t } = useLingui();
    const { formatCurrency, formatDate } = useLocalFormat();
    const groupId: string | undefined = context.entity?.id;
    const [period, setPeriod] = useState<Period>('12m');
    const [subsidiaryId, setSubsidiaryId] = useState('');
    const [state, setState] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [take, setTake] = useState(PAGE_SIZE);
    const from = periodStart(period);
    const { data } = useQuery({
        queryKey: ['crm-group-sales', groupId, period, subsidiaryId, state, customerId, take],
        queryFn: () => api.query(salesDocument, { groupId: groupId!, from, options: { from, subsidiaryId: subsidiaryId || null, states: state ? [state] : null, customerId: customerId || null, take } }) as Promise<any>,
        enabled: !!groupId,
    });
    if (!data || !['company', 'companyGroup'].includes(data.customerGroup?.crmGroupType)) {
        return null;
    }
    const summary = data.crmGroupSalesSummary;
    const currency = summary.currencyCode ?? data.crmGroupOrders.items[0]?.order.currencyCode ?? 'EUR';
    const money = (value: number) => formatCurrency(value, currency);
    const contacts = new Map<string, string>(data.crmGroupOrders.items.filter((row: any) => row.customer).map((row: any) => [row.customer.id, `${row.customer.firstName} ${row.customer.lastName}`]));

    return (
        <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
                <NativeSelect value={period} onChange={event => setPeriod(event.target.value as Period)} aria-label={t`Period`}>
                    <NativeSelectOption value="12m">{t`Last 12 months`}</NativeSelectOption>
                    <NativeSelectOption value="year">{t`This year`}</NativeSelectOption>
                    <NativeSelectOption value="all">{t`All time`}</NativeSelectOption>
                </NativeSelect>
                {data.customerGroup.crmChildren.length > 0 && (
                    <NativeSelect value={subsidiaryId} onChange={event => setSubsidiaryId(event.target.value)} aria-label={t`Subsidiary`}>
                        <NativeSelectOption value="">{t`All subsidiaries`}</NativeSelectOption>
                        {data.customerGroup.crmChildren.map((child: any) => <NativeSelectOption key={child.id} value={child.id}>{child.name}</NativeSelectOption>)}
                    </NativeSelect>
                )}
                <NativeSelect value={state} onChange={event => setState(event.target.value)} aria-label={t`State`}>
                    <NativeSelectOption value="">{t`All states`}</NativeSelectOption>
                    {STATES.map(code => <NativeSelectOption key={code} value={code}>{code}</NativeSelectOption>)}
                </NativeSelect>
                {(contacts.size > 1 || customerId) && (
                    <NativeSelect value={customerId} onChange={event => setCustomerId(event.target.value)} aria-label={t`Contact`}>
                        <NativeSelectOption value="">{t`All contacts`}</NativeSelectOption>
                        {[...contacts].map(([id, name]) => <NativeSelectOption key={id} value={id}>{name}</NativeSelectOption>)}
                    </NativeSelect>
                )}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Figure label={<Trans>Revenue excl. tax</Trans>} value={money(summary.total)} />
                <Figure label={<Trans>Revenue incl. tax</Trans>} value={money(summary.totalWithTax)} />
                <Figure label={<Trans>Orders</Trans>} value={String(summary.orderCount)} />
                <Figure label={<Trans>Average order</Trans>} value={money(summary.averageWithTax)} />
            </div>
            {summary.lastOrderAt && <p className="text-muted-foreground"><Trans>Last counted order:</Trans> {formatDate(summary.lastOrderAt)}</p>}
            <table className="w-full text-left">
                <thead className="text-xs text-muted-foreground">
                    <tr><th className="py-1 font-medium"><Trans>Order</Trans></th><th className="font-medium"><Trans>Date</Trans></th><th className="font-medium"><Trans>Subsidiary</Trans></th><th className="font-medium"><Trans>Contact</Trans></th><th className="font-medium"><Trans>State</Trans></th><th className="text-right font-medium"><Trans>Total incl. tax</Trans></th></tr>
                </thead>
                <tbody className="divide-y">
                    {data.crmGroupOrders.items.map((row: any) => (
                        <tr key={row.order.id}>
                            <td className="py-2"><Link to="/orders/$id" params={{ id: row.order.id }} className="font-mono hover:underline">{row.order.code}</Link></td>
                            <td>{row.order.orderPlacedAt ? formatDate(row.order.orderPlacedAt) : ''}</td>
                            <td>{row.company?.name ?? ''}</td>
                            <td>{row.customer ? `${row.customer.firstName} ${row.customer.lastName}` : ''}</td>
                            <td>{row.order.state}</td>
                            <td className="text-right tabular-nums">{formatCurrency(row.order.totalWithTax, row.order.currencyCode)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.crmGroupOrders.items.length === 0 && <p className="text-muted-foreground"><Trans>No order in this period.</Trans></p>}
            {data.crmGroupOrders.totalItems > take && (
                <Button variant="outline" size="sm" onClick={() => setTake(take + PAGE_SIZE)}><Trans>Show more</Trans></Button>
            )}
        </div>
    );
}
