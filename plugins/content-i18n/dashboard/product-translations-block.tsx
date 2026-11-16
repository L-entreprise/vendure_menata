import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import { api, Button, PageContextValue } from '@vendure/dashboard';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { StaleTranslations, staleTranslations, TranslationRow } from '../shared/stale-translations';
import { CreatedPrompt } from './created-prompt';
import { useFormatProgress } from './progress-format';
import { StaleTranslationsDialog } from './stale-translations-dialog';
import { useContentLanguages } from './use-languages';

const progressDocument = graphql(`
    query ContentI18nProductProgress($id: ID!) {
        product(id: $id) {
            id
            translationProgress {
                languageCode
                total
                translated
                missing
            }
        }
    }
`);

const clearDocument = graphql(`
    mutation ContentI18nClearProductTranslations($input: UpdateProductInput!) {
        updateProduct(input: $input) {
            id
        }
    }
`);

const WATCHED_FIELDS = ['name', 'description'];

interface LanguageProgress {
    languageCode: string;
    total: number;
    translated: number;
    missing: string[];
}

interface ProductEntity {
    id: string;
    createdAt?: string;
    updatedAt?: string;
    translations?: TranslationRow[];
    variantList?: { items?: Array<{ id: string; name?: string }> };
}

/**
 * Side panel on the product page: what is left to translate per language, a shortcut to
 * switch to that language, and the "original changed" / "translate the new product" prompts.
 */
export function ProductTranslationsBlock({ context }: { context: PageContextValue }) {
    const entity = context.entity as ProductEntity | undefined;
    const languages = useContentLanguages();
    const progress = useProductProgress(entity?.id, entity?.updatedAt);
    const stale = useStaleAfterSave(entity, languages.defaultLanguage, languages.isTranslating);
    if (!entity?.id || languages.targetLanguages.length === 0) return null;
    return (
        <>
            <ProgressList progress={progress} entity={entity} onSwitch={languages.setContentLanguage} />
            <StaleProductDialog entity={entity} stale={stale.value} onDone={stale.dismiss} />
            <CreatedPrompt entityId={entity.id} createdAt={entity.createdAt} translations={entity.translations} />
        </>
    );
}

function useProductProgress(productId: string | undefined, updatedAt: string | undefined): LanguageProgress[] {
    const [rows, setRows] = useState<LanguageProgress[]>([]);
    useEffect(() => {
        if (!productId) return;
        let cancelled = false;
        api.query(progressDocument, { id: productId })
            .then((result: any) => !cancelled && setRows(result?.product?.translationProgress ?? []))
            // The panel is a guide: the product page keeps working without it.
            .catch(() => !cancelled && setRows([]));
        return () => {
            cancelled = true;
        };
    }, [productId, updatedAt]);
    return rows;
}

/** Compares the saved product with the previous version of the same product. */
function useStaleAfterSave(entity: ProductEntity | undefined, defaultLanguage: string, isTranslating: boolean) {
    const previous = useRef<ProductEntity | undefined>(undefined);
    const [value, setValue] = useState<StaleTranslations | null>(null);
    useEffect(() => {
        const before = previous.current;
        previous.current = entity;
        if (!entity || !before || before.id !== entity.id || before.updatedAt === entity.updatedAt) return;
        if (isTranslating) return;
        const result = staleTranslations(before.translations ?? [], entity.translations ?? [], defaultLanguage, WATCHED_FIELDS);
        if (result.fields.length > 0) setValue(result);
    }, [entity, defaultLanguage, isTranslating]);
    return { value, dismiss: () => setValue(null) };
}

function ProgressList(props: { progress: LanguageProgress[]; entity: ProductEntity; onSwitch: (code: string) => void }) {
    const { t } = useLingui();
    const format = useFormatProgress();
    const label = (missing: string) => {
        if (missing === 'name') return t`Name`;
        if (missing === 'description') return t`Description`;
        if (missing.startsWith('customFields.')) return missing.slice('customFields.'.length);
        const variantId = /^variant:(.+):name$/.exec(missing)?.[1];
        const variant = props.entity.variantList?.items?.find(v => String(v.id) === variantId);
        return t`Variant ${variant?.name ?? variantId}`;
    };
    if (props.progress.length === 0) return null;
    return (
        <div className="space-y-3">
            {props.progress.map(row => (
                <div key={row.languageCode} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold">
                            {row.languageCode.toUpperCase()}{' '}
                            <span className="font-normal tabular-nums text-muted-foreground">{format(row) ?? ''}</span>
                        </span>
                        {row.missing.length > 0 && (
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => props.onSwitch(row.languageCode)}>
                                <Trans>Translate</Trans>
                            </Button>
                        )}
                    </div>
                    {row.missing.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{row.missing.map(label).join(', ')}</p>
                    )}
                </div>
            ))}
        </div>
    );
}

function StaleProductDialog(props: { entity: ProductEntity; stale: StaleTranslations | null; onDone: () => void }) {
    const { t } = useLingui();
    const queryClient = useQueryClient();
    const { defaultLanguage, setContentLanguage } = useContentLanguages();
    const [busy, setBusy] = useState(false);
    const stale = props.stale;
    const fieldLabel = (field: string) => (field === 'name' ? t`Name` : t`Description`);
    const clear = async () => {
        if (!stale) return;
        setBusy(true);
        try {
            const emptied = Object.fromEntries(stale.fields.map(field => [field, '']));
            await api.mutate(clearDocument, {
                input: { id: props.entity.id, translations: stale.languages.map(languageCode => ({ languageCode, ...emptied })) },
            });
            await queryClient.invalidateQueries();
            toast.success(t`Translations cleared`);
            props.onDone();
        } catch (error) {
            toast.error(t`Could not clear the translations`, {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setBusy(false);
        }
    };
    return (
        <StaleTranslationsDialog
            open={!!stale}
            fields={(stale?.fields ?? []).map(fieldLabel)}
            sourceLanguage={defaultLanguage}
            languages={stale?.languages ?? []}
            busy={busy}
            onKeep={props.onDone}
            onClear={clear}
            onTranslate={code => {
                setContentLanguage(code);
                props.onDone();
            }}
        />
    );
}
