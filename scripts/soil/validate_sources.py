"""Check seven bounded official soil samples. Cache is ignored, never shipped."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from io import BytesIO
import json
from pathlib import Path
from urllib.request import urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='Redownload instead of using a hash-valid cache')
    args = parser.parse_args()
    samples = json.loads((ROOT / 'tests/fixtures/soil-samples.json').read_text())
    cache = ROOT / 'data/cache/soil-validation'
    cache.mkdir(parents=True, exist_ok=True)

    def check(s):
        path = cache / (s['sha256'] + '.png')
        cached = not args.refresh and path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == s['sha256']
        b = path.read_bytes() if cached else urlopen(s['url'], timeout=30).read()
        image = Image.open(BytesIO(b)).convert('RGBA')
        if image.size != (256, 256):
            raise ValueError('Unexpected tile size: ' + s['url'])
        rgba = list(image.getpixel(tuple(s['pixel'])))
        same_hash = hashlib.sha256(b).hexdigest() == s['sha256']
        if same_hash and not cached:
            pending = path.with_suffix('.tmp')
            pending.write_bytes(b)
            pending.replace(path)
        return {'name': s['name'], 'layer': s['layer'], 'url': s['url'],
                'mode': 'cached' if cached else 'live', 'hash_matches': same_hash,
                'rgba': rgba, 'pixel_matches': rgba == s['rgba']}

    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(check, samples))
    print(json.dumps(results, indent=2, ensure_ascii=False))
    if not all(r['hash_matches'] and r['pixel_matches'] for r in results):
        raise SystemExit('Source snapshot changed; review the official map before updating golden records.')


if __name__ == '__main__':
    main()
