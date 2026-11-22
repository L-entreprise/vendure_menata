# CRM plugin

In-house CRM on top of Vendure customers, customer groups and orders. Spec: "CRM Vendure -
fonctionnalités validées avant cahier des charges" (v3), V1 scope (the V2 sales dashboards
are not included). RGPD items are tracked separately (`menata-docs/docs/crm-rgpd-a-traiter.md`).

## What it covers (CDC references)

| Area | Features |
|---|---|
| Customers | Company hint (C1), company suggestions by click (C2), configurable status with history entry (C3, C4), company and greyed ancestors (C5), several roles (C6), lead source (C7), `CLI-` code (I1) |
| Groups | Type (G7), company data (G8), hierarchy with several parents, loop and 5-level checks, orphaned children on delete (G1-G6), `GRP-` code (I2), tree page |
| Prospect / client | Computed from counted orders (payment settled, not cancelled, not fully refunded) for companies and groups of companies, direct or through a subsidiary, dormant after a configurable threshold, nightly job (T1-T4) |
| Membership rules | Customers / groups / both (R1, R2), one company per customer with "move" (R3), pickers only offer allowed groups (R4), type or scope changes cannot strand members (R5) |
| Addresses | Company address book (A1), draft order by company with proposed addresses (A2, A3), frozen copies on orders (A4), nothing on the shop (A5) |
| Notes | Named authors (N1), notes block with pinning (N2), author-only edit and delete on customer, order and group notes, super admin may delete (N3), group notes (N4), company journal (N5) |
| Follow-ups | Follow-ups from a note or directly, assigned to their author (K1), "Mes relances" page and home widget (K2), @mentions with autocomplete (K3), toolbar notifications and daily "due today" job (K4) |
| Search | Toolbar search by name, e-mail or code, `/crm/code/<code>` (S1, I3) |
| Duplicates | Live e-mail check on the new customer page (D2), duplicate and multi-company audits with merge (D3) |
| Sales | Company frozen on each order and sales rep (O1, O6), group orders with subsidiary and contact, totals and filters (O2-O5) |
| Settings | Super admin page: statuses and transitions, dormant threshold, role and lead source lists |

## Rules that hold on direct API calls

These native mutations are redeclared with the same names, permissions and service calls,
so a direct API call cannot bypass the rules: `createCustomerGroup`, `updateCustomerGroup`,
`addCustomersToGroup`, `updateCustomerNote`, `deleteCustomerNote`, `updateOrderNote`,
`deleteOrderNote`, `createDraftOrder`. Rerun the e2e specs on every Vendure upgrade: a
renamed argument or a new native entry point would bypass a rule silently.

## Compatibility

- Declared `compatibility: '^3.5.3'` (dashboard toolbar items need 3.5.3; scheduled tasks 3.3;
  history entry components 3.4.3). Vendure checks it with `includePrerelease`, so 3.x pre-releases load.
- Verified on Vendure 3.7.4 and 3.8.2 (e2e, `tsc`, dashboard build) and on the 3.9 pre-release.
- No change to any `@vendure/*` package: everything is plugin code, native mutations are only
  redeclared through the plugin API.
- SQL is portable across Postgres, MySQL / MariaDB and SQLite (no `||` concatenation, no
  `ESCAPE` clause, no database-specific functions beyond `LOWER` / `TRIM`). The CRM specs pass
  on SQLite (CI), PostgreSQL 16 and MariaDB 11 (run by hand on throwaway containers).
- The company and sales rep of an order are frozen inside the transaction that places it
  (blocking `OrderPlacedEvent` handler, Vendure 2.2+); an application error there is logged
  and does not block the sale. Lifecycle refreshes run after commit.

## Permissions

`CrmAdmin` (custom permission, held by SuperAdmin): group types and allowed members,
hierarchy, settings, audits and merges, changing the company of an order, deleting anyone's
note. Sales reps need the native customer, customer group and order permissions only.

`requiresPermission` on a custom field hides it from reads too, so structure fields stay
readable and their writes are guarded in the resolvers.

## Scheduled tasks

`crm-due-tasks` (07:00, follow-ups due today) and `crm-lifecycle` (02:30, dormancy). They need
`DefaultSchedulerPlugin`. Dates are calendar days in the server time zone: set `TZ=Europe/Paris`.

## Database

New tables and custom fields. With `DB_SYNCHRONIZE=false` (production), generate a migration
from `deploy/` (`npm run migration:generate`) before deploying.

## Not in V1

- V2 dashboards (consolidated revenue, conversion by sales rep, quotes).
- Enriching customers created from CMS form submissions (lead source, company hint,
  address): the CMS already creates the customer; wire this when the CMS gets typed fields.
- External notifications (e-mail) for mentions and follow-ups (V2 / V3).

## Tests

```bash
cd deploy && npx vitest run --config vitest.config.mts plugins/crm-plugin
```
