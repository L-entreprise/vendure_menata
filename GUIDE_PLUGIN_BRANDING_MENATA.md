# Guide branding Menata (plugin-only)

Objectif: branding dashboard sans patch du core Vendure.

## Fichiers

- plugin dashboard: `plugins/menata-branding/menata-branding.plugin.ts`
- extension login: `plugins/menata-branding/dashboard/index.tsx`
- composant logo login: `plugins/menata-branding/dashboard/menata-login-logo.tsx`
- source logos: `plugins/menata-branding/ui/logos/*`
- theme dashboard: `packages/dev-server/vite.config.mts`

## Ce qui est plugin-safe

- logo de login
- contenu login (`beforeForm` / `afterForm`)
- couleurs et tokens du dashboard

## Ce qui n est pas plugin-safe

- modifier le shell global (sidebar/header core) via fichiers `packages/dashboard/src/...`

## Lancer en dev

Depuis `packages/dev-server`:

```powershell
npm run dev
```

Dans un autre terminal:

```powershell
npm run dashboard:dev
```

Puis ouvre `http://localhost:5173/dashboard/`.
