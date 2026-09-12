#!/usr/bin/env python3
"""Copy bounded, source-hashed official validation data for offline browser QA only.
The Vite development adapter serves this explicitly tagged fixture set. Production
Worker has no fixture path and never packages data/cache.
"""
import argparse,pathlib,json,hashlib,shutil,sys,urllib.request
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent/'terrain'))
from process import pixel
p=argparse.ArgumentParser();p.add_argument('--data-dir',type=pathlib.Path,required=True);a=p.parse_args();repo=pathlib.Path(__file__).resolve().parents[1];out=repo/'data/cache/browser-fixtures';out.mkdir(parents=True,exist_ok=True);manifest={}
def add(route,b,source):
 name=hashlib.sha256(b).hexdigest();(out/name).write_bytes(b);manifest[route]={'file':name,'sha256':name,'source':source}
for lat in [35.393,35.329]:
 lon=138.728;px,py=pixel(lon,lat,14);x,y=int(px//256),int(py//256)
 for dy in [-1,0,1]:
  for dx in [-1,0,1]:
   path=a.data_dir/'cache/dem/14'/str(x+dx)/f'{y+dy}.png'
   add(f'/api/tiles/dem/14/{x+dx}/{y+dy}.png',path.read_bytes(),json.loads(path.with_suffix('.json').read_text())['source'])
 vx,vy=pixel(lon,lat,15);x,y=int(vx//256),int(vy//256);path=a.data_dir/'cache/vegetation/15'/str(x)/f'{y}.pbf';source=f'https://www.biodic.go.jp/kiso/vg/tile/veg2024vector/15/{x}/{y}.pbf'
 add(f'/api/tiles/vegetation/15/{x}/{y}.pbf',path.read_bytes(),source)
 source=f'https://gbank.gsj.jp/seamless/v2/api/1.3.1/legend.json?point={lat},{lon}'
 with urllib.request.urlopen(source,timeout=30) as r:add(f'/api/geology?lat={lat}&lon={lon}',r.read(),source)
(out/'manifest.json').write_text(json.dumps(manifest,indent=2));print(f'{len(manifest)} official fixture responses prepared (development only)')
