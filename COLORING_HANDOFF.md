# Smalldraw coloring-book handoff

Updated 2026-10-23. This work was performed in `/Users/steve/dev/apps/smalldraw` while the conversation happened to be attached to the **localci** agent. The code and commits are in smalldraw. Run the commands below from smalldraw, not localci.

## Current state

The gallery has **888 drawings**: 774 imported PDF/standalone-sheet drawings, 74 Pavel Kukov SVGs, and 40 Public Domain Review drawings. This includes **50 NPS illustrations**: 40 selected pages from the prehistoric coloring book and its ten bonus drawings.

All available PDFs from the surveyed Commons category have been downloaded and reviewed. Covers, advertising, blank pages, and duplicate illustrations were omitted. Remaining work is the standalone alphabet sheets: the queue contains 69 sources awaiting review/import, of which **one has been downloaded and 68 still need downloading** at handoff time. Use the status command for current numbers.

The user explicitly wants a broad collection and will winnow it down. Continue importing usable, licensed artwork rather than asking them to curate every addition.

## User decisions to preserve

- Group the gallery by subject, not source books or gender/age labels. Public Domain Review has one combined section.
- Review every page for orientation and crop. Earlier corrections included dove, camel, and SS Edmund Fitzgerald rotating 90 degrees counterclockwise.
- Artwork must be **black ink with transparent paper/background**, not opaque white images. The gallery cards themselves are white, without a nested cream rectangle.
- SVG and PNG are both acceptable. Prefer what stays closest to the source with a small file size. The user asked whether everything should become PNG; that was a question, not a directive.
- Thumbnails should be sharp; current imported previews have a 768-pixel longest edge. Raster drawing assets use 1600 pixels.
- Rehosting rights matter. CC BY, CC BY-SA, and CC0 are viable when the specific file's license and attribution support reuse. Do not treat a Commons category or its CC0 metadata notice as an artwork license.
- Do not add export-attribution UI. Preserve artwork credits, source links, licenses, and adaptation metadata.
- `/coloringbook` opens each selection as a **fresh drawing** with fill selected. Its heading is “Free coloring book.” It has a screenshot of a frog colored with the in-app palette; the desktop screenshot was reduced in size.
- No image subtitles, “No ads or signup required,” “Pick a picture and make it yours,” or similar promotional filler. Category navigation uses links, not buttons.

## Commits already made

All were made on smalldraw's `main`; this agent did not push them. Check the current Git state before pushing or making assumptions about the other agent's work.

- `f839f2e` — Resumable, paced Commons downloader, persistent queue, tests, docs.
- `89b703b` — Remaining coloring PDFs and reviewed alphabet sheets; gallery reached 888 drawings.
- `a337d15` — Reviewed collections and remaining-source notes; gallery reached 601 drawings.
- `3be8cfe` — First Commons/NPS expansion, importer enhancements, grouping, tests, docs.
- `dd5273e` — Smaller desktop header screenshot.
- `9db7d04` — Colored frog screenshot in the header.
- `682ff3b` — Earlier artwork framing and preview improvements.

The working tree was clean before this handoff document was added.

## Resume downloads

```sh
cd /Users/steve/dev/apps/smalldraw
mise run //packages/splat:coloring:download -- --status
mise run //packages/splat:coloring:download
```

Implementation: `packages/splat/scripts/download_coloring_sources.py`.
Queue: `packages/splat/src/coloring/commonsDownloads.json`.

Defaults: at most ten new files per invocation, at least 60 seconds between requests, persistent cache at `~/.cache/smalldraw/coloring`. Already verified files are reused. The downloader saves request timing and locks the cache against concurrent downloaders.

HTTP 429/503 saves `Retry-After` and ends the batch. Without that header, it uses a 15-minute cooldown. Rerunning during a saved cooldown makes no request. `--wait` waits out a saved cooldown before starting; a newly encountered rate limit still ends the batch. `--limit`, `--interval`, and `--cache-dir` are available. Keep the same cache between passes.

