/**
 * DI token under which the resolved {@link DiagnosticsPluginOptions} are provided.
 * Kept as a string-typed `InjectionToken` so the service can depend on it without
 * importing the plugin class (avoids a circular import).
 */
export const DIAGNOSTICS_PLUGIN_OPTIONS = 'DIAGNOSTICS_PLUGIN_OPTIONS';

/**
 * Default time-to-live (ms) for the in-memory cache of the Menata response.
 * The business validity window lives on Menata (single source of truth); this
 * cache only avoids hammering the central API on every admin page open.
 */
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Default timeout (ms) for the server-to-server call to the Menata API.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 10 * 1000;
