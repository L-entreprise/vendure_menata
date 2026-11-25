import { useLingui } from '@lingui/react/macro';

import { GROUP_TYPE_LABELS, LIFECYCLE_LABELS } from './group-labels';

/** G7: group type label in the customer group list. */
export function GroupTypeCell({ value }: Readonly<{ value?: string | null }>) {
    const { i18n } = useLingui();
    return <span>{value && GROUP_TYPE_LABELS[value] ? i18n._(GROUP_TYPE_LABELS[value]) : ''}</span>;
}

/** T4: prospect / client / dormant in the customer group list. */
export function LifecycleCell({ value }: Readonly<{ value?: string | null }>) {
    const { i18n } = useLingui();
    return <span>{value && LIFECYCLE_LABELS[value] ? i18n._(LIFECYCLE_LABELS[value]) : ''}</span>;
}
