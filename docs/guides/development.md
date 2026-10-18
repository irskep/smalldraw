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

This builds the prose site. `mise run docs:build` also generates TypeDoc first. The sidebar is generated from Markdown files by `docs/.vuepress/config.ts`. Keep existing page paths when rewriting explanations so links remain useful; label retained design proposals as historical.

Performance probes need a quieter environment than ordinary linting. A timeout while several builds and browsers are active is not enough evidence to change a rendering algorithm. Inspect the first failure, distinguish cascading failures, and rerun the relevant suite after competing work settles.
