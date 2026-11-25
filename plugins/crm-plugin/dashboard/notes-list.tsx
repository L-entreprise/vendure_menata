import { Trans, useLingui } from '@lingui/react/macro';
import { Button } from '@vendure/dashboard';
import { BellPlusIcon, PencilIcon, PinIcon, PinOffIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import { MentionTextarea } from './mention-textarea';
import { TaskForm, TaskTarget } from './tasks-list';

export interface CrmNote {
    id: string;
    text: string;
    createdAt: string;
    authorName: string | null;
    pinned: boolean;
    isMine: boolean;
}

export interface NotesActions {
    add: (text: string) => Promise<boolean>;
    edit: (id: string, text: string) => Promise<boolean>;
    remove: (id: string) => Promise<boolean>;
    pin: (id: string, pinned: boolean) => Promise<boolean>;
}

interface NotesListProps {
    notes: CrmNote[];
    actions: NotesActions;
    canWrite: boolean;
    /** Super admin: may delete anyone's note (never edit it). */
    canDeleteAny: boolean;
    pending: boolean;
    /** K1: where a follow-up created from a note points to. */
    followUpTarget?: (note: CrmNote) => TaskTarget;
}

function byPinThenDate(a: CrmNote, b: CrmNote) {
    return Number(b.pinned) - Number(a.pinned) || a.createdAt.localeCompare(b.createdAt);
}

function NoteEditor({ initial, onSave, onCancel, pending }: Readonly<{ initial: string; onSave: (text: string) => void; onCancel?: () => void; pending: boolean }>) {
    const { t } = useLingui();
    const [text, setText] = useState(initial);
    return (
        <div className="space-y-2">
            <MentionTextarea value={text} onChange={setText} placeholder={t`Write a note… (@ to mention a colleague)`} />
            <div className="flex gap-2">
                <Button size="sm" disabled={pending || !text.trim()} onClick={() => onSave(text)}>
                    {initial ? <Trans>Save</Trans> : <Trans>Add the note</Trans>}
                </Button>
                {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}><Trans>Cancel</Trans></Button>}
            </div>
        </div>
    );
}

/**
 * N2 / N3 / N4: hand-written notes, pinned ones first, apart from the timeline. Only the
 * author edits or deletes a note; the super admin may delete any note.
 */
export function NotesList({ notes, actions, canWrite, canDeleteAny, pending, followUpTarget }: Readonly<NotesListProps>) {
    const { t, i18n } = useLingui();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [followUpId, setFollowUpId] = useState<string | null>(null);
    const [draftKey, setDraftKey] = useState(0);
    const formatDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.locale, { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="space-y-4 text-sm">
            {canWrite && (
                <NoteEditor key={draftKey} initial="" pending={pending}
                    onSave={async text => (await actions.add(text)) && setDraftKey(key => key + 1)} />
            )}
            {notes.length === 0 && <p className="text-muted-foreground"><Trans>No note yet.</Trans></p>}
            <ul className="divide-y">
                {[...notes].sort(byPinThenDate).map(note => (
                    <li key={note.id} className="py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-xs text-muted-foreground">
                            <span>
                                {note.pinned && <span className="mr-2 font-medium text-foreground"><Trans>Pinned</Trans></span>}
                                {note.authorName ?? t`Unknown author`} · {formatDate(note.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                                {followUpTarget && canWrite && (
                                    <Button variant="ghost" size="icon" aria-label={t`Add a follow-up`} onClick={() => setFollowUpId(followUpId === note.id ? null : note.id)}>
                                        <BellPlusIcon />
                                    </Button>
                                )}
                                {canWrite && (
                                    <Button variant="ghost" size="icon" disabled={pending} aria-label={note.pinned ? t`Unpin` : t`Pin`}
                                        onClick={() => actions.pin(note.id, !note.pinned)}>
                                        {note.pinned ? <PinOffIcon /> : <PinIcon />}
                                    </Button>
                                )}
                                {note.isMine && (
                                    <Button variant="ghost" size="icon" disabled={pending} aria-label={t`Edit`} onClick={() => setEditingId(note.id)}>
                                        <PencilIcon />
                                    </Button>
                                )}
                                {(note.isMine || canDeleteAny) && (
                                    <Button variant="ghost" size="icon" disabled={pending} aria-label={t`Delete`} onClick={() => actions.remove(note.id)}>
                                        <Trash2Icon />
                                    </Button>
                                )}
                            </span>
                        </div>
                        {editingId === note.id ? (
                            <div className="mt-2">
                                <NoteEditor initial={note.text} pending={pending} onCancel={() => setEditingId(null)}
                                    onSave={async text => (await actions.edit(note.id, text)) && setEditingId(null)} />
                            </div>
                        ) : (
                            <p className="mt-1 whitespace-pre-wrap">{note.text}</p>
                        )}
                        {followUpTarget && followUpId === note.id && (
                            <div className="mt-2">
                                <TaskForm target={followUpTarget(note)} initialTitle={note.text.slice(0, 120)} onDone={() => setFollowUpId(null)} />
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
