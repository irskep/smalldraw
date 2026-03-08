#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve()
SPLAT_DIR = SCRIPT_PATH.parent.parent
REPO_ROOT = SPLAT_DIR.parent.parent
ASSETS_DIR = SPLAT_DIR / "src" / "coloring" / "assets"


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def process_image(input_path: Path, output_path: Path, passes: int) -> None:
    if passes < 1:
        raise ValueError("passes must be >= 1")

    cmd: list[str] = ["magick", str(input_path)]
    for _ in range(passes):
        cmd.extend(["(", "+clone", ")", "-compose", "Multiply", "-composite"])

    cmd.append(str(output_path))
    run(cmd)


def resolve_input_dir(raw: str) -> Path:
    provided = Path(raw).expanduser()
    candidates: list[Path] = []

    if provided.is_absolute():
        candidates.append(provided)
    else:
        candidates.extend([Path.cwd() / provided, SPLAT_DIR / provided, REPO_ROOT / provided])

        # Allow repo-style paths when running from packages/splat task cwd.
        raw_parts = provided.parts
        if len(raw_parts) >= 2 and raw_parts[0] == "packages" and raw_parts[1] == "splat":
            candidates.append(SPLAT_DIR.joinpath(*raw_parts[2:]))

        # Allow passing just a slug folder name.
        if len(raw_parts) == 1:
            candidates.append(ASSETS_DIR / provided.name)

    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        if resolved.exists() and resolved.is_dir():
            return resolved

    asset_dirs = sorted(path.name for path in ASSETS_DIR.iterdir() if path.is_dir())
    raise FileNotFoundError(
        f"Input folder not found: {raw}\n"
        f"Looked in common locations relative to repo and package roots.\n"
        f"Available asset folders: {', '.join(asset_dirs)}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Darken line art using ImageMagick Multiply composition. "
            "Useful as a postprocess after manual Retrobatch cleanup."
        )
    )
    parser.add_argument("--input-dir", required=True, help="Folder containing input PNGs")
    parser.add_argument(
        "--pattern",
        default="page-*.png",
        help="Glob pattern inside input dir (default: page-*.png)",
    )
    parser.add_argument(
        "--passes",
        type=int,
        default=1,
        help=(
            "Number of self-multiply passes. "
            "1 is usually enough; 2 is more aggressive."
        ),
    )
    args = parser.parse_args()

    input_dir = resolve_input_dir(args.input_dir)

    files = sorted(input_dir.glob(args.pattern))
    if not files:
        raise FileNotFoundError(f"No files matched pattern '{args.pattern}' in {input_dir}")

    output_dir = input_dir
    temp_dir = input_dir / ".postprocess-tmp"
    temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        for file_path in files:
            destination = output_dir / file_path.name
            temp_destination = temp_dir / file_path.name
            process_image(
                input_path=file_path,
                output_path=temp_destination,
                passes=args.passes,
            )
            temp_destination.replace(destination)
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)

    print(f"Processed {len(files)} image(s) in place: {output_dir}")


if __name__ == "__main__":
    main()
