import json
import unittest
import pymupdf
from coloring_formats import artwork_bounds, frame_svg, prepare_page, render_page

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

    def test_crop_removes_blank_band_and_preserves_edge_artwork(self):
        document = pymupdf.open()
        page = document.new_page(width=200, height=300)
        page.draw_rect(pymupdf.Rect(0, 150, 200, 290), color=(0, 0, 0))
        bounds = artwork_bounds(page)
        self.assertEqual(bounds.x0, 0)
        self.assertEqual(bounds.x1, 200)
        self.assertGreater(bounds.y0, 140)
        self.assertLess(bounds.y0, 150)
        self.assertGreater(bounds.y1, 290)
        data, _, width, height = render_page(page, "fixture")
        self.assertEqual(width, 1600)
        self.assertLess(height, width)
        self.assertIn(b'viewBox="0.000000', data)

    def test_svg_preview_has_black_ink_transparency_and_retina_resolution(self):
        source = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200" viewBox="0 0 100 200"><path d="M10 100H90V180H10Z" fill="none" stroke="black" stroke-width="2"/></svg>'
        svg, width, height, preview = frame_svg(source)
        self.assertIn('d="M10 100H90V180H10Z"', svg)
        self.assertEqual(width, height)
        image = pymupdf.Pixmap(preview)
        self.assertGreaterEqual(max(image.width, image.height), 768)
        self.assertLessEqual(max(image.width, image.height), 770)
        self.assertEqual(image.n, 2)
        self.assertTrue(image.alpha)
        self.assertEqual(set(image.samples[::2]), {0})
        self.assertEqual(min(image.samples[1::2]), 0)
        self.assertEqual(max(image.samples[1::2]), 255)

    def test_reviewed_crop_and_rotation_preserve_vectors(self):
        document = pymupdf.open()
        page = document.new_page(width=200, height=300)
        # A footer must disappear; the upper-left mark must turn into a lower-left mark.
        page.draw_rect(pymupdf.Rect(20, 30, 40, 50), fill=(0, 0, 0))
        page.insert_text((20, 280), "Footer")
        with prepare_page(page, [0, 0, 1, .5], 90) as prepared:
            rotated = prepared[0]
            self.assertEqual(rotated.rect, pymupdf.Rect(0, 0, 150, 200))
            image = rotated.get_pixmap(colorspace=pymupdf.csGRAY)
            self.assertEqual(image.pixel(40, 170), (0,))
            self.assertEqual(image.pixel(140, 170), (255,))
            self.assertEqual(rotated.get_images(), [])
            data, extension, _, _ = render_page(rotated, "reviewed")
            self.assertEqual(extension, "svg")
            self.assertIn(b"reviewed", data)

    def test_label_removal_preserves_adjacent_artwork(self):
        document = pymupdf.open()
        page = document.new_page(width=100, height=100)
        page.draw_rect(pymupdf.Rect(5, 5, 20, 15), fill=(0, 0, 0))
        page.draw_circle(pymupdf.Point(50, 15), 10, fill=(0, 0, 0))
        with prepare_page(page, erase=[[0, 0, .25, .2]]) as prepared:
            image = prepared[0].get_pixmap(colorspace=pymupdf.csGRAY)
            self.assertEqual(image.pixel(10, 10), (255,))
            self.assertEqual(image.pixel(50, 10), (0,))

    def test_invalid_page_review_is_rejected(self):
        document = pymupdf.open()
        page = document.new_page()
        for crop in ([0, 0, 2, 1], [.8, 0, .2, 1], [0, 0, 1, 0]):
            with self.assertRaises(ValueError):
                prepare_page(page, crop)
        with self.assertRaises(ValueError):
            prepare_page(page, rotation=45)

    def test_blank_page_keeps_its_bounds(self):
        document = pymupdf.open()
        page = document.new_page(width=100, height=200)
        self.assertEqual(artwork_bounds(page), page.rect)

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
