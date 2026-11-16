import { useLingui } from '@lingui/react/macro';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useLocalFormat } from '@vendure/dashboard';

import { useContentLanguages } from './use-languages';

/**
 * Toolbar item next to the alerts bell: the language being edited across the dashboard
 * (products, CMS, ...). Same setting as Vendure's own content language selector.
 */
export function LanguageSwitcher() {
    const { t } = useLingui();
    const { formatLanguageName } = useLocalFormat();
    const { contentLanguage, defaultLanguage, targetLanguages, setContentLanguage } = useContentLanguages();
    const codes = [defaultLanguage, ...targetLanguages];
    if (codes.length < 2) return null;
    const items = Object.fromEntries(codes.map(code => [code, code.toUpperCase()]));
    return (
        <Select
            items={items}
            value={contentLanguage}
            onValueChange={value => {
                if (value != null) setContentLanguage(String(value));
            }}
        >
            <SelectTrigger
                className="h-8 w-auto gap-1.5 px-2.5 text-xs font-semibold"
                aria-label={t`Content language`}
                title={t`Content language`}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {codes.map(code => (
                    <SelectItem key={code} value={code}>
                        {formatLanguageName(code)}
                        {code === defaultLanguage ? ` (${t`original`})` : ''}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
