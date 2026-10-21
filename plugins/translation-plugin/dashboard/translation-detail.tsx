import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { PencilIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    api,
    Button,
    Card,
    CardContent,
    DashboardRouteDefinition,
    Page,
    PageActionBar,
    PageActionBarRight,
    PageTitle,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    ToggleGroup,
    ToggleGroupItem,
    detailPageRouteLoader,
} from '@vendure/dashboard';

import { ExpertModeSwitch, useCmsSimpleMode } from '../../cms-plugin/dashboard/cms-simple-mode';

import { CollectionTranslationPanel } from './translation-collection-panel';
import { EditorLanguage } from './translation-field-row';
import { PageTranslationPanel } from './translation-page-panel';
import { PanelContext } from './translation-panel-state';
import { useFormatProgress, useTranslationProgress } from './translation-progress-data';

const getTranslationLanguagesDocument = graphql(`
    query GetTranslationLanguagesForDetail {
        translationLanguages {
            id
            code
            name
            enabled
            isDefault
        }
    }
`);

const getCmsPageForTranslationDocument = graphql(`
    query GetCmsPageForTranslation($id: ID!) {
        cmsPage(id: $id) {
            id
            key
            name
            isCollection
            acceptsSubmissions
            parentId
            children {
                id
                key
                name
                advanced
                isCollection
                acceptsSubmissions
                sidebarOrder
            }
        }
    }
`);

// Tab of the page's own fields; child pages use their id as tab value.
const CONTENT_TAB = 'content';

interface Language extends EditorLanguage {
    isDefault: boolean;
    enabled: boolean;
}

interface TabPage {
    id: string;
    name: string;
    isCollection: boolean;
}

