# syntax=docker/dockerfile:1
#
# Build context = repository ROOT.
#   Coolify settings:  Build Pack = Dockerfile
#                      Base Directory = /
#                      Dockerfile Location = /deploy/Dockerfile
#
# The image mirrors the repo layout (/app/deploy + /app/plugins) so the
# `../plugins/*` imports in vendure-config.ts resolve identically to source.
# Only the dashboard SPA is compiled here; @vendure/* come precompiled from npm.

############################ builder ############################
FROM node:20-bookworm AS builder

# Toolchain for native addons (e.g. bcrypt) compiled during npm install.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# 1) Install ONLY the deploy project's deps (npm registry, not the monorepo).
#    npm ci installs the exact, validated versions from the committed lockfile,
#    so Coolify builds the same tree that was tested locally (no silent drift).
WORKDIR /app/deploy
COPY deploy/package.json deploy/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# 2) Bring in sources: the shared plugins + the deploy project.
#    (Host node_modules are excluded by .dockerignore, so the install above is kept.)
WORKDIR /app
COPY plugins ./plugins
COPY deploy ./deploy

# The shared plugins live at /app/plugins but the deps are installed in
# /app/deploy/node_modules. Node only resolves UP the tree, so expose the deps at
# /app/node_modules (a symlink) — now both /app/plugins and /app/deploy see them.
RUN ln -s deploy/node_modules /app/node_modules

# 3) Build the dashboard SPA only -> /app/deploy/dist
WORKDIR /app/deploy
RUN npx vite build

############################ runner ############################
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app/deploy

# Carry over installed deps, sources, and the built dashboard.
COPY --from=builder /app /app

EXPOSE 3000

# Default service = API. The worker service overrides this in Coolify with:
#   npm run start:worker
CMD ["npm", "run", "start:server"]
