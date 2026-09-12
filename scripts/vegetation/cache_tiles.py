#!/usr/bin/env python3
"""Cache a bounded set of unchanged MOE vegetation vector tiles with hashes."""
import argparse,hashlib,json,pathlib,sys,urllib.request
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'terrain'))
from process import pixel,atomic
import math
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--bbox',nargs=4,type=float,required=True);p.add_argument('--zoom',type=int,default=15);p.add_argument('--data-dir',type=pathlib.Path,default=pathlib.Path('data'));p.add_argument('--max-tiles',type=int,default=64);p.add_argument('--refresh',action='store_true');a=p.parse_args()
w,s,e,n=a.bbox
if not(5<=a.zoom<=15 and 122<=w<e<=154 and 20<=s<n<=46.5):p.error('Invalid Japan bounds/zoom')
x0,y0=pixel(w,n,a.zoom);x1,y1=pixel(e,s,a.zoom);xs=range(int(x0//256),math.ceil(x1/256));ys=range(int(y0//256),math.ceil(y1/256))
if len(xs)*len(ys)>a.max_tiles:p.error('Tile count exceeds --max-tiles; use regional batches')
for y in ys:
 for x in xs:
  path=a.data_dir/'cache'/'vegetation'/str(a.zoom)/str(x)/f'{y}.pbf';meta=path.with_suffix('.json');url=f'https://www.biodic.go.jp/kiso/vg/tile/veg2024vector/{a.zoom}/{x}/{y}.pbf'
  if path.exists() and meta.exists() and not a.refresh:
   if hashlib.sha256(path.read_bytes()).hexdigest()==json.loads(meta.read_text())['sha256']:continue
  with urllib.request.urlopen(url,timeout=30) as r:b=r.read(8*1024*1024)
  if not b or b.startswith(b'<'):raise ValueError('Invalid PBF payload')
  atomic(path,b);atomic(meta,json.dumps({'source':url,'sha256':hashlib.sha256(b).hexdigest(),'processing':'unchanged; original categories retained'}).encode());print(path)
