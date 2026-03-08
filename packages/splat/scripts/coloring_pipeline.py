#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
from urllib.request import Request, urlopen

SCRIPT_PATH = Path(__file__).resolve()
SPLAT_DIR = SCRIPT_PATH.parent.parent
REPO_ROOT = SPLAT_DIR.parent.parent
COLORING_DIR = SPLAT_DIR / "src" / "coloring"
BOOKS_DIR = COLORING_DIR / "books"
ASSETS_DIR = COLORING_DIR / "assets"
INTAKE_DIR = COLORING_DIR / "intake"


def run_command(
    cmd: List[str], cwd: Optional[Path] = None, stdin_text: Optional[str] = None
) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            check=True,
            text=True,
            capture_output=True,
            input=stdin_text,
        )
    except subprocess.CalledProcessError as error:
        message = (
            f"Command failed: {' '.join(cmd)}\n"
            f"exit_code={error.returncode}\n"
            f"stdout:\n{error.stdout}\n"
            f"stderr:\n{error.stderr}"
        )
        raise RuntimeError(message) from error


def download_file(url: str, output_path: Path) -> None:
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "application/pdf,application/octet-stream,*/*",
            "Referer": "https://library.nyam.org/colorourcollections/",
        },
    )
    with urlopen(request) as response:
        data = response.read()
    output_path.write_bytes(data)


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def default_page(index: int) -> Dict[str, Any]:
    return {
        "index": index,
        "rotationQuarterTurnsCcw": 0,
        "crop": None,
        "enabled": True,
    }


def normalize_crop(crop: Any) -> Optional[Dict[str, int]]:
    if not isinstance(crop, dict):
        return None
    try:
        x = int(crop["x"])
        y = int(crop["y"])
        width = int(crop["width"])
        height = int(crop["height"])
    except (KeyError, TypeError, ValueError):
        return None

    if x < 0 or y < 0 or width <= 0 or height <= 0:
        return None
    return {"x": x, "y": y, "width": width, "height": height}


def scale_crop(crop: Optional[Dict[str, int]], scale: float) -> Optional[Dict[str, int]]:
    if crop is None:
        return None
    if scale == 1.0:
        return crop
    x = max(0, int(round(crop["x"] * scale)))
    y = max(0, int(round(crop["y"] * scale)))
    width = max(1, int(round(crop["width"] * scale)))
    height = max(1, int(round(crop["height"] * scale)))
    return {"x": x, "y": y, "width": width, "height": height}


def normalize_page_index_list(
    value: Any, *, page_count: int, field_name: str
) -> Optional[List[int]]:
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError(f"Manifest field '{field_name}' must be a list of 0-based indexes")
    indexes: List[int] = []
    for raw in value:
        try:
            index = int(raw)
        except (TypeError, ValueError):
            raise ValueError(f"Manifest field '{field_name}' has non-integer value: {raw}") from None
        if index < 0 or index >= page_count:
            raise ValueError(
                f"Manifest field '{field_name}' index out of range: {index} (page_count={page_count})"
            )
        indexes.append(index)
    return sorted(set(indexes))