Commons repeatedly allowed only a small batch before throttling, even after cooldowns. Do not restart parallel downloaders or repeatedly retry during a saved cooldown.

Downloaded originals are in `originals/`, named by Commons SHA-1 plus extension. `commons-progress.json` maps titles to local paths and SHA-256 hashes. Verified SHA-256 files are also placed at the cache root for the importer. Downloads do **not** publish pages or mark them reviewed.

The first live downloader run fetched:

- `File:Alphabet-number-1-at-coloringpagesforkidsboys-dotcom.svg`
- Original: `~/.cache/smalldraw/coloring/originals/d0d574f27a8c9812469897dbd728a2639c318d56.svg`
- SHA-256: `d47203b6906cc34fab051e9f5cf08b74ced7656de0e54c058b511ab18dbd59fb`
- It still needs visual review and an importer manifest entry.

## Review and import

Primary files under `packages/splat/src/coloring/`:

- `pdfSources.json`: reviewed sources, author/license evidence, checksums, original page selections, crops, rotations, labels, subject tags.
- `pdfPages.json`: generated catalog.
- `assets/`: generated drawings and previews. `assets/credits/credits.txt` combines credits.
- `categories.ts`: subject grouping. The alphabet category is now “Letters & numbers.”
- `COMMONS_REVIEW.md`: remaining import backlog, duplicate mappings, rights exclusions.
- `README.md`: importer and licensing documentation.

For a newly downloaded source:

1. Inspect the original and its specific license/author record. Review rotation and framing.
2. Add it to `pdfSources.json`, using its SHA-256 and source/credit evidence. Standalone SVGs use `format: "svg"` and `pages: [1]`.
3. Choose subject tags and a useful accessible label. The skateboard figures deliberately form letters/numbers; do not rotate each person upright and destroy the character.
4. Run the importer, inspect the output/preview, check fill behavior where relevant, and remove confirmed duplicates.
5. Update the review notes, format generated JSON, and commit. Do not remove a queue entry merely because its bytes downloaded; download and review/import are different states.

### Important cache detail

The importer processes **all** manifest sources. The new persistent cache initially contains only the newly downloaded number sheet. The verified cache for the already imported books is still in `/tmp/smalldraw-coloring-sources`.

Before importing against the persistent cache, copy the existing verified SHA-256 entries from that old cache into it. Otherwise the importer will try to download all the old books again and encounter throttling. A safe migration is to iterate the current `pdfSources.json`, verify each old cache file against its declared SHA-256, and copy missing entries into the persistent cache. Do not overwrite a conflicting file without checking it. If the temporary cache is gone, obtain the missing originals deliberately rather than assuming the persistent cache is complete.

Then:

```sh
mise run //packages/splat:coloring:import-pdf -- --cache-dir ~/.cache/smalldraw/coloring
mise run format:fix
```

The importer remains `packages/splat/scripts/import-pdf-coloring.py`, with rendering helpers in `coloring_formats.py`.

`pages` contains original one-based source page numbers. `pageSettings` keys use those same numbers. `crop` and `erase` use fractional `[left, top, right, bottom]` rectangles; rotation is **counterclockwise** in 90-degree increments. Erasures are reviewed isolated labels, not artwork. Blank margins are automatically trimmed.

Asset filenames use original page numbers so curation does not renumber remaining pages. The original dinosaur/butterfly sources have explicit `assetNumber` overrides preserving their older IDs.

Vector pages remain SVG unless sufficiently large/dense that PNG is much smaller. Raster pages become transparent black-ink PNGs. SVG conversion preserves white occlusion shapes while applying a filter that removes white paper after compositing; simply deleting white fills exposes hidden strokes and is incorrect.

## Licensing and source scope

The survey covered `https://commons.wikimedia.org/wiki/Category:Printable_coloring_books` and its alphabet subcategories. Superseded heart-alphabet PNG copies were skipped in favor of SVG originals. We have **not** surveyed the broader `Category:Coloring_pages`; the user suggested that only if the first category yielded little, and it yielded plenty.

