import { graphql } from '@/graphql/graphql';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { InfoIcon, SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    api,
    Button,
    Card,
    CardContent,
    DashboardRouteDefinition,
    DetailPageButton,
    ListPage,
    PageActionBarRight,
} from '@vendure/dashboard';

import { ExpertModeSwitch, useCmsSimpleMode } from '../../cms-plugin/dashboard/cms-simple-mode';

import { useFormatProgress, useTranslationProgress } from './translation-progress-data';

const getCmsPageListDocument = graphql(`
    query GetCmsPagesForTranslation($options: CmsPageListOptions) {
        cmsPages(options: $options) {
            items {
                id
                createdAt
                updatedAt
                key
                enabled
                name
                acceptsSubmissions
                isCollection
                children {
                    id
                    advanced
                    acceptsSubmissions
                }
            }
            totalItems
        }
    }
`);

const getLanguagesDocument = graphql(`
    query GetTranslationLanguagesForList {
        translationLanguages {
            code
            enabled
            isDefault
            position
        }
    }
`);

interface ListChild {
    id: string;
    advanced: boolean;
    acceptsSubmissions: boolean;
}

/** The tabs a page shows in the translation editor (forms are not translated there). */
function translatableChildren(children: ListChild[] | undefined, simple: boolean): ListChild[] {
    return (children ?? []).filter(child => !child.acceptsSubmissions && (!simple || !child.advanced));
}

/** Languages to translate into, in their configured order. */
function useTargetLanguages(): string[] {
    const [codes, setCodes] = useState<string[]>([]);
    useEffect(() => {
        api.query(getLanguagesDocument, {})
            .then(result =>
                setCodes(
                    (result.translationLanguages ?? [])
                        .filter((l: any) => l.enabled && !l.isDefault)
                        .sort((a: any, b: any) => a.position - b.position)
                        .map((l: any) => l.code),
                ),
            )
            .catch(() => setCodes([]));
    }, []);
    return codes;
}

/** "DE 92 % · EN 100 %" for a page and its tabs. */
function ProgressCell({ pageIds, languageCodes }: { pageIds: string[]; languageCodes: string[] }) {
    const progress = useTranslationProgress(pageIds);
    const format = useFormatProgress();
    const parts = languageCodes.flatMap(code => {
        const value = progress.forLanguage(code);
        const percent = format(value);
        return percent ? [{ code, percent, done: value.translated === value.total }] : [];
    });
    if (parts.length === 0) return null;
    return (
        <span className="tabular-nums whitespace-nowrap">
            {parts.map((part, i) => (
                <span key={part.code} className={part.done ? 'text-muted-foreground' : undefined}>
                    {i > 0 && <span className="text-muted-foreground"> · </span>}
                    {part.code.toUpperCase()} {part.percent}
                </span>
            ))}
        </span>
    );
}

function TranslationListContent({ route }: { route: any }) {
    const { t } = useLingui();
    const mode = useCmsSimpleMode();
    const targetLanguages = useTargetLanguages();
    return (
        <>
            <Card className="mb-4">
                <CardContent className="flex items-start gap-3 py-4 text-sm">
                    <InfoIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <div className="font-medium">
                            <Trans>Translating products, collections & facets</Trans>
                        </div>
                        <div className="text-muted-foreground">
                            <Trans>
                                For products, collections, facets and other built-in Vendure entities,
                                switch the content language using the language selector at the top of the dashboard,
                                then open the entity and edit its name, slug or description directly. Saving will store
                                the translation for the selected language.
                            </Trans>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <ListPage
                pageId="translation-list"
                title={t`Translations`}
                listQuery={getCmsPageListDocument}
                route={route}
                transformQueryKey={queryKey => [...queryKey, mode.simple]}
                transformVariables={(vars: any) => {
                    // Same rows as the CMS page list: child pages are tabs of their parent,
                    // a search still finds every page, advanced pages stay out of simple mode.
                    const filter = vars.options?.filter ?? {};
                    const searching = Object.keys(filter).length > 0;
                    return {
                        ...vars,
                        options: {
                            ...vars.options,
                            filter: {
                                ...filter,
                                acceptsSubmissions: { eq: false },
                                ...(!searching && { parentId: { isNull: true } }),
                                ...(mode.simple && { advanced: { eq: false } }),
                            },
                        },
                    };
                }}
                defaultVisibility={
                    mode.simple ? { id: false, createdAt: false, updatedAt: false, key: false, enabled: false } : undefined
                }
                customizeColumns={{
                    name: {
                        header: t`Page`,
                        cell: ({ row }) => (
                            <DetailPageButton
                                id={row.original.id}
                                label={row.original.name || row.original.key || row.original.id}
                            />
                        ),
                    },
                    children: {
                        header: t`Tabs`,
                        cell: ({ row }) => translatableChildren(row.original.children as ListChild[], mode.simple).length || '',
                    },
                    acceptsSubmissions: { meta: { disabled: true } },
                    isCollection: { meta: { disabled: true } },
                }}
                additionalColumns={{
                    progress: {
                        header: t`Translated`,
                        cell: ({ row }: { row: any }) => (
                            <ProgressCell
                                pageIds={[
                                    String(row.original.id),
                                    ...translatableChildren(row.original.children, mode.simple).map(c => String(c.id)),
                                ]}
                                languageCodes={targetLanguages}
                            />
                        ),
                    },
                }}
            >
                <PageActionBarRight>
                    <ExpertModeSwitch mode={mode} />
                    {!mode.simple && (
                        <Button variant="outline" render={<Link to="/cms-translations/settings" />}>
                            <SettingsIcon className="mr-2 h-4 w-4" />
                            <Trans>Languages</Trans>
                        </Button>
                    )}
                </PageActionBarRight>
            </ListPage>
        </>
    );
}

export const translationList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'translations',
        id: 'cms-translations',
        url: '/cms-translations',
        title: 'Translations',
        requiresPermission: ['ReadCmsPage'],
    },
    path: '/cms-translations',
    loader: () => ({
        // A function (not <Trans>) so the browser tab title also gets the translated text.
        breadcrumb: () => i18n._(msg`Translations`),
    }),
    component: route => <TranslationListContent route={route} />,
};
