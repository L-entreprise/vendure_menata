# Menata Branding Plugin

Plugin de branding dashboard-only pour ce fork Vendure.

## Ce que fait le plugin

- logo de login dashboard via extension (`menata_deux_lignes.webp`), **inliné en data
  URI** dans `dashboard/menata-logo-data.ts` (WebP recadré, 240 px de haut, ~21 Ko).
  Le plugin n'a donc aucune dépendance fichier au runtime : pas besoin d'ajouter
  `server.fs.allow` dans la config Vite de l'hôte (le serveur Vite du dashboard refuse
  sinon les fichiers hors de sa racine `node_modules/@vendure/dashboard`).
  Pour changer le logo : régénérer ce fichier depuis `ui/logos/` (sharp : `trim()`,
  `resize({ height: 240 })`, `webp()`, puis base64).
- palette couleurs dashboard via `vite.config.mts`

## Fichiers utiles

- `plugins/menata-branding/menata-branding.plugin.ts`
- `plugins/menata-branding/dashboard/index.tsx`
- `plugins/menata-branding/dashboard/menata-login-logo.tsx`
- sources logos: `plugins/menata-branding/ui/logos/*`
- `packages/dev-server/vite.config.mts`

## Lancement

Depuis `packages/dev-server`:

```powershell
npm run dev
```

Dans un autre terminal:

```powershell
npm run dashboard:dev
```
