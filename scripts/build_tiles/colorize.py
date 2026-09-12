#!/usr/bin/env python3
"""Render one Phase-1 terrain COG into per-variable XYZ PNGs at its native zoom."""
import argparse,pathlib,json,numpy as np,rasterio
from PIL import Image
p=argparse.ArgumentParser(description=__doc__);p.add_argument('cog',type=pathlib.Path);p.add_argument('--output',type=pathlib.Path,default=pathlib.Path('data/tiles'));a=p.parse_args();meta=json.loads(a.cog.with_suffix('.json').read_text());z,x,y=meta['tile']
aspect=['337abb','45baba','68a958','c6b442','db8551','c55770','906cb4','636bb3'];terrain=['000000','805b36','c99a4c','a6b68d','589d99','346995','d2d2cc']
def rgb(hex):return [int(hex[i:i+2],16) for i in [0,2,4]]
with rasterio.open(a.cog) as d:
 for key in ['elevation','slope','aspect','curvature','terrain']:
  v=d.read(d.descriptions.index(key)+1);valid=np.isfinite(v);rgba=np.zeros((*v.shape,4),dtype='uint8')
  if key in ['aspect','terrain']:
   palette=np.array([rgb(c) for c in (aspect if key=='aspect' else terrain)],dtype='uint8');idx=np.where(valid,v,0)
   idx=((idx+22.5)//45%8).astype(int) if key=='aspect' else idx.astype(int)
   rgba[:,:,:3]=palette[idx]
   if key=='terrain':valid&=v!=0
  else:
   stops={'elevation':[(0,'528d75'),(600,'a4b579'),(1400,'c9b688'),(2400,'a28d7c'),(3776,'f8f7ef')],'slope':[(0,'eef1dc'),(10,'b5c99b'),(25,'e6b85c'),(40,'cd764c'),(60,'863b49')],'curvature':[(-.02,'37688c'),(0,'f0f2ed'),(.02,'be743c')]}[key]
   colors=[rgb(c) for _,c in stops]
   for k in range(3):rgba[:,:,k]=np.rint(np.interp(np.where(valid,v,0),[t for t,_ in stops],[c[k] for c in colors])).astype('uint8')
  rgba[:,:,3]=valid.astype('uint8')*255;path=a.output/key/str(z)/str(x)/f'{y}.png';path.parent.mkdir(parents=True,exist_ok=True);Image.fromarray(rgba).save(path);print(path)
