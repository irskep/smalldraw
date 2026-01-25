# Smalldraw

This is a greenfield prototype of a "drawing program construction kit." It is a vector/raster hybrid but can be used to specialize in vector or raster work.

## Packages

### `@smalldraw/geometry`

Contains:
- What is a shape geometrically
- What is true about a given shape geometrically

Depends on: third party libs only (Euclid.ts)

Exposes: geometry types and functions, wrapping any third party stuff and not just re-exporting it

### `@smalldraw/core`

Contains: 
- Frontend-framework-agnostic model and reactive datastore for illustration programs
- Tool implementations in pure logic, no UI framework integrations. What is a selection tool, what does it need, what does it do?
- Later on (do not do now): will be based on Automerge for local-first and multiplayer

Depends on: geometry, third party libraries, but not Euclid.ts because its logic comes in through geometry

Exposes: generic interfaces, stores, controllers, managers, and registries for UI layers to use

DOES NOT expose: individual shape types. the abstractions of the module should allow UI layer to be shape-agnostic.

### `@smalldraw/renderer-konva`

Contains:
- Code to render core's data model on an HTML canvas using the Konva library, in an incremental way

Depends on: core

Exposes: as small a surface area as possible to keep a canvas updated

### `@smalldraw/ui-vanillajs`

Contains:
- Complete implementation of a minimalistic drawing app using all features of Smalldraw, mountable in a DOM element

Depends on: core, renderer-konva, re:dom

Exposes: an object that can mount/unmount the app; eventually, access to core objects for serialization/deserialization/sync

## Current status

Codebase is messy and needs to be further conformed to the module boundaries. Code reuse is suboptimal. Many types are copy/pasted across files, especially in tests. The geometry package in particular should be beefed up substantially, but new abstractions are needed for generic shape intersections (do we even need that?) and hit testing (we definitely need that).

---

Original README continues below.

---

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
