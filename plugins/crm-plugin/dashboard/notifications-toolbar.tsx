import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api, Button } from '@vendure/dashboard';
import { AtSignIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const notificationsDocument = graphql(`
    query CrmMyNotifications {
        myCrmNotifications { unreadCount items { id createdAt type read data } }
    }
`);
const markReadDocument = graphql(`
    mutation CrmMarkNotificationsRead($ids: [ID!]) { markCrmNotificationsRead(ids: $ids) }
`);

const REFRESH_MS = 60_000;

interface CrmNotificationRow {
    id: string;
    createdAt: string;
    type: string;
    read: boolean;
    data: Record<string, any>;
}

function NotificationLine({ notification }: Readonly<{ notification: CrmNotificationRow }>) {
    const data = notification.data;
    const author = data.authorName ?? '';
    const title = data.title ?? '';
    if (notification.type === 'mention') {
        return (
            <>
                <p className="font-medium"><Trans>{author} mentioned you</Trans>{data.targetName ? ` · ${data.targetName}` : ''}</p>
                <p className="line-clamp-2 text-muted-foreground">{data.excerpt}</p>
            </>
        );
    }
    return <p className="font-medium"><Trans>Follow-up due today: {title}</Trans></p>;
}

/** K4: badge and list of internal notifications in the toolbar. */
export function NotificationsToolbarItem() {
    const { t } = useLingui();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const panel = useRef<HTMLDivElement>(null);
    const { data } = useQuery({
        queryKey: ['crm-notifications'],
        queryFn: async () => ((await api.query(notificationsDocument, {})) as any).myCrmNotifications,
        refetchInterval: REFRESH_MS,
    });
    useEffect(() => {
        const close = (event: MouseEvent) => panel.current && !panel.current.contains(event.target as Node) && setOpen(false);
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const unread: number = data?.unreadCount ?? 0;
    const items: CrmNotificationRow[] = data?.items ?? [];
    const markRead = async (ids: string[] | null) => {
        await api.mutate(markReadDocument, { ids });
        await queryClient.invalidateQueries({ queryKey: ['crm-notifications'] });
    };
    const openTarget = async (notification: CrmNotificationRow) => {
        await markRead([notification.id]);
        setOpen(false);
        if (notification.data.customerId) {
            await navigate({ to: '/customers/$id', params: { id: notification.data.customerId } });
        } else if (notification.data.groupId) {
            await navigate({ to: '/customer-groups/$id', params: { id: notification.data.groupId } });
        }
    };

    return (
        <div ref={panel} className="relative">
            <Button variant="ghost" size="icon" aria-label={t`CRM notifications`} aria-expanded={open} onClick={() => setOpen(!open)}>
                <AtSignIcon />
                {unread > 0 && (
                    <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
                        {unread}
                    </span>
                )}
            </Button>
            {open && (
                <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border bg-popover text-sm text-popover-foreground shadow-sm">
                    <div className="flex items-center justify-between border-b px-3 py-2">
                        <span className="font-medium"><Trans>CRM notifications</Trans></span>
                        {unread > 0 && <button type="button" className="text-xs hover:underline" onClick={() => markRead(null)}><Trans>Mark all as read</Trans></button>}
                    </div>
                    {items.length === 0 ? (
                        <p className="px-3 py-4 text-muted-foreground"><Trans>No notification.</Trans></p>
                    ) : (
                        <ul className="max-h-96 overflow-auto">
                            {items.map(notification => (
                                <li key={notification.id}>
                                    <button type="button" onClick={() => openTarget(notification)}
                                        className={`w-full px-3 py-2 text-left hover:bg-accent ${notification.read ? 'opacity-70' : ''}`}>
                                        <NotificationLine notification={notification} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
