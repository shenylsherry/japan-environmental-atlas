"""Download a bounded, unchanged official vegetation tile snapshot."""
import concurrent.futures, pathlib, subprocess, hashlib, json, math, datetime
root=pathlib.Path(__file__).parent/'dist'
base='https://www.biodic.go.jp/kiso/vg/tile/veg2024vector'
def fetch(pair):
    x,y=pair
    path=root/f'tiles/13/{x}/{y}.pbf'
    path.parent.mkdir(parents=True,exist_ok=True)
    url=f'{base}/13/{x}/{y}.pbf'
    subprocess.run(['curl','--fail','--silent','--show-error','--max-time','60',url,'-o',str(path)],check=True)
    b=path.read_bytes()
    if not b or b.startswith(b'<'): raise ValueError('Invalid tile '+url)
    return {'x':x,'y':y,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'source':url}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    results=list(pool.map(fetch,[(x,y) for x in range(7261,7266) for y in range(3224,3229)]))
def lat(y): return math.degrees(math.atan(math.sinh(math.pi*(1-2*y/8192))))
bounds=[7261/8192*360-180,lat(3229),7266/8192*360-180,lat(3224)]
manifest={'source':base,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'bounds':bounds,'zoom':13,'tiles':results}
(root/'data-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps({'tiles':len(results),'bytes':sum(r['bytes'] for r in results),'bounds':bounds}))
