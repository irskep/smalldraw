# Phase 3: Migrate from PostgreSQL to SQLite

This phase replaces PostgreSQL with SQLite for simpler deployment and local development.

---

## 3.1 Pre-Migration Assessment

### 3.1.1 Current PostgreSQL-specific code

1. **Prisma schema** (`apps/server/prisma/schema.prisma`):
   - `provider = "postgresql"`
   - `Bytes[]` type in DocumentData model (PostgreSQL array)

2. **Direct pg usage** (`apps/server/src/automergeRepo/automergeRepo.ts`):
   ```typescript
   import pg from "pg";
   const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ... });
   ```

3. **Automerge storage** (`automerge-repo-storage-postgres`):
   - Uses PostgreSQL for storing Automerge document data
   - Must be replaced with SQLite-compatible storage

4. **Docker Compose** (`docker-compose.yml`):
   - PostgreSQL container definition

### 3.1.2 SQLite considerations

- **File-based**: No separate server process
- **Type differences**: SQLite has limited types; Prisma handles mapping
- **Bytes handling**: SQLite uses BLOB instead of BYTEA[]
- **Connection string**: `file:./dev.db` instead of `postgresql://...`

---

## 3.2 Create Automerge SQLite Storage Adapter

The `automerge-repo-storage-postgres` package must be replaced with a SQLite storage adapter using Bun's native SQLite support.

### 3.2.1 Create storage adapter

Create `apps/server/src/automergeRepo/sqliteStorageAdapter.ts`:
```typescript
import { StorageAdapter, StorageKey } from "@automerge/automerge-repo";
import { Database } from "bun:sqlite";

export class SqliteStorageAdapter implements StorageAdapter {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS automerge_data (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL
      )
    `);
  }

  async load(key: StorageKey): Promise<Uint8Array | undefined> {
    const row = this.db.query("SELECT value FROM automerge_data WHERE key = ?").get(key.join("/"));
    return row ? new Uint8Array(row.value) : undefined;
  }

  async save(key: StorageKey, data: Uint8Array): Promise<void> {
    this.db.run(
      "INSERT OR REPLACE INTO automerge_data (key, value) VALUES (?, ?)",
      [key.join("/"), data]
    );
  }

  async remove(key: StorageKey): Promise<void> {
    this.db.run("DELETE FROM automerge_data WHERE key = ?", [key.join("/")]);
  }

  async loadRange(keyPrefix: StorageKey): Promise<{ key: StorageKey; data: Uint8Array }[]> {
    const prefix = keyPrefix.join("/");
    const rows = this.db.query(
      "SELECT key, value FROM automerge_data WHERE key LIKE ?"
    ).all(`${prefix}%`);

    return rows.map(row => ({
      key: row.key.split("/") as StorageKey,
      data: new Uint8Array(row.value),
    }));
  }

  async removeRange(keyPrefix: StorageKey): Promise<void> {
    const prefix = keyPrefix.join("/");
    this.db.run("DELETE FROM automerge_data WHERE key LIKE ?", [`${prefix}%`]);
  }
}
```

---

## 3.3 Update Prisma Schema

### 3.3.1 Modify schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id                 String             @id @default(uuid())
  username           String             @unique
  registrationRecord String
  sessions           Session[]
  loginAttempt       LoginAttempt?
  createdAt          DateTime           @default(now())
  documents          UsersOnDocuments[]
}

model Session {
  sessionKey String   @id
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  createdAt  DateTime @default(now())
}

model LoginAttempt {
  id               String   @id @default(uuid())
  userId           String   @unique
  user             User     @relation(fields: [userId], references: [id])
  serverLoginState String
  createdAt        DateTime @default(now())
}

model Document {
  id                  String               @id
  name                String
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  users               UsersOnDocuments[]
  documentInvitations DocumentInvitation[]
}

model UsersOnDocuments {
  user       User     @relation(fields: [userId], references: [id])
  userId     String
  document   Document @relation(fields: [documentId], references: [id])
  documentId String
  isAdmin    Boolean
  @@id([userId, documentId])
}

model DocumentInvitation {
  id         String   @id @default(uuid())
  document   Document @relation(fields: [documentId], references: [id])
  documentId String
  token      String   @unique
  createdAt  DateTime @default(now())
}

// Note: DocumentData model removed - Automerge data now stored via SqliteStorageAdapter
```

### 3.3.2 Remove DocumentData model

The `DocumentData` model was marked `@@ignore` and used by `automerge-repo-storage-postgres`. With the new SQLite adapter, this data is stored in a separate table managed by the adapter, not Prisma.

---

## 3.4 Update Server Code

### 3.4.1 Remove pg dependency

In `apps/server/src/automergeRepo/automergeRepo.ts`:

**Before**:
```typescript
import pg from "pg";
import { PostgresStorageAdapter } from "automerge-repo-storage-postgres";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const config: RepoConfig = {
  network: [new AuthAdapter(webSocketServer)],
  storage: new PostgresStorageAdapter("DocumentData", pool),
  // ...
};
```

**After**:
```typescript
import { SqliteStorageAdapter } from "./sqliteStorageAdapter";

const automergeDbPath = process.env.AUTOMERGE_DB_PATH || "./automerge.db";

const config: RepoConfig = {
  network: [new AuthAdapter(webSocketServer)],
  storage: new SqliteStorageAdapter(automergeDbPath),
  // ...
};
```

### 3.4.2 Remove PostgreSQL packages
```bash
cd apps/server
bun remove pg @types/pg automerge-repo-storage-postgres
```

---

## 3.5 Update Environment Configuration

