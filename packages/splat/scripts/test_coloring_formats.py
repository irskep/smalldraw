import json
import unittest
import pymupdf
from coloring_formats import render_page

class ColoringFormatsTest(unittest.TestCase):
    def test_vector_stays_svg_with_transparent_white(self):
        document = pymupdf.open()
        page = document.new_page(width=100, height=100)
        page.draw_rect(pymupdf.Rect(10, 10, 90, 90), color=(0, 0, 0), fill=(1, 1, 1))
        data, extension, width, height = render_page(page, json.dumps({"source": "fixture"}))
        self.assertEqual(extension, "svg")
        self.assertEqual((width, height), (1600, 1600))
        self.assertIn(b'fill="#ffffff"', data)
        self.assertIn(b'filter="url(#smalldraw-lineart)"', data)
        self.assertIn(b'feColorMatrix', data)
        self.assertIn(b'fixture', data)

    def test_bitmap_becomes_transparent_compact_png(self):
        source = pymupdf.open()
        art = source.new_page(width=100, height=100)
        art.draw_rect(pymupdf.Rect(10, 10, 90, 90), color=(0, 0, 0), fill=(0, 0, 0))
        document = pymupdf.open()
        page = document.new_page(width=100, height=100)
        page.insert_image(page.rect, stream=art.get_pixmap().tobytes("png"))
        data, extension, width, height = render_page(page, "fixture")
        self.assertEqual(extension, "png")
        image = pymupdf.Pixmap(data)
        self.assertTrue(image.alpha)
        self.assertEqual(image.pixel(0, 0)[-1], 0)
        self.assertEqual(image.pixel(width // 2, height // 2)[-1], 255)
        self.assertLess(len(data), 50000)

if __name__ == "__main__":
    unittest.main()