- Peaksel: CC BY-SA 4.0. Some PDF front matter says all rights reserved; the Commons confirmed-permission/VRT records are the evidence for the CC grant. Ticket numbers are recorded per source.
- Trento library books: CC BY-SA 4.0. Several historical illustrations needed rotations, recorded in the manifest.
- NPS: primary NPS asset records explicitly grant public-domain rights. Artist credits include Studio 105 and Benji Paysnoe. The ten bonus sources have individual NPS evidence URLs. The book original matched the Commons checksum.
- Great Coloring Book of Dogs: CC0 compilation with public-domain illustrations identified by the source.
- SELinux book: CC BY-SA 4.0, Dan Walsh and Máirín Duffy. Five cat/dog compositions were extracted; technical diagrams and repeated characters were omitted.
- Vegepedia: Nick Dolan, CC BY 4.0, explicitly stated in its own introduction. These are abstract drawings, despite the book name; grouped with shapes/patterns.
- Skateboard alphabet: per-file CC BY-SA 3.0 records.
- Peaksel adult collection page 257 was excluded: recognizable Star Wars stormtrooper, with no established permission for that third-party character. Keep that exclusion.

## Validation completed

- LocalCI passed for `3be8cfe`, `a337d15`, `89b703b`, and `f839f2e` (two aggregate tasks each).
- 378 splat tests passed during the collection work; later commits passed comprehensive LocalCI validation.
- Eight rendering-pipeline tests and eleven downloader tests passed.
- All 774 imported assets were decoded and compared with previews in Chromium/WebKit.
- A dense Trento engraving produced a thumbnail pixel-comparison difference; visually checked side by side and correct.
- Adult collection butterfly pages 47, 48, and 50 were flagged only by Chromium at 160-pixel comparison width. All three passed in both engines at 768 pixels. This was fine-line downsampling, not missing drawing content.
- Desktop/mobile gallery checks passed in Chromium/WebKit, including choosing a page, fill, reload, and opening another fresh copy.
- WebKit fill/reload also passed on the NPS mammoth PNG, a new butterfly PNG, and Vegepedia page 10 SVG. Screenshots confirmed visible color inside the intended regions.
- A final duplicate comparison found no remaining matches under the tested image-similarity thresholds. This does not prove there can be no visually similar variants.

Useful commands:

```sh
mise run //packages/splat:coloring:test-download
mise run //packages/splat:coloring:test-pipeline
mise run //packages/splat:test
mise exec -- localci wait --repo /Users/steve/dev/apps/smalldraw
```

## Local services and temporary research

Follow the repo's AGENTS.md and inspect Tilt before starting duplicate services. Development uses portal `localhost:3000`, editor `localhost:3001`, and API/assets `localhost:3030`. The portal stopped overnight and was restarted with `mise run portal:web:dev`; editor/API were already running. These are observations, not a guarantee of current process state.

Useful temporary material remains in `/tmp/commons-coloring-review`:

- `inventory.json`: original Commons inventory and metadata, plus downloaded local paths.
- `reviews.json`: manual page selections, tags, crop/rotation decisions, duplicate mappings, and exclusions.
- Contact sheets, original downloads, browser screenshots, validation logs.
- `check-render.ts`, `check-gallery.ts`, `check-new-fill.ts`: temporary browser checks.
- `sheets.py`, `single-sheets.py`, `asset-sheets.py`, `duplicates.py`: review helpers.

**Do not blindly rerun the temporary `build-manifest.py`, `save-review.py`, or old `resume.py`.** They were orchestration scripts for prior batches and can overwrite newer committed decisions or bypass the persistent downloader's saved timing. Continue from the committed manifests and the new downloader. Temporary files are useful evidence but are not the durable source of truth.

No automatic publishing, deployment, push, or export-attribution changes are required for the next batch. The next concrete step is to review the cached skateboard “1,” then continue small download/review/import batches as Commons permits.
