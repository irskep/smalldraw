"""Refresh inexpensive line-density ordering from existing previews, without reimporting originals."""
import json
from pathlib import Path
from coloring_formats import complexity_score

root = Path(__file__).resolve().parents[1] / "src/coloring"
for filename in ("pdfPages.json", "svgPages.json"):
    data = json.loads((root / filename).read_text())
    pages = data if isinstance(data, list) else data["pages"]
    for page in pages:
        preview = page["preview"].removeprefix("coloring/")
        if filename == "svgPages.json":
            preview = "pavelkukov/" + preview
        page["complexity"] = complexity_score((root / "assets" / preview).read_bytes())
    (root / filename).write_text(json.dumps(data, indent=2) + "\n")
# The original raster-book catalog has no separate preview metadata.
scores = {}
for path in sorted((root / "books").glob("*.json")):
    source = json.loads(path.read_text())
    for image in sorted((root / "assets" / source["slug"]).glob("page-*.png")):
        scores[f"coloring/{source['slug']}/{image.name}"] = complexity_score(image.read_bytes())
(root / "rasterComplexity.json").write_text(json.dumps(scores, indent=2) + "\n")
print("Refreshed coloring-page complexity scores")
