import { Trans } from '@lingui/react/macro';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@vendure/dashboard';

export interface StaleTranslationsDialogProps {
    open: boolean;
    /** Labels of the original fields that changed. */
    fields: string[];
    /** Language of the original. */
    sourceLanguage: string;
    /** Languages that hold a translation of those fields. */
    languages: string[];
    busy?: boolean;
    onKeep: () => void;
    onClear: () => void;
    onTranslate: (languageCode: string) => void;
}

/**
 * Asked after the original text was saved with changes while translations of it exist:
 * keep them, clear them (the site then shows the original), or go translate now.
 * Shared with the CMS plugin.
 */
export function StaleTranslationsDialog(props: StaleTranslationsDialogProps) {
    const { open, fields, sourceLanguage, languages, busy, onKeep, onClear, onTranslate } = props;
    const fieldList = fields.join(', ');
    const source = sourceLanguage.toUpperCase();
    const languageList = languages.map(code => code.toUpperCase()).join(', ');
    const first = languages[0];
    return (
        <Dialog open={open} onOpenChange={next => !next && onKeep()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        <Trans>The original text changed</Trans>
                    </DialogTitle>
                    <DialogDescription>
                        <Trans>
                            {fieldList} changed in {source}. These translations may be out of date: {languageList}.
                        </Trans>
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                    <Trans>Clearing them shows the original text on the site until they are translated again.</Trans>
                </p>
                <DialogFooter className="gap-2">
                    <Button type="button" variant="ghost" disabled={busy} onClick={onKeep}>
                        <Trans>Keep</Trans>
                    </Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={onClear}>
                        <Trans>Clear in {languageList}</Trans>
                    </Button>
                    {first && (
                        <Button type="button" disabled={busy} onClick={() => onTranslate(first)}>
                            <Trans>Translate now ({first.toUpperCase()})</Trans>
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
