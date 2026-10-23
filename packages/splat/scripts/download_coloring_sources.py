"""Download queued Commons originals in resumable, rate-limited batches."""
import argparse
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import fcntl
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def retry_delay(value, now):
    """Retry-After accepts seconds or an HTTP date; missing headers get 15 minutes."""
    if value:
        try:
            return max(0, int(value))
        except ValueError:
            try:
                return max(0, parsedate_to_datetime(value).timestamp() - now)
            except (TypeError, ValueError, OverflowError):
                pass
    return 900


def read_state(cache):
    path = cache / 'commons-progress.json'
    return json.loads(path.read_text()) if path.exists() else {'nextRequestAt': 0, 'downloaded': {}}


def save_state(cache, state):
    path = cache / 'commons-progress.json'
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, indent=2) + '\n')
    temporary.replace(path)


def digest(path, algorithm):
    result = hashlib.new(algorithm)
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def source_path(cache, source):
    return cache / 'originals' / (source['sha1'] + Path(source['title']).suffix.lower())


def record_download(cache, source, path, state):
    if digest(path, 'sha1') != source['sha1']:
        raise ValueError(f"Checksum mismatch: {path}; source needs review")
    sha256 = digest(path, 'sha256')
    target = cache / sha256
    if not target.exists():
        temporary = target.with_suffix('.part')
        try:
            shutil.copyfile(path, temporary)
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
    elif digest(target, 'sha256') != sha256:
        raise ValueError(f'Corrupt importer cache: {target}')
    state['downloaded'][source['title']] = {'sha256': sha256, 'file': str(path)}
    save_state(cache, state)


def run(queue, cache, limit=10, interval=60, wait=False, status=False):
    cache = Path(cache).expanduser().resolve()
    if status:
        available = sum(source_path(cache, s).exists() and digest(source_path(cache, s), 'sha1') == s['sha1'] for s in queue)
        state = read_state(cache)
        print(f'{available}/{len(queue)} originals cached; {len(queue) - available} remaining')
        if state['nextRequestAt'] > time.time():
            print('Next request:', datetime.fromtimestamp(state['nextRequestAt'], timezone.utc).isoformat())
        return
    cache.mkdir(parents=True, exist_ok=True)
    (cache / 'originals').mkdir(exist_ok=True)
    with (cache / 'commons-download.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('Another downloader is using this cache') from None
        state = read_state(cache)
        downloaded = 0
        for source in queue:
            path = source_path(cache, source)
            if path.exists():
                record_download(cache, source, path, state)
                continue
            if downloaded >= limit:
                break
            delay = state['nextRequestAt'] - time.time()
            if delay > 0:
                if state.get('cooldown', False) and not wait:
                    print('Cooling down until', datetime.fromtimestamp(state['nextRequestAt'], timezone.utc).isoformat(), flush=True)
                    return
                print(f'Waiting {delay:.0f}s before the next request', flush=True)
                time.sleep(delay)
            state['cooldown'] = False
            state['nextRequestAt'] = time.time() + interval
            save_state(cache, state)
            print('Downloading', source['title'], flush=True)
            temporary = None
            try:
                request = Request(source['downloadUrl'], headers={'User-Agent': 'Smalldraw/1.0 (coloring artwork import)'})
                with urlopen(request, timeout=60) as response, tempfile.NamedTemporaryFile(dir=path.parent, suffix='.part', delete=False) as output:
                    temporary = Path(output.name)
                    shutil.copyfileobj(response, output)
                if digest(temporary, 'sha1') != source['sha1']:
                    raise ValueError(f"Downloaded checksum mismatch: {source['title']}; source needs review")
                temporary.replace(path)
                record_download(cache, source, path, state)
                downloaded += 1
            except HTTPError as error:
                if error.code not in (429, 503):
                    raise
                state['nextRequestAt'] = time.time() + max(interval, retry_delay(error.headers.get('Retry-After'), time.time()))
                state['cooldown'] = True
                save_state(cache, state)
                print(f'HTTP {error.code}; cooldown saved. Rerun after {datetime.fromtimestamp(state["nextRequestAt"], timezone.utc).isoformat()}', flush=True)
                # Even --wait ends this batch on a new limit; no unattended retry loop.
                return
            finally:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
        remaining = sum(not source_path(cache, source).exists() for source in queue)
        print(f'Downloaded {downloaded}; {remaining} remaining. Cached originals still need visual and license review.', flush=True)


def positive(value):
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError('must be positive')
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--queue', type=Path, default=ROOT / 'src/coloring/commonsDownloads.json')
    parser.add_argument('--cache-dir', type=Path, default=Path.home() / '.cache/smalldraw/coloring')
    parser.add_argument('--limit', type=positive, default=10, help='maximum new downloads (default: 10)')
    parser.add_argument('--interval', type=positive, default=60, help='minimum seconds between requests (default: 60)')
    parser.add_argument('--wait', action='store_true', help='wait out a saved cooldown before starting')
    parser.add_argument('--status', action='store_true', help='show cache progress without network access')
    args = parser.parse_args()
    try:
        run(json.loads(args.queue.read_text()), args.cache_dir, args.limit, args.interval, args.wait, args.status)
    except (ValueError, OSError, URLError) as error:
        parser.exit(1, f'{error}\n')
    except KeyboardInterrupt:
        parser.exit(130, 'Interrupted; verified downloads and request timing are saved.\n')


if __name__ == '__main__':
    main()