def normalize_manifest(manifest: Dict[str, Any], page_count: Optional[int] = None) -> Dict[str, Any]:
    if not isinstance(manifest.get("slug"), str) or not manifest["slug"].strip():
        raise ValueError("Manifest requires non-empty 'slug'")
    if not isinstance(manifest.get("title"), str) or not manifest["title"].strip():
        raise ValueError("Manifest requires non-empty 'title'")

    normalized_page_count = int(manifest.get("page_count") or 0)
    if page_count is not None:
        normalized_page_count = page_count
    if normalized_page_count <= 0:
        raise ValueError("Manifest requires positive 'page_count'")

    existing_pages = manifest.get("pages")
    pages_by_index: Dict[int, Dict[str, Any]] = {}
    if isinstance(existing_pages, list):
        for page in existing_pages:
            if not isinstance(page, dict):
                continue
            try:
                index = int(page.get("index"))
            except (TypeError, ValueError):
                continue
            if index < 0:
                continue
            pages_by_index[index] = page

    normalized_pages: List[Dict[str, Any]] = []
    for index in range(normalized_page_count):
        page = pages_by_index.get(index, default_page(index))
        try:
            rotation = int(page.get("rotationQuarterTurnsCcw", 0)) % 4
        except (TypeError, ValueError):
            rotation = 0
        crop = normalize_crop(page.get("crop"))
        enabled = bool(page.get("enabled", True))
        normalized_pages.append(
            {
                "index": index,
                "rotationQuarterTurnsCcw": rotation,
                "crop": crop,
                "enabled": enabled,
            }
        )

    render_strategy = manifest.get("render_strategy")
    if render_strategy not in ("auto", "rasterize", "extract-bitmaps"):
        render_strategy = "auto"
    try:
        crop_dpi = int(manifest.get("crop_dpi", 300))
    except (TypeError, ValueError):
        crop_dpi = 300
    if crop_dpi <= 0:
        crop_dpi = 300
    include_pages = normalize_page_index_list(
        manifest.get("include_pages"), page_count=normalized_page_count, field_name="include_pages"
    )
    include_set = set(include_pages or [])

    return {
        "slug": manifest["slug"],
        "title": manifest["title"],
        "url": manifest.get("url") if isinstance(manifest.get("url"), str) else None,
        "source_pdf": manifest.get("source_pdf") if isinstance(manifest.get("source_pdf"), str) else None,
        "render_strategy": render_strategy,
        "crop_dpi": crop_dpi,
        "include_pages": include_pages,
        "page_count": normalized_page_count,
        "pages": [
            {
                **page,
                "enabled": bool(page.get("enabled", True))
                and (True if include_pages is None else page["index"] in include_set)
            }
            for page in normalized_pages
        ],
    }


def get_book_manifest_path(slug: str) -> Path:
    return BOOKS_DIR / f"{slug}.json"


def find_pdf_path(manifest: Dict[str, Any]) -> Path:
    source_pdf = manifest.get("source_pdf")
    if not isinstance(source_pdf, str) or not source_pdf:
        raise ValueError("Manifest is missing 'source_pdf'")

    candidate = Path(source_pdf)
    if candidate.is_absolute() and candidate.exists():
        return candidate

    candidates = [
        REPO_ROOT / source_pdf,
        INTAKE_DIR / manifest["slug"] / source_pdf,
        INTAKE_DIR / source_pdf,
    ]
    for path in candidates:
        if path.exists():
            return path

    raise FileNotFoundError(f"Could not locate source PDF '{source_pdf}'")


def count_pdf_pages(pdf_path: Path) -> int:
    result = run_command(["magick", "identify", str(pdf_path)])
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    if not lines:
        raise RuntimeError(f"No pages found in {pdf_path}")
    return len(lines)


def ingest_command(args: argparse.Namespace) -> None:
    BOOKS_DIR.mkdir(parents=True, exist_ok=True)
    INTAKE_DIR.mkdir(parents=True, exist_ok=True)

    slug = args.slug.strip()
    if not slug:
        raise ValueError("--slug is required")

    input_pdf_path: Optional[Path] = None
    source_pdf_name: Optional[str] = None
    source_url: Optional[str] = None

    if args.url:
        source_url = args.url
        parsed = urlparse(args.url)
        filename = Path(parsed.path).name or f"{slug}.pdf"
        if not filename.lower().endswith(".pdf"):
            filename = f"{filename}.pdf"
        book_intake_dir = INTAKE_DIR / slug
        book_intake_dir.mkdir(parents=True, exist_ok=True)
        input_pdf_path = book_intake_dir / filename
        download_file(args.url, input_pdf_path)
        source_pdf_name = str(input_pdf_path.relative_to(REPO_ROOT))
    elif args.pdf:
        input_pdf_path = Path(args.pdf).resolve()
        if not input_pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {input_pdf_path}")
        source_pdf_name = str(input_pdf_path.relative_to(REPO_ROOT))
    else:
        raise ValueError("Provide either --pdf or --url")

    page_count = count_pdf_pages(input_pdf_path)
    manifest_path = get_book_manifest_path(slug)

    if manifest_path.exists() and not args.force:
        existing = load_json(manifest_path)
        merged: Dict[str, Any] = dict(existing)
        merged["slug"] = slug
        if args.title:
            merged["title"] = args.title
        elif not isinstance(merged.get("title"), str) or not merged["title"].strip():
            merged["title"] = slug
        if source_url:
            merged["url"] = source_url
        merged["source_pdf"] = source_pdf_name
        merged["page_count"] = page_count
        normalized = normalize_manifest(merged, page_count=page_count)
    else:
        normalized = normalize_manifest(
            {
                "slug": slug,
                "title": args.title or slug,
                "url": source_url,
                "source_pdf": source_pdf_name,
                "render_strategy": args.strategy,
                "crop_dpi": 300,
                "include_pages": None,
                "page_count": page_count,
                "pages": [default_page(index) for index in range(page_count)],
            },
            page_count=page_count,
        )

    write_json(manifest_path, normalized)
    print(f"Wrote manifest: {manifest_path}")


