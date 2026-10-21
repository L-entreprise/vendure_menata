import { Trans } from '@lingui/react/macro';
import { ReactNode } from 'react';
import { Button, Card, CardContent, CardHeader } from '@vendure/dashboard';

import { FieldProgress } from '../translation-progress';

export type PanelStatus = 'loading' | 'failed' | 'ready';

/**
 * The frame every translation tab shares: what is left to do in the target language,
 * the save button, and the loading / error states.
 */
export function PanelShell({
    status,
    onRetry,
    progress,
    targetName,
    dirty,
    saving,
    onSave,
    children,
}: {
    status: PanelStatus;
    onRetry: () => void;
    progress: FieldProgress;
    targetName: string;
    dirty: boolean;
    saving: boolean;
    onSave: () => void;
    children: ReactNode;
}) {
    if (status === 'failed') {
        return (
            <div className="py-12 text-center text-muted-foreground">
                <Trans>This tab could not be loaded.</Trans>{' '}
                <Button type="button" variant="link" onClick={onRetry}>
                    <Trans>Try again</Trans>
                </Button>
            </div>
        );
    }
    if (status === 'loading') {
        return <div className="py-12 text-center text-muted-foreground"><Trans>Loading...</Trans></div>;
    }
    const remaining = progress.total - progress.translated;
    return (
        <Card className="mt-4">
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                        {progress.total === 0 ? (
                            <Trans>Nothing to translate here.</Trans>
                        ) : remaining === 0 ? (
                            <Trans>Everything is translated into {targetName}.</Trans>
                        ) : (
                            <Trans>
                                {remaining} of {progress.total} fields left to translate into {targetName}.
                            </Trans>
                        )}
                    </p>
                    <Button type="button" disabled={!dirty || saving} onClick={onSave}>
                        <Trans>Save</Trans>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

export function PanelEmpty({ children }: { children: ReactNode }) {
    return <div className="py-10 text-center text-muted-foreground">{children}</div>;
}
