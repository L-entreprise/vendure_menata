import { graphql } from '@/graphql/graphql';
import { i18n } from '@lingui/core';
import { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
    api,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    DashboardBaseWidget,
    DashboardRouteDefinition,
    DashboardWidgetDefinition,
    Page,
    PageTitle,
} from '@vendure/dashboard';
import { ListTodoIcon } from 'lucide-react';

import { CRM_NAV_SECTION } from './constants';
import { CrmTaskRow, TasksList } from './tasks-list';

const myTasksDocument = graphql(`
    query CrmMyTasks($bucket: CrmTaskBucket!) {
        myCrmTasks(bucket: $bucket) {
            id title dueDate done isMine
            customer { id firstName lastName }
            group { id name }
        }
    }
`);

type Bucket = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'DONE';

const BUCKET_TITLES: Record<Bucket, MessageDescriptor> = {
    OVERDUE: msg`Overdue`,
    TODAY: msg`Today`,
    UPCOMING: msg`Upcoming`,
    DONE: msg`Done recently`,
};

function useMyTasks(bucket: Bucket) {
    return useQuery({
        queryKey: ['crm-my-tasks', bucket],
        queryFn: async () => ((await api.query(myTasksDocument, { bucket })) as any).myCrmTasks as CrmTaskRow[],
    });
}

function BucketCard({ bucket }: Readonly<{ bucket: Bucket }>) {
    const { i18n: lingui } = useLingui();
    const { data } = useMyTasks(bucket);
    return (
        <Card>
            <CardHeader>
                <CardTitle>{lingui._(BUCKET_TITLES[bucket])}{data ? ` (${data.length})` : ''}</CardTitle>
            </CardHeader>
            <CardContent>{data && <TasksList tasks={data} showTarget />}</CardContent>
        </Card>
    );
}

/** K2: my follow-ups: overdue, today, upcoming. */
function TasksPage() {
    return (
        <Page pageId="crm-tasks">
            <PageTitle><Trans>My follow-ups</Trans></PageTitle>
            <div className="mt-4 grid max-w-4xl gap-6">
                {(['OVERDUE', 'TODAY', 'UPCOMING', 'DONE'] as Bucket[]).map(bucket => <BucketCard key={bucket} bucket={bucket} />)}
            </div>
        </Page>
    );
}

export const crmTasksRoute: DashboardRouteDefinition = {
    path: '/crm/tasks',
    loader: () => ({ breadcrumb: () => i18n._(msg`My follow-ups`) }),
    component: () => <TasksPage />,
    navMenuItem: { id: 'crm-tasks', title: 'Mes relances', sectionId: CRM_NAV_SECTION, icon: ListTodoIcon, order: 100 },
};

/** K2 widget: overdue and today's follow-ups on the home dashboard. */
function TasksWidget({ id, config }: Readonly<{ id: string; config?: any }>) {
    const { t } = useLingui();
    const overdue = useMyTasks('OVERDUE').data ?? [];
    const today = useMyTasks('TODAY').data ?? [];
    return (
        <DashboardBaseWidget id={id} config={config} title={t`My follow-ups`}>
            <div className="space-y-3 overflow-auto">
                <TasksList tasks={[...overdue, ...today]} showTarget />
                <Link to="/crm/tasks" className="text-sm hover:underline"><Trans>See all my follow-ups</Trans></Link>
            </div>
        </DashboardBaseWidget>
    );
}

export const crmTasksWidget: DashboardWidgetDefinition = {
    id: 'crm-my-tasks',
    name: 'Mes relances',
    component: TasksWidget as any,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 3 },
};
