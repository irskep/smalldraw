# Phase 1: Migrate to Bun

This phase replaces pnpm with Bun as the package manager and runtime, removes unnecessary dependencies, and establishes a test suite.

---

## 1.1 Replace pnpm with Bun Package Manager

### 1.1.1 Remove pnpm-specific files
```bash
rm pnpm-workspace.yaml
rm pnpm-lock.yaml
```

### 1.1.2 Update root package.json

Convert `pnpm.overrides` to `overrides` (standard npm/Bun format):

**Before**:
```json
{
  "pnpm": {
    "overrides": {
      "@automerge/automerge": "^2.2.4"
    }
  }
}
```

**After**:
```json
{
  "overrides": {
    "@automerge/automerge": "^2.2.4"
  }
}
```

### 1.1.3 Install dependencies with Bun
```bash
bun install
```

This generates `bun.lockb` and installs all workspace dependencies.

### 1.1.4 Update .gitignore
Add `bun.lockb` if not present (it should be committed, similar to other lock files).

**Checkpoint**: `bun install` succeeds and all packages are linked correctly.

---

## 1.2 Add Test Infrastructure (Pre-Migration Baseline)

**Goal**: Establish automated tests that verify current functionality before any changes.

### 1.2.1 Install test framework
```bash
# In apps/server
bun add -D vitest @vitest/coverage-v8
```

### 1.2.2 Create test configuration
Create `apps/server/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

### 1.2.3 Create test setup with mock database
Create `apps/server/src/test/setup.ts`:
```typescript
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
// Setup test database, mock environment, etc.
```

### 1.2.4 Add baseline tests

**Database layer tests** (`apps/server/src/db/user.test.ts`):
- `createUser` creates a user and returns it
- `getUser` retrieves existing user
- `getUserByUsername` finds user by username
- Duplicate username throws error

**Session tests** (`apps/server/src/db/session.test.ts`):
- `createSession` creates valid session
- `getSession` retrieves session with user data
- `deleteSession` removes session

**Document tests** (`apps/server/src/db/document.test.ts`):
- `createDocument` creates document with owner
- `getUserHasAccessToDocument` returns correct access
- `addUserToDocument` grants access

**tRPC router tests** (`apps/server/src/trpc/router.test.ts`):
- Registration flow works
- Login flow works
- Document CRUD operations work
- Authorization is enforced

**WebSocket authorization tests** (`apps/server/src/automergeRepo/authAdapter.test.ts`):
- Valid session allows connection
- Invalid session rejected with 401
- Document access is checked on messages

### 1.2.5 Update package.json scripts
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Checkpoint**: All tests pass with current setup.

---

## 1.3 Remove dotenv Dependency

**Rationale**: Bun automatically loads `.env` files without any import.

### 1.3.1 Remove the import
In `apps/server/src/index.ts`, remove:
```typescript
import "dotenv/config";
```

### 1.3.2 Remove the package
```bash
cd apps/server
bun remove dotenv
```

**Checkpoint**: Tests still pass. Server starts and loads environment variables.

---

## 1.4 Update Runtime and Dev Dependencies

The `ws` package is retained for compatibility with `@automerge/automerge-repo-network-websocket`. Bun runs `ws` without issues.

### 1.4.1 Remove unnecessary dev dependencies
```bash
cd apps/server
bun remove nodemon ts-node
```

### 1.4.2 Update dev scripts for Bun

In `apps/server/package.json`:
```json
{
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target node",
    "start": "bun dist/index.js",
    "test": "bun test",
    "ts:check": "tsc --noEmit"
  }
}
```

### 1.4.3 Update root package.json scripts
```json
{
  "scripts": {
    "test": "bun --filter './apps/server' test",
    "ts:check": "bun --filter '*' ts:check",
    "lint": "bun --filter '*' lint"
  }
}
```

### 1.4.4 Create bunfig.toml
Create `apps/server/bunfig.toml`:
```toml
[test]
preload = ["./src/test/setup.ts"]
```

### 1.4.5 Migrate tests from Vitest to Bun test runner (optional)
Bun's test runner is API-compatible with Jest/Vitest. Update imports:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
```

### 1.4.6 Update Dockerfile for Bun

Replace `apps/server/Dockerfile`:
```dockerfile
FROM oven/bun:1-alpine

WORKDIR /usr/src/app

COPY package.json bun.lockb ./
COPY prisma ./prisma/

RUN bun install --frozen-lockfile
RUN bunx prisma generate

COPY . .

EXPOSE $PORT

CMD ["bun", "run", "start"]
```

### 1.4.7 Update .github/workflows for Bun

Modify `.github/workflows/tests-and-checks.yml`:
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: cd apps/server && bunx prisma generate
      - run: bun test
```

**Checkpoint**: All tests pass under Bun runtime.

---

## 1.5 Summary of Phase 1 Changes

| File | Change |
|------|--------|
| `pnpm-workspace.yaml` | Delete |
| `pnpm-lock.yaml` | Delete (replaced by `bun.lockb`) |
| Root `package.json` | Convert `pnpm.overrides` to `overrides`; update scripts |
| `apps/server/package.json` | Remove dotenv, nodemon, ts-node; update scripts for Bun |
| `apps/server/src/index.ts` | Remove `import "dotenv/config"` |
| `apps/server/Dockerfile` | Switch to `oven/bun` base image |
| `apps/server/bunfig.toml` | New file for Bun configuration |
| `.github/workflows/tests-and-checks.yml` | Add Bun setup, update test commands |
| `apps/server/src/test/**` | New test files |
| `apps/server/src/**/*.test.ts` | New unit tests |

**Packages removed**: `dotenv`, `nodemon`, `ts-node`

**Packages retained**: `ws` (required by `@automerge/automerge-repo-network-websocket`), `@types/ws`

**Files deleted**: `pnpm-workspace.yaml`, `pnpm-lock.yaml`

**Files created**: `bun.lockb`, test files
