# Account App Route/Test Notebook

Date: 2026-04-07

## Problem

The account app still had legacy `/list/...` route naming, no runtime tests, and
an inconsistent dev-server host policy compared to `splat-web`.

While adding runtime tests, two environment problems showed up:

1. `apps/app/node_modules` contained stale Bun symlinks into a missing
   `node_modules/.bun` store.
2. The first proper component-test setup loaded multiple React instances, causing
   invalid hook call failures.

## Goals

1. Rename account-app document routes from `/list/$documentId` to
   `/documents/$documentId`.
2. Expose `account:web:dev` on LAN, like `splat:web:dev`.
3. Add real runtime/component tests for `apps/app` without hand-rolling a DOM
   harness.

## Hypotheses

1. Route rename is localized to route files, navigation calls, and generated
   `routeTree.gen.ts`.
2. LAN exposure is just Vite `server.host`.
3. A proper Vitest + `happy-dom` + Testing Library setup is a better test seam
   than manual `bun test` DOM wiring.
4. Invalid hook call failures in tests are caused by duplicate React resolution,
   not by component logic.

## Experiments

### Experiment 1: Inspect current route/test/dev surface

Commands:

```sh
git status --short
find apps/app/src/routes -maxdepth 3 -type f | sort
sed -n '1,220p' apps/app/package.json
sed -n '1,220p' apps/app/vite.config.ts
rg -n '(/list\\b|list/\\$documentId|Create List|List name|list\\W)' apps/app/src
```

Result:

- Legacy `/list/$documentId` route still present in source and generated route
  tree.
- `apps/app` had no test script or test harness.
- Vite dev server used `3001` but not `0.0.0.0`.

Conclusion:

- Proceed with route rename, Vite host change, and test harness addition.

### Experiment 2: First runtime-test attempt with manual DOM globals

Implementation:

- Added `bun test` tests with `happy-dom` preload and manual global registration.

Result:

- Tests failed due to stale Bun dependency links in `apps/app/node_modules`.
- Manual DOM setup was brittle and objectionable on design grounds.

Conclusion:

- Scrap the manual DOM harness approach.
- Move to Vitest-managed environment.

### Experiment 3: Diagnose broken package resolution

Commands:

```sh
python3 - <<'PY'
import os
base='apps/app/node_modules'
broken=[]
for name in os.listdir(base):
    path=os.path.join(base,name)
    if os.path.islink(path):
        target=os.readlink(path)
        resolved=os.path.normpath(os.path.join(base,target))
        if not os.path.exists(resolved):
            broken.append((name,target))
print('broken', len(broken))
for name,target in broken[:50]:
    print(name, '->', target)
PY
```

Result:

- Eighteen package links were broken.
- They pointed into `../../../node_modules/.bun/...`, but the root `.bun` store
  did not exist.

Conclusion:

- The workspace install needed to be restored to isolated-linker mode so
  package-local Bun links would resolve again.

### Experiment 4: Restore Bun isolated linker store

Command:

```sh
bun install --linker isolated --force
```

Result:

- Root `node_modules/.bun` store restored.
- `apps/app/node_modules/react`, `lucide-react`, and `happy-dom` became valid.

Conclusion:

- Proceed with Vitest-based tests on top of the repaired dependency graph.

### Experiment 5: Switch to proper test framework

Implementation:

- Replaced manual `bun test` harness with:
  - `bunx vitest run`
  - `@testing-library/react`
  - Vite `test.environment = "happy-dom"`

Result:

- Framework-owned DOM environment worked.
- Initial test run still failed with React invalid-hook-call errors.

Conclusion:

- Environment is now conceptually correct.
- Remaining failure is duplicate React resolution.

### Experiment 6: Deduplicate React for Vitest/Vite

Changes:

- Added Vite `resolve.dedupe` for `react`, `react-dom`.
- Added explicit `resolve.alias` to root `react` and `react-dom`.

Result:

- Vitest component tests passed.

Conclusion:

- Duplicate React resolution was the actual remaining test failure.
- This fix is appropriate for both test and dev resolution consistency.

## Current Outcome

Implemented:

1. `/list/$documentId` renamed to `/documents/$documentId`.
2. `account:web:dev` now binds `0.0.0.0`.
3. `apps/app` now has proper component runtime tests under Vitest.
4. React resolution is pinned to a single root instance for app/test consistency.

Validation state at notebook write time:

- `bun run --cwd apps/app test` passes
- `bun run --cwd apps/app ts:check` passes
- `bun run --cwd apps/app lint` passes
- `bun run --cwd apps/app build` passes

## Follow-up Note

The account app still treats `document.name` as first-class metadata, while the
drawing app UI does not. That is a product-model mismatch worth addressing
separately, but it is not required to complete the route/test/dev-host cleanup.
