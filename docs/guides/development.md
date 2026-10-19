# Development and validation

The executable workflow is `mise.toml`. This is a Bun project; use `mise run` tasks rather than substituting npm commands. Read the repository's `AGENTS.md` and `design_principles.md` before making changes.

## Local services

Tilt may already be running. `Tiltfile` declares these services:

| Tilt resource | Address | Role |
| --- | --- | --- |
| `app-frontend` | `http://localhost:3000` | React home/account portal and `/draw/` proxy |
| `splat-web` | `http://localhost:3001` | Standalone drawing editor |
| `app-server` | `http://localhost:3030` | API and WebSocket sync |
| `design-system` | `http://localhost:3002` | Component harness |

Use port 3000 for normal login/share navigation. Opening the standalone editor is useful for rendering work, but its configured account links still point at the portal.

```sh
mise run tilt:up
tilt logs splat-web --tail 30
```

For a fresh environment, install tools/dependencies and configure `.env` from `.env.example`. Database tasks are separate: `db:generate`, `db:push`, and `db:studio` are defined in `mise.toml`. Schema pushes mutate the configured database; choose the intended environment explicitly. Starting another dev server is not a substitute for diagnosing a failing Tilt resource.

## Focused checks

Typechecks use the TypeScript 7 native compiler, installed as `@typescript/native`
and exposed as `tsc`. TypeDoc and declaration bundling still use the TypeScript 6
JavaScript API through the `typescript` alias. The `@typescript/old` archive
override prevents Bun from resolving that alias back to its own wrapper.

The portal uses Vite 8 and Oxlint. Its Oxlint config retains Hooks and refresh
checks, with route-file refresh handled by TanStack Router. React Compiler rules
are not enabled for this React 18 app. Other workspaces use Biome.

```sh
mise tasks lint
mise run //packages/splat:test
mise run //packages/splat:ts:check
mise run //packages/splat:lint
mise run //packages/renderer-raster:test
mise run //packages/renderer-canvas:test
```

Tasks ending in `:fix` write changes. Keep formatting scoped when another contributor is working in the same checkout.

Commits enqueue comprehensive LocalCI checks asynchronously. The hook prints the exact commit and commands for inspecting it. Prefer the full hash when checking a specific revision:

```sh
localci status --commit FULL_COMMIT_HASH
localci wait --commit FULL_COMMIT_HASH
localci artifacts --commit FULL_COMMIT_HASH --task //packages/splat:test
```

For uncommitted work, follow the repository requirement to run `localci wait --no-clone`; if no working-tree run exists, `localci run --no-clone --wait` starts one. Waiting does not itself enqueue a missing run. Avoid duplicate runs, especially alongside browser performance measurements.

## Documentation

```sh
mise run //apps/docs-site:build
```

Both this task and `mise run docs:build` generate the TypeDoc API reference, then build the Zensical site into `site/`. `mise run docs:dev` serves it at `http://localhost:8000` with live reload. Zensical is installed/pinned by mise; the docs workspace uses Bun for TypeDoc and a pinned local Mermaid bundle.

`zensical.toml` configures navigation and Markdown/Mermaid support. Update its navigation when adding pages. Generated API HTML (`docs/reference/`), the copied Mermaid bundle (`docs/assets/mermaid.min.js`), site output, and caches are ignored by Git. Label retained design proposals as historical.

Performance probes need a quieter environment than ordinary linting. A timeout while several builds and browsers are active is not enough evidence to change a rendering algorithm. Inspect the first failure, distinguish cascading failures, and rerun the relevant suite after competing work settles.
