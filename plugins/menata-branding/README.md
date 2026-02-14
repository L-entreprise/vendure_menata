# Menata Branding Plugin

Plugin de branding dashboard-only pour ce fork Vendure.

## Ce que fait le plugin

- logo de login dashboard via extension (`menata_deux_lignes.webp`)
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
