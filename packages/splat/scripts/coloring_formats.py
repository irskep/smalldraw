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
        first = re.search(rb"[\x00-\xf4]", row)
        if first:
            last = len(row) - 1 - re.search(rb"[\x00-\xf4]", row[::-1]).start()
            left, right = min(left, first.start()), max(right, last)
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
    stride = 1 + 2 * pixmap.width
    rows = bytearray(stride * pixmap.height)
    inverse = bytes(range(255, -1, -1))
    for y in range(pixmap.height):
        # Filter byte and luminance stay zero; only the alpha channel carries ink.
        start = y * stride
        rows[start + 2:start + stride:2] = samples[y * pixmap.width:(y + 1) * pixmap.width].translate(inverse)
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


def prepare_page(page, crop=None, rotation=0, erase=None):
    """Apply a reviewed crop (fractions of the source page) and CCW rotation.

    Return a document so its page remains alive while previews and assets render.
    The new page contains the original PDF artwork, without rasterizing vectors.
    """
    if rotation not in (0, 90, 180, 270):
        raise ValueError("Rotation must be 0, 90, 180, or 270 degrees counterclockwise")
    crop = crop or [0, 0, 1, 1]
    left, top, right, bottom = crop
    if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
        raise ValueError("Crop must be a nonempty rectangle within [0, 1]")
    rect = page.rect
    if erase:
        for area in erase:
            x0, y0, x1, y1 = area
            if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
                raise ValueError("Erase rectangle must be within [0, 1]")
            page.draw_rect(pymupdf.Rect(x0 * rect.width, y0 * rect.height,
                                       x1 * rect.width, y1 * rect.height),
                           color=None, fill=(1, 1, 1), overlay=True)
    clip = pymupdf.Rect(rect.x0 + left * rect.width, rect.y0 + top * rect.height,
                        rect.x0 + right * rect.width, rect.y0 + bottom * rect.height)
    width, height = clip.width, clip.height
    if rotation in (90, 270):
        width, height = height, width
    document = pymupdf.open()
    target = document.new_page(width=width, height=height)
    target.show_pdf_page(target.rect, page.parent, page.number, clip=clip, rotate=rotation)
    return document


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
