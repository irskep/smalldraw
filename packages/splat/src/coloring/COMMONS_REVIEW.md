# Commons source review — 2026-10-23

Inventory: the [Printable coloring books category](https://commons.wikimedia.org/wiki/Category:Printable_coloring_books) and its alphabet subcategories. Superseded PNG copies of the heart alphabet were excluded in favor of SVG originals. The broader Coloring pages category has not been surveyed.

Imported sources, licenses, checksums, selected pages, and framing settings are recorded in `pdfSources.json`. NPS bonus pages were obtained from the linked NPS rights records.

## Current curation — 2026-10-23

After visual review in the gallery, the user requested removing incomplete
alphabet subsets and the entire Valentine alphabet collection. Removed all nine
Commons illustrated-letter sheets, all six illustrated letters from the Pavel
Kukov collection, and all 39 imported Valentine sheets (letters, numbers, and
heart-only variants). Originals remain in the verified cache, but their generated
assets and manifest entries are removed. Do not reimport these exclusions.

The retained alphabets are complete A–Z sets: skateboard figures and patterned
letters (adult collection pages 72–97). Skateboard letters come first, followed
by numbers 0–10 and charts; the more intricate patterned alphabet follows.
The gallery now contains **898 drawings**: 790 PDF/standalone imports, 68 Pavel
Kukov drawings, and 40 Public Domain Review pages.

Other subjects are sorted by measured preview line density, from simpler to
more detailed. This is a browsing heuristic, not an age or difficulty rating.

The following import/review record is historical; these curation decisions
supersede its retained-sheet counts.

## Completed alphabet-sheet review — 2026-10-23

All 69 queued sources have been downloaded and checksum-verified. Their per-file
Commons license and author records were checked against the preserved inventory.
64 sheets were imported: 22 skateboard letters/numbers, three SVG skateboard
charts, 37 heart letters/numbers, a plain heart, and a nine-heart sheet. Together
with the existing collection, the gallery now has 952 drawings (838 from this
import pipeline, 74 Pavel Kukov SVGs, and 40 Public Domain Review pages).

Each original was visually reviewed. Skateboard figures retain the orientations
that form the characters. Heart letters retain their intentional tilt. Blank
margins are trimmed by the importer; no artwork crops or rotations were needed.
The standalone sheet labels are explicit, without an appended page number.

Omitted downloaded sources:

- `Skateboard Alphabet Chart.gif`: raster duplicate of the SVG alphabet chart,
  with an added promotional mark. Retained `Skateboard-alphabet-chart-at-coloringpagesforkidsboys-dotcom.svg`.
- `Skateboard Numbers Chart.gif`: repeats the individual number figures and
  includes a promotional mark. Retained the two SVG number charts instead.
- `Skateboard-alphabet-cover-at-coloringpagesforkidsboys-dotcom.svg`: cover,
  repeating the included sheets.
- `Valentines-day-hearts-alphabet-cover-at-coloring-pages-for-kids-boys-dotcom.svg`:
  cover, repeating the included sheets.
- `Valentines-day-hearts-alphabet-blank1-at-coloring-pages-for-kids-boys-dotcom.svg`:
  tilted version of the plain heart. Retained the upright `blank2` and distinct
  nine-heart `blank3` arrangement. These are usable outlined hearts, not empty pages.

The heart L has a specific **PD-ineligible** designation on its Commons file
page, rather than CC BY-SA. Its manifest records `LicenseRef-PD-ineligible` and
links to that evidence; it is not mislabeled CC0. All other new sheets retain
CC BY-SA 3.0 and attribution to Coloringbuddymike.

`commonsDownloads.json` remains the complete download inventory, including
reviewed omissions. `pdfSources.json` is the authoritative import selection.
There are no remaining sources awaiting review in this queue.

Validation: all 64 final assets and previews decode and agree in Chromium and
WebKit, with transparent paper and black ink. All previews retain a longest
edge of at least 768 pixels. Previously imported artwork is byte-for-byte
unchanged. The source renderer repeats an existing SELinux XObject warning,
but its output is unchanged. The new assets and previews total about 2.9 MB.
Desktop (1280px) and mobile (390px) gallery checks passed in both browsers,
including fresh-copy creation and fill selected on entry. Filled skateboard
shirt and heart regions were visually checked; fills persisted after reload.
The rendering/downloader tests and all 378 splat package tests passed.


## Duplicate drawings omitted

The same artwork appears in several Peaksel books. These are original one-based PDF page numbers; each entry identifies the retained copy.

### Coloring Pages for Boys – Printable Coloring Book for Little Men.pdf

- Page 4: `peaksel-dragons`, page 9.
- Page 6: `peaksel-dinosaurs`, page 7.
- Page 7: `peaksel-horses`, page 11.
- Page 8: `peaksel-dragons`, page 11.
- Page 9: `peaksel-spring`, page 16.
- Page 11: `peaksel-dinosaurs`, page 4.
- Page 12: `peaksel-fish`, page 10.
- Page 13: `peaksel-dinosaurs`, page 5.
- Page 14: `peaksel-horses`, page 6.
- Page 15: `peaksel-spring`, page 13.
- Page 17: `peaksel-dragons`, page 20.
- Page 18: `peaksel-dinosaurs`, page 12.
- Page 20: `peaksel-dragons`, page 5.
- Page 21: `peaksel-fish`, page 4.
- Page 23: `peaksel-spring`, page 23.
- Page 24: `peaksel-horses`, page 10.
- Page 25: `peaksel-dinosaurs`, page 11.
- Page 27: `peaksel-dragons`, page 8.
- Page 28: `peaksel-fish`, page 11.
- Page 29: `peaksel-dinosaurs`, page 16.
- Page 31: `peaksel-spring`, page 5.
- Page 32: `peaksel-dragons`, page 4.
- Page 33: `peaksel-dinosaurs`, page 10.
- Page 34: `peaksel-fish`, page 9.
- Page 35: `peaksel-dragons`, page 16.
- Page 36: `peaksel-dinosaurs`, page 9.
- Page 37: `peaksel-spring`, page 24.

### Coloring Pages for Girls - Printable Coloring Book for Kids.pdf

- Page 4: `peaksel-princesses`, page 10.
- Page 5: `peaksel-princesses`, page 23.
- Page 7: `peaksel-fairies`, page 14.
- Page 8: `peaksel-horses`, page 6.
- Page 9: `peaksel-princesses`, page 9.
- Page 10: `peaksel-butterflies`, page 4.
- Page 11: `peaksel-princesses`, page 7.
- Page 12: `peaksel-spring`, page 22.
- Page 13: `peaksel-fairies`, page 15.
- Page 15: `peaksel-flowers`, page 4.
- Page 16: `peaksel-fish`, page 4.
- Page 17: `peaksel-fairies`, page 22.
- Page 18: `peaksel-princesses`, page 12.
- Page 20: `peaksel-fairies`, page 5.
- Page 21: `peaksel-horses`, page 9.
- Page 22: `peaksel-spring`, page 25.
- Page 23: `peaksel-princesses`, page 11.
- Page 24: `peaksel-flowers`, page 5.
- Page 25: `peaksel-butterflies`, page 13.
- Page 27: `peaksel-fairies`, page 8.
- Page 28: `peaksel-flowers`, page 10.
- Page 30: `peaksel-fish`, page 9.
- Page 31: `peaksel-flowers`, page 14.
- Page 32: `peaksel-fish`, page 11.
- Page 33: `peaksel-fairies`, page 11.
- Page 34: `peaksel-fish`, page 10.
- Page 35: `peaksel-fairies`, page 12.

### Coloring Pages for Kids PDF.pdf

- Page 4: `peaksel-fairies`, page 5.
- Page 5: `peaksel-dragons`, page 20.
- Page 6: `peaksel-butterflies`, page 7.
- Page 7: `peaksel-dinosaurs`, page 9.
- Page 8: `peaksel-stories`, page 19.
- Page 9: `peaksel-horses`, page 10.
- Page 10: `peaksel-fish`, page 11.
- Page 11: `peaksel-fairies`, page 14.
- Page 12: `peaksel-flowers`, page 10.
- Page 13: `peaksel-princesses`, page 7.
- Page 14: `peaksel-dragons`, page 16.
- Page 15: `peaksel-adventures`, page 5.
- Page 16: `peaksel-dinosaurs`, page 7.
- Page 17: `peaksel-butterflies`, page 4.
- Page 19: `peaksel-spring`, page 12.
- Page 20: `peaksel-stories`, page 14.
- Page 21: `peaksel-adventures`, page 19.
- Page 22: `peaksel-fish`, page 9.
- Page 23: `peaksel-dinosaurs`, page 5.
- Page 24: `peaksel-fairies`, page 8.
- Page 25: `peaksel-flowers`, page 5.
- Page 26: `peaksel-horses`, page 6.
- Page 27: `peaksel-princesses`, page 23.
- Page 28: `peaksel-adventures`, page 10.
- Page 29: `peaksel-spring`, page 9.
- Page 30: `peaksel-dragons`, page 5.
- Page 31: `peaksel-fairies`, page 22.
- Page 32: `peaksel-stories`, page 26.
- Page 33: `peaksel-fish`, page 4.
- Page 34: `peaksel-spring`, page 10.
- Page 35: `peaksel-flowers`, page 4.
- Page 36: `peaksel-adventures`, page 16.
- Page 37: `peaksel-dragons`, page 9.
- Page 38: `peaksel-fish`, page 10.
- Page 39: `peaksel-stories`, page 6.
- Page 40: `peaksel-spring`, page 11.
- Page 41: `peaksel-dinosaurs`, page 4.
- Page 42: `peaksel-flowers`, page 14.
- Page 43: `peaksel-horses`, page 9.
- Page 44: `peaksel-spring`, page 21.
- Page 45: `peaksel-princesses`, page 9.
- Page 46: `peaksel-horses`, page 11.
- Page 47: `peaksel-spring`, page 25.

### Printable Coloring Pages for Adults - Free Adult Coloring Book.pdf

- Page 4: `peaksel-mandalas`, page 4.
- Page 5: `peaksel-mandalas`, page 5.
- Page 6: `peaksel-mandalas`, page 6.
- Page 7: `peaksel-mandalas`, page 7.
- Page 8: `peaksel-mandalas`, page 8.
- Page 9: `peaksel-mandalas`, page 9.
- Page 10: `peaksel-mandalas`, page 10.
- Page 11: `peaksel-mandalas`, page 11.
- Page 12: `peaksel-mandalas`, page 12.
- Page 13: `peaksel-mandalas`, page 13.
- Page 14: `peaksel-mandalas`, page 14.
- Page 15: `peaksel-mandalas`, page 15.
- Page 16: `peaksel-mandalas`, page 16.
- Page 17: `peaksel-mandalas`, page 17.
- Page 18: `peaksel-mandalas`, page 18.
- Page 19: `peaksel-mandalas`, page 19.
- Page 20: `peaksel-mandalas`, page 20.
- Page 21: `peaksel-mandalas`, page 21.
- Page 22: `peaksel-mandalas`, page 22.
- Page 23: `peaksel-mandalas`, page 23.
- Page 24: `peaksel-mandalas`, page 24.
- Page 25: `peaksel-mandalas`, page 25.
- Page 26: `peaksel-mandalas`, page 26.
- Page 27: `peaksel-mandalas`, page 27.
- Page 28: `peaksel-mandalas`, page 28.
- Page 29: `peaksel-mandalas`, page 29.
- Page 30: `peaksel-mandalas`, page 30.
- Page 31: `peaksel-mandalas`, page 31.
- Page 32: `peaksel-mandalas`, page 32.
- Page 33: `peaksel-mandalas`, page 33.

## Rights exclusions

Excluded Printable Coloring Pages for Adults - Free Adult Coloring Book.pdf, page 257: Recognizable Star Wars stormtrooper; uploader license does not establish permission for the character.

## Other omissions

- Covers, advertisements, blank sheets, and book credits are not drawing pages. Author and license credits remain in the downloadable artwork credits.
- SELinux: retain the five standalone cat-and-dog compositions; omit the colored covers and technical policy diagrams that repeat those characters.
