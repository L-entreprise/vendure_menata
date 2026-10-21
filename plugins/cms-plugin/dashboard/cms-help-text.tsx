import { Link } from '@tanstack/react-router';

import { parseHelpText } from './cms-help-links';

/**
 * A field's help line (`metadata.help`). `[label](/products)` links to a dashboard
 * screen, so a page can point to where related data lives (e.g. Catalog › Products).
 */
export function HelpText({ help, className = '' }: { help?: unknown; className?: string }) {
    if (typeof help !== 'string' || !help.trim()) return null;
    return (
        <p className={`text-sm text-muted-foreground ${className}`}>
            {parseHelpText(help).map((part, i) => {
                if (part.kind === 'text') return <span key={i}>{part.text}</span>;
                if (part.internal) {
                    return (
                        <Link key={i} to={part.href} className="underline underline-offset-2 text-foreground">
                            {part.label}
                        </Link>
                    );
                }
                return (
                    <a
                        key={i}
                        href={part.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 text-foreground"
                    >
                        {part.label}
                    </a>
                );
            })}
        </p>
    );
}