def render_pdf_to_raw_pages(pdf_path: Path, raw_dir: Path, dpi: int) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    output_pattern = raw_dir / "page-%03d.png"
    run_command(
        [
            "magick",
            "-density",
            str(dpi),
            str(pdf_path),
            "-background",
            "white",
            "-alpha",
            "remove",
            "-alpha",
            "off",
            str(output_pattern),
        ]
    )


def get_image_size(path: Path) -> Dict[str, int]:
    result = run_command(
        ["magick", "identify", "-format", "%w %h", str(path)]
    ).stdout.strip()
    parts = result.split()
    if len(parts) != 2:
        raise RuntimeError(f"Could not read image size for {path}: {result}")
    return {"width": int(parts[0]), "height": int(parts[1])}


def compute_trim_bbox(path: Path, fuzz_percent: float) -> Optional[Dict[str, int]]:
    result = run_command(
        [
            "magick",
            str(path),
            "-fuzz",
            f"{fuzz_percent}%",
            "-trim",
            "-format",
            "%@",
            "info:",
        ]
    ).stdout.strip()
    match = re.fullmatch(r"(\d+)x(\d+)\+(-?\d+)\+(-?\d+)", result)
    if not match:
        return None
    width = int(match.group(1))
    height = int(match.group(2))
    x = int(match.group(3))
    y = int(match.group(4))
    if width <= 0 or height <= 0:
        return None
    return {"x": x, "y": y, "width": width, "height": height}


def expand_crop(
    crop: Dict[str, int], image_size: Dict[str, int], padding: int
) -> Dict[str, int]:
    x = max(0, crop["x"] - padding)
    y = max(0, crop["y"] - padding)
    right = min(image_size["width"], crop["x"] + crop["width"] + padding)
    bottom = min(image_size["height"], crop["y"] + crop["height"] + padding)
    width = max(1, right - x)
    height = max(1, bottom - y)
    return {"x": x, "y": y, "width": width, "height": height}


def render_rotated_temp(input_png: Path, rotation_ccw_quarter_turns: int, output_png: Path) -> None:
    cmd = ["magick", str(input_png)]
    rotation = rotation_ccw_quarter_turns % 4
    if rotation:
        cmd.extend(["-rotate", str(-90 * rotation)])
    cmd.append(str(output_png))
    run_command(cmd)


def has_command(command: str) -> bool:
    return shutil.which(command) is not None


def parse_pdfimages_list(pdf_path: Path) -> List[Dict[str, Any]]:
    result = run_command(["pdfimages", "-list", str(pdf_path)])
    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    rows: List[Dict[str, Any]] = []
    for line in lines:
        if line.startswith("page ") or line.startswith("------"):
            continue
        parts = line.split()
        if len(parts) < 6:
            continue
        try:
            page = int(parts[0])
            num = int(parts[1])
            width = int(parts[3])
            height = int(parts[4])
        except ValueError:
            continue
        rows.append({"page": page, "num": num, "width": width, "height": height})
    return rows


def render_pdf_by_extracting_bitmaps(pdf_path: Path, raw_dir: Path, page_count: int) -> bool:
    if not has_command("pdfimages"):
        return False

    raw_dir.mkdir(parents=True, exist_ok=True)
    prefix = raw_dir / "pdfimage"
    run_command(["pdfimages", "-png", str(pdf_path), str(prefix)])
    rows = parse_pdfimages_list(pdf_path)
    if not rows:
        return False

    best_by_page: Dict[int, Dict[str, Any]] = {}
    for row in rows:
        page_index = int(row["page"]) - 1
        if page_index < 0 or page_index >= page_count:
            continue
        score = int(row["width"]) * int(row["height"])
        previous = best_by_page.get(page_index)
        previous_score = (
            int(previous["width"]) * int(previous["height"]) if previous is not None else -1
        )
        if score > previous_score:
            best_by_page[page_index] = row

    for page_index in range(page_count):
        best = best_by_page.get(page_index)
        if best is None:
            return False
        source_file = raw_dir / f"pdfimage-{int(best['num']):03d}.png"
        if not source_file.exists():
            return False
        target_file = raw_dir / f"page-{page_index:03d}.png"
        shutil.copyfile(source_file, target_file)
    return True


