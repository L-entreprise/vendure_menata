import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { ReactNode, useState } from 'react';

/**
 * A titled panel the client opens and closes, used for field sections
 * (`metadata.section`) in the page editor and the translation editor.
 */
export function CollapsibleSection({
    title,
    defaultOpen = true,
    children,
}: {
    title: ReactNode;
    defaultOpen?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const Chevron = open ? ChevronDownIcon : ChevronRightIcon;
    return (
        <section className="border rounded-lg">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className="flex w-full items-center gap-2 px-5 py-3 text-left text-base font-semibold hover:bg-muted/30 transition-colors"
            >
                <Chevron className="h-4 w-4 text-muted-foreground shrink-0" />
                {title}
            </button>
            {open && <div className="border-t px-5 py-5">{children}</div>}
        </section>
    );
}
