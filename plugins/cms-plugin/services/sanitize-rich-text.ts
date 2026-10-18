import sanitizeHtml from 'sanitize-html';

import { ContentBlockType } from '../constants';

const ALLOWED_TAGS = [
    ...sanitizeHtml.defaults.allowedTags,
    'h1', 'h2', 'img', 'figure', 'figcaption',
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    '*': ['class', 'style'],
};

/**
 * Sanitizes textContent for RICH_TEXT blocks to prevent stored XSS.
 * Strips `<script>`, event handlers, and dangerous attributes.
 */
export function sanitizeBlockTranslations(
    type: string,
    translations?: Array<{ textContent?: string; [key: string]: any }>,
): void {
    if (type !== ContentBlockType.RICH_TEXT || !translations) return;
    for (const t of translations) {
        if (t.textContent) {
            t.textContent = sanitizeHtml(t.textContent, {
                allowedTags: ALLOWED_TAGS,
                allowedAttributes: ALLOWED_ATTRIBUTES,
            });
        }
    }
}
