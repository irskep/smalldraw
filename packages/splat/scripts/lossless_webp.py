"""Encode raster artwork without changing pixels, including transparent RGB."""
import subprocess
import tempfile
from pathlib import Path


def encode_webp(png):
    with tempfile.TemporaryDirectory(prefix="coloring-webp-") as directory:
        source = Path(directory) / "source.png"
        output = Path(directory) / "output.webp"
        source.write_bytes(png)
        subprocess.run([
            "cwebp", "-quiet", "-lossless", "-exact", "-m", "6",
            "-metadata", "all", str(source), "-o", str(output),
        ], check=True)
        return output.read_bytes()
