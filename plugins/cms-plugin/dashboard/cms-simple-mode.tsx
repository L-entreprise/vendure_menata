import { Trans } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { Switch, usePermissions } from '@vendure/dashboard';

const STORAGE_KEY = 'menata.cms.expertMode';
const CHANGE_EVENT = 'menata-cms-expert-mode';

function readExpertFlag(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export interface CmsSimpleMode {
    /** True when structure (keys, types, adding/removing fields, page settings) is hidden. */
    simple: boolean;
    /** Only SuperAdmins (the agency) can switch to expert mode. */
    canToggle: boolean;
    setExpert: (expert: boolean) => void;
}

/**
 * Simple mode is the default for everyone: the client only sees what they edit.
 * The agency switches to expert mode per browser; it is a display preference,
 * not a permission (the API keeps enforcing who may change structure).
 */
export function useCmsSimpleMode(): CmsSimpleMode {
    const { hasPermissions } = usePermissions();
    const canToggle = hasPermissions(['SuperAdmin']);
    const [expert, setExpertState] = useState(readExpertFlag);

    useEffect(() => {
        const sync = () => setExpertState(readExpertFlag());
        window.addEventListener(CHANGE_EVENT, sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener(CHANGE_EVENT, sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const setExpert = useCallback((value: boolean) => {
        try {
            localStorage.setItem(STORAGE_KEY, String(value));
        } catch {
            // Storage blocked: the switch still works for this page view.
        }
        setExpertState(value);
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    return { simple: !(canToggle && expert), canToggle, setExpert };
}

export function ExpertModeSwitch({ mode }: { mode: CmsSimpleMode }) {
    if (!mode.canToggle) return null;
    return (
        <label className="flex items-center gap-2 mr-2 text-sm text-muted-foreground">
            <Trans>Expert mode</Trans>
            <Switch checked={!mode.simple} onCheckedChange={checked => mode.setExpert(checked)} />
        </label>
    );
}
