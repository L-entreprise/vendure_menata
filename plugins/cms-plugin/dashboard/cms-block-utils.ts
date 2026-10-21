// Block helpers shared by the page editor and the child-page tabs.

/**
 * A block without an id is new. The generic create form seeds its first block from
 * `UpdatePageContentBlockInput`, whose Boolean `enabled` defaults to `false` — a value
 * the editor never lets the user pick. New blocks are therefore always sent enabled;
 * existing blocks keep their stored flag (toggled via the per-block switch).
 */
export function resolveBlockEnabled(block: any): boolean {
    if (!block.id) return true;
    return block.enabled ?? true;
}

export function prepareBlocksForMutation(blocks: any[]): any[] {
    return (blocks || [])
        .filter((b: any) => b.type)
        .map((b: any, i: number) => ({
            ...(b.id ? { id: b.id } : {}),
            type: b.type,
            key: b.key,
            position: i,
            enabled: resolveBlockEnabled(b),
            featuredAssetId: b.featuredAssetId ?? null,
            metadata: b.metadata ?? null,
            dateValue: b.dateValue ?? null,
            numberValue: b.numberValue != null ? Number(b.numberValue) : null,
            translations: (b.translations || []).map((t: any) => ({
                ...(t.id ? { id: t.id } : {}),
                languageCode: t.languageCode,
                name: t.name,
                textContent: t.textContent ?? '',
                altText: t.altText ?? '',
            })),
        }));
}

export function getDefaultMetadata(type: string): Record<string, unknown> | null {
    switch (type) {
        case 'TEXT_SHORT':
            return { maxLength: 255 };
        case 'TEXT_LONG':
            return { maxLength: 2000 };
        case 'BOOLEAN':
            return { trueLabel: 'Yes', falseLabel: 'No' };
        case 'IMAGE_GALLERY':
            return { assetIds: [], imageMeta: {} };
        default:
            return null;
    }
}

/** Maps a content block from the Admin API to the shape the block editors work on. */
export function toEditableBlock(block: any): any {
    return {
        id: block.id,
        type: block.type,
        key: block.key,
        position: block.position,
        enabled: block.enabled ?? true,
        featuredAssetId: block.featuredAsset?.id ?? null,
        metadata: block.metadata ?? getDefaultMetadata(block.type),
        dateValue: block.dateValue,
        numberValue: block.numberValue != null ? Number(block.numberValue) : null,
        _assetPreview: block.featuredAsset?.preview ?? null,
        translations: block.translations?.map((t: any) => ({
            id: t.id,
            languageCode: t.languageCode,
            name: t.name,
            textContent: t.textContent ?? '',
            altText: t.altText ?? '',
        })) ?? [],
    };
}

export interface BlockSection {
    /** Section title from `metadata.section`; null for fields without a section. */
    title: string | null;
    /** Collapsed on open when any of its fields sets `metadata.sectionCollapsed`. */
    collapsed: boolean;
    items: Array<{ block: any; index: number }>;
}

/**
 * Groups blocks into the sections the client sees, in the order they first appear
 * on the page. `index` stays the block's position in the original array so editors
 * can keep updating it by index.
 */
export function groupBlocksBySection(blocks: any[]): BlockSection[] {
    const sections: BlockSection[] = [];
    const byTitle = new Map<string | null, BlockSection>();
    blocks.forEach((block, index) => {
        const raw = block?.metadata?.section;
        const title = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
        let section = byTitle.get(title);
        if (!section) {
            section = { title, collapsed: false, items: [] };
            byTitle.set(title, section);
            sections.push(section);
        }
        section.items.push({ block, index });
        if (block?.metadata?.sectionCollapsed === true) {
            section.collapsed = true;
        }
    });
    return sections;
}
