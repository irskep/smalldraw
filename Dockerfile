# syntax=docker/dockerfile:1
# Supplied by mise server:deploy from .bun-version; no floating fallback.
ARG BUN_VERSION
FROM oven/bun:${BUN_VERSION}-alpine AS base
WORKDIR /app

# Normalize scripts away in a separate stage. Script-only manifest edits produce
# identical install inputs, so they don't invalidate the dependency layer.
FROM base AS manifests
COPY bun.lock package.json .bun-version ./
COPY scripts/check-bun-version.ts scripts/check-bun-version.ts
COPY patches patches
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN bun scripts/check-bun-version.ts && \
    bun -e 'for (const path of ["package.json", "apps/server/package.json", "packages/shared/package.json"]) { const pkg = await Bun.file(path).json(); delete pkg.scripts; await Bun.write(path, JSON.stringify(pkg)); }'

FROM base AS dependencies
COPY --from=manifests /app/ ./
# The full lockfile remains authoritative; only these workspaces are installed.
# Drizzle Kit and its driver are runtime dependencies because startup uses them.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --filter server --filter @smalldraw/shared

FROM base AS runtime
ENV NODE_ENV=production PORT=3000
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json
# Preserve workspace manifests and any workspace-local dependency directories.
COPY --from=dependencies /app/apps ./apps
COPY --from=dependencies /app/packages ./packages

COPY drizzle.config.ts ./
COPY apps/server/src apps/server/src
COPY apps/server/scripts apps/server/scripts
COPY packages/shared/src packages/shared/src

# Exercise database startup against a disposable database before publishing.
# Invoke the installed executable directly: startup must never fetch packages.
RUN DATABASE_URL=/tmp/startup-check.db bun node_modules/drizzle-kit/bin.cjs push && \
    DATABASE_URL=/tmp/startup-check.db bun apps/server/scripts/normalize-moderation-schema.ts && \
    DATABASE_URL=/tmp/startup-check.db bun node_modules/drizzle-kit/bin.cjs push && \
    rm -f /tmp/startup-check.db*

# Pre-built assets change most often, so keep them after dependency/startup checks.
COPY apps/server/build apps/server/build

EXPOSE 3000
CMD ["sh", "-c", "bun apps/server/scripts/normalize-moderation-schema.ts && bun node_modules/drizzle-kit/bin.cjs push && exec bun apps/server/src/index.ts"]
