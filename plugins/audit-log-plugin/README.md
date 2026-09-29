# Audit Log Plugin

Records admin and shop activity into a queryable audit trail, with a SuperAdmin-only
dashboard page.

- **Export:** `AuditLogPlugin` (`audit-log.plugin.ts`)
- **Entity:** `AuditLogEntry`
- **Service:** `AuditLogService` (exported — other plugins can log into the trail)
- **Dashboard route:** `/audit-log`, nav item under **Settings**, SuperAdmin only
- **Compatibility:** Vendure `^3.0.0`
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
| `retentionDays` | `number` | `90` | Age cutoff used by `AuditLogService.pruneOldEntries()` |

Env var used by `deploy/vendure-config.ts`: `AUDIT_LOG_RETENTION_DAYS`.

> **Note:** `pruneOldEntries(retentionDays)` exists on the service but is **not yet
> scheduled** — nothing calls it automatically. The option is currently only a stored
> setting. Wire it to a scheduled task (`DefaultSchedulerPlugin`) if you need the trail
> to self-trim.

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

- `docs/cms-plugin-guide.md` §8
- `../../ADD-PLUGINS-TO-NEW-VENDURE.md` — installing this plugin in another Vendure

## Used by other plugins

`cms-plugin` and `translation-plugin` import this plugin (`AuditLogPlugin` in their
module `imports`, `AuditLogService` in their services) by relative path
`../audit-log-plugin/...`. Keep this folder as a **sibling** of theirs and register
`AuditLogPlugin` whenever either of them is registered.
