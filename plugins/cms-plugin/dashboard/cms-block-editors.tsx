import { graphql } from '@/graphql/graphql';
import { Trans, useLingui } from '@lingui/react/macro';
import { ImageIcon, PlusIcon, XIcon } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import {
    api,
    AssetPickerDialog,
    Badge,
    Button,
    Input,
    RichTextEditor,
    Switch,
    Textarea,
} from '@vendure/dashboard';

const getAssetsByIdsDocument = graphql(`
    query GetAssetsByIds($options: AssetListOptions) {
        assets(options: $options) {
            items {
                id
                preview
            }
        }
    }
`);

/**
 * Formats a stored value (ISO string / Date) into the `YYYY-MM-DDTHH:mm` shape a
 * `datetime-local` input expects, using LOCAL time. `toISOString()` (UTC) shifts
 * the displayed time by the timezone offset, making minute edits move the hour.
 */
function toDatetimeLocalValue(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The client view titles each field with its own name, so the generic type caption
// ("Short Text", "Images"...) is noise there; HideTypeLabels turns it off.
const ShowTypeLabels = createContext(true);

export function HideTypeLabels({ children }: { children: ReactNode }) {
    return <ShowTypeLabels.Provider value={false}>{children}</ShowTypeLabels.Provider>;
}

function TypeLabel({ children }: { children: ReactNode }) {
    return useContext(ShowTypeLabels) ? <label className="text-sm font-medium">{children}</label> : null;
}

export function BlockValueEditor({
    block,
    index,
    isSuperAdmin,
    onFieldChange,
    onFieldsChange,
    onMetadataChange,
    onTranslationChange,
}: {
    block: any;
    index: number;
    isSuperAdmin: boolean;
    onFieldChange: (index: number, field: string, value: any) => void;
    onFieldsChange: (index: number, fields: Record<string, any>) => void;
    onMetadataChange: (index: number, key: string, value: any) => void;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    const { t } = useLingui();
    switch (block.type) {
        case 'TEXT_SHORT':
            return <TextShortEditor block={block} index={index} onTranslationChange={onTranslationChange} />;
        case 'TEXT_LONG':
            return <TextLongEditor block={block} index={index} onTranslationChange={onTranslationChange} />;
        case 'RICH_TEXT':
            return <RichTextBlockEditor block={block} index={index} onTranslationChange={onTranslationChange} />;
        case 'BOOLEAN':
            return <BooleanEditor block={block} index={index} isSuperAdmin={isSuperAdmin} onFieldChange={onFieldChange} onMetadataChange={onMetadataChange} />;
        case 'ENUM':
            return <EnumEditor block={block} index={index} onTranslationChange={onTranslationChange} />;
        case 'IMAGE':
            return <ImageEditor block={block} index={index} onFieldsChange={onFieldsChange} onTranslationChange={onTranslationChange} />;
        case 'IMAGE_GALLERY':
            return <ImageGalleryEditor block={block} index={index} onFieldChange={onFieldChange} />;
        case 'DATE':
            return (
                <div>
                    <TypeLabel><Trans>Date</Trans></TypeLabel>
                    <Input
                        type="datetime-local"
                        value={toDatetimeLocalValue(block.dateValue)}
                        onChange={e =>
                            onFieldChange(
                                index,
                                'dateValue',
                                e.target.value ? new Date(e.target.value).toISOString() : null,
                            )
                        }
                        className="mt-1"
                    />
                </div>
            );
        case 'NUMBER':
            return (
                <div>
                    <TypeLabel><Trans>Number</Trans></TypeLabel>
                    <Input
                        type="number"
                        value={block.numberValue ?? ''}
                        onChange={e =>
                            onFieldChange(
                                index,
                                'numberValue',
                                e.target.value ? Number(e.target.value) : null,
                            )
                        }
                        placeholder="0"
                        className="mt-1"
                    />
                </div>
            );
        default:
            return null;
    }
}

// --- Individual block type editors ---

function TextShortEditor({ block, index, onTranslationChange }: {
    block: any;
    index: number;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    const { t } = useLingui();
    const maxLength = block.metadata?.maxLength ?? 255;
    const currentValue = block.translations?.[0]?.textContent ?? '';
    return (
        <div>
            <TypeLabel><Trans>Short Text</Trans></TypeLabel>
            <Input
                value={currentValue}
                onChange={e => onTranslationChange(index, 'textContent', e.target.value)}
                placeholder={t`Enter text`}
                maxLength={maxLength}
                className="mt-1"
            />
            <div className="text-xs text-muted-foreground text-right mt-1">
                {currentValue.length} / {maxLength}
            </div>
        </div>
    );
}

function TextLongEditor({ block, index, onTranslationChange }: {
    block: any;
    index: number;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    const { t } = useLingui();
    const maxLength = block.metadata?.maxLength ?? 2000;
    const currentValue = block.translations?.[0]?.textContent ?? '';
    return (
        <div>
            <TypeLabel><Trans>Long Text</Trans></TypeLabel>
            <Textarea
                value={currentValue}
                onChange={e => onTranslationChange(index, 'textContent', e.target.value)}
                placeholder={t`Enter text content...`}
                maxLength={maxLength}
                rows={4}
                className="mt-1"
            />
            <div className="text-xs text-muted-foreground text-right mt-1">
                {currentValue.length} / {maxLength}
            </div>
        </div>
    );
}

function RichTextBlockEditor({ block, index, onTranslationChange }: {
    block: any;
    index: number;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    const currentValue = block.translations?.[0]?.textContent ?? '';
    return (
        <div>
            <TypeLabel><Trans>Rich Text Content</Trans></TypeLabel>
            <div className="mt-1">
                <RichTextEditor
                    value={currentValue}
                    onChange={(val: string) => onTranslationChange(index, 'textContent', val)}
                />
            </div>
        </div>
    );
}

function BooleanEditor({ block, index, isSuperAdmin, onFieldChange, onMetadataChange }: {
    block: any;
    index: number;
    isSuperAdmin: boolean;
    onFieldChange: (index: number, field: string, value: any) => void;
    onMetadataChange: (index: number, key: string, value: any) => void;
}) {
    const { t } = useLingui();
    const trueLabel = block.metadata?.trueLabel ?? t`Yes`;
    const falseLabel = block.metadata?.falseLabel ?? t`No`;
    const isTrue = block.numberValue === 1;
    const activeLabel = isTrue ? trueLabel : falseLabel;

    return (
        <div className="space-y-3">
            {isSuperAdmin && (
            <div className="grid gap-3 @md:grid-cols-2">
                <div>
                    <label className="text-sm font-medium"><Trans>True Label</Trans></label>
                    <Input
                        value={trueLabel}
                        onChange={e => onMetadataChange(index, 'trueLabel', e.target.value)}
                        placeholder={t`e.g. Show Banner`}
                        className="mt-1"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium"><Trans>False Label</Trans></label>
                    <Input
                        value={falseLabel}
                        onChange={e => onMetadataChange(index, 'falseLabel', e.target.value)}
                        placeholder={t`e.g. Hide Banner`}
                        className="mt-1"
                    />
                </div>
            </div>
            )}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                <Switch
                    checked={isTrue}
                    onCheckedChange={checked => onFieldChange(index, 'numberValue', checked ? 1 : 0)}
                />
                <span className="text-sm font-medium">{activeLabel}</span>
            </div>
        </div>
    );
}

function EnumEditor({ block, index, onTranslationChange }: {
    block: any;
    index: number;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    const { t } = useLingui();
    const currentValue = block.translations?.[0]?.textContent ?? '';
    const options = currentValue.split('\n').filter((line: string) => line.trim());

    return (
        <div>
            <TypeLabel><Trans>Options</Trans></TypeLabel>
            <p className="text-xs text-muted-foreground mb-1"><Trans>Enter one option per line</Trans></p>
            <Textarea
                value={currentValue}
                onChange={e => onTranslationChange(index, 'textContent', e.target.value)}
                placeholder={t`Small\nMedium\nLarge\nExtra Large`}
                rows={4}
                className="mt-1 font-mono text-sm"
            />
            {options.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                    {options.map((opt: string, i: number) => (
                        <Badge key={i} variant="secondary">{opt.trim()}</Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

function ImageEditor({ block, index, onFieldsChange, onTranslationChange }: {
    block: any;
    index: number;
    onFieldsChange: (index: number, fields: Record<string, any>) => void;
    onTranslationChange: (index: number, field: string, value: string) => void;
}) {
    const { t } = useLingui();
    const [pickerOpen, setPickerOpen] = useState(false);
    const assetPreview = block._assetPreview ?? block.featuredAsset?.preview;
    const hasAsset = !!block.featuredAssetId;

    return (
        <div className="space-y-3">
            <div className="flex items-start gap-4">
                {hasAsset && assetPreview ? (
                    <div className="relative group">
                        <img
                            src={`${assetPreview}?preset=thumb`}
                            alt=""
                            className="w-24 h-24 object-cover rounded-md border"
                        />
                        <button
                            type="button"
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onFieldsChange(index, { featuredAssetId: null, _assetPreview: null })}
                        >
                            <XIcon className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ) : (
                    <div className="w-24 h-24 border border-dashed rounded-md flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                    </div>
                )}
                <div className="flex-1 space-y-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPickerOpen(true)}
                    >
                        {hasAsset ? t`Change Image` : t`Select Image`}
                    </Button>
                    <div>
                        <label className="text-sm font-medium"><Trans>Alt Text</Trans></label>
                        <Input
                            value={block.translations?.[0]?.altText ?? ''}
                            onChange={e => onTranslationChange(index, 'altText', e.target.value)}
                            placeholder={t`Short text for screen readers / SEO`}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium"><Trans>Description</Trans></label>
                        <Textarea
                            value={String(block.metadata?.description ?? '')}
                            onChange={e =>
                                onFieldsChange(index, {
                                    metadata: { ...(block.metadata || {}), description: e.target.value },
                                })
                            }
                            placeholder={t`Visible caption shown next to the image`}
                            rows={2}
                            className="mt-1"
                        />
                    </div>
                </div>
            </div>
            {pickerOpen && (
                <AssetPickerDialog
                    open={pickerOpen}
                    onClose={() => setPickerOpen(false)}
                    multiSelect={false}
                    onSelect={assets => {
                        if (assets.length > 0) {
                            const asset = assets[0];
                            onFieldsChange(index, { featuredAssetId: asset.id, _assetPreview: asset.preview });
                        }
                    }}
                />
            )}
        </div>
    );
}

const ASSET_PREVIEW_BATCH_SIZE = 100;

/**
 * Resolves asset preview URLs keyed by asset id. The `assets` list query defaults to
 * `take: 10`, so ids are fetched in explicit batches; keying by id (not array index)
 * keeps previews correct after reorder, removal, save/reset, or a missing asset.
 */
function useAssetPreviews(assetIds: string[]) {
    const [previews, setPreviews] = useState<Map<string, string>>(() => new Map());
    const missingKey = assetIds.filter(id => !previews.has(id)).join(',');

    useEffect(() => {
        const missing = [...new Set(missingKey.split(',').filter(Boolean))];
        if (missing.length === 0) return;
        let active = true;
        const batches: string[][] = [];
        for (let i = 0; i < missing.length; i += ASSET_PREVIEW_BATCH_SIZE) {
            batches.push(missing.slice(i, i + ASSET_PREVIEW_BATCH_SIZE));
        }
        Promise.all(
            batches.map(ids =>
                api.query(getAssetsByIdsDocument, {
                    options: { filter: { id: { in: ids } }, take: ids.length },
                }),
            ),
        )
            .then(results => {
                if (!active) return;
                const found = results.flatMap((r: any) => r.assets.items as Array<{ id: string; preview: string }>);
                setPreviews(prev => {
                    const next = new Map(prev);
                    for (const asset of found) next.set(String(asset.id), asset.preview);
                    return next;
                });
            })
            .catch(e => {
                if (import.meta.env.DEV) console.warn('Failed to fetch gallery previews', e);
            });
        return () => {
            active = false;
        };
    }, [missingKey]);

    const addPreviews = useCallback((entries: Array<[string, string]>) => {
        setPreviews(prev => new Map([...prev, ...entries]));
    }, []);

    return { previews, addPreviews };
}

function ImageGalleryEditor({ block, index, onFieldChange }: {
    block: any;
    index: number;
    onFieldChange: (index: number, field: string, value: any) => void;
}) {
    const { t } = useLingui();
    const [pickerOpen, setPickerOpen] = useState(false);
    const assetIds: string[] = (block.metadata?.assetIds ?? []).map(String);
    const { previews, addPreviews } = useAssetPreviews(assetIds);
    // Per-image alt/description keyed by asset id (default language). Survives
    // reorder/removal because it is keyed by id, not array index.
    const imageMeta: Record<string, { alt?: string; description?: string }> =
        block.metadata?.imageMeta ?? {};

    const updateGallery = (
        newIds: string[],
        newImageMeta: Record<string, { alt?: string; description?: string }> = imageMeta,
    ) => {
        // `assetPreviews` is a legacy positional cache the server strips; previews are
        // now resolved per asset id, so drop it instead of persisting a stale copy.
        const { assetPreviews: _legacyPreviews, ...restMetadata } = block.metadata || {};
        const newMetadata = {
            ...restMetadata,
            assetIds: newIds,
            imageMeta: newImageMeta,
        };
        onFieldChange(index, 'metadata', newMetadata);
    };

    const removeAsset = (assetIndex: number) => {
        const removedId = assetIds[assetIndex];
        const newIds = assetIds.filter((_, i) => i !== assetIndex);
        const { [removedId]: _removed, ...restMeta } = imageMeta;
        updateGallery(newIds, restMeta);
    };

    const updateImageMeta = (assetId: string, field: 'alt' | 'description', value: string) => {
        const newImageMeta = {
            ...imageMeta,
            [assetId]: { ...(imageMeta[assetId] || {}), [field]: value },
        };
        updateGallery(assetIds, newImageMeta);
    };

    return (
        <div>
            <TypeLabel><Trans>Images</Trans></TypeLabel>
            <div className="space-y-3 mt-2">
                {assetIds.map((assetId, i) => (
                    <div key={`${assetId}-${i}`} className="flex gap-3 items-start border rounded-md p-2">
                        <div className="relative group shrink-0">
                            {previews.get(assetId) ? (
                                <img
                                    src={`${previews.get(assetId)}?preset=thumb`}
                                    alt=""
                                    className="w-20 h-20 object-cover rounded-md border"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-md border bg-muted flex items-center justify-center text-muted-foreground">
                                    <ImageIcon className="h-5 w-5" />
                                </div>
                            )}
                            <button
                                type="button"
                                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeAsset(i)}
                            >
                                <XIcon className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <div className="flex-1 space-y-2">
                            <Input
                                value={imageMeta[assetId]?.alt ?? ''}
                                onChange={e => updateImageMeta(assetId, 'alt', e.target.value)}
                                placeholder={t`Alt text (screen readers / SEO)`}
                            />
                            <Textarea
                                value={imageMeta[assetId]?.description ?? ''}
                                onChange={e => updateImageMeta(assetId, 'description', e.target.value)}
                                placeholder={t`Description / caption`}
                                rows={2}
                            />
                        </div>
                    </div>
                ))}
                <button
                    type="button"
                    className="w-20 h-20 border border-dashed rounded-md flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    onClick={() => setPickerOpen(true)}
                >
                    <PlusIcon className="h-6 w-6" />
                </button>
            </div>
            {assetIds.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1"><Trans>Click + to add images</Trans></p>
            )}
            {pickerOpen && (
                <AssetPickerDialog
                    open={pickerOpen}
                    onClose={() => setPickerOpen(false)}
                    multiSelect={true}
                    onSelect={assets => {
                        if (assets.length > 0) {
                            addPreviews(assets.map(a => [String(a.id), a.preview]));
                            updateGallery([...assetIds, ...assets.map(a => String(a.id))]);
                        }
                    }}
                />
            )}
        </div>
    );
}
