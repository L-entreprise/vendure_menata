# Deploiement Prod avec Plugin Menata

Ce guide decrit un deploiement "comme en prod" depuis un fork Vendure, avec application du plugin `plugins/menata-branding`.

## 1) Prerequis

- Node.js >= 20.19.0
- npm
- base de donnees (MariaDB/MySQL ou Postgres)
- acces shell au serveur

## 2) Etat du code attendu

Le plugin est dans:

- `plugins/menata-branding`

Le serveur charge le plugin dans:

- `packages/dev-server/dev-config.ts`

avec import:

```ts
import { MenataBrandingPlugin } from '../../plugins/menata-branding/menata-branding.plugin';
```

et presence dans `plugins: [ ... ]`.

## 3) Variables d environnement (serveur)

Exemple minimal (MariaDB/MySQL):

```bash
DB=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=vendure
DB_PASSWORD=change-me
DB_NAME=vendure-prod
COOKIE_SECRET=change-me-very-long
```

Notes:
- le `dev-config.ts` lit deja `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME`
- change les secrets avant prod

## 4) Build depuis la racine

Depuis le root du repo:

```bash
npm ci
npm run build
```

Build Dashboard (assets servis par `DashboardPlugin` via `packages/dev-server/dist`):

```bash
cd packages/dev-server
npx vite build
cd ../..
```

## 5) Lancement "prod-like"

API/Server:

```bash
npm run --workspace packages/dev-server dev:server
```

Worker (recommande en process separe):

```bash
npm run --workspace packages/dev-server dev:worker
```

Endpoints:
- Dashboard: `http://<host>:3000/dashboard`
- Admin API: `http://<host>:3000/admin-api`
- Health: `http://<host>:3000/health`

## 6) Check rapide post-deploiement

- ouvrir `/dashboard/login`
- verifier logo Menata sur login
- verifier les couleurs du theme dashboard
- login admin OK
- creation/modification produit OK

## 7) Passage en vraie prod (important)

Le `dev-config.ts` contient des plugins et options de dev. Pour une vraie prod:

1. creer un `prod-config.ts` dedie
2. retirer les plugins de dev (ex: `GraphiqlPlugin`, plugins de test, mailbox dev)
3. desactiver playground/debug GraphQL
4. conserver `synchronize: false`
5. gerer les migrations explicitement
6. lancer via process manager (`systemd`/`pm2`) derriere reverse proxy (`nginx`/`traefik`)

## 8) Migrations

Commandes utiles:

```bash
cd packages/dev-server
node -r ts-node/register -r dotenv/config -r tsconfig-paths/register migration.ts run
```

Le `index.ts` lance aussi `runMigrations(devConfig)` au demarrage.

## 9) Strategie "fork propre + plugin"

Pour garder un flux propre:
- garder le plugin dans `plugins/menata-branding`
- eviter les patches du core dashboard (`packages/dashboard/src/...`)
- appliquer le branding dashboard via:
  - extension plugin (login, composants)
  - `packages/dev-server/vite.config.mts` (theme)

