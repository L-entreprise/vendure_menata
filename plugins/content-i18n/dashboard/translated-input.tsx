import { DashboardFormComponent, Input, RichTextInput, usePage } from '@vendure/dashboard';

import { OriginalHint } from './original-hint';
import { useContentLanguages } from './use-languages';

/**
 * Native inputs of translatable product fields, plus the original text underneath while a
 * translation is being edited. Registered through `detailForms.inputs`, so the product and
 * variant pages themselves stay untouched.
 */

/** The default-language value of the field this input edits (`translations.<i>.<field>`). */
function useOriginal(fieldPath: string): { languageCode: string; value: unknown } | null {
    const { form } = usePage();
    const { isTranslating, defaultLanguage } = useContentLanguages();
    const translations = (form?.watch('translations') ?? []) as Array<Record<string, unknown>>;
    if (!isTranslating) return null;
    const field = fieldPath.split('.').pop() ?? fieldPath;
    const source = translations.find(t => t?.languageCode === defaultLanguage);
    return { languageCode: defaultLanguage, value: source?.[field] };
}

export const TranslatedTextInput: DashboardFormComponent = props => {
    const original = useOriginal(props.name);
    return (
        <div className="w-full">
            <Input {...props} value={props.value ?? ''} />
            {original && (
                <OriginalHint
                    languageCode={original.languageCode}
                    value={original.value}
                    onCopy={() => props.onChange(original.value ?? '')}
                />
            )}
        </div>
    );
};

export const TranslatedRichTextInput: DashboardFormComponent = props => {
    const original = useOriginal(props.name);
    return (
        <div className="w-full">
            <RichTextInput {...props} />
            {original && (
                <OriginalHint
                    languageCode={original.languageCode}
                    value={original.value}
                    onCopy={() => props.onChange(original.value ?? '')}
                />
            )}
        </div>
    );
};
