# Coloring pages

The picker groups drawings by subject. Public Domain Review pages share one
section; source volumes are provenance, not browsing categories.

The locked `lineart` image layer sits above `color-under`. The fill tool renders
the complete layer stack into a pixel buffer, flood-fills it in a worker, and
adds a raster-fill shape to the active drawing layer. SVG files use the same
image loader and compositor as PNGs. They are not converted into editable shapes.
White paper must be transparent so colors below it remain visible. PDF-derived
SVGs retain white occlusion shapes and apply a white-to-alpha filter to the
composited artwork; removing those shapes would expose hidden strokes.
New imported documents have a maximum dimension of 1600 pixels to bound fill work.
Imports measure visible ink after compositing and trim blank margins, retaining
a 3% margin where the source has room. The gallery and picker use separate
768-pixel transparent PNG previews rendered from the originals; the editor uses
the full SVG or PNG artwork.

## Public gallery

`/coloringbook` displays the same subject categories as the editor picker. Page
links use `/draw/?new=coloring&page=<catalog-id>` to create a fresh drawing.
Opening the link again creates another copy; reloading the resulting `?local=`
URL reopens that drawing. Unknown page IDs show a startup error.

The gallery header is a real editor screenshot. Regenerate it with
`mise run coloring:capture-preview` while the portal and editor are running;
pass a portal origin to capture from another environment.

## Import SVG artwork

```sh
git clone https://github.com/pavelkukov/coloring-pages /tmp/coloring-pages
mise run //packages/splat:coloring:import-svg -- /tmp/coloring-pages
mise run //packages/splat:coloring:import-pdf
```

The SVG import records the source commit in `svgPages.json`, retains the original
artwork and attribution, corrects the dove, camel, and SS Edmund Fitzgerald orientations, and excludes the blank sheet. Subject grouping lives in
`categories.ts`; technical tags, ages, and gender labels are not shown as categories.

## Import Commons artwork

`pdfSources.json` records source pages, exact download checksums, license links,
author credits, and reviewed page numbers (one-based). It also accepts individual
SVG and raster sheets; `format` identifies those sources. The importer uses a pinned
PyMuPDF environment through uv. It rejects changed downloads. Vector pages stay SVG unless a dense drawing is over 300 KB and a PNG is less
than half its size. Pages containing bitmap images become compact grayscale+alpha PNGs, with white paper transparent and
black line art. Both formats use the same catalog, picker, and fill path.

`mise run //packages/splat:coloring:import-pdf` extracts the selected drawing pages,
converts white fills to transparent, embeds source metadata, and writes
`pdfPages.json`. It also assembles the downloadable artwork credits. Review
rendered pages and test filling, saving, and reopening before adding a source.
The older PNG pipeline remains for the existing Public Domain Review assets.

To remove a drawing, remove its source page number from `pages` and rerun the
import. Asset names use original page numbers so removing one does not renumber
the others. The original dinosaur and butterfly imports record `assetNumber`
overrides to retain their assigned filenames. `pageSettings` is keyed by the original page number and can override
`label`, `tags`, `crop`, and `rotation`. Crops are `[left, top, right, bottom]`
fractions of the source page. Rotation is counterclockwise, in 90-degree steps.
A source-level `crop` applies to all its pages. Isolated printed labels can be
removed with reviewed `erase` rectangles in the same coordinate system; these
are applied before cropping and rotation. Blank margins are then trimmed.

Downloads are checksum-verified and cached in the system temporary directory.
Use `--cache-dir /path/to/sources` to keep a reusable cache elsewhere. Cache
filenames are the source SHA-256 values. Repeated imports use the cache, and the
importer removes stale generated files within each source directory.

## Source and license review — 2026-10-22

- [Pavel Kukov SVG collection](https://github.com/pavelkukov/coloring-pages):
  collection licensed CC BY-SA 4.0. Preserve its LICENSE, acknowledgments, and
  per-file metadata. The dove, camel, and SS Edmund Fitzgerald are rotated 90° counterclockwise. Blank margins are trimmed; original paths are retained. Browsing labels are ours.
- [Peaksel dinosaur PDF](https://commons.wikimedia.org/wiki/File:Dinosaur_Coloring_Pages_-_Printable_Coloring_Book_For_Kids.pdf)
  and [butterfly PDF](https://commons.wikimedia.org/wiki/File:Butterfly_Coloring_Pages_-_Printable_Coloring_Book_For_Kids.pdf):
  the Commons description pages specify CC BY-SA 4.0 and confirmed permission
  under VRT ticket 2016051310011997. The PDF front matter says all rights reserved;
  retain the Commons permission record as the evidence for the CC grant. Pages
  4–23 contain vector drawings; covers, copyright sheets, and app promotions are
  excluded. Extracted/transparent artwork remains CC BY-SA 4.0.
- [NPS prehistoric collection](https://commons.wikimedia.org/wiki/File:NPS_Prehistoric_Life_in_the_National_Parks_Coloring_Book.pdf):
  Commons lists the book as US public domain federal work. NPS's own
  [asset records](https://npgallery.nps.gov/AssetDetail/216a585e-6539-4851-b16e-84471347d17d)
  explicitly mark the drawings public domain. The ten bonus pages each have their
  own NPS rights record in the manifest. Credits retain Studio 105 and Benji
  Paysnoe as the book's artists. Printed frames and headings are removed, with
  individual crops where artwork approaches the headings.

The Commons category itself does not license its contents. Review each file's
license and attribution; the site's CC0 metadata notice does not make the image
CC0. CC0, CC BY, and CC BY-SA sources can be imported with their specific terms
recorded. Do not assume every Creative Commons license permits the same uses.

The additional Commons sheets retain their individual licenses: Peaksel and
Trento library PDFs use CC BY-SA 4.0; the skateboard and heart alphabets use
CC BY-SA 3.0. License evidence and available Wikimedia permission ticket numbers
are recorded per source. Source book titles are kept in provenance; gallery
categories describe the drawings.
