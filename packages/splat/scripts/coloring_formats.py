"""Keep PDF vectors as SVG and raster pages as compact transparent PNGs."""
import struct
import zlib
import xml.etree.ElementTree as ET
import pymupdf

SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")


def png_chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def render_page(page, metadata):
    width, height = page.rect.width, page.rect.height
    scale = 1600 / max(width, height)
    if not page.get_images() and page.get_drawings():
        svg = ET.fromstring(page.get_svg_image(text_as_path=True))
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
    # Grayscale+alpha PNG stores line strength in alpha and black in luminance.
    # This preserves antialiasing and lets the drawing layer show through paper.
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), colorspace=pymupdf.csGRAY, alpha=False)
    samples = pixmap.samples
    rows = bytearray()
    for y in range(pixmap.height):
        rows.append(0)  # PNG filter: none
        for gray in samples[y * pixmap.width:(y + 1) * pixmap.width]:
            rows.extend((0, 255 - gray))
    data = b"\x89PNG\r\n\x1a\n"
    data += png_chunk(b"IHDR", struct.pack(">IIBBBBB", pixmap.width, pixmap.height, 8, 4, 0, 0, 0))
    data += png_chunk(b"tEXt", b"Source\x00" + metadata.encode("ascii"))
    data += png_chunk(b"IDAT", zlib.compress(rows, 9))
    data += png_chunk(b"IEND", b"")
    return data, "png", pixmap.width, pixmap.height
