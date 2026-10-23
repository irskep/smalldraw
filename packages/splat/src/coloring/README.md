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

## Import SVG artwork

```sh
git clone https://github.com/pavelkukov/coloring-pages /tmp/coloring-pages
mise run //packages/splat:coloring:import-svg -- /tmp/coloring-pages
mise run //packages/splat:coloring:import-pdf
```

The SVG import records the source commit in `svgPages.json`, retains the original
artwork and attribution, corrects the dove’s orientation, and excludes the blank sheet. Subject grouping lives in
`categories.ts`; technical tags, ages, and gender labels are not shown as categories.

## Import PDF artwork

`pdfSources.json` records source pages, exact download checksums, license links,
author credits, and reviewed page numbers (one-based). The importer uses a pinned
PyMuPDF environment through uv. It rejects changed downloads. Vector pages stay SVG; pages containing bitmap
images become compact grayscale+alpha PNGs, with white paper transparent and
black line art. Both formats use the same catalog, picker, and fill path.

`mise run //packages/splat:coloring:import-pdf` extracts the selected drawing pages,
converts white fills to transparent, embeds source metadata, and writes
`pdfPages.json`. It also assembles the downloadable artwork credits. Review
rendered pages and test filling, saving, and reopening before adding a source.
The older PNG pipeline remains for the existing Public Domain Review assets.

## Source and license review — 2026-10-22

- [Pavel Kukov SVG collection](https://github.com/pavelkukov/coloring-pages):
  collection licensed CC BY-SA 4.0. Preserve its LICENSE, acknowledgments, and
  per-file metadata. The dove is rotated 90° counterclockwise; other SVGs are unchanged. Browsing labels are ours.
- [Peaksel dinosaur PDF](https://commons.wikimedia.org/wiki/File:Dinosaur_Coloring_Pages_-_Printable_Coloring_Book_For_Kids.pdf)
  and [butterfly PDF](https://commons.wikimedia.org/wiki/File:Butterfly_Coloring_Pages_-_Printable_Coloring_Book_For_Kids.pdf):
  the Commons description pages specify CC BY-SA 4.0 and confirmed permission
  under VRT ticket 2016051310011997. The PDF front matter says all rights reserved;
  retain the Commons permission record as the evidence for the CC grant. Pages
  4–23 contain vector drawings; covers, copyright sheets, and app promotions are
  excluded. Extracted/transparent artwork remains CC BY-SA 4.0.
- [NPS prehistoric collection](https://commons.wikimedia.org/wiki/File:NPS_Prehistoric_Life_in_the_National_Parks_Coloring_Book.pdf):
  listed as US public domain federal work. Not imported in this pass.

The Commons category itself does not license its contents. Review each file's
license and attribution; the site's CC0 metadata notice does not make the image
CC0. CC0, CC BY, and CC BY-SA sources can be imported with their specific terms
recorded. Do not assume every Creative Commons license permits the same uses.
