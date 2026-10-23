"""Generate compact gallery thumbnails; retain full-size previews for high-DPI displays."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / "src/coloring"
assets = root / "assets"
previews = {page["preview"].removeprefix("coloring/") for page in json.loads((root / "pdfPages.json").read_text())}
previews.update("pavelkukov/" + page["preview"] for page in json.loads((root / "svgPages.json").read_text())["pages"])
for book in ("pdr-v1", "pdr-v2"):
    previews.update(str(path.relative_to(assets)) for path in (assets / book).glob("page-*.png"))
for preview in sorted(previews):
    path = assets / preview
    with Image.open(path) as original:
        for size in (256, 512):
            output = path.with_name(f"{path.stem}-thumb-{size}.webp")
            if output.exists() and output.stat().st_mtime_ns >= path.stat().st_mtime_ns:
                continue
            thumbnail = original.convert("RGBA")
            thumbnail.thumbnail((size, size), Image.Resampling.LANCZOS)
            thumbnail.save(output, format="WEBP", lossless=True, method=6)
print(f"Prepared 256px/512px thumbnails for {len(previews)} pages")
