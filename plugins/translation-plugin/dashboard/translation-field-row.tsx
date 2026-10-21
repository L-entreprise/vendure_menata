import { Trans, useLingui } from '@lingui/react/macro';

import { CollapsibleSection } from '../../cms-plugin/dashboard/cms-collapsible-section';
import { HelpText } from '../../cms-plugin/dashboard/cms-help-text';

import { AssetThumb, FieldInput, SourceValue } from './translation-field-input';
import { groupRowsBySection, TranslationRow, Values } from './translation-rows';

export interface EditorLanguage {
    code: string;
    name: string;
}

export interface RowEditing {
    source: Values;
    target: Values;
    onChange: (key: string, value: string) => void;
    /** Expert mode shows technical keys next to labels. */
    showKeys: boolean;
}

/** "Français (original)" over the left column, the language being written over the right. */
export function ColumnHeadings({ source, target }: { source: EditorLanguage | null; target: EditorLanguage }) {
    return (
        <div className="hidden lg:grid grid-cols-2 gap-4 pb-3 text-sm font-medium text-muted-foreground">
            <div>
                {source ? <Trans>{source.name} (original)</Trans> : <Trans>Original</Trans>}
            </div>
            <div className="text-foreground">{target.name}</div>
        </div>
    );
}

function RowLabel({ row, showKeys }: { row: TranslationRow; showKeys: boolean }) {
    const { t } = useLingui();
    const base = row.pageField
        ? row.fieldName === 'name'
            ? t`Page Name`
            : t`Page Slug`
        : row.label ?? (showKeys && row.technicalKey ? row.technicalKey : t`Untitled field`);
    const part =
        row.part === 'alt' ? t`alt text` : row.part === 'description' ? t`image description` : row.part === 'image' ? t`image` : null;
    return (
        <div className="flex items-center gap-2 min-w-0">
            {row.assetId && <AssetThumb assetId={row.assetId} />}
            <h4 className="text-sm font-semibold">
                {base}
                {part && <span className="font-normal text-muted-foreground">, {part}</span>}
            </h4>
            {showKeys && row.technicalKey && (
                <code className="text-xs text-muted-foreground truncate">{row.technicalKey}</code>
            )}
        </div>
    );
}

/** One field: its label and help, then the original and the translation side by side. */
function FieldRow({ row, editing }: { row: TranslationRow; editing: RowEditing }) {
    return (
        <div>
            <RowLabel row={row} showKeys={editing.showKeys} />
            <HelpText help={row.help} className="mt-0.5" />
            <div className="mt-2 grid gap-2 lg:grid-cols-2 lg:gap-4 items-start">
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm min-h-9">
                    <SourceValue row={row} value={editing.source[row.key]} />
                </div>
                <FieldInput
                    blockType={row.blockType}
                    fieldName={row.fieldName}
                    value={editing.target[row.key] ?? ''}
                    onChange={value => editing.onChange(row.key, value)}
                />
            </div>
        </div>
    );
}

export function FieldRows({ rows, editing }: { rows: TranslationRow[]; editing: RowEditing }) {
    return (
        <div className="space-y-6">
            {rows.map(row => (
                <FieldRow key={row.key} row={row} editing={editing} />
            ))}
        </div>
    );
}

/**
 * Fields grouped in the page's sections, like the CMS editor. When only fields to
 * translate are shown, every section opens so nothing to do stays hidden.
 */
export function SectionedRows({
    rows,
    editing,
    forceOpen,
}: {
    rows: TranslationRow[];
    editing: RowEditing;
    forceOpen: boolean;
}) {
    return (
        <div className="space-y-4">
            {groupRowsBySection(rows).map((section, i) =>
                section.title === null ? (
                    <FieldRows key={`untitled-${i}`} rows={section.rows} editing={editing} />
                ) : (
                    <CollapsibleSection
                        key={`${section.title}-${forceOpen}`}
                        title={section.title}
                        defaultOpen={forceOpen || !section.collapsed}
                    >
                        <FieldRows rows={section.rows} editing={editing} />
                    </CollapsibleSection>
                ),
            )}
        </div>
    );
}
