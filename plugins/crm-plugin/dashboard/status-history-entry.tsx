import { Trans } from '@lingui/react/macro';
import { HistoryEntry } from '@vendure/dashboard';
import { ArrowRightLeftIcon, MergeIcon } from 'lucide-react';

import { optionLabel, useCrmSettings } from './use-crm-settings';

/** C4: "Statut : Actif → Parti (par Alexandre)" in the customer timeline. */
export function StatusHistoryEntry({ entry }: Readonly<{ entry: any }>) {
    const { data: settings } = useCrmSettings();
    const from = optionLabel(settings?.customerStatuses, entry.data?.from);
    const to = optionLabel(settings?.customerStatuses, entry.data?.to);
    return (
        <HistoryEntry entry={entry} title={<Trans>Status changed</Trans>} timelineIcon={<ArrowRightLeftIcon />}>
            <p className="text-sm">
                {from} → {to}
            </p>
        </HistoryEntry>
    );
}

/** D3: "Fusionné avec CLI-000123 (ancien e-mail)" in the customer timeline. */
export function MergedHistoryEntry({ entry }: Readonly<{ entry: any }>) {
    const code = entry.data?.sourceCode ?? '';
    const email = entry.data?.sourceEmail ?? '';
    return (
        <HistoryEntry entry={entry} title={<Trans>Duplicate merged</Trans>} timelineIcon={<MergeIcon />}>
            <p className="text-sm">
                <Trans>Merged from {code} ({email})</Trans>
            </p>
        </HistoryEntry>
    );
}