### 3.5.1 Update .env.example
```
DATABASE_URL=file:./prisma/dev.db
AUTOMERGE_DB_PATH=./automerge.db
OPAQUE_SERVER_SETUP=TODO
```

### 3.5.2 Update .env (local development)
```
DATABASE_URL=file:./prisma/dev.db
AUTOMERGE_DB_PATH=./automerge.db
OPAQUE_SERVER_SETUP=<your-generated-value>
```

---

## 3.6 Update Docker Configuration

### 3.6.1 Remove PostgreSQL from docker-compose.yml

**Before** (`docker-compose.yml`):
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: prisma
      POSTGRES_PASSWORD: prisma
      POSTGRES_DB: automerge_jumpstart
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**After**: File can be deleted or repurposed for other services. SQLite requires no container.

### 3.6.2 Update Dockerfile for SQLite persistence

```dockerfile
FROM oven/bun:1-alpine

WORKDIR /usr/src/app

# Install SQLite (if not in base image)
RUN apk add --no-cache sqlite

COPY package.json bun.lockb ./
COPY prisma ./prisma/

RUN bun install --frozen-lockfile
RUN bunx prisma generate

COPY . .

# Create directory for SQLite databases
RUN mkdir -p /data

# Set environment for SQLite
ENV DATABASE_URL=file:/data/app.db
ENV AUTOMERGE_DB_PATH=/data/automerge.db

EXPOSE $PORT

# Run migrations on startup, then start server
CMD bunx prisma migrate deploy && bun run start
```

---

## 3.7 Create Fresh Migration

### 3.7.1 Remove old PostgreSQL migrations
```bash
rm -rf apps/server/prisma/migrations
```

### 3.7.2 Generate new SQLite migration
```bash
cd apps/server
bunx prisma migrate dev --name init
```

This creates a SQLite-compatible migration.

---

## 3.8 Update Tests for SQLite

### 3.8.1 Test setup changes

Update `apps/server/src/test/setup.ts`:
```typescript
import { beforeAll, afterAll, beforeEach } from 'bun:test';
import { prisma } from '../db/prisma';
import { execSync } from 'child_process';

beforeAll(async () => {
  // Use test database
  process.env.DATABASE_URL = 'file:./prisma/test.db';
  process.env.AUTOMERGE_DB_PATH = './test-automerge.db';

  // Run migrations
  execSync('bunx prisma migrate deploy', { stdio: 'inherit' });
});

beforeEach(async () => {
  // Clean database between tests
  await prisma.documentInvitation.deleteMany();
  await prisma.usersOnDocuments.deleteMany();
  await prisma.document.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### 3.8.2 Add SQLite storage adapter tests

Create `apps/server/src/automergeRepo/sqliteStorageAdapter.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { SqliteStorageAdapter } from './sqliteStorageAdapter';
import { unlinkSync } from 'fs';

describe('SqliteStorageAdapter', () => {
  const testDbPath = './test-storage.db';
  let adapter: SqliteStorageAdapter;

  beforeEach(() => {
    try { unlinkSync(testDbPath); } catch {}
    adapter = new SqliteStorageAdapter(testDbPath);
  });

  afterAll(() => {
    try { unlinkSync(testDbPath); } catch {}
  });

  it('saves and loads data', async () => {
    const key = ['doc', '123', 'chunk1'];
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    await adapter.save(key, data);
    const loaded = await adapter.load(key);

    expect(loaded).toEqual(data);
  });

  it('returns undefined for missing key', async () => {
    const result = await adapter.load(['nonexistent']);
    expect(result).toBeUndefined();
  });

  it('removes data', async () => {
    const key = ['doc', '456'];
    await adapter.save(key, new Uint8Array([1]));
    await adapter.remove(key);

    const result = await adapter.load(key);
    expect(result).toBeUndefined();
  });

  it('loads range of keys', async () => {
    await adapter.save(['doc', 'a', '1'], new Uint8Array([1]));
    await adapter.save(['doc', 'a', '2'], new Uint8Array([2]));
    await adapter.save(['doc', 'b', '1'], new Uint8Array([3]));

    const results = await adapter.loadRange(['doc', 'a']);

    expect(results.length).toBe(2);
  });
});
```

---

## 3.9 Update README

Update setup instructions in `README.md`:
```markdown
## Development

### Setup

```sh
bun install
```

```sh
cd apps/server
cp .env.example .env
npx @serenity-kit/opaque@latest create-server-setup
# copy the string value as OPAQUE_SERVER_SETUP in .env
bunx prisma migrate dev
bunx prisma generate
bun dev
```

```sh
# in another tab
cd apps/app
bun dev
```

### DB UI

```bash
cd apps/server
bunx prisma studio
```

### Wipe all local data

```bash
cd apps/server
rm prisma/dev.db automerge.db
bunx prisma migrate dev
```
```

---

## 3.10 Summary of Phase 3 Changes

| File | Change |
|------|--------|
| `apps/server/prisma/schema.prisma` | Change provider to sqlite, remove DocumentData |
| `apps/server/prisma/migrations/*` | New SQLite migration |
| `apps/server/src/automergeRepo/automergeRepo.ts` | Use SqliteStorageAdapter |
| `apps/server/src/automergeRepo/sqliteStorageAdapter.ts` | New file |
| `apps/server/.env.example` | SQLite connection string |
| `apps/server/package.json` | Remove pg, @types/pg, automerge-repo-storage-postgres |
| `docker-compose.yml` | Remove or delete (no PostgreSQL needed) |
| `apps/server/Dockerfile` | Update for SQLite |
| `README.md` | Update setup instructions |

**Packages removed**: `pg`, `@types/pg`, `automerge-repo-storage-postgres`

**Checkpoint**: All tests pass with SQLite backend.
