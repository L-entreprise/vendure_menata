# Audit Log Plugin

Records admin and shop activity into a queryable audit trail, with a SuperAdmin-only
dashboard page.

- **Export:** `AuditLogPlugin` (`audit-log.plugin.ts`)
- **Entity:** `AuditLogEntry`
- **Service:** `AuditLogService` (exported — other plugins can log into the trail)
- **Dashboard route:** `/audit-log`, nav item under **Settings**, SuperAdmin only
- **Compatibility:** Vendure `^3.3.0`
- **Extra npm deps:** none

## Register

```ts
import { AuditLogPlugin } from './plugins/audit-log-plugin/audit-log.plugin';

plugins: [
    AuditLogPlugin.init({
        retentionDays: Number(process.env.AUDIT_LOG_RETENTION_DAYS) || 90,
    }),
    // ... DashboardPlugin must come after
]
```

| Option | Type | Default | Meaning |
|---|---|---|---|
| `retentionDays` | `number` | `90` | Entries older than this are deleted every night |

Env var used by `deploy/vendure-config.ts`: `AUDIT_LOG_RETENTION_DAYS`.

The plugin registers a `prune-audit-log` scheduled task (daily at 03:00) that calls
`pruneOldEntries(retentionDays)`. It needs `DefaultSchedulerPlugin` (or another scheduler
strategy) to be registered, hence Vendure `^3.3.0`.

## GDPR (RGPD)

The trail is a security log kept under legitimate interest (art. 6.1.f). To keep it
compliant:

- **Storage limitation (art. 5.1.e):** entries are purged after `retentionDays`
  (default 90, CNIL recommends 6 to 12 months max for security logs).
- **Data minimisation (art. 5.1.c):** subjects are referenced by id only (`userId`,
  `entityId`, `customerId`). Names, emails, phone numbers and postal addresses in
  mutation input are stored as `[redacted]` (the field name stays, so you still see
  *what* changed). Login identifiers are masked (`j***@example.com`).
- **Secrets:** passwords, hashes and tokens are dropped from the payload entirely.
- **Access:** SuperAdmin only.
- **IP address** is kept (personal data) for security investigation; it expires with
  the entry.
- **Erasure requests:** once a customer is deleted, remaining entries only hold ids and
  IPs and expire with the retention window. Use `clearAuditLog` if an immediate purge
  is required.

Entries written before this change may still contain clear personal data; they are
removed by the first nightly purge past the retention window.

## What it records

`onApplicationBootstrap` subscribes to **54 Vendure events** via the `EventBus`. Each one
becomes an `AuditLogEntry` with an `action`, a `category`, a `severity` and a structured
`detail` payload.

| Category | Events covered |
|---|---|
| `auth` | Login, Logout, AttemptedLogin, AccountRegistration, AccountVerified, PasswordReset(+Verified), IdentifierChange(+Request) |
| `catalog` | Product, ProductVariant, ProductVariantPrice, ProductChannel, ProductVariantChannel, ProductOption, ProductOptionGroup(+Change), Collection(+Modification), Facet, FacetValue, Asset, AssetChannel |
| `order` | Order, OrderStateTransition, OrderPlaced, OrderLine, CouponCode |
| `payment` | PaymentStateTransition, PaymentMethod, Refund, RefundStateTransition |
| `fulfillment` | Fulfillment, FulfillmentStateTransition |
| `customer` | Customer, CustomerAddress, CustomerGroup, CustomerGroupChange |
| `promotion` | Promotion |
| `stock` | StockMovement, StockLocation |
| `settings` | Channel, Zone, ZoneMembers, Country, TaxCategory, TaxRate(+Modification), ShippingMethod, Seller |
| `system` | Role, RoleChange, Administrator, GlobalSettings |

**Severity** is `info` by default. Escalated:

- `warning` — AttemptedLogin, PasswordResetRequested, IdentifierChangeRequested,
  RefundCreated, RefundStateTransition, Channel\*, GlobalSettings\*
- `critical` — Role\*, RoleChange, Administrator\*

For create/update/delete events the `detail` payload captures what changed (`created`
lists the input, `updated` the changed fields, `deleted` what was removed).

## Entity: `AuditLogEntry`

| Column | Type | Indexed | Notes |
|---|---|---|---|
| `action` | `varchar` | ✅ | e.g. `Login`, `ProductCreated`, `OrderStateTransition` |
| `category` | `varchar` (default `other`) | ✅ | see table above |
| `entityType` | `varchar` (default `''`) | ✅ | `Product`, `Order`, `Customer`, … |
| `entityId` | `varchar` nullable | | id of the affected entity |
| `userId` | `varchar` nullable | ✅ | who did it |
| `userName` | `varchar` nullable | | email or display name |
| `apiType` | `varchar` nullable | ✅ | `admin` or `shop` |
| `ipAddress` | `varchar` nullable | | from the request, when available |
| `severity` | `varchar` (default `info`) | ✅ | `info` \| `warning` \| `critical` |
| `success` | `boolean` (default `true`) | | false for failed attempts |
| `detail` | `simple-json` nullable | | action-specific payload |
| `channels` | ManyToMany `Channel` | | entries are channel-scoped |

Adding this plugin adds tables, so run once with `DB_SYNCHRONIZE=true` or generate a
migration.

## Admin API

All operations are `@Allow(Permission.SuperAdmin)`.

```graphql
query {
    auditLog(options: { take: 50, skip: 0 }) {
        items { id createdAt action category entityType entityId userName apiType ipAddress severity success detail }
        totalItems
    }
    auditLogStats {
        totalEntries
        todayEntries
        categories { category count }
        topUsers { userName count }
        recentCritical { id action severity createdAt }
    }
}

mutation {
    clearAuditLog   # deletes every entry, returns the count removed
}
```

`AuditLogEntryListOptions` is generated at runtime by the `ListQueryBuilder`, so the
usual `filter` / `sort` / `take` / `skip` are available on the indexed columns.

## Service API

`AuditLogService` is exported, so another plugin can import `AuditLogPlugin` and write
its own entries (this is what `translation-plugin` does).

```ts
await this.auditLogService.log(ctx, {
    action: 'CmsPageTranslated',
    category: 'catalog',
    entityType: 'CmsPage',
    entityId: page.id,
    detail: { languageCode },
});
```

| Method | Purpose |
|---|---|
| `findAll(ctx, options?)` | Paginated, channel-filtered list |
| `log(ctx, input)` | Write an entry (user/IP extracted from `ctx`) |
| `getStats(ctx)` | Totals, per-category counts, top users, recent critical |
| `clearAll()` | Delete everything, returns count |
| `pruneOldEntries(days)` | Delete entries older than `days`, returns count |

## Dashboard

`dashboard/audit-log-list.tsx` — filterable list with expandable rows showing the
`detail` JSON, plus the stats header. Registered at `/audit-log`, nav section
`settings`, icon `Shield`, `requiresPermission: 'SuperAdmin'`. Strings are translated
via Lingui PO files in `dashboard/i18n/{en,fr}.po`.

## See also

- `menata-docs/docs/cms-plugin-guide.md` §8 (local, untracked)
- `menata-docs/ADD-PLUGINS-TO-NEW-VENDURE.md` (local, untracked) — installing this plugin in another Vendure

## Used by other plugins

`cms-plugin` and `translation-plugin` import this plugin (`AuditLogPlugin` in their
module `imports`, `AuditLogService` in their services) by relative path
`../audit-log-plugin/...`. Keep this folder as a **sibling** of theirs and register
`AuditLogPlugin` whenever either of them is registered.
