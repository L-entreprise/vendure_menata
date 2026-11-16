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
import { useEffect, useState } from 'react';

import { hasText } from '../shared/translation-progress';
import { TranslationRow } from '../shared/stale-translations';
import { useContentLanguages } from './use-languages';

// A record counts as just created for this long after its createdAt.
const JUST_CREATED_MS = 2 * 60 * 1000;
const STORAGE_PREFIX = 'content-i18n:created-prompt:';

/**
 * Right after a record is created in the original language: offer to translate it now.
 * Asked once per record and browser session.
 */
export function CreatedPrompt(props: { entityId: string; createdAt?: string; translations?: TranslationRow[] }) {
    const { defaultLanguage, targetLanguages, isTranslating, setContentLanguage } = useContentLanguages();
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const created = props.createdAt ? Date.parse(props.createdAt) : NaN;
        const justCreated = Number.isFinite(created) && Date.now() - created < JUST_CREATED_MS;
        const translated = (props.translations ?? []).some(
            row => row.languageCode !== defaultLanguage && hasText(String(row.name ?? '')),
        );
        if (!justCreated || translated || isTranslating || targetLanguages.length === 0) return;
        if (alreadyAsked(props.entityId)) return;
        markAsked(props.entityId);
        setOpen(true);
    }, [props.entityId, props.createdAt]);
    const first = targetLanguages[0];
    if (!first) return null;
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        <Trans>Created. Translate it now?</Trans>
                    </DialogTitle>
                    <DialogDescription>
                        <Trans>The site shows the original text in the other languages until they are translated.</Trans>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                        <Trans>Later</Trans>
                    </Button>
                    {targetLanguages.map(code => (
                        <Button
                            key={code}
                            type="button"
                            variant={code === first ? 'default' : 'outline'}
                            onClick={() => {
                                setContentLanguage(code);
                                setOpen(false);
                            }}
                        >
                            <Trans>Translate into {code.toUpperCase()}</Trans>
                        </Button>
                    ))}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function alreadyAsked(id: string): boolean {
    try {
        return sessionStorage.getItem(STORAGE_PREFIX + id) === '1';
    } catch {
        return false;
    }
}

function markAsked(id: string): void {
    try {
        sessionStorage.setItem(STORAGE_PREFIX + id, '1');
    } catch {
        // Private mode: the prompt may show again, which is harmless.
    }
}
