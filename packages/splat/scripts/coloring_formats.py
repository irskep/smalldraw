"""Keep PDF vectors as SVG and raster pages as compact transparent PNGs."""
import re
import struct
import zlib
import xml.etree.ElementTree as ET
import pymupdf

SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")


def png_chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def artwork_bounds(page):
    """Measure visible ink after compositing, retaining a 3% breathing margin."""
    scale = 1200 / max(page.rect.width, page.rect.height)
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), colorspace=pymupdf.csGRAY, alpha=False)
    samples = pixmap.samples
    left, top, right, bottom = pixmap.width, pixmap.height, -1, -1
    for y in range(pixmap.height):
        row = samples[y * pixmap.width:(y + 1) * pixmap.width]
        ink = [x for x, gray in enumerate(row) if gray < 245]
        if ink:
            left, right = min(left, ink[0]), max(right, ink[-1])
            top, bottom = min(top, y), y
    if right < left:
        return page.rect
    margin = max(right - left + 1, bottom - top + 1) * .03
    return pymupdf.Rect((left - margin) / scale, (top - margin) / scale,
                        (right + 1 + margin) / scale, (bottom + 1 + margin) / scale) & page.rect


def render_png(page, bounds, longest_edge, metadata):
    scale = longest_edge / max(bounds.width, bounds.height)
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=bounds,
                            colorspace=pymupdf.csGRAY, alpha=False)
    samples = pixmap.samples
    rows = bytearray()
    for y in range(pixmap.height):
        rows.append(0)
        for gray in samples[y * pixmap.width:(y + 1) * pixmap.width]:
            rows.extend((0, 255 - gray))
    data = b"\x89PNG\r\n\x1a\n"
    data += png_chunk(b"IHDR", struct.pack(">IIBBBBB", pixmap.width, pixmap.height, 8, 4, 0, 0, 0))
    data += png_chunk(b"tEXt", b"Source\x00" + metadata.encode("ascii"))
    data += png_chunk(b"IDAT", zlib.compress(rows, 9))
    data += png_chunk(b"IEND", b"")
    return data, pixmap.width, pixmap.height


def frame_svg(text):
    """Keep original SVG paths; trim its viewport and render a sharp preview."""
    root = ET.fromstring(text)
    x, y, width, height = map(float, root.attrib["viewBox"].split())
    with pymupdf.open(stream=text.encode(), filetype="svg") as document:
        page = document[0]
        bounds = artwork_bounds(page)
        preview, _, _ = render_png(page, bounds, 768, "Preview of source SVG; margins trimmed; black ink on transparent background.")
        viewbox = [x + bounds.x0 / page.rect.width * width, y + bounds.y0 / page.rect.height * height,
                   bounds.width / page.rect.width * width, bounds.height / page.rect.height * height]
    scale = 1600 / max(viewbox[2:])
    pixel_width, pixel_height = round(viewbox[2] * scale), round(viewbox[3] * scale)
    start, end = text.index("<svg"), text.index(">", text.index("<svg"))
    header = text[start:end]
    for name, value in {"viewBox": " ".join(f"{v:.6f}" for v in viewbox), "width": str(pixel_width), "height": str(pixel_height)}.items():
        header = re.sub(rf'(?<![\w:-]){name}="[^"]*"', f'{name}="{value}"', header)
    return text[:start] + header + text[end:], pixel_width, pixel_height, preview


def render_page(page, metadata):
    bounds = artwork_bounds(page)
    width, height = bounds.width, bounds.height
    scale = 1600 / max(width, height)
    if not page.get_images() and page.get_drawings():
        svg = ET.fromstring(page.get_svg_image(text_as_path=True))
        svg.set("viewBox", " ".join(f"{v:.6f}" for v in (bounds.x0, bounds.y0, bounds.width, bounds.height)))
        svg.set("width", str(round(width * scale)))
        svg.set("height", str(round(height * scale)))
        # Composite the original white occlusion shapes before removing paper.
        # Deleting white fills exposes strokes hidden behind foreground shapes.
        definitions = ET.SubElement(svg, f"{{{SVG}}}defs")
        filter_node = ET.SubElement(definitions, f"{{{SVG}}}filter", {
            "id": "smalldraw-lineart", "color-interpolation-filters": "sRGB",
            "x": "0", "y": "0", "width": "100%", "height": "100%",
        })
        ET.SubElement(filter_node, f"{{{SVG}}}feColorMatrix", {
            "type": "matrix",
            "values": "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.2126 -0.7152 -0.0722 1 0",
        })
        artwork = ET.Element(f"{{{SVG}}}g", {"filter": "url(#smalldraw-lineart)"})
        for child in list(svg):
            if child.tag.rsplit("}", 1)[-1] not in {"defs", "metadata"}:
                svg.remove(child)
                artwork.append(child)
        svg.append(artwork)
        ET.SubElement(svg, f"{{{SVG}}}metadata").text = metadata
        data = (ET.tostring(svg, encoding="unicode") + "\n").encode()
        return data, "svg", round(width * scale), round(height * scale)
    data, width, height = render_png(page, bounds, 1600, metadata)
    return data, "png", width, height