def apply_transforms(
    input_png: Path,
    output_png: Path,
    rotation_ccw_quarter_turns: int,
    crop: Optional[Dict[str, int]],
    transparent_lines: bool,
    normalize_black: bool,
) -> None:
    with tempfile.TemporaryDirectory(prefix="coloring-transform-") as tmp:
        transformed = Path(tmp) / "transformed.png"
        normalized = Path(tmp) / "normalized.png"
        cmd = ["magick", str(input_png)]

        rotation = rotation_ccw_quarter_turns % 4
        if rotation:
            cmd.extend(["-rotate", str(-90 * rotation)])

        if crop is not None:
            cmd.extend(
                [
                    "-crop",
                    f"{crop['width']}x{crop['height']}+{crop['x']}+{crop['y']}",
                    "+repage",
                ]
            )

        cmd.append(str(transformed))
        run_command(cmd)

        if normalize_black:
            run_command(
                [
                    "magick",
                    str(transformed),
                    "-colorspace",
                    "Gray",
                    "-auto-level",
                    str(normalized),
                ]
            )
            source_for_output = normalized
        else:
            source_for_output = transformed

        if not transparent_lines:
            shutil.copyfile(source_for_output, output_png)
            return

        alpha_cmd = [
            "magick",
            str(source_for_output),
            "-fill",
            "black",
            "-colorize",
            "100",
            "(",
            str(source_for_output),
            "-colorspace",
            "Gray",
            "-negate",
            ")",
            "-compose",
            "CopyOpacity",
            "-composite",
            str(output_png),
        ]
        run_command(alpha_cmd)


def render_command(args: argparse.Namespace) -> None:
    manifest_path = get_book_manifest_path(args.slug)
    if not manifest_path.exists():
        raise FileNotFoundError(f"Book manifest not found: {manifest_path}")

    manifest = normalize_manifest(load_json(manifest_path))
    pdf_path = find_pdf_path(manifest)

    raw_dir = INTAKE_DIR / manifest["slug"] / "raw-pages"
    strategy = args.strategy if args.strategy is not None else manifest.get("render_strategy", "auto")
    extracted = False
    if strategy in ("auto", "extract-bitmaps"):
        extracted = render_pdf_by_extracting_bitmaps(
            pdf_path=pdf_path,
            raw_dir=raw_dir,
            page_count=int(manifest["page_count"]),
        )
        if strategy == "extract-bitmaps" and not extracted:
            raise RuntimeError(
                "extract-bitmaps strategy selected, but embedded bitmap extraction failed. "
                "Install poppler's pdfimages or switch to --strategy rasterize."
            )

    if not extracted:
        render_pdf_to_raw_pages(pdf_path, raw_dir, args.dpi)

    assets_dir = ASSETS_DIR / manifest["slug"]
    assets_dir.mkdir(parents=True, exist_ok=True)
    for existing_png in assets_dir.glob("page-*.png"):
        existing_png.unlink()

    page_count = manifest["page_count"]
    crop_dpi = int(manifest.get("crop_dpi", args.dpi))
    crop_scale = args.dpi / crop_dpi if crop_dpi > 0 else 1.0
    for page in manifest["pages"]:
        if not page.get("enabled", True):
            continue
        index = int(page["index"])
        if index >= page_count:
            continue

        input_png = raw_dir / f"page-{index:03d}.png"
        if not input_png.exists():
            raise FileNotFoundError(f"Missing rendered page: {input_png}")

        output_png = assets_dir / f"page-{index + 1:03d}.png"
        apply_transforms(
            input_png=input_png,
            output_png=output_png,
            rotation_ccw_quarter_turns=int(page.get("rotationQuarterTurnsCcw", 0)),
            crop=scale_crop(normalize_crop(page.get("crop")), crop_scale),
            transparent_lines=bool(args.transparent_lines),
            normalize_black=bool(args.normalize_black),
        )

    manifest["render_strategy"] = strategy
    write_json(manifest_path, manifest)
    print(f"Rendered pages to: {assets_dir}")


