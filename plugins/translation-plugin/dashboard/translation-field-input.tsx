import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, AssetPickerDialog, Badge, Button, Input, RichTextEditor, Textarea } from '@vendure/dashboard';

import { TranslationRow } from './translation-rows';

const getAssetDocument = graphql(`
    query GetAssetPreviewForTranslation($id: ID!) {
        asset(id: $id) {
            id
            preview
        }
    }
`);

/** Alt-text field across regular IMAGE, gallery and collection image fields. */
function isAltField(fieldName: string): boolean {
    return fieldName === 'altText' || fieldName.endsWith(':alt') || fieldName.endsWith('__alt');
}

/** Description field across regular IMAGE, gallery and collection image fields. */
function isDescriptionField(fieldName: string): boolean {
    return (
        fieldName === 'description' ||
        fieldName.endsWith(':description') ||
        fieldName.endsWith('__description')
    );
}

/** The editor for one field in the language being translated. */
export function FieldInput({
    blockType,
    fieldName,
    value,
    onChange,
    disabled,
}: {
    blockType: string | null;
    fieldName: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    // Image alt / description are plain text fields. Check these BEFORE the IMAGE
    // picker branch so an IMAGE block's altText/description (which carry
    // blockType 'IMAGE') render as text inputs, not an asset picker.
    if (isAltField(fieldName)) {
        return <Input value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />;
    }
    if (isDescriptionField(fieldName)) {
        return <Textarea rows={3} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />;
    }
    if (blockType === 'RICH_TEXT') {
        return <RichTextEditor value={value} onChange={onChange} disabled={disabled} />;
    }
    if (blockType === 'TEXT_LONG') {
        return <Textarea rows={4} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />;
    }
    // The image itself (per-language swap): regular page uses fieldName 'image';
    // collection entries use the block key (blockType 'IMAGE').
    if (fieldName === 'image' || blockType === 'IMAGE') {
        return <ImageFieldInput value={value} onChange={onChange} disabled={disabled} />;
    }
    if (blockType === 'ENUM') {
        return <OptionsListTranslationInput value={value} onChange={onChange} disabled={disabled} />;
    }
    return <Input value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />;
}

/**
 * Parses an Options List value that may be stored as a JSON array (collection
 * entries / translated lists) or as a newline/comma string (regular-page ENUM
 * textContent), returning a plain string[].
 */
function parseOptionsValue(value: string): string[] {
    if (!value) return [];
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
        try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr)) return arr.map((x: any) => String(x));
        } catch {
            // fall through to line/comma split
        }
    }
    return trimmed.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
}

/**
 * Per-language Options List editor for translations. Renders the list as chips,
 * lets you add/remove options, and stores the result as a JSON array string so it
 * round-trips regardless of the source format.
 */
function OptionsListTranslationInput({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    const { t } = useLingui();
    const options = parseOptionsValue(value);
    const [draft, setDraft] = useState('');

    const commit = (next: string[]) => onChange(JSON.stringify(next));
    const addOption = () => {
        const v = draft.trim();
        if (!v) return;
        commit([...options, v]);
        setDraft('');
    };
    const removeOption = (i: number) => commit(options.filter((_, idx) => idx !== i));

    return (
        <div>
            {!disabled && (
                <div className="flex gap-2">
                    <Input
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addOption();
                            }
                        }}
                        placeholder={t`Add an option and press Enter`}
                    />
                    <Button type="button" variant="outline" onClick={addOption}>
                        <Trans>Add</Trans>
                    </Button>
                </div>
            )}
            {options.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                    {options.map((opt, i) => (
                        <Badge key={i} variant="secondary" className="flex items-center gap-1">
                            {opt}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => removeOption(i)}
                                    aria-label={t`Remove`}
                                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                                >
                                    <XIcon className="h-3 w-3" />
                                </button>
                            )}
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

function useAssetPreview(assetId: string | null | undefined): string | null {
    const [preview, setPreview] = useState<string | null>(null);
    useEffect(() => {
        if (!assetId) {
            setPreview(null);
            return;
        }
        let active = true;
        api.query(getAssetDocument, { id: assetId })
            .then(r => {
                if (active) setPreview(r.asset?.preview ?? null);
            })
            .catch(() => {
                // A missing thumbnail is cosmetic: the field still works.
            });
        return () => {
            active = false;
        };
    }, [assetId]);
    return preview;
}

function ImageFieldInput({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    const { t } = useLingui();
    const [pickerOpen, setPickerOpen] = useState(false);
    const preview = useAssetPreview(value);

    return (
        <div className="flex items-center gap-3">
            {value && preview ? (
                <img src={`${preview}?preset=thumb`} alt="" className="h-16 w-16 rounded object-cover border" />
            ) : value ? (
                <Badge variant="secondary">{t`Image selected`}</Badge>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)} disabled={disabled}>
                {value ? t`Change Image` : t`Use another image`}
            </Button>
            {value && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t`Remove`}
                    onClick={() => onChange('')}
                    disabled={disabled}
                >
                    <XIcon className="h-4 w-4" />
                </Button>
            )}
            {pickerOpen && (
                <AssetPickerDialog
                    open={true}
                    onClose={() => setPickerOpen(false)}
                    multiSelect={false}
                    onSelect={assets => {
                        if (assets.length > 0) onChange(assets[0].id);
                        setPickerOpen(false);
                    }}
                />
            )}
        </div>
    );
}

/** Small asset thumbnail resolved from an asset id, used in gallery field labels. */
export function AssetThumb({ assetId, size = 'sm' }: { assetId: string; size?: 'sm' | 'md' }) {
    const preview = useAssetPreview(assetId);
    if (!preview) return null;
    return (
        <img
            src={`${preview}?preset=thumb`}
            alt=""
            className={`${size === 'md' ? 'h-16 w-16' : 'h-8 w-8'} rounded object-cover border shrink-0`}
        />
    );
}

/** Rich text as readable plain text, paragraphs kept. textContent never runs markup. */
function richTextToPlain(html: string): string {
    const withBreaks = html.replace(/<\/(p|h[1-6]|li|div)>|<br\s*\/?>/gi, '\n');
    const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
    return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** The default-language value, read-only, as the client reads it on the site. */
export function SourceValue({ row, value }: { row: TranslationRow; value: string | undefined }) {
    if (!value || !value.trim()) {
        return (
            <span className="text-muted-foreground">
                <Trans>Empty in the original language</Trans>
            </span>
        );
    }
    if (row.part === 'image') return <AssetThumb assetId={value} size="md" />;
    const text =
        row.blockType === 'RICH_TEXT'
            ? richTextToPlain(value)
            : row.blockType === 'ENUM'
              ? parseOptionsValue(value).join(', ')
              : value;
    return <p className="whitespace-pre-wrap break-words">{text}</p>;
}
