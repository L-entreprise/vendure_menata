import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    api,
    Button,
    Card,
    CardContent,
    CardHeader,
    DashboardRouteDefinition,
    Input,
    Page,
    PageActionBar,
    PageActionBarRight,
    PageTitle,
    Switch,
    usePermissions,
} from '@vendure/dashboard';
import { toast } from 'sonner';

const getLanguagesDocument = graphql(`
    query GetTranslationLanguagesSettings {
        translationLanguages {
            id
            code
            name
            enabled
            isDefault
            position
        }
    }
`);

const setLanguagesDocument = graphql(`
    mutation SetTranslationLanguages($input: [TranslationLanguageInput!]!) {
        setTranslationLanguages(input: $input) {
            id
            code
            name
            enabled
            isDefault
            position
        }
    }
`);

interface LanguageRow {
    code: string;
    name: string;
    enabled: boolean;
    isDefault: boolean;
}

function TranslationSettingsContent() {
    const { t } = useLingui();
    const { hasPermissions } = usePermissions();
    const isSuperAdmin = hasPermissions(['SuperAdmin']);
    const [languages, setLanguages] = useState<LanguageRow[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.query(getLanguagesDocument, {}).then(result => {
            setLanguages(
                (result.translationLanguages ?? []).map((l: any) => ({
                    code: l.code,
                    name: l.name,
                    enabled: l.enabled,
                    isDefault: l.isDefault,
                })),
            );
        });
    }, []);

    const addLanguage = useCallback(() => {
        setLanguages(prev => [...prev, { code: '', name: '', enabled: true, isDefault: false }]);
    }, []);

    const removeLanguage = useCallback((index: number) => {
        setLanguages(prev => prev.filter((_, i) => i !== index));
    }, []);

    const updateLanguage = useCallback((index: number, field: keyof LanguageRow, value: any) => {
        setLanguages(prev =>
            prev.map((lang, i) => (i === index ? { ...lang, [field]: value } : lang)),
        );
    }, []);

    const setDefault = useCallback((index: number) => {
        setLanguages(prev =>
            prev.map((lang, i) => ({ ...lang, isDefault: i === index })),
        );
    }, []);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const input = languages.map((lang, i) => ({
                code: lang.code,
                name: lang.name,
                enabled: lang.enabled,
                isDefault: lang.isDefault,
                position: i,
            }));
            const result = await api.mutate(setLanguagesDocument, { input });
            setLanguages(
                (result.setTranslationLanguages ?? []).map((l: any) => ({
                    code: l.code,
                    name: l.name,
                    enabled: l.enabled,
                    isDefault: l.isDefault,
                })),
            );
            toast.success(t`Languages saved`);
        } catch (err: any) {
            toast.error(err.message ?? 'Failed to save languages');
        } finally {
            setSaving(false);
        }
    }, [languages, t]);

    if (!isSuperAdmin) {
        return (
            <Page>
                <PageTitle>{t`Translation Settings`}</PageTitle>
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        <Trans>Only SuperAdmin can manage translation languages.</Trans>
                    </CardContent>
                </Card>
            </Page>
        );
    }

    return (
        <Page>
            <PageTitle>{t`Translation Settings`}</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <Button variant="outline" onClick={addLanguage}>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        <Trans>Add Language</Trans>
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? '...' : <Trans>Save Languages</Trans>}
                    </Button>
                </PageActionBarRight>
            </PageActionBar>

            <Card>
                <CardHeader className="font-medium">
                    <Trans>Languages</Trans>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-[100px_1fr_80px_80px_50px] gap-4 border-b pb-2 mb-4 font-medium text-sm text-muted-foreground">
                        <div>Code</div>
                        <div>Name</div>
                        <div>Enabled</div>
                        <div>Default</div>
                        <div></div>
                    </div>

                    {languages.map((lang, index) => (
                        <div
                            key={index}
                            className="grid grid-cols-[100px_1fr_80px_80px_50px] gap-4 mb-3 items-center"
                        >
                            <Input
                                value={lang.code}
                                placeholder="en"
                                maxLength={10}
                                onChange={e => updateLanguage(index, 'code', e.target.value)}
                            />
                            <Input
                                value={lang.name}
                                placeholder="English"
                                maxLength={100}
                                onChange={e => updateLanguage(index, 'name', e.target.value)}
                            />
                            <Switch
                                checked={lang.enabled}
                                onCheckedChange={v => updateLanguage(index, 'enabled', v)}
                            />
                            <input
                                type="radio"
                                name="default-language"
                                checked={lang.isDefault}
                                onChange={() => setDefault(index)}
                                className="h-4 w-4 cursor-pointer"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLanguage(index)}
                            >
                                <TrashIcon className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}

                    {languages.length === 0 && (
                        <div className="py-8 text-center text-muted-foreground">
                            <Trans>No languages configured. Add one to get started.</Trans>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Page>
    );
}

export const translationSettings: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'translations',
        id: 'translation-settings',
        url: '/cms-translations/settings',
        title: 'Languages',
        requiresPermission: ['SuperAdmin'],
    },
    path: '/cms-translations/settings',
    loader: () => ({
        breadcrumb: 'Languages',
    }),
    component: () => <TranslationSettingsContent />,
};
