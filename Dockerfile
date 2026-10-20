FROM oven/bun:1-alpine

WORKDIR /app

# Install only runtime dependencies by creating a minimal workspace root
COPY bun.lock package.json ./
COPY patches patches
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN bun -e 'const root = await Bun.file("package.json").json(); await Bun.write("package.json", JSON.stringify({private:true, workspaces:["apps/server","packages/shared"], patchedDependencies:root.patchedDependencies}));'
RUN bun install

# Copy source files needed at runtime
COPY drizzle.config.ts ./
COPY apps/server/src apps/server/src
COPY apps/server/scripts apps/server/scripts
COPY packages/shared/src packages/shared/src

# Exercise database startup against a disposable database before publishing.
RUN DATABASE_URL=/tmp/startup-check.db bunx --bun drizzle-kit push && rm -f /tmp/startup-check.db*

# Copy pre-built frontend assets (built by scripts/prod-build.ts before docker build)
COPY apps/server/build apps/server/build

EXPOSE $PORT

CMD ["sh", "-c", "bunx --bun drizzle-kit push && bun apps/server/src/index.ts"]
