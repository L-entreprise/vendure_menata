# Guide Coolify - Environnement PROD Vendure + Plugin Menata

Ce guide est la version production du guide dev, pour deployer ton fork Vendure avec le plugin `plugins/menata-branding` sur Coolify.

Objectif:
- base de donnees propre,
- API et Worker separes,
- dashboard Menata accessible en prod,
- migrations controlees,
- configuration securisee.

## 1) Architecture cible (prod)

- 1 service DB (MariaDB ou Postgres)
- 1 service `vendure-api` (HTTP port 3000)
- 1 service `vendure-worker` (sans port public)
- 1 domaine public sur `vendure-api`

Le dashboard est servi par Vendure sur `/dashboard`.

## 2) Prerequis code (obligatoire)

Dans ton repo:
- `plugins/menata-branding/*` present
- `packages/dev-server/dev-config.ts` charge `MenataBrandingPlugin`
- `packages/dev-server/vite.config.mts` configure bien le dashboard

Important:
- `npx vite build` est obligatoire avant run en prod (sinon dashboard non servi correctement).

## 3) Creer la DB dans Coolify

1. `Create New Resource` -> `Database` -> `MariaDB` (ou Postgres).
2. Active un volume persistant.
3. Note les infos:
   - host interne (ex: `mariadb`)
   - port (3306 MariaDB / 5432 Postgres)
   - database
   - username
   - password

Attention:
- `DB_HOST` doit etre un host (`mariadb`), pas une URL complete.

## 4) Creer le service API (vendure-api)

1. `Create New Resource` -> `Application` -> ton repo Git
2. Build pack: `Nixpacks`
3. Branch: `menata_branding` (ou ta branche cible)
4. Base directory: `/`
5. Port expose: `3000`

Commandes:

- Install Command
```bash
npm ci --include=dev
```

- Build Command
```bash
npm run build && cd packages/dev-server && npx vite build
```

- Start Command (API)
```bash
npm run --workspace packages/dev-server dev:server
```

## 5) Variables d environnement API (prod)

Exemple MariaDB:

```bash
NODE_ENV=production
APP_ENV=production
DB=mysql
DB_HOST=mariadb
DB_PORT=3306
DB_NAME=vendure_prod
DB_USERNAME=vendure
DB_PASSWORD=strong-password
COOKIE_SECRET=long-random-secret
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=change-me-now
```

Notes:
- Change tous les secrets en vrai.
- Garde `RUN_JOB_QUEUE` vide sur l API si tu utilises un Worker separe.

## 6) Creer le service Worker (vendure-worker)

Duplique le service API, puis adapte:

- Port public: aucun
- Start Command
```bash
npm run --workspace packages/dev-server dev:worker
```

Variables d environnement: les memes que l API (DB + secrets).

## 7) Migrations en prod

Le serveur execute deja `runMigrations(devConfig)` au boot.
Pour garder du controle, lance d abord l API seule au premier deploy, verifie les logs, puis active le worker.

Si besoin manuel:
```bash
cd packages/dev-server
node -r ts-node/register -r dotenv/config -r tsconfig-paths/register migration.ts run
```

## 8) Donnees initiales / demo

En production reelle:
- ne pas lancer `populate` (ca reset la DB).

En preprod/demo uniquement:
```bash
npm run --workspace packages/dev-server populate
```

## 9) Domaine et acces

Dans Coolify (service API):
- ajoute ton domaine (ex: `commerce.ton-domaine.com`)
- active HTTPS

URLs a tester:
- `https://<domaine>/health`
- `https://<domaine>/admin-api`
- `https://<domaine>/dashboard`

## 10) Checklist post-deploiement

- Login dashboard OK
- Branding Menata visible (logo + couleurs)
- CRUD produit OK
- Worker actif (jobs traites)
- Pas d erreur DB dans les logs

## 11) Hardening recommande (apres go-live)

Ton `dev-config.ts` reste un setup de dev. Pour une vraie prod durable:

1. Creer `prod-config.ts`
2. Retirer plugins dev (`GraphiqlPlugin`, `ReviewsPlugin`, mailbox dev, etc.)
3. Verifier `synchronize: false`
4. Ajouter `HardenPlugin`
5. Garder API et Worker separes
6. Mettre backups DB + monitoring + alerting

## 12) Erreurs frequentes

- `Error occurred while trying to proxy localhost:3000`
  - arrive en mode Vite dev dashboard sans backend.
  - en prod Coolify, utilise toujours le dashboard build servi par l API.

- Dashboard 404 ou page blanche
  - `npx vite build` manquant dans build command
  - mismatch entre `base: '/dashboard/'` et `route: 'dashboard'`

- DB ne connecte pas
  - `DB_HOST` mis en URL complete au lieu du host
  - mauvais user/password
  - port DB incorrect

