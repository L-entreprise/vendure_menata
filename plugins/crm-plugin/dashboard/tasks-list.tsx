import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { api, Button, Checkbox, Input } from '@vendure/dashboard';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import { useCrmAction } from './use-crm-action';

export const createTaskDocument = graphql(`
    mutation CrmCreateTask($input: CreateCrmTaskInput!) {
        createCrmTask(input: $input) { id }
    }
`);
const setDoneDocument = graphql(`
    mutation CrmSetTaskDone($id: ID!, $done: Boolean!) {
        setCrmTaskDone(id: $id, done: $done) { id }
    }
`);
const deleteTaskDocument = graphql(`
    mutation CrmDeleteTask($id: ID!) {
        deleteCrmTask(id: $id) { result }
    }
`);

export interface CrmTaskRow {
    id: string;
    title: string;
    dueDate: string;
    done: boolean;
    isMine: boolean;
    assigneeName?: string | null;
    customer?: { id: string; firstName: string; lastName: string } | null;
    group?: { id: string; name: string } | null;
}

export interface TaskTarget {
    customerId?: string;
    groupId?: string;
    sourceNoteId?: string;
    sourceNoteKind?: 'customer' | 'group';
}

export function todayString(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatDay(day: string, locale: string): string {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** K1: "what and when" — the follow-up is always assigned to its author. */
export function TaskForm({ target, initialTitle = '', onDone }: Readonly<{ target: TaskTarget; initialTitle?: string; onDone?: () => void }>) {
    const { t } = useLingui();
    const [title, setTitle] = useState(initialTitle);
    const [dueDate, setDueDate] = useState(todayString());
    const { run, pending } = useCrmAction();
    const submit = async () => {
        if (await run(() => api.mutate(createTaskDocument, { input: { ...target, title, dueDate } }), t`Follow-up added`)) {
            setTitle('');
            onDone?.();
        }
    };
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Input value={title} onChange={event => setTitle(event.target.value)} placeholder={t`What to do`} aria-label={t`Follow-up`} className="min-w-[12rem] flex-1" />
            <Input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} aria-label={t`Due date`} className="w-auto" />
            <Button size="sm" disabled={pending || !title.trim() || !dueDate} onClick={submit}><Trans>Add the follow-up</Trans></Button>
        </div>
    );
}

/** K1 / K2: follow-ups with their due day; only the assignee ticks or deletes them. */
export function TasksList({ tasks, showTarget }: Readonly<{ tasks: CrmTaskRow[]; showTarget?: boolean }>) {
    const { t, i18n } = useLingui();
    const { run, pending } = useCrmAction();
    const today = todayString();
    if (tasks.length === 0) {
        return <p className="text-sm text-muted-foreground"><Trans>No follow-up.</Trans></p>;
    }
    return (
        <ul className="divide-y text-sm">
            {tasks.map(task => (
                <li key={task.id} className="flex items-start gap-3 py-2">
                    <Checkbox checked={task.done} disabled={!task.isMine || pending} aria-label={t`Done`}
                        onCheckedChange={checked => run(() => api.mutate(setDoneDocument, { id: task.id, done: checked === true }))} />
                    <div className="min-w-0 flex-1">
                        <p className={task.done ? 'text-muted-foreground line-through' : ''}>{task.title}</p>
                        <p className={`text-xs ${!task.done && task.dueDate < today ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                            {formatDay(task.dueDate, i18n.locale)}
                            {!task.isMine && task.assigneeName ? ` · ${task.assigneeName}` : ''}
                            {showTarget && task.customer && (
                                <> · <Link to="/customers/$id" params={{ id: task.customer.id }} className="hover:underline">{task.customer.firstName} {task.customer.lastName}</Link></>
                            )}
                            {showTarget && task.group && (
                                <> · <Link to="/customer-groups/$id" params={{ id: task.group.id }} className="hover:underline">{task.group.name}</Link></>
                            )}
                        </p>
                    </div>
                    {task.isMine && (
                        <Button variant="ghost" size="icon" disabled={pending} aria-label={t`Delete`}
                            onClick={() => run(() => api.mutate(deleteTaskDocument, { id: task.id }))}>
                            <Trash2Icon />
                        </Button>
                    )}
                </li>
            ))}
        </ul>
    );
}
