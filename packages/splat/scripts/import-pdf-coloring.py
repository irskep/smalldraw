"""Import reviewed PDF/SVG drawing pages with reproducible framing and credits."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import time
import pymupdf
from lossless_webp import encode_webp
from coloring_formats import complexity_score, artwork_bounds, prepare_page, render_page, render_png

splat = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--cache-dir", type=Path, default=Path(tempfile.gettempdir()) / "smalldraw-coloring-sources")
args = parser.parse_args()
args.cache_dir.mkdir(parents=True, exist_ok=True)
sources = json.loads((splat / "src/coloring/pdfSources.json").read_text())
pages = []
credits = []
for source in sources:
    if source["license"] not in {"CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0", "CC-BY-SA-3.0", "PD-US-Gov-NPS"}:
        raise ValueError(f"Review the license before importing {source['id']}")
    output = splat / "src/coloring/assets" / source["id"]
    output.mkdir(parents=True, exist_ok=True)
    cached = args.cache_dir / source["sha256"]
    if not cached.exists():
        with tempfile.TemporaryDirectory() as temporary:
            download = Path(temporary) / "source"
            subprocess.run(["curl", "--fail", "--location", "--retry", "2", "--user-agent",
                            "Smalldraw/1.0 (coloring asset import)", source["downloadUrl"],
                            "--output", str(download)], check=True)
            if hashlib.sha256(download.read_bytes()).hexdigest() != source["sha256"]:
                raise ValueError(f"Source changed; review before importing {source['id']}")
            cached.write_bytes(download.read_bytes())
        time.sleep(20)
    if hashlib.sha256(cached.read_bytes()).hexdigest() != source["sha256"]:
        raise ValueError(f"Corrupt source cache for {source['id']}")
    document = pymupdf.open(stream=cached.read_bytes(), filetype=source.get("format", "pdf"))
    if not document.is_pdf:
        converted = pymupdf.open("pdf", document.convert_to_pdf())
        document.close()
        document = converted
    written = set()
    with document:
        for number, pdf_page in enumerate(source["pages"], 1):
            review = source.get("pageSettings", {}).get(str(pdf_page), {})
            with prepare_page(document[pdf_page - 1], review.get("crop", source.get("crop")), review.get("rotation", 0), review.get("erase")) as framed:
                page = framed[0]
                metadata = json.dumps({"source": source["sourceUrl"], "author": source["author"],
                    "license": source["license"], "licenseUrl": source["licenseUrl"], "page": pdf_page,
                    "crop": review.get("crop", source.get("crop")), "rotationCCW": review.get("rotation", 0), "erasedLabels": review.get("erase", []),
                    "changes": "Artwork extracted; margins trimmed; white paper made transparent; black line art."})
                data, extension, width, height = render_page(page, metadata)
                # Dense vector illustrations can be much larger than their raster equivalent.
                if extension == "svg" and len(data) > 300_000:
                    png, png_width, png_height = render_png(page, artwork_bounds(page), 1600, metadata)
                    if len(png) < len(data) / 2:
                        data, extension, width, height = png, "png", png_width, png_height
                if extension == "png":
                    data, extension = encode_webp(data), "webp"
                asset_number = review.get("assetNumber", pdf_page)
                filename = f"page-{asset_number:03d}.{extension}"
                (output / filename).write_bytes(data)
                preview_filename = f"page-{asset_number:03d}-preview.webp"
                preview, _, _ = render_png(page, artwork_bounds(page), 768, metadata)
                (output / preview_filename).write_bytes(encode_webp(preview))
                written.update((filename, preview_filename))
                pages.append({"id": f"coloring/{source['id']}/{filename}",
                    "preview": f"coloring/{source['id']}/{preview_filename}",
                    "label": review.get("label", f"{source['label']} {asset_number}"), "sourceId": source["id"],
                    "sourceUrl": source["sourceUrl"], "tags": review.get("tags", source["tags"]),
                    "pageNumber": pdf_page, "width": width, "height": height, "complexity": complexity_score(preview)})
    for stale in output.glob("page-*"):
        if stale.name not in written:
            stale.unlink()
    credits.append(f"{source['label']} pages — {source['author']}\n"
                   f"Source: {source['sourceUrl']}\n"
                   f"License: {source['license']} — {source['licenseUrl']}\n"
                   "Changes: artwork extracted; reviewed crops and rotations applied; blank margins trimmed; Lossless WebP previews rendered; white paper made transparent; black line art. Dense vectors may be rasterized.\n"
                   "Adapted artwork retains the source license or public-domain status.\n")
    print(f"Imported {source['id']}: {len(source['pages'])} pages", flush=True)
(splat / "src/coloring/pdfPages.json").write_text(json.dumps(pages, indent=2) + "\n")
credits_dir = splat / "src/coloring/assets/credits"
credits_dir.mkdir(exist_ok=True)
(credits_dir / "credits.txt").write_text(
    (splat / "src/coloring/assets/pavelkukov/credits.txt").read_text()
    + "\n\nCommons artwork\n\n" + "\n".join(credits))
print(f"Imported {len(pages)} drawing pages")
