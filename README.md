# Splatterboard / Smalldraw

This repository contains [Splatterboard](https://splatterboard.app/), a drawing app, and the Smalldraw packages it is built from. The repository is public, but is not licensed as open source.

The app stores drawing documents in Automerge, renders committed content into raster tiles, and uses an isolated canvas composition for in-progress strokes. The web editor uses re:dom; the account portal uses React.

## Start here

- [Internal documentation](docs/index.md): architecture, rendering, tools, multiplayer, and validation.
- [Design principles](design_principles.md): package boundaries, state ownership, rendering, and component conventions.
- [Development guide](docs/guides/development.md): local services and checks.
- [Rendering pipeline](docs/explanation/rendering-pipeline.md): what each canvas/cache does and why it exists.

## Workspace

| Location | Responsibility |
| --- | --- |
| `packages/core` | Drawing model, actions, undo, tool runtime, store, Automerge adapter |
| `packages/geometry` | Geometry and vector/bounds helpers |
| `packages/renderer-canvas` | Shape dispatch, ordered painting, isolated layer composition |
| `packages/renderer-raster` | Tiles, layer backends, snapshot preparation, hot canvas composition |
| `packages/splat` | Drawing app assembly, concrete tools/shapes, input and document lifecycle |
| `packages/design-system` | Shared re:dom UI components and browser harness |
| `packages/shared` | Shared routes, account/parental-control contracts and helpers |
| `packages/testing` | Test infrastructure |
| `packages/server-cli` | Server administration client |
| `apps/splat-web`, `apps/splat-desktop` | Web and desktop drawing hosts |
| `apps/app` | React home/account portal; proxies the drawing app in development |
| `apps/server` | HTTP API, authentication, metadata, thumbnails, Automerge sync/storage |
| `apps/docs-site` | Zensical tasks and TypeDoc generation for `docs/` |

## Local development

Use Bun and the tasks in `mise.toml`. Tilt orchestrates the local services; check whether it is already running before starting another instance.

```sh
mise install
bun install
# Configure .env from .env.example for a fresh checkout.
mise run tilt:up
```

The normal browser entry is `http://localhost:3000`; the drawing app is at `/draw/`. See the development guide before operating the database or running services individually.

Root lab notebooks, `thinking/`, and old design proposals record historical experiments. They are evidence, not descriptions of the current architecture or an authoritative backlog. Current explanations live under `docs/explanation/`.


### Bun version

`.bun-version` is the single version pin for mise, GitHub Actions, and the
production Docker build. Update that file, then run `mise install bun`.
Use `mise run ...` or `mise exec -- bun ...`; do not run `bun upgrade` against
a mise-managed installation. Dependency installation, production builds, CI,
and Docker builds verify the actual executable version.

Deploy with `mise run deploy`, which passes the pinned version to Docker.
For a manual Docker build, supply `--build-arg BUN_VERSION="$(cat .bun-version)"`;
the build rejects a version that differs from the pin.

### Workspace validation

Pacwich owns workspace check scheduling; localci runs setup and one check task.
Use `mise run check` for affected validation, or `mise run validate:all` for
the full suite. Each workspace's `check` script runs its lint, types, tests,
and build (where present); design-system checks also run managed browser tests.
At most four workspaces run at once, with the longest suite started first.

On main, affected checks compare with `HEAD^`; on feature branches they compare
with `main` (or `origin/main` when only the remote ref is available). Local edits
are included. Detached commits on main's history use their parent. Missing
comparison history causes a full run, never an empty success.

Pacwich follows workspace dependencies. Shared root configuration, build scripts,
CI configuration, and dependency patches invalidate every workspace. Documentation
inputs also invalidate the docs build. Strict dependency verification and selection
regressions run on every check. Shared scripts are validation inputs, not imports
owned by every package, so they are excluded from per-package import verification.

Inspect selection with `mise exec -- bunx pacwich affected list --base=HEAD^ --explain`.
Run one workspace with `mise exec -- bunx pacwich run check server`.
