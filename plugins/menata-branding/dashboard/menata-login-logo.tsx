import { i18n } from '@lingui/core';
import { useEffect, useRef } from 'react';

import { MENATA_LOGIN_LOGO_DATA_URI } from './menata-logo-data';

export function MenataLoginBeforeForm() {
    const containerRef = useRef<HTMLDivElement>(null);
    const isFrench = i18n.locale === 'fr';

    // Apply gradient to the login page background
    useEffect(() => {
        const loginWrapper = containerRef.current?.closest('.min-h-svh');
        if (loginWrapper instanceof HTMLElement) {
            const original = loginWrapper.style.background;
            loginWrapper.style.background = [
                'radial-gradient(ellipse at center, #0a0a0a 0%, transparent 70%)',
                'linear-gradient(135deg, #628eda 0%, #1a1a2e 40%, #0a0a0a 50%, #1a1a2e 60%, #65379a 100%)',
            ].join(', ');
            return () => {
                loginWrapper.style.background = original;
            };
        }
    }, []);

    return (
        <div ref={containerRef} className="flex flex-col items-center text-center gap-2">
            <img src={MENATA_LOGIN_LOGO_DATA_URI} alt="Menata" className="h-14 w-auto object-contain mb-3" />
            <h1 className="text-2xl font-semibold tracking-tight">
                {isFrench ? 'Bienvenue' : 'Welcome'}
            </h1>
            <p className="text-sm text-muted-foreground">
                {isFrench
                    ? 'Connectez-vous au tableau de bord'
                    : 'Sign in to access the admin dashboard'}
            </p>
        </div>
    );
}