function TranslationDetailPage({ route }: { route: any }) {
    const { t } = useLingui();
    const params = route.useParams();
    const pageId = String(params.id);
    const navigate = useNavigate();
    const search = useSearch({ strict: false }) as { tab?: string | number; lang?: string };
    const mode = useCmsSimpleMode();
    const [languages, setLanguages] = useState<Language[] | null>(null);
    const [page, setPage] = useState<any>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [onlyToTranslate, setOnlyToTranslate] = useState(false);

    const load = useCallback(async () => {
        try {
            const [langResult, pageResult] = await Promise.all([
                api.query(getTranslationLanguagesDocument, {}),
                api.query(getCmsPageForTranslationDocument, { id: pageId }),
            ]);
            const loaded = pageResult.cmsPage;
            // A child page is translated as a tab of its parent, like in the CMS.
            if (loaded?.parentId) {
                await navigate({
                    to: '/cms-translations/$id',
                    params: { id: String(loaded.parentId) },
                    search: { tab: String(loaded.id) },
                    replace: true,
                } as any);
                return;
            }
            setLanguages((langResult.translationLanguages ?? []).filter((l: any) => l.enabled));
            setPage(loaded);
            setLoadFailed(false);
        } catch {
            setLoadFailed(true);
        }
    }, [pageId, navigate]);

    useEffect(() => {
        load();
    }, [load]);

    // Advanced pages (agency only, e.g. interface labels) stay out of simple mode.
    const tabs: TabPage[] = (page?.children ?? [])
        .filter((child: any) => !child.acceptsSubmissions && (!mode.simple || !child.advanced))
        .sort((a: any, b: any) => (a.sidebarOrder ?? 0) - (b.sidebarOrder ?? 0))
        .map((child: any) => ({ id: String(child.id), name: child.name || child.key, isCollection: child.isCollection }));
    const progress = useTranslationProgress(page ? [pageId, ...tabs.map(tab => tab.id)] : []);
    const formatProgress = useFormatProgress();

    const source = languages?.find(l => l.isDefault) ?? null;
    const targets = (languages ?? []).filter(l => !l.isDefault);
    const target = targets.find(l => l.code === search.lang) ?? targets[0];
    const requestedTab = String(search.tab ?? CONTENT_TAB);
    const activeTab = tabs.some(tab => tab.id === requestedTab) ? requestedTab : CONTENT_TAB;
    const setSearch = (next: { tab?: string; lang?: string }) =>
        navigate({ search: (prev: any) => ({ ...prev, ...next }), replace: true } as any);

    if (loadFailed) {
        return (
            <Page pageId="translation-detail">
                <PageTitle>{t`Translations`}</PageTitle>
                <div className="py-12 text-center text-muted-foreground">
                    <Trans>This page could not be loaded.</Trans>{' '}
                    <Button type="button" variant="link" onClick={load}>
                        <Trans>Try again</Trans>
                    </Button>
                </div>
            </Page>
        );
    }
    if (!page || !languages) {
        return (
            <Page pageId="translation-detail">
                <div className="py-12 text-center text-muted-foreground"><Trans>Loading...</Trans></div>
            </Page>
        );
    }

    const cmsSearch = activeTab === CONTENT_TAB ? {} : { tab: activeTab };
    const header = (
        <>
            <PageTitle>{page.name || page.key}</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <ExpertModeSwitch mode={mode} />
                    <Button
                        variant="outline"
                        render={<Link to={'/cms-pages/$id' as any} params={{ id: pageId } as any} search={cmsSearch as any} />}
                    >
                        <PencilIcon className="mr-2 h-4 w-4" />
                        <Trans>Edit in the original language</Trans>
                    </Button>
                </PageActionBarRight>
            </PageActionBar>
        </>
    );

    if (!target) {
        return (
            <Page pageId="translation-detail">
                {header}
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                        <Trans>Only one language is enabled, so there is nothing to translate yet.</Trans>
                    </CardContent>
                </Card>
            </Page>
        );
    }

    const context: PanelContext = {
        sourceCode: source?.code ?? null,
        targetCode: target.code,
        targetCodes: targets.map(l => l.code),
        onlyToTranslate,
        simple: mode.simple,
        onSaved: progress.refresh,
    };
    const panelLanguages = { source, target };
    const panelFor = (tab: { id: string; isCollection: boolean }) =>
        tab.isCollection ? (
            <CollectionTranslationPanel key={tab.id} pageId={tab.id} context={context} languages={panelLanguages} />
        ) : (
            <PageTranslationPanel key={tab.id} pageId={tab.id} context={context} languages={panelLanguages} />
        );
    const remainingIn = (tabId: string) => {
        const p = progress.forLanguage(target.code, tabId);
        return p.total - p.translated;
    };

    const ownContent = page.acceptsSubmissions ? (
        <Card className="mt-4">
            <CardContent className="py-10 text-center text-muted-foreground">
                <Trans>Form submissions are not translated.</Trans>
            </CardContent>
        </Card>
    ) : (
        panelFor({ id: pageId, isCollection: page.isCollection })
    );

    return (
        <Page pageId="translation-detail">
            {header}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                {targets.length > 1 && (
                    <ToggleGroup
                        variant="outline"
                        value={[target.code]}
                        onValueChange={(value: string[]) => value[0] && setSearch({ lang: value[0] })}
                        aria-label={t`Language to translate into`}
                    >
                        {targets.map(language => {
                            const percent = formatProgress(progress.forLanguage(language.code));
                            return (
                                <ToggleGroupItem key={language.code} value={language.code} className="px-3">
                                    {language.name}
                                    {percent && <span className="ml-1.5 text-muted-foreground tabular-nums">{percent}</span>}
                                </ToggleGroupItem>
                            );
                        })}
                    </ToggleGroup>
                )}
                <label className="flex items-center gap-2 text-sm">
                    <Switch checked={onlyToTranslate} onCheckedChange={checked => setOnlyToTranslate(checked)} />
                    <Trans>Only fields to translate</Trans>
                </label>
            </div>
            {tabs.length === 0 ? (
                ownContent
            ) : (
                <Tabs value={activeTab} onValueChange={value => setSearch({ tab: value === CONTENT_TAB ? undefined : String(value) })} className="w-full mt-4">
                    <TabsList className="flex-wrap h-auto">
                        <TabsTrigger value={CONTENT_TAB}>
                            <Trans>Texts</Trans>
                            <RemainingCount count={remainingIn(pageId)} />
                        </TabsTrigger>
                        {tabs.map(tab => (
                            <TabsTrigger key={tab.id} value={tab.id}>
                                {tab.name}
                                <RemainingCount count={remainingIn(tab.id)} />
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {/* Kept mounted: edits in one tab survive a look at another before saving. */}
                    <TabsContent value={CONTENT_TAB} keepMounted>{ownContent}</TabsContent>
                    {tabs.map(tab => (
                        <TabsContent key={tab.id} value={tab.id} keepMounted>
                            {panelFor(tab)}
                        </TabsContent>
                    ))}
                </Tabs>
            )}
        </Page>
    );
}

/** Fields left to translate in a tab, in the target language. Nothing when done. */
function RemainingCount({ count }: { count: number }) {
    const { t } = useLingui();
    if (count <= 0) return null;
    return (
        <span className="text-muted-foreground tabular-nums" title={t`${count} fields to translate`}>
            {count}
        </span>
    );
}

export const translationDetail: DashboardRouteDefinition = {
    path: '/cms-translations/$id',
    loader: detailPageRouteLoader({
        queryDocument: getCmsPageForTranslationDocument,
        // The nav section crumb already links to the translations list.
        breadcrumb: (isNew, entity) => [entity?.name ?? <Trans>Translation</Trans>],
    }),
    component: route => <TranslationDetailPage route={route} />,
};
