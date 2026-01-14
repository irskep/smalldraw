# Phase 2: Upgrade Dependencies

This phase upgrades all dependencies to their latest versions, working through ecosystems in batches to isolate breaking changes.

---

## 2.1 Pre-Upgrade Test Verification

**Checkpoint**: Ensure all Phase 1 tests pass before upgrading.

---

## 2.2 Audit Current Versions

Run dependency audit:
```bash
bun outdated
```

Key packages to evaluate:

| Package | Current | Action |
|---------|---------|--------|
| `@trpc/server` | 11.0.0-rc.366 | Check for stable v11 release |
| `@trpc/client` | 11.0.0-rc.366 | Check for stable v11 release |
| `react` | 18.3.1 | Check for React 19 |
| `vite` | 5.3.3 | Check for Vite 6 |
| `prisma` | 5.16.1 | Update to latest 5.x |
| `@tanstack/react-query` | 5.49.2 | Update to latest 5.x |
| `@automerge/*` | 2.2.4 / 1.2.0 | Check for updates |
| `typescript` | 5.5.3 | Update to latest 5.x |
| `tailwindcss` | 3.4.4 | Check for Tailwind 4 |

---

## 2.3 Upgrade Strategy

**Principle**: Upgrade in batches by ecosystem to isolate breaking changes.

### 2.3.1 Batch 1: TypeScript and Build Tools
```bash
bun update typescript tsup
```

Run tests, fix any type errors.

### 2.3.2 Batch 2: Prisma
```bash
cd apps/server
bun update prisma @prisma/client
bunx prisma generate
```

Run tests, verify database operations.

### 2.3.3 Batch 3: tRPC Ecosystem
```bash
# Check if stable v11 is released
bun update @trpc/server @trpc/client @trpc/react-query
```

This may require code changes if APIs changed between RC and stable.

Run tests, fix any tRPC-related issues.

### 2.3.4 Batch 4: React Ecosystem
```bash
cd apps/app
bun update react react-dom @types/react @types/react-dom
bun update @tanstack/react-query @tanstack/react-router
```

Run frontend tests/type checks.

### 2.3.5 Batch 5: Automerge Ecosystem
```bash
# Update root override first
# In root package.json, update overrides["@automerge/automerge"]

bun update @automerge/automerge @automerge/automerge-repo @automerge/automerge-repo-network-websocket @automerge/automerge-repo-storage-indexeddb @automerge/automerge-repo-react-hooks
```

Run full integration tests (WebSocket sync).

### 2.3.6 Batch 6: Vite and Frontend Build
```bash
cd apps/app
bun update vite vite-plugin-wasm @vitejs/plugin-react
```

Run build, verify output.

### 2.3.7 Batch 7: UI Libraries
```bash
cd apps/app
bun update tailwindcss postcss autoprefixer
bun update @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-slot
bun update lucide-react clsx
```

Visual verification of UI components.

---

## 2.4 Lock File Regeneration

After all upgrades:
```bash
rm bun.lockb
bun install
```

---

## 2.5 Post-Upgrade Verification

1. Run all tests: `bun test`
2. Type check: `bun run ts:check`
3. Lint: `bun run lint`
4. Build both apps: `cd apps/app && bun run build` and `cd apps/server && bun run build`
5. Manual smoke test: Start both apps, test login, document creation, real-time sync

**Checkpoint**: All tests pass with upgraded dependencies.
