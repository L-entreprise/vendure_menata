# Guide Coolify - Environnement DEV Vendure + Plugin Menata

Ce guide te donne une procedure complete pour deployer ton fork Vendure sur Coolify en environnement de developpement, avec:
- base de donnees,
- plugin `plugins/menata-branding`,
- migrations,
- donnees de demo (produits random Vendure),
- acces web propre.

## 1) Architecture cible

- 1 service DB (MariaDB)
- 1 service App Vendure (API + Dashboard)
- Le Dashboard est servi par Vendure sur `/dashboard`

Note: en mode DEV simple, on lance le job queue dans le meme process avec `RUN_JOB_QUEUE=1`.

## 2) Pre-requis

- Ton repo Git avec:
  - `plugins/menata-branding/*`
  - `packages/dev-server/dev-config.ts` qui importe `MenataBrandingPlugin`
  - `packages/dev-server/vite.config.mts` (theme dashboard + pathAdapter)
- Node 20+ (Coolify/Nixpacks)

## 3) Creer la base de donnees dans Coolify

1. Dans Coolify: `Create New Resource` -> `Database` -> `MariaDB`.
2. Donne un nom, ex: `vendure-dev-db`.
3. Definis:
   - Database name (ex: `vendure_dev`)
   - Username
   - Password
4. Active un volume persistant.
5. Deploy la DB.
6. Recupere ensuite les infos de connexion (host interne, port, user, password, db name).

## 4) Creer le service application dans Coolify

1. `Create New Resource` -> `Application` -> ton repo Git.
2. Build pack: `Nixpacks`.
3. Branch: ta branche de deploiement (ex: `menata_branding`).
4. Base Directory: `/` (racine du repo).
5. Port expose: `3000`.

### Commandes a configurer

- Install Command:
```bash
npm ci --include=dev
```

- Build Command:
```bash
npm run build && cd packages/dev-server && npx vite build
```

- Start Command:
```bash
npm run --workspace packages/dev-server dev:server
```

Pourquoi `--include=dev`: `dev:server` utilise `ts-node`.

## 5) Variables d environnement (App)

Ajoute ces variables dans Coolify (service App):

```bash
DB=mysql
DB_HOST=<host_interne_mariadb>
DB_PORT=3306
DB_USERNAME=<user_db>
DB_PASSWORD=<password_db>
DB_NAME=<database_name>
RUN_JOB_QUEUE=1
```

Optionnel:
```bash
NODE_ENV=development
```

## 6) Premier deploiement

1. Lance `Deploy` sur le service App.
2. Verification logs:
   - migrations executees (`runMigrations`)
   - plugin charge (`MenataBrandingPlugin`)
   - serveur demarre sur port `3000`

## 7) Seed de donnees de demo (produits random Vendure)

Important: cette commande vide les tables avant de re-populer.
Fais-la uniquement sur l environnement de dev.

Depuis le terminal du conteneur App (Coolify Exec):

```bash
npm run --workspace packages/dev-server populate
```

La commande:
- reset la DB,
- charge les donnees initiales Vendure,
- ajoute des produits depuis le CSV de demo,
- ajoute des clients de test.

## 8) Rendre accessible proprement

1. Dans Coolify, configure un domaine sur le service App (ex: `vendure-dev.ton-domaine.com`).
2. Active HTTPS/SSL (Let’s Encrypt) dans Coolify.
3. Verifie les routes:
   - `https://<domaine>/health`
   - `https://<domaine>/admin-api`
   - `https://<domaine>/dashboard`

## 9) Verifications fonctionnelles

- Login dashboard OK
- Branding Menata visible sur login
- Theme dashboard applique
- Liste produits visible apres `populate`

## 10) Troubleshooting rapide

- `Error occurred while trying to proxy localhost:3000`:
  - arrive en dev local quand Vite dashboard tourne sans backend.
  - sur Coolify, utilise le dashboard build servi par Vendure (`/dashboard`), pas `vite dev`.

- Dashboard blanc / 404:
  - verifier que `npx vite build` est bien dans la Build Command.
  - verifier `DashboardPlugin.init({ route: 'dashboard', appDir: .../dist })`.

- Pas de donnees:
  - relancer `populate` sur l environnement DEV.

- Jobs qui ne tournent pas:
  - verifier `RUN_JOB_QUEUE=1` ou mettre un worker separe.

## 11) Option recommandee ensuite (plus propre)

Quand tu passes en preprod/prod:
- separe API et Worker en 2 services Coolify:
  - API: `dev:server` sans `RUN_JOB_QUEUE=1`
  - Worker: `npm run --workspace packages/dev-server dev:worker`
- desactive les plugins/outils purement dev.

