import { Trans, useLingui } from '@lingui/react/macro';
import { Input, Switch, Textarea } from '@vendure/dashboard';

/**
 * Expert-mode inputs for how a field is presented to the client, stored in the block's
 * `metadata`: its section (panel), whether that section starts collapsed, and a help
 * line. `[label](/products)` in the help links to a dashboard screen.
 */
export function BlockLayoutFields({
    block,
    index,
    onMetadataChange,
    helpOnly = false,
}: {
    block: any;
    index: number;
    onMetadataChange: (index: number, key: string, value: any) => void;
    helpOnly?: boolean;
}) {
    const { t } = useLingui();
    return (
        <div className="grid gap-4 mt-4 @md:grid-cols-2">
            {!helpOnly && (
                <div>
                    <label className="text-sm font-medium"><Trans>Section</Trans></label>
                    <Input
                        value={String(block.metadata?.section ?? '')}
                        onChange={e => onMetadataChange(index, 'section', e.target.value)}
                        placeholder={t`e.g. Top of page`}
                        className="mt-1"
                    />
                    <label className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Switch
                            checked={block.metadata?.sectionCollapsed === true}
                            onCheckedChange={checked => onMetadataChange(index, 'sectionCollapsed', checked)}
                        />
                        <Trans>Section starts collapsed</Trans>
                    </label>
                </div>
            )}
            <div className={helpOnly ? '@md:col-span-2' : ''}>
                <label className="text-sm font-medium"><Trans>Help</Trans></label>
                <Textarea
                    value={String(block.metadata?.help ?? '')}
                    onChange={e => onMetadataChange(index, 'help', e.target.value)}
                    placeholder={t`Shown under the field. Link with [text](/products).`}
                    rows={2}
                    className="mt-1"
                />
            </div>
        </div>
    );
}
