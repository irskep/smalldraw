# Coloring Assets Workflow

This folder contains final coloring books used by `pkg-js/splat`.

## Manual Pipeline (Retrobatch)

1. Ingest a PDF + create/update manifest:

```bash
bun run --cwd packages/splat coloring:pipeline ingest --slug <slug> --url <pdf_url>
```

2. Set `enabled` and `rotationQuarterTurnsCcw` in `src/coloring/books/<slug>.json`.

3. Generate input pages for manual processing:

```bash
bun run --cwd packages/splat coloring:pipeline prepare-input --slug <slug> --dpi 300
```

This writes raw pages to:

- `src/coloring/assets/<slug>-input/`

4. Run your Retrobatch workflow manually:

- Input: `src/coloring/assets/<slug>-input/`
- Output: `src/coloring/assets/<slug>/`

5. Optional black-strength postprocess:

```bash
mise run //packages/splat:coloring:postprocess-blacks -- --input-dir <slug> --passes 1
```

6. Regenerate TypeScript imports and metadata:

```bash
bun run --cwd packages/splat generate:coloring-assets
```
