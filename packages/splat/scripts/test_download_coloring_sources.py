"""Exercise resume and throttling behavior against a local HTTP server."""
from contextlib import redirect_stdout
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import fcntl

import download_coloring_sources as downloader


class DownloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.cache = Path(self.temp.name)
        self.body = b'<svg>review me</svg>'
        self.status = 200
        self.retry = '120'
        self.requests = 0
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                owner.requests += 1
                self.send_response(owner.status)
                if owner.status != 200:
                    self.send_header('Retry-After', owner.retry)
                self.end_headers()
                self.wfile.write(owner.body)

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.source = {'title': 'File:Example.svg', 'sha1': hashlib.sha1(self.body).hexdigest(),
                       'downloadUrl': f'http://127.0.0.1:{self.server.server_port}/example'}
        self.queue = [self.source]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def run_download(self, **kwargs):
        with redirect_stdout(io.StringIO()):
            downloader.run(self.queue, self.cache, interval=0, **kwargs)

    def test_verified_download_is_reused_and_ready_for_importer(self):
        self.run_download()
        self.run_download()
        self.assertEqual(self.requests, 1)
        state = downloader.read_state(self.cache)
        sha256 = state['downloaded'][self.source['title']]['sha256']
        self.assertEqual((self.cache / sha256).read_bytes(), self.body)
        self.assertEqual(downloader.source_path(self.cache, self.source).read_bytes(), self.body)

    def test_cooldown_survives_another_invocation_without_a_request(self):
        self.status = 429
        self.run_download()
        state = downloader.read_state(self.cache)
        self.assertGreater(state['nextRequestAt'], time.time() + 110)
        with patch.object(downloader.time, 'sleep', side_effect=AssertionError('must stop')):
            self.run_download()
        self.assertEqual(self.requests, 1)
        self.assertFalse(downloader.source_path(self.cache, self.source).exists())

    def test_bad_or_partial_content_is_not_published_and_can_be_retried(self):
        expected = self.body
        self.body = b'truncated'
        with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
            self.run_download()
        self.assertFalse(downloader.source_path(self.cache, self.source).exists())
        self.assertEqual(list(self.cache.rglob('*.part')), [])
        self.body = expected
        self.run_download()
        self.assertEqual(self.requests, 2)

    def test_completed_original_recovers_missing_progress_without_network(self):
        path = downloader.source_path(self.cache, self.source)
        path.parent.mkdir()
        path.write_bytes(self.body)
        self.run_download()
        self.assertEqual(self.requests, 0)
        self.assertIn(self.source['title'], downloader.read_state(self.cache)['downloaded'])

    def test_corrupt_cache_is_not_silently_reused(self):
        self.run_download()
        downloader.source_path(self.cache, self.source).write_bytes(b'bad')
        with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
            self.run_download()
        self.assertEqual(self.requests, 1)

    def test_status_never_downloads(self):
        self.run_download(status=True)
        self.assertEqual(self.requests, 0)

    def test_only_one_process_can_use_the_cache(self):
        with (self.cache / 'commons-download.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaisesRegex(ValueError, 'Another downloader'):
                self.run_download()
        self.assertEqual(self.requests, 0)

    def test_batch_limit_counts_new_downloads_only(self):
        other = dict(self.source, title='File:Other.svg', sha1=hashlib.sha1(b'other').hexdigest())
        self.queue.append(other)
        self.run_download(limit=1)
        self.assertEqual(self.requests, 1)
        self.assertFalse(downloader.source_path(self.cache, other).exists())

    def test_request_spacing_survives_a_restart(self):
        downloader.save_state(self.cache, {'nextRequestAt': 160, 'cooldown': False, 'downloaded': {}})
        with patch.object(downloader.time, 'time', return_value=100), patch.object(downloader.time, 'sleep') as sleep:
            self.run_download()
        sleep.assert_called_once_with(60)
        self.assertEqual(self.requests, 1)

    def test_interrupt_does_not_publish_partial_content(self):
        def interrupted(source, output):
            output.write(b'partial')
            raise KeyboardInterrupt
        with patch.object(downloader.shutil, 'copyfileobj', side_effect=interrupted):
            with self.assertRaises(KeyboardInterrupt):
                self.run_download()
        self.assertFalse(downloader.source_path(self.cache, self.source).exists())
        self.assertEqual(list(self.cache.rglob('*.part')), [])
        self.assertEqual(downloader.read_state(self.cache)['downloaded'], {})

    def test_retry_after_formats(self):
        self.assertEqual(downloader.retry_delay('120', 0), 120)
        self.assertEqual(downloader.retry_delay('Thu, 01 Jan 1970 00:02:00 GMT', 30), 90)
        self.assertEqual(downloader.retry_delay(None, 0), 900)
        self.assertEqual(downloader.retry_delay('invalid', 0), 900)


if __name__ == '__main__':
    unittest.main()
