FROM oven/bun:1-alpine

WORKDIR /app

# Install only server dependencies by creating a minimal workspace root
COPY bun.lock ./
COPY apps/server/package.json apps/server/
RUN printf '{"private":true,"workspaces":["apps/server"]}' > package.json
RUN bun install

# Copy source files needed at runtime
COPY drizzle.config.ts ./
COPY apps/server/src apps/server/src

# Copy pre-built frontend assets (built by scripts/prod-build.ts before docker build)
COPY apps/server/build apps/server/build

EXPOSE $PORT

CMD ["sh", "-c", "bunx drizzle-kit push && bun apps/server/src/index.ts"]
