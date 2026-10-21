import { BlockValueEditor, HideTypeLabels } from './cms-block-editors';
import { BlockSection, groupBlocksBySection } from './cms-block-utils';
import { CollapsibleSection } from './cms-collapsible-section';
import { HelpText } from './cms-help-text';

export interface BlockEditHandlers {
    onFieldChange: (index: number, field: string, value: any) => void;
    onFieldsChange: (index: number, fields: Record<string, any>) => void;
    onMetadataChange: (index: number, key: string, value: any) => void;
    onTranslationChange: (index: number, field: string, value: string) => void;
}

/**
 * The client's view of a page's fields: grouped in collapsible sections in the order
 * they appear on the site (`metadata.section`), each with its help line. No keys,
 * types or structure controls.
 */
export function BlockSections({
    blocks,
    isSuperAdmin,
    handlers,
}: {
    blocks: any[];
    isSuperAdmin: boolean;
    handlers: BlockEditHandlers;
}) {
    const sections = groupBlocksBySection(blocks);
    return (
        <HideTypeLabels>
            <div className="space-y-4">
                {sections.map((section, i) =>
                    section.title === null ? (
                        <SectionFields key={`untitled-${i}`} section={section} isSuperAdmin={isSuperAdmin} handlers={handlers} />
                    ) : (
                        <TitledSection key={section.title} section={section} isSuperAdmin={isSuperAdmin} handlers={handlers} />
                    ),
                )}
            </div>
        </HideTypeLabels>
    );
}

function TitledSection({
    section,
    isSuperAdmin,
    handlers,
}: {
    section: BlockSection;
    isSuperAdmin: boolean;
    handlers: BlockEditHandlers;
}) {
    return (
        <CollapsibleSection title={section.title} defaultOpen={!section.collapsed}>
            <SectionFields section={section} isSuperAdmin={isSuperAdmin} handlers={handlers} />
        </CollapsibleSection>
    );
}

function SectionFields({
    section,
    isSuperAdmin,
    handlers,
}: {
    section: BlockSection;
    isSuperAdmin: boolean;
    handlers: BlockEditHandlers;
}) {
    return (
        <div className="space-y-8">
            {section.items.map(({ block, index }) => (
                <div key={block.id ?? `new-${index}`}>
                    <h3 className="text-base font-semibold">{block.translations?.[0]?.name || block.key}</h3>
                    <HelpText help={block.metadata?.help} className="mt-1" />
                    <div className="mt-2">
                        <BlockValueEditor block={block} index={index} isSuperAdmin={isSuperAdmin} {...handlers} />
                    </div>
                </div>
            ))}
        </div>
    );
}