def prepare_input_command(args: argparse.Namespace) -> None:
    manifest_path = get_book_manifest_path(args.slug)
    if not manifest_path.exists():
        raise FileNotFoundError(f"Book manifest not found: {manifest_path}")

    manifest = normalize_manifest(load_json(manifest_path))
    pdf_path = find_pdf_path(manifest)

    raw_dir = INTAKE_DIR / manifest["slug"] / "raw-pages"
    strategy = args.strategy if args.strategy is not None else manifest.get("render_strategy", "auto")
    extracted = False
    if strategy in ("auto", "extract-bitmaps"):
        extracted = render_pdf_by_extracting_bitmaps(
            pdf_path=pdf_path,
            raw_dir=raw_dir,
            page_count=int(manifest["page_count"]),
        )
        if strategy == "extract-bitmaps" and not extracted:
            raise RuntimeError(
                "extract-bitmaps strategy selected, but embedded bitmap extraction failed. "
                "Install poppler's pdfimages or switch to --strategy rasterize."
            )

    if not extracted:
        render_pdf_to_raw_pages(pdf_path, raw_dir, args.dpi)

    input_assets_dir = ASSETS_DIR / f"{manifest['slug']}-input"
    input_assets_dir.mkdir(parents=True, exist_ok=True)
    for existing_png in input_assets_dir.glob("page-*.png"):
        existing_png.unlink()

    page_count = manifest["page_count"]
    for page in manifest["pages"]:
        if not page.get("enabled", True):
            continue
        index = int(page["index"])
        if index >= page_count:
            continue

        input_png = raw_dir / f"page-{index:03d}.png"
        if not input_png.exists():
            raise FileNotFoundError(f"Missing rendered page: {input_png}")

        output_png = input_assets_dir / f"page-{index + 1:03d}.png"
        apply_transforms(
            input_png=input_png,
            output_png=output_png,
            rotation_ccw_quarter_turns=int(page.get("rotationQuarterTurnsCcw", 0)),
            crop=None,
            transparent_lines=False,
            normalize_black=False,
        )

    manifest["render_strategy"] = strategy
    write_json(manifest_path, manifest)
    print(f"Prepared Retrobatch input pages at: {input_assets_dir}")


def autocrop_command(args: argparse.Namespace) -> None:
    manifest_path = get_book_manifest_path(args.slug)
    if not manifest_path.exists():
        raise FileNotFoundError(f"Book manifest not found: {manifest_path}")

    manifest = normalize_manifest(load_json(manifest_path))
    pdf_path = find_pdf_path(manifest)
    raw_dir = INTAKE_DIR / manifest["slug"] / "raw-pages"
    render_pdf_to_raw_pages(pdf_path, raw_dir, args.dpi)

    updated = 0
    with tempfile.TemporaryDirectory(prefix="coloring-autocrop-", dir=str(INTAKE_DIR)) as tmp:
        tmp_dir = Path(tmp)
        for page in manifest["pages"]:
            if not page.get("enabled", True):
                continue
            if page.get("crop") is not None and not args.overwrite:
                continue

            index = int(page["index"])
            input_png = raw_dir / f"page-{index:03d}.png"
            if not input_png.exists():
                continue

            rotated_png = tmp_dir / f"rotated-{index:03d}.png"
            render_rotated_temp(
                input_png=input_png,
                rotation_ccw_quarter_turns=int(page.get("rotationQuarterTurnsCcw", 0)),
                output_png=rotated_png,
            )
            image_size = get_image_size(rotated_png)
            trim_bbox = compute_trim_bbox(rotated_png, args.fuzz)
            if trim_bbox is None:
                continue
            page["crop"] = expand_crop(trim_bbox, image_size, args.padding)
            updated += 1

    manifest["crop_dpi"] = args.dpi
    write_json(manifest_path, manifest)
    print(f"Updated {updated} crop(s) in: {manifest_path}")


