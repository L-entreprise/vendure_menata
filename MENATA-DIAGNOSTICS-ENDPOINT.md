# Menata — Diagnostics endpoint for Vendure clients

**Audience:** developer working on the Menata Nuxt site (`C:\Users\aleks\Documents\Dev\Menata`).
**Goal:** add **one** authenticated, server-to-server endpoint so each client's Vendure
admin can display that client's frozen web-diagnostic, and have it auto-expire after a
business validity window — without ever exposing the signed storage URL or HTML to a
browser.

This extends the **existing** storage-link system (`LINK_GENERATION.md`,
`server/api/admin/storage-link.post.ts`, `server/api/storage/[slug].get.ts`). Reuse it;
do not reinvent. The Vendure side is already built (`plugins/diagnostics-plugin`); it
calls the endpoint below.

---

## 1. How it fits together

```
VENDURE CLIENT (per instance)                MENATA (this site)
─────────────────────────────               ──────────────────
DiagnosticsPlugin resolver                   NEW: POST /api/client/diagnostic
 env: MENATA_DIAGNOSTIC_API_KEY               auth: Bearer <per-client key>
      MENATA_CLIENT_ID                         body: { clientId }
                                               1. verify key matches clientId (timing-safe)
 POST { clientId } + Bearer key  ───────────▶  2. find slug mapped to clientId
                                               3. now > validUntil -> { expired: true }
 receive HTML | {expired} | {notFound} ◀────   4. else read storage/<slug>.html, return html
 render in <iframe sandbox srcDoc>             SINGLE SOURCE OF TRUTH for the window
```

Key points (the security rationale):

- The diagnostic HTML moves **server-to-server only**. It is never put in a browser, a
  URL, or history. So a leaked link is not a risk for the Vendure path.
- The **validity window is owned here** (`validUntil` per diagnostic). Every Vendure
  instance respects it; there is nothing to sync per instance.
- A client's key authorises **only its own `clientId`**, so client A can't read client B.

---

## 2. Per-client API keys

Each client's Vendure instance is given a distinct Bearer key (you control all deploys).
Store the `clientId → key` map server-side as an env var holding JSON, exposed via
`runtimeConfig` (private — never `public`).

`.env`:

```bash
# JSON object: { "<clientId>": "<bearer key>", ... }
DIAGNOSTIC_CLIENT_KEYS={"emoi":"ck_live_emoi_9f3...","rob":"ck_live_rob_7a1..."}
```

`nuxt.config.ts` → `runtimeConfig` (alongside the existing `storageLinkSecret` /
`adminApiKey`):

```ts
runtimeConfig: {
  storageLinkSecret: process.env.STORAGE_LINK_SECRET,
  adminApiKey: process.env.ADMIN_API_KEY,
  // NEW — parsed once at startup; invalid JSON fails fast.
  diagnosticClientKeys: JSON.parse(process.env.DIAGNOSTIC_CLIENT_KEYS || '{}'),
  // ...
}
```

> Generate keys with e.g. `openssl rand -hex 24`. Each value goes into the matching
> Vendure instance as `MENATA_DIAGNOSTIC_API_KEY`, and the key name (the `clientId`) goes
> in as `MENATA_CLIENT_ID`.

---

## 3. Extend `storage-config.json`

Add `clientId` and `validUntil` to the diagnostic(s) you want to expose. `validUntil` is a
**Unix epoch in seconds**. Files without a `clientId` keep working exactly as today (public
signed-link flow untouched).

`server/assets/data/storage-config.json`:

```json
{
  "files": {
    "emoi_naturopathie": {
      "title": "ANALYSE EMOI",
      "clientId": "emoi",
      "validUntil": 1781990400
    },
    "rob": {
      "title": "ANALYSE ROBISCHUNG LOCATION",
      "clientId": "rob",
      "validUntil": 1781990400
    }
  }
}
```

The frozen-HTML upload flow is unchanged: you still drop `storage/<slug>.html` as today.
To extend a client's window, bump their `validUntil`. To revoke, set it in the past (the
Vendure admin flips to the CTA) or remove `clientId`.

> **One diagnostic per client** is assumed here. For a history later, change the lookup to
> return the newest non-expired entry for the `clientId` and add a `createdAt`.

---

## 4. The endpoint

`server/api/client/diagnostic.post.ts` — modeled on `storage-link.post.ts` (same Bearer +
`timingSafeEqual` discipline) and `[slug].get.ts` (same asset read + HTML decode).

