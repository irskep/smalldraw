"""Extract reviewed PDF drawing pages as transparent SVG or PNG line art.
Run with mise run //packages/splat:coloring:import-pdf.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import pymupdf
from coloring_formats import artwork_bounds, render_page, render_png

splat = Path(__file__).resolve().parents[1]
sources = json.loads((splat / "src/coloring/pdfSources.json").read_text())
pages = []
credits = []
for source in sources:
    if source["license"] not in {"CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0"}:
        raise ValueError(f"Review the license before importing {source['id']}")
    output = splat / "src/coloring/assets" / source["id"]
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        pdf = Path(temporary) / "source.pdf"
        subprocess.run(["curl", "--fail", "--location", "--retry", "2", "--user-agent",
                        "Smalldraw/1.0 (coloring asset import)", source["downloadUrl"],
                        "--output", str(pdf)], check=True)
        if hashlib.sha256(pdf.read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError(f"Source changed; review before importing {source['id']}")
        with pymupdf.open(pdf) as document:
            for number, pdf_page in enumerate(source["pages"], 1):
                page = document[pdf_page - 1]
                metadata = json.dumps({**source, "pdfPage": pdf_page,
                    "changes": "Extracted artwork; margins trimmed; white paper made transparent; raster pages normalized to black line art."})
                data, extension, width, height = render_page(page, metadata)
                filename = f"page-{number:03d}.{extension}"
                (output / filename).write_bytes(data)
                preview_filename = f"page-{number:03d}-preview.png"
                preview, _, _ = render_png(page, artwork_bounds(page), 768, metadata)
                (output / preview_filename).write_bytes(preview)
                pages.append({"id": f"coloring/{source['id']}/{filename}",
                    "preview": f"coloring/{source['id']}/{preview_filename}",
                    "label": f"{source['label']} {number}", "sourceId": source["id"],
                    "sourceUrl": source["sourceUrl"], "tags": source["tags"],
                    "pageNumber": pdf_page, "width": width, "height": height})
    credits.append(f"{source['label']} pages — {source['author']}\n"
                   f"Source: {source['sourceUrl']}\n"
                   f"License: {source['license']} — {source['licenseUrl']}\n"
                   "Changes: pages extracted; margins trimmed; PNG previews rendered; white paper made transparent; raster pages normalized to black line art.\n"
                   "Adapted artwork remains under the source license.\n")
(splat / "src/coloring/pdfPages.json").write_text(json.dumps(pages, indent=2) + "\n")
credits_dir = splat / "src/coloring/assets/credits"
credits_dir.mkdir(exist_ok=True)
(credits_dir / "credits.txt").write_text(
    (splat / "src/coloring/assets/pavelkukov/credits.txt").read_text()
    + "\n\nPDF artwork\n\n" + "\n".join(credits))
print(f"Imported {len(pages)} PDF drawing pages")