def clear_crops_command(args: argparse.Namespace) -> None:
    manifest_path = get_book_manifest_path(args.slug)
    if not manifest_path.exists():
        raise FileNotFoundError(f"Book manifest not found: {manifest_path}")

    manifest = normalize_manifest(load_json(manifest_path))
    cleared = 0
    for page in manifest["pages"]:
        if page.get("crop") is not None:
            page["crop"] = None
            cleared += 1
    write_json(manifest_path, manifest)
    print(f"Cleared {cleared} crop(s) in: {manifest_path}")


def parse_json_from_text(text: str) -> Dict[str, Any]:
    direct = text.strip()
    if direct.startswith("{") and direct.endswith("}"):
        return json.loads(direct)

    fenced_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fenced_match:
        return json.loads(fenced_match.group(1))

    first = text.find("{")
    last = text.rfind("}")
    if first >= 0 and last > first:
        return json.loads(text[first : last + 1])

    raise ValueError("Could not parse JSON from Codex output")


def render_preview_page(pdf_path: Path, index: int, out_path: Path, dpi: int) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    run_command(
        [
            "magick",
            "-density",
            str(dpi),
            f"{pdf_path}[{index}]",
            "-background",
            "white",
            "-alpha",
            "remove",
            "-alpha",
            "off",
            str(out_path),
        ]
    )


def parse_page_indexes(raw: Optional[str], page_count: int, max_pages: int) -> List[int]:
    if raw:
        values: List[int] = []
        for token in raw.split(","):
            token = token.strip()
            if not token:
                continue
            value = int(token)
            if value < 0 or value >= page_count:
                raise ValueError(f"Page index out of range: {value}")
            values.append(value)
        return sorted(set(values))

    return list(range(min(page_count, max_pages)))


def codex_command(args: argparse.Namespace) -> None:
    manifest_path = get_book_manifest_path(args.slug)
    if not manifest_path.exists():
        raise FileNotFoundError(f"Book manifest not found: {manifest_path}")

    manifest = normalize_manifest(load_json(manifest_path))
    pdf_path = find_pdf_path(manifest)
    pages = parse_page_indexes(args.pages, manifest["page_count"], args.max_pages)

    INTAKE_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="coloring-codex-", dir=str(INTAKE_DIR)) as tmp:
        tmp_dir = Path(tmp)
        images: List[Path] = []
        for index in pages:
            image_path = tmp_dir / f"page-{index:03d}.png"
            render_preview_page(pdf_path, index, image_path, args.dpi)
            images.append(image_path)

        codex_output_path = tmp_dir / "codex-output.txt"
        prompt = (
            "You are helping build a coloring-book import manifest. "
            "Inspect the provided PDF page images and return JSON only. "
            "Infer book metadata from the title/cover page when possible and suggest per-page crops "
            "to remove margins/page numbers while preserving artwork.\n\n"
            "Return this exact JSON shape:\n"
            "{\n"
            '  "title": string,\n'
            '  "url": string | null,\n'
            '  "page_suggestions": [\n'
            "    {\n"
            '      "index": number,\n'
            '      "rotationQuarterTurnsCcw": 0|1|2|3,\n'
            '      "crop": {"x": number, "y": number, "width": number, "height": number} | null,\n'
            '      "notes": string\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            f"Context: slug={manifest['slug']}, current_title={manifest['title']}, current_url={manifest.get('url')}, "
            f"page_count={manifest['page_count']}, suggested_pages={pages}."
        )

        cmd = [
            "codex",
            "exec",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "-o",
            str(codex_output_path),
        ]

        for image in images:
            cmd.extend(["-i", str(image)])

        run_command(cmd, cwd=REPO_ROOT, stdin_text=prompt)

        codex_text = codex_output_path.read_text(encoding="utf-8")
        parsed = parse_json_from_text(codex_text)
        print(json.dumps(parsed, indent=2))

        if not args.apply:
            return

        title = parsed.get("title")
        if isinstance(title, str) and title.strip():
            manifest["title"] = title.strip()

        url = parsed.get("url")
        if isinstance(url, str) and url.strip():
            manifest["url"] = url.strip()
        elif url is None:
            manifest["url"] = None

        suggestions = parsed.get("page_suggestions")
        if isinstance(suggestions, list):
            pages_by_index = {int(page["index"]): page for page in manifest["pages"]}
            for suggestion in suggestions:
                if not isinstance(suggestion, dict):
                    continue
                try:
                    index = int(suggestion.get("index"))
                except (TypeError, ValueError):
                    continue
                if index < 0 or index >= manifest["page_count"]:
                    continue

                page = pages_by_index.get(index)
                if page is None:
                    continue

                try:
                    rotation = int(suggestion.get("rotationQuarterTurnsCcw", 0)) % 4
                except (TypeError, ValueError):
                    rotation = 0
                page["rotationQuarterTurnsCcw"] = rotation

                crop = normalize_crop(suggestion.get("crop"))
                page["crop"] = crop

        normalized = normalize_manifest(manifest)
        normalized["crop_dpi"] = args.dpi
        write_json(manifest_path, normalized)
        print(f"Applied Codex suggestions to: {manifest_path}")


