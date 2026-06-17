/**
 * Configuration for the {@link DiagnosticsPlugin}. Every value is per-instance and
 * MUST be supplied from environment variables in `vendure-config.ts` — never hardcoded.
 * Each Menata client has its own Vendure deployment, so each gets its own `clientId`
 * and `apiKey`.
 */
export interface DiagnosticsPluginOptions {
    /**
     * Base URL of the Menata site that owns the diagnostic (no trailing slash).
     * e.g. `https://menata.fr`. From `MENATA_API_BASE_URL`.
     */
    apiBaseUrl: string;
    /**
     * Per-client Bearer key authorising this instance to read its own diagnostic.
     * From `MENATA_DIAGNOSTIC_API_KEY`. Server-to-server only; never sent to the browser.
     */
    apiKey: string;
    /**
     * Opaque client identifier that Menata maps to a diagnostic slug + validity window.
     * From `MENATA_CLIENT_ID`.
     */
    clientId: string;
    /**
     * Where the admin "order a new diagnostic" CTA points when none is available or
     * the current one has expired. From `DIAGNOSTICS_CTA_URL`. Optional.
     */
    ctaUrl?: string;
    /**
     * Override the in-memory cache TTL (ms). Optional.
     */
    cacheTtlMs?: number;
    /**
     * Override the server-to-server request timeout (ms). Optional.
     */
    requestTimeoutMs?: number;
}

/**
 * Shape returned by the Menata `POST /api/client/diagnostic` endpoint.
 * Discriminated on `expired` / presence of `html`.
 */
export interface MenataDiagnosticResponse {
    /** True when Menata has no diagnostic mapped to this client at all. */
    notFound?: boolean;
    /** True when a diagnostic exists but its validity window has passed. */
    expired?: boolean;
    /** Human title of the diagnostic. */
    title?: string;
    /** Frozen diagnostic HTML. Present only when valid (not expired / not found). */
    html?: string;
    /** Unix epoch (seconds) at which the diagnostic stops being shown. */
    validUntil?: number;
}

/**
 * Normalised result surfaced through the Admin GraphQL API and rendered by the
 * dashboard page.
 */
export interface DiagnosticResult {
    /** A valid, non-expired diagnostic exists and `html` is populated. */
    available: boolean;
    /** A diagnostic existed but its window has passed (drives the CTA state). */
    expired: boolean;
    title?: string;
    html?: string;
    /** ISO-8601 string for display, derived from the Menata `validUntil`. */
    validUntil?: string;
    /** CTA URL to order on menata.fr (echoed from options for the frontend). */
    ctaUrl?: string;
}
