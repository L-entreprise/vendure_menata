# syntax=docker/dockerfile:1

###############################################################################
# Stage 1 — builder: install all deps + build every package + dashboard SPA
###############################################################################
FROM node:20-bookworm AS builder

# Native toolchain for any node-gyp addons pulled in by the monorepo.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the whole workspace (context is trimmed by .dockerignore: no .git,
# no host node_modules, no prebuilt lib/dist — all regenerated below).
COPY . .

# Reproducible install of the full workspace (dev deps included: the app is
# started with ts-node at runtime, so ts-node/tsconfig-paths/typescript stay).
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev --no-audit --no-fund

# Build ONLY the packages the server actually loads (+ their deps). Skips
# admin-ui (Angular), cli, create, harden, payments, stellate, ui-devkit,
# testing, admin-ui-plugin — none are used at runtime. Cuts build time ~50%+.
RUN npx lerna run build \
        --scope @vendure/common \
        --scope @vendure/core \
        --scope @vendure/asset-server-plugin \
        --scope @vendure/email-plugin \
        --scope @vendure/job-queue-plugin \
        --scope @vendure/graphiql-plugin \
        --scope @vendure/sentry-plugin \
        --scope @vendure/telemetry-plugin \
        --scope @vendure/dashboard \
        --include-dependencies \
    && cd packages/dev-server \
    && npx vite build

###############################################################################
# Stage 2 — runner: slim image carrying only the built workspace
###############################################################################
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Bring over the fully built workspace (node_modules symlinks + compiled
# packages + dev-server + root plugins). No chromium / build toolchain here.
COPY --from=builder /app /app

EXPOSE 3000

# Default = API service. The worker service overrides the command in Coolify
# with: npm run --workspace packages/dev-server dev:worker
CMD ["npm", "run", "--workspace", "packages/dev-server", "dev:server"]
