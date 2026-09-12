#!/usr/bin/env python3
"""Compare JS and NumPy calculations on a real haloed tile, including edge pixels."""
import argparse,pathlib,sys,json,subprocess,numpy as np
from process import download,resolution,lonlat
from core import derive_grid
p=argparse.ArgumentParser();p.add_argument('--data-dir',type=pathlib.Path,required=True);a=p.parse_args();z,x,y=14,14505,6467;grid=np.empty((768,768),dtype=np.float32)
for dy in [-1,0,1]:
 for dx in [-1,0,1]:grid[(dy+1)*256:(dy+2)*256,(dx+1)*256:(dx+2)*256]=download(z,x+dx,y+dy,a.data_dir)[0]
grid=grid[192:576,192:576];metres=np.array([resolution(lonlat(x*256,y*256+r+.5,z)[1],z) for r in range(256)]);d=derive_grid(grid,metres)
work=a.data_dir/'parity';work.mkdir(parents=True,exist_ok=True);(work/'grid.bin').write_bytes(grid.tobytes());(work/'res.json').write_text(json.dumps(metres.tolist()))
code="""import {readFileSync,writeFileSync} from 'node:fs';import {deriveGrid} from './dist/gis/terrain.mjs';const b=readFileSync(process.argv[1]);const r=JSON.parse(readFileSync(process.argv[2]));const d=deriveGrid(new Float32Array(b.buffer,b.byteOffset,b.byteLength/4),384,384,64,256,y=>r[y]);for(const [k,v]of Object.entries(d))writeFileSync(process.argv[3]+'/'+k+'.bin',Buffer.from(v.buffer));"""
subprocess.run(['node','--input-type=module','-e',code,str((work/'grid.bin').resolve()),str((work/'res.json').resolve()),str(work.resolve())],cwd=pathlib.Path(__file__).resolve().parents[2],check=True)
results={}
for k,v in d.items():
 js=np.fromfile(work/f'{k}.bin',dtype=np.float32).reshape(v.shape);same_mask=np.array_equal(np.isfinite(v),np.isfinite(js));valid=np.isfinite(v)&np.isfinite(js);diff=float(np.max(np.abs(v[valid]-js[valid]))) if valid.any() else 0
 results[k]={'same_nodata_mask':same_mask,'max_absolute_difference':diff}
 if not same_mask or diff>(0 if k=='terrain' else .0001):raise AssertionError((k,results[k]))
print(json.dumps(results,indent=2));(work/'result.json').write_text(json.dumps(results,indent=2))
