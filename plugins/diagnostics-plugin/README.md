# Diagnostics Plugin

Surfaces a client's frozen **Menata web-diagnostic** report inside their Vendure admin
dashboard. When the report's validity window passes, the page flips to a CTA to order a
new one on menata.fr.

## Architecture — "central authority + thin plugin"

```
MENATA (central, Nuxt)                      VENDURE CLIENT (per instance)
─────────────────────                       ─────────────────────────────
POST /api/client/diagnostic                 DiagnosticsPlugin
 auth: Bearer <per-client key>               env: MENATA_DIAGNOSTIC_API_KEY + MENATA_CLIENT_ID
 maps clientId -> slug + validUntil          on admin "Web Diagnostic" page open:
 now > validUntil -> { expired: true }        1. resolver POSTs Menata w/ per-client key
 else -> returns HTML (server-to-server)      2. receives HTML | { expired } | { notFound }
                                              3. render HTML in <iframe sandbox srcDoc>
 SINGLE SOURCE OF TRUTH for duration          4. expired/none -> CTA -> menata.fr
```

The diagnostic HTML and its validity window live **only on Menata**. This plugin stores
nothing — it proxies on demand.

## Why this design is the secure choice

1. **Server-to-server.** Vendure↔Menata is authed by a per-client Bearer key, not the
   public signed URL. The signed URL / HTML never reaches the client's browser, so
   there's nothing leakable in DOM or history.
2. **Sandboxed render.** HTML goes into `<iframe sandbox="allow-scripts allow-popups" srcDoc>`
   — opaque origin, no `allow-same-origin`, so hostile JS can't reach the Vendure session.
3. **Single source of truth.** The validity window (e.g. 14 days) is enforced once on
   Menata; every instance respects it, no per-instance sync.
4. **Per-client isolation.** A client's key only authorises its own `clientId` → client A
   can't read client B's diagnostic.

## Configuration (env, per instance)

All options come from env vars in `deploy/vendure-config.ts`. Never hardcode.

| Env var                       | Required | Description                                              |
| ----------------------------- | -------- | -------------------------------------------------------- |
| `MENATA_API_BASE_URL`         | yes      | Menata site origin, e.g. `https://menata.fr` (no trailing slash) |
| `MENATA_DIAGNOSTIC_API_KEY`   | yes      | Per-client Bearer key (server-to-server only)            |
| `MENATA_CLIENT_ID`            | yes      | Opaque client id Menata maps to a diagnostic             |
| `DIAGNOSTICS_CTA_URL`         | no       | CTA target when expired/none (default: order page URL)   |
| `DIAGNOSTICS_CACHE_TTL_MS`    | no       | In-memory cache TTL, default 300000 (5 min)              |

Wire-up in `vendure-config.ts`:

```ts
import { DiagnosticsPlugin } from '../plugins/diagnostics-plugin/diagnostics.plugin';

// ...
plugins: [
    // ...
    ...(process.env.MENATA_DIAGNOSTIC_API_KEY
        ? [
              DiagnosticsPlugin.init({
                  apiBaseUrl: process.env.MENATA_API_BASE_URL!,
                  apiKey: process.env.MENATA_DIAGNOSTIC_API_KEY!,
                  clientId: process.env.MENATA_CLIENT_ID!,
                  ctaUrl: process.env.DIAGNOSTICS_CTA_URL,
                  cacheTtlMs: process.env.DIAGNOSTICS_CACHE_TTL_MS
                      ? Number(process.env.DIAGNOSTICS_CACHE_TTL_MS)
                      : undefined,
              }),
          ]
        : []),
],
```

The plugin is only enabled when `MENATA_DIAGNOSTIC_API_KEY` is set, so instances without a
diagnostic simply don't show the nav item.

## Menata-side work

This plugin depends on **one new authenticated endpoint** on the Menata Nuxt site:
`POST /api/client/diagnostic`. See `MENATA-DIAGNOSTICS-ENDPOINT.md` at the repo root for
the full implementation spec.

## API

Admin GraphQL:

```graphql
query {
    diagnostic {
        available   # valid, non-expired diagnostic exists; html populated
        expired     # existed but window passed
        title
        html        # frozen diagnostic HTML (null when unavailable/expired)
        validUntil
        ctaUrl
    }
}
```

Gated by `Permission.Authenticated` — any logged-in admin of the instance can view.
