"""Import a checked-out pavelkukov/coloring-pages collection, retaining vector artwork.
Usage: mise run //packages/splat:coloring:import-svg -- /path/to/coloring-pages
"""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

source = Path(sys.argv[1]).resolve()
splat = Path(__file__).resolve().parents[1]
destination = splat / "src/coloring/assets/pavelkukov"
destination.mkdir(parents=True, exist_ok=True)
revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
collection = json.loads((source / "collection.json").read_text())
pages = []
for filename, metadata in sorted(collection.items()):
    if filename == "blank.svg":
        continue
    if Path(filename).name != filename or not filename.endswith(".svg"):
        raise ValueError(f"Unexpected SVG filename: {filename}")
    svg = ET.parse(source / "images" / filename).getroot()
    for element in svg.iter():
        if element.tag.rsplit("}", 1)[-1] in {"script", "image", "foreignObject"}:
            raise ValueError(f"Unexpected embedded content: {filename}")
    _, _, width, height = map(float, svg.attrib["viewBox"].split())
    if filename == "dove.svg":
        # Correct the source's sideways portrait page without changing its paths.
        text = (source / "images" / filename).read_text()
        text = text.replace('viewBox="0 0 210 297"', 'viewBox="0 0 297 210"')
        text = text.replace('height="297mm"', 'height="210mm"').replace('width="210mm"', 'width="297mm"')
        text = text.replace('id="layer1"', 'id="layer1" transform="translate(0 210) rotate(-90)"')
        (destination / filename).write_text(text)
        width, height = height, width
    else:
        shutil.copyfile(source / "images" / filename, destination / filename)
    # Keep document pixel dimensions bounded for the existing raster fill worker.
    scale = 1600 / max(width, height)
    pages.append({
        "filename": filename,
        "label": Path(filename).stem.replace("_", " ").capitalize(),
        "tags": metadata["categories"],
        "author": metadata.get("author", ""),
        "sourceUrl": metadata.get("source", ""),
        "width": round(width * scale),
        "height": round(height * scale),
    })
shutil.copyfile(source / "LICENSE", destination / "LICENSE")
acknowledgments = "\n".join(line.rstrip() for line in (source / "Acknowledgments.md").read_text().splitlines()) + "\n"
(destination / "Acknowledgments.md").write_text(acknowledgments)
credits = f"""# Coloring artwork credits

SVG collection: Pavel Kukov, https://github.com/pavelkukov/coloring-pages
Source revision: {revision}
Collection license: CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/

The dove is rotated 90 degrees counterclockwise; other SVGs are unchanged.
Labels and browsing categories
are supplied by this app. Original artist and source information is retained in
each SVG and in Acknowledgments.md alongside these files. The blank sheet is omitted.

""" + acknowledgments
(destination / "credits.txt").write_text(credits)
(splat / "src/coloring/svgPages.json").write_text(json.dumps({"revision": revision, "pages": pages}, indent=2) + "\n")
print(f"Imported {len(pages)} SVG pages from {revision}")
