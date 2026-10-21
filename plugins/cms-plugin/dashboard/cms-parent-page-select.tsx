import { graphql } from '@/graphql/graphql';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { api, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vendure/dashboard';

const rootCmsPagesDocument = graphql(`
    query GetRootCmsPages($options: CmsPageListOptions) {
        cmsPages(options: $options) {
            items {
                id
                key
                name
            }
        }
    }
`);

// The Select cannot hold an empty value, so "no parent" gets its own sentinel.
const NO_PARENT = '__none__';
const MAX_ROOT_PAGES = 500;

/**
 * Picks the top-level page this page belongs to. Only top-level pages are offered:
 * the hierarchy is one level deep (enforced by the API as well).
 */
export function ParentPageSelect({
    pageId,
    value,
    onChange,
    disabled,
}: {
    pageId?: string;
    value: string | null;
    onChange: (parentId: string | null) => void;
    disabled?: boolean;
}) {
    const { t } = useLingui();
    const [pages, setPages] = useState<Array<{ id: string; key: string; name: string }>>([]);

    useEffect(() => {
        let active = true;
        api.query(rootCmsPagesDocument, {
            options: { filter: { parentId: { isNull: true } }, take: MAX_ROOT_PAGES },
        })
            .then(result => {
                if (!active) return;
                const roots = result.cmsPages.items
                    .filter(page => String(page.id) !== String(pageId))
                    .sort((a, b) => (a.name || a.key).localeCompare(b.name || b.key));
                setPages(roots);
            })
            .catch(e => {
                if (import.meta.env.DEV) console.warn('Failed to load top-level pages', e);
            });
        return () => {
            active = false;
        };
    }, [pageId]);

    const noParentLabel = t`None (top-level page)`;
    // Base UI shows the raw value in the trigger unless it gets the labels up front.
    const labels: Record<string, string> = {
        [NO_PARENT]: noParentLabel,
        ...Object.fromEntries(pages.map(page => [String(page.id), page.name || page.key])),
    };

    return (
        <Select
            items={labels}
            value={value ? String(value) : NO_PARENT}
            onValueChange={next => onChange(!next || next === NO_PARENT ? null : String(next))}
            disabled={disabled}
        >
            <SelectTrigger>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NO_PARENT}>{noParentLabel}</SelectItem>
                {pages.map(page => (
                    <SelectItem key={page.id} value={String(page.id)}>
                        {page.name || page.key}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
