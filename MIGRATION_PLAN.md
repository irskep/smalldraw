# Migration Plan: Bun, Dependencies, and SQLite

This document outlines a phased migration plan for the Automerge Jumpstart boilerplate. Each phase produces a working state with passing automated tests.

## Current State

- **Monorepo**: pnpm workspaces with 2 apps (`apps/app` frontend, `apps/server` backend)
- **Backend**: Node.js 22 + Express + tRPC + Prisma + PostgreSQL
- **Frontend**: React 18 + Vite + TanStack Router/Query
- **Real-time**: Automerge CRDT via WebSocket (`ws` library)
- **Auth**: OPAQUE protocol with session-based WebSocket authorization
- **Tests**: None

## Phases

### [Phase 1: Migrate to Bun](./MIGRATION_PHASE1_BUN.md)

Replace pnpm with Bun as the package manager and runtime.

| Action | Details |
|--------|---------|
| Replace pnpm | Delete `pnpm-workspace.yaml`, `pnpm-lock.yaml`; run `bun install` |
| Add tests | Establish baseline test suite with Vitest, then optionally migrate to Bun's test runner |
| Remove dotenv | Bun loads `.env` automatically |
| Update scripts | Replace nodemon/ts-node with `bun --watch` |
| Update CI/Docker | Switch to `oven/bun` image |

**Packages removed**: `dotenv`, `nodemon`, `ts-node`

**Packages retained**: `ws` (required by Automerge)

---

### [Phase 2: Upgrade Dependencies](./MIGRATION_PHASE2_DEPS.md)

Upgrade all dependencies to latest versions in batches.

| Batch | Packages |
|-------|----------|
| 1 | TypeScript, tsup |
| 2 | Prisma |
| 3 | tRPC (check for stable v11) |
| 4 | React, TanStack |
| 5 | Automerge |
| 6 | Vite |
| 7 | Tailwind, Radix UI |

---

### [Phase 3: Migrate to SQLite](./MIGRATION_PHASE3_SQLITE.md)

Replace PostgreSQL with SQLite for simpler deployment.

| Action | Details |
|--------|---------|
| Create SqliteStorageAdapter | New adapter using `bun:sqlite` for Automerge document storage |
| Update Prisma | Change provider to `sqlite`, remove DocumentData model |
| Remove pg packages | `pg`, `@types/pg`, `automerge-repo-storage-postgres` |
| Update Docker | Remove PostgreSQL container, update Dockerfile for SQLite persistence |
| Fresh migration | Delete old migrations, generate new SQLite-compatible migration |

**Packages removed**: `pg`, `@types/pg`, `automerge-repo-storage-postgres`

---

## Execution Order

```
Phase 1: Bun Migration
├── Replace pnpm with Bun package manager
├── Add test infrastructure
├── Remove dotenv
├── Update runtime/dev dependencies
└── ✓ Checkpoint: Tests pass under Bun

Phase 2: Dependency Upgrades
├── Audit outdated packages
├── Upgrade in batches
└── ✓ Checkpoint: Tests pass with new dependencies

Phase 3: SQLite Migration
├── Create SqliteStorageAdapter
├── Update Prisma schema
├── Remove pg dependencies
├── Update Docker/environment config
└── ✓ Checkpoint: Tests pass with SQLite
```

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| tRPC RC → stable breaking changes | Medium | Review changelog; may need API updates |
| Automerge version conflicts | Medium | Pinned in root; upgrade carefully |
| SQLite concurrent write limits | Low | Single server setup; not an issue |
| SQLite BLOB size limits | Low | Automerge chunks are small |
| Prisma SQLite feature gaps | Low | Schema is simple; no advanced features used |
| Bun workspace compatibility | Low | Standard `workspaces` field already present |
