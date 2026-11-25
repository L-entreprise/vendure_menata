import { graphql } from '@/graphql/graphql';
import { useQuery } from '@tanstack/react-query';
import { api, PageContextValue, usePermissions } from '@vendure/dashboard';

import { TaskForm, TasksList, TaskTarget } from './tasks-list';

const tasksForDocument = graphql(`
    query CrmTasksFor($customerId: ID, $groupId: ID) {
        crmTasksFor(customerId: $customerId, groupId: $groupId) {
            id title dueDate done isMine assigneeName
        }
    }
`);

function TasksBlock({ target, writePermission }: Readonly<{ target: TaskTarget; writePermission: string }>) {
    const canWrite = usePermissions().hasPermissions([writePermission]);
    const { data } = useQuery({
        queryKey: ['crm-tasks-for', target.customerId, target.groupId],
        queryFn: () => api.query(tasksForDocument, { customerId: target.customerId, groupId: target.groupId }) as Promise<any>,
    });
    if (!data) {
        return null;
    }
    return (
        <div className="space-y-3">
            {canWrite && <TaskForm target={target} />}
            <TasksList tasks={data.crmTasksFor} />
        </div>
    );
}

/** K1: follow-ups about this customer (everyone's, only one's own can be ticked). */
export function CustomerTasksBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const id: string | undefined = context.entity?.id;
    return id ? <TasksBlock target={{ customerId: id }} writePermission="UpdateCustomer" /> : null;
}

/** K1: follow-ups about this group. */
export function GroupTasksBlock({ context }: Readonly<{ context: PageContextValue }>) {
    const id: string | undefined = context.entity?.id;
    return id ? <TasksBlock target={{ groupId: id }} writePermission="UpdateCustomerGroup" /> : null;
}
