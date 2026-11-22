# CRM plugin (POC)

In-house CRM on top of Vendure customers and customer groups. Spec: "CRM Vendure -
fonctionnalités validées avant cahier des charges" (v3). RGPD items are tracked
separately and deferred until after the POC.

## What the POC covers

| CDC | What | Where |
|---|---|---|
| G7, R1 | `groupType` and `memberScope` custom fields on `CustomerGroup` (super admin only). An empty scope is filled from the type on creation. | `config/custom-fields.ts`, `api/customer-group-guard.resolver.ts` |
| G7, R1 | `CustomerGroup.crmGroupType` / `crmMemberScope`: read-only fields every group reader sees. Needed because `requiresPermission` on a custom field also hides it from reads, so sales reps could not see the type. | `api/api-extensions.ts`, `api/customer-group-crm-fields.resolver.ts` |
| R2 | A group reserved for groups refuses customers. | `services/membership-rules.service.ts` |
| R3 | A customer belongs to one company at most. | idem |
| N1 | The note author is shown by name, including to a sales rep without `ReadAdministrator` (native in Vendure 3.8). | e2e only |
| N3 | Only the author edits or deletes a note; `CrmAdmin` (super admin) may delete any note, never edit it. | `services/note-ownership.service.ts`, `api/customer-note-guard.resolver.ts` |
| C5, A2 | "Company" block on the customer page and the draft order page; "CRM rules" block on the customer group page. | `dashboard/` |

## Native mutations are replaced, not wrapped

`createCustomerGroup`, `addCustomersToGroup`, `updateCustomerNote` and `deleteCustomerNote`
are redeclared by the plugin resolvers with the same names, permissions and service calls.
Vendure merges plugin resolvers after its own, so the plugin versions run and a direct API
call cannot bypass the rules. The e2e specs prove it; rerun them on every Vendure upgrade,
since a renamed argument or a new native entry point (e.g. a bulk mutation) would bypass the
rules silently.

Not guarded yet: `updateCustomerGroup` changing the type or scope of a populated group (R5),
order notes (`updateOrderNote` / `deleteOrderNote`).

## Permissions

`CrmAdmin` is a custom permission. The SuperAdmin role holds it automatically; never give it
to the sales rep role.

## Database

New custom fields on `CustomerGroup`. With `DB_SYNCHRONIZE=false` (production), generate a
migration from `deploy/` (`npm run migration:generate`) before deploying.

## Tests

```bash
cd deploy && npx vitest run --config vitest.config.mts plugins/crm-plugin
```