def generate_ts_command(_: argparse.Namespace) -> None:
    run_command(["bun", "run", "./scripts/generate-coloring-assets.ts"], cwd=SPLAT_DIR)
    print("Regenerated generatedColoringPageAssets.ts")


def main() -> None:
    parser = argparse.ArgumentParser(description="Coloring-book PDF pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)

    ingest = subparsers.add_parser("ingest", help="Create/update a book manifest from a PDF or URL")
    ingest.add_argument("--slug", required=True)
    ingest.add_argument("--title", default=None)
    ingest_group = ingest.add_mutually_exclusive_group(required=True)
    ingest_group.add_argument("--pdf")
    ingest_group.add_argument("--url")
    ingest.add_argument("--force", action="store_true", help="Overwrite existing metadata fields")
    ingest.add_argument(
        "--strategy",
        choices=["auto", "rasterize", "extract-bitmaps"],
        default="auto",
        help="Preferred render strategy for this book",
    )
    ingest.set_defaults(func=ingest_command)

    render = subparsers.add_parser("render", help="Render a manifest-defined book to assets")
    render.add_argument("--slug", required=True)
    render.add_argument(
        "--strategy",
        choices=["auto", "rasterize", "extract-bitmaps"],
        default=None,
        help="Override manifest render strategy for this run",
    )
    render.add_argument("--dpi", type=int, default=150)
    render.add_argument("--transparent-lines", action="store_true")
    render.add_argument(
        "--no-normalize-black",
        dest="normalize_black",
        action="store_false",
        help="Disable post-crop grayscale black-level normalization",
    )
    render.set_defaults(normalize_black=True)
    render.set_defaults(func=render_command)

    prepare_input = subparsers.add_parser(
        "prepare-input",
        help="Render pages into assets/<slug>-input for manual Retrobatch processing",
    )
    prepare_input.add_argument("--slug", required=True)
    prepare_input.add_argument(
        "--strategy",
        choices=["auto", "rasterize", "extract-bitmaps"],
        default=None,
        help="Override manifest render strategy for this run",
    )
    prepare_input.add_argument("--dpi", type=int, default=300)
    prepare_input.set_defaults(func=prepare_input_command)

    codex_sub = subparsers.add_parser(
        "codex",
        help="Use Codex CLI to infer title/url and suggest per-page rotation + crop",
    )
    codex_sub.add_argument("--slug", required=True)
    codex_sub.add_argument("--pages", default=None, help="Comma-separated 0-based page indexes")
    codex_sub.add_argument("--max-pages", type=int, default=8)
    codex_sub.add_argument("--dpi", type=int, default=120)
    codex_sub.add_argument("--apply", action="store_true", help="Apply parsed suggestions to the manifest")
    codex_sub.set_defaults(func=codex_command)

    autocrop = subparsers.add_parser(
        "autocrop",
        help="Suggest and apply crop boxes for pages using non-white trim bounds",
    )
    autocrop.add_argument("--slug", required=True)
    autocrop.add_argument("--dpi", type=int, default=150)
    autocrop.add_argument("--fuzz", type=float, default=2.0)
    autocrop.add_argument("--padding", type=int, default=16)
    autocrop.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace existing crop values instead of only filling null crops",
    )
    autocrop.set_defaults(func=autocrop_command)

    clear_crops = subparsers.add_parser(
        "clear-crops",
        help="Remove all crop boxes from a book manifest",
    )
    clear_crops.add_argument("--slug", required=True)
    clear_crops.set_defaults(func=clear_crops_command)

    generate_ts = subparsers.add_parser("generate-ts", help="Regenerate TypeScript imports for coloring pages")
    generate_ts.set_defaults(func=generate_ts_command)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
