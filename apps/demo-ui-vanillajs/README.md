# Demo UI (Vanilla JS)

A dependency-light static site that mounts `@smalldraw/ui-vanillajs` to showcase the raw canvas + toolbar experience without React.

## Scripts

```sh
bun run --filter demo-ui-vanillajs build  # Produces dist/ with bundled JS + static assets
bun run --filter demo-ui-vanillajs dev    # Runs bun's HTML dev server (http://localhost:3000) with live reload
```

After `build`, serve `dist/` via any static server (e.g. `bunx serve dist`).
