import { useChannel, useUserSettings } from '@vendure/dashboard';

export interface ContentLanguages {
    /** The language being edited (dashboard "content language"). */
    contentLanguage: string;
    /** The channel's default language: where originals live. */
    defaultLanguage: string;
    /** The channel's other languages. */
    targetLanguages: string[];
    /** True when editing a translation rather than the original. */
    isTranslating: boolean;
    /** False until the active channel (and so its default language) is loaded. */
    ready: boolean;
    setContentLanguage: (code: string) => void;
}

/** Content language, channel default and target languages, in one place for every extension. */
export function useContentLanguages(): ContentLanguages {
    const { activeChannel } = useChannel();
    const { settings, setContentLanguage } = useUserSettings();
    const defaultLanguage: string = activeChannel?.defaultLanguageCode ?? 'en';
    const available: string[] = activeChannel?.availableLanguageCodes ?? [defaultLanguage];
    return {
        contentLanguage: settings.contentLanguage,
        defaultLanguage,
        targetLanguages: available.filter(code => code !== defaultLanguage),
        isTranslating: settings.contentLanguage !== defaultLanguage,
        ready: !!activeChannel?.defaultLanguageCode,
        setContentLanguage,
    };
}
