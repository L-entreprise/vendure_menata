# Guide de mise en place du fork Vendure (Menata)

## Objectif

Construire un fork Vendure maintenable pour tes clients e-commerce, avec :

- ton branding,
- des fonctionnalités métier additionnelles (ex: CMS),
- un chemin d'upgrade simple depuis l'upstream Vendure.

## Principe clé

Ne pas modifier le coeur Vendure si ce n'est pas indispensable.

Prioriser :

1. les plugins backend (`@VendurePlugin`),
2. les extensions Dashboard (React),
3. la configuration (`vendure-config`) et les variables d'environnement.

## Pourquoi cette approche

- Vendure est conçu pour être étendu via plugins.
- Le Dashboard React est la direction actuelle de Vendure.
- L'Admin UI Angular est dépréciée (fin de maintenance annoncée après juillet 2026), donc éviter d'investir lourdement dessus.

## Architecture recommandée

## 1) Branching Git

- `master`: miroir propre de ton fork.
- `menata_branding`: branche d'intégration Menata (branding + socle commun).
- `client/<nom-client>`: personnalisations spécifiques client.

Rythme conseillé :

1. Synchroniser régulièrement `master` avec `upstream`.
2. Rebaser/merger `menata_branding` depuis `master`.
3. Rebaser/merger chaque `client/*` depuis `menata_branding`.

## 2) Couche "socle Menata"

Créer des plugins dédiés (dans un repo projet client ou dans un workspace séparé) :

- `menata-branding-plugin`
- `menata-cms-plugin`
- `menata-b2b-plugin` (si besoin)
- `menata-integrations-plugin` (ERP/PIM/CRM)

Chaque plugin doit contenir :

- logique métier (services),
- extensions API GraphQL (`adminApiExtensions` / `shopApiExtensions`),
- entités custom si nécessaire,
- custom fields via `configuration`,
- extension Dashboard via `dashboard: './dashboard/index.tsx'` si UI admin requise.

## 3) Branding

### Branding minimum

Via `adminUiConfig` (nom de marque, etc.) pour une personnalisation rapide.

### Branding durable

Passer la personnalisation admin vers le Dashboard (thème Vite + tokens CSS), afin d'éviter les patchs dans `packages/admin-ui`.

## 4) Fonctionnalités type CMS

Pour un CMS, implémenter un plugin dédié :

1. Entités CMS (Article, Category, etc.)
2. Services métier
3. API GraphQL admin/shop
4. Pages Dashboard pour l'édition
5. Migrations SQL versionnées

## Sécurité et gestion des secrets

Ne jamais versionner de secrets.

Bonnes pratiques :

- utiliser `.env` (déjà ignoré dans ce repo),
- garder uniquement des valeurs par défaut de dev non sensibles dans le code,
- mettre les vraies valeurs dans variables d'environnement (CI/CD et prod).

Exemples à externaliser :

- `DB_PASSWORD`,
- `COOKIE_SECRET`,
- clés API prestataires (paiement, email, S3, etc.).

## Politique de modification du fork

### Autorisé

- `vendure-config` et bootstrap projet
- plugins custom
- extensions Dashboard
- scripts de build/deploy

### À éviter

- modifications directes de `packages/core`, `packages/admin-ui`, `packages/dashboard` pour du branding/fonctionnel client.

Ces modifications rendent les merges upstream plus coûteux.

## Process de livraison client

Pour chaque nouveau client :

1. créer `client/<nom-client>`,
2. activer la combinaison de plugins Menata + plugins client,
3. définir thème/logo/variables client,
4. exécuter migrations,
5. valider via tests E2E ciblés.

## Process d'upgrade Vendure

1. Lire `CHANGELOG.md` upstream.
2. Mettre à jour `master` depuis `upstream`.
3. Rejouer build/tests.
4. Remonter les changements dans `menata_branding`, puis dans `client/*`.
5. Régénérer schémas/types GraphQL si nécessaire.

## Checklist rapide

- Aucun secret en dur dans le code.
- Toute feature client = plugin.
- Toute UI admin nouvelle = Dashboard extension.
- Migrations présentes pour chaque changement de schéma/custom fields.
- Branche client séparée de la branche socle Menata.