```ts
import { timingSafeEqual } from 'node:crypto'

// Constant-time compare — avoids leaking key length/content via timing.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

interface FileEntry {
  title?: string
  clientId?: string
  validUntil?: number // unix seconds
}
interface StorageConfig {
  files: Record<string, FileEntry>
}

// Reused verbatim from server/api/storage/[slug].get.ts — frozen HTML is stored
// with escaped sequences in some cases.
function decodeEscapedHtml(raw: string): string {
  if (!/\\[nrt"\\]/.test(raw)) return raw
  return raw
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
}

function bearer(event: any): string | null {
  const auth = getHeader(event, 'authorization') || ''
  const [scheme, token] = auth.split(' ')
  if (scheme !== 'Bearer' || !token) return null
  return token
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig()

  // ── 1. Auth: body.clientId + Bearer key must match the configured pair ──────
  const body = await readBody(event)
  const clientId = typeof body?.clientId === 'string' ? body.clientId.trim() : ''
  if (!clientId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing clientId' })
  }

  const keys = (runtimeConfig.diagnosticClientKeys || {}) as Record<string, string>
  const expectedKey = keys[clientId]
  const token = bearer(event)
  // Compare even when the client is unknown (against a dummy) to avoid revealing,
  // via timing/branching, whether the clientId exists.
  const ok = !!token && safeEqual(token, expectedKey || '\0invalid')
  if (!expectedKey || !ok) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // ── 2. Resolve the diagnostic mapped to this client ────────────────────────
  const storage = useStorage('assets:server')
  const configRaw = await storage.getItem('data/storage-config.json')
  if (!configRaw) {
    throw createError({ statusCode: 500, statusMessage: 'Configuration not found' })
  }
  const config: StorageConfig = typeof configRaw === 'string' ? JSON.parse(configRaw) : configRaw

  const entry = Object.entries(config.files).find(([, f]) => f.clientId === clientId)
  if (!entry) {
    // No diagnostic for this client — let the admin show "order one" CTA.
    return { notFound: true }
  }
  const [slug, fileConfig] = entry

  // ── 3. Validity window (single source of truth) ────────────────────────────
  const now = Math.floor(Date.now() / 1000)
  if (fileConfig.validUntil && now > fileConfig.validUntil) {
    return { expired: true, title: fileConfig.title || slug, validUntil: fileConfig.validUntil }
  }

  // ── 4. Return the frozen HTML directly (server-to-server) ──────────────────
  const htmlRaw = await storage.getItem(`storage/${slug}.html`)
  if (!htmlRaw) {
    // Config exists but HTML not uploaded yet — treat as not available.
    return { notFound: true }
  }
  const raw = Buffer.isBuffer(htmlRaw) ? htmlRaw.toString('utf8') : String(htmlRaw)

  return {
    title: fileConfig.title || slug,
    validUntil: fileConfig.validUntil,
    html: decodeEscapedHtml(raw),
  }
})
```

### Response contract (consumed by `plugins/diagnostics-plugin`)

| Case               | HTTP | Body                                                   |
| ------------------ | ---- | ------------------------------------------------------ |
| Valid diagnostic   | 200  | `{ title, validUntil, html }`                          |
| Expired window     | 200  | `{ expired: true, title, validUntil }`                 |
| No diagnostic / no HTML yet | 200 | `{ notFound: true }`                          |
| Bad/missing auth   | 401  | error                                                  |
| Missing clientId   | 400  | error                                                  |

The Vendure plugin already normalises all of these into its `DiagnosticResult` and
renders HTML in a sandboxed iframe or shows the menata.fr CTA.

---

## 5. Checklist

- [ ] Add `DIAGNOSTIC_CLIENT_KEYS` to `.env` (+ deploy secrets) and `runtimeConfig`.
- [ ] Add `clientId` + `validUntil` to the relevant entries in `storage-config.json`.
- [ ] Create `server/api/client/diagnostic.post.ts` (above).
- [ ] Hand each client's key → `MENATA_DIAGNOSTIC_API_KEY`, and its `clientId` →
      `MENATA_CLIENT_ID`, into that client's Vendure deployment env.
- [ ] Verify: `curl -X POST https://menata.fr/api/client/diagnostic -H "Authorization: Bearer <key>" -H "content-type: application/json" -d '{"clientId":"emoi"}'`
      returns the HTML; a wrong key returns 401; a past `validUntil` returns `{ expired: true }`.

---

## 6. Notes / decisions left open

- **History vs single** (handoff Q3): this spec returns one diagnostic per client. A
  history is a small change (return newest non-expired, add `createdAt`).
- **Expiry UX** (handoff Q6): the Vendure side currently shows a plain CTA on
  expiry/none. A blurred teaser would need the endpoint to also return a teaser image or
  truncated HTML on expiry — not included here.
