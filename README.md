# Automerge Jumpstart

A comprehensive boilerplate for building real-time
collaborative editing applications with Automerge, React,
tRPC, and more.

Website incl. explanation videos: [https://www.automerge-jumpstart.com/](https://www.automerge-jumpstart.com/)

## Development

### Setup

```sh
bun install
cp .env.example .env
# optional: generate a real OPAQUE setup string with
# bunx @serenity-kit/opaque@latest create-server-setup
mise run db:push
mise run server:dev
```

```sh
# in another tab
cd apps/app
bun run dev
```

### Updating the Database Schema

1. Make changes
2. Update `apps/server/src/db/schema.ts`
3. Run `mise run db:generate -- --name my-migration`
4. Run `mise run db:push`
5. Restart the TS server in your editor

### DB UI

```bash
mise run db:studio
```

### Wipe all local data

```bash
rm -f apps/server/sqlite/dev.db automerge.db
mise run db:push
```

## Setup Production Environment and CI

see [docs/setup-production-environment-and-ci.md](docs/setup-production-environment-and-ci.md)

## Connect to the Production Database

```sh
fly postgres connect -a automerge-jumpstart-db
```

```sh
# list dbs
\list;
# connect to a db
\c automerge_jumpstart;
# list tables
\dt
# query a table
SELECT * FROM "Document";
```

## Upgrading Dependencies

Note: Automerge version is pinned in the root `package.json` file to avoid issues arising from different automerge versions.

```sh
bun update
cd apps/app && bun update
cd apps/server && bun update
mise run db:push
```

## Architecture

### Authentication

Users use OPAQUE to authenticate with the server. After Login the server creates a session in the database which includes Opaque's `sessionKey`. The `sessionKey` is used as `bearer` token to authenticate the user for authenticated requests and also to connect to the Websocket.
