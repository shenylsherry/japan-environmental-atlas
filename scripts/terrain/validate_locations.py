#!/usr/bin/env python3
"""Bounded official-data integration run; records source values and provenance."""
import argparse,concurrent.futures,json,pathlib,subprocess,sys,urllib.request,numpy as np
from process import pixel,download,tile
import rasterio
POINTS=[('fuji_n',35.393,138.728),('fuji_s',35.329,138.728),('takao',35.625,139.243),('daisen',35.378,133.544),('asahidake',43.67,142.851),('kirishima',31.927,130.86),('yakushima',30.336,130.505)]
def main():
 p=argparse.ArgumentParser();p.add_argument('--data-dir',type=pathlib.Path,default=pathlib.Path('data'));p.add_argument('--output',type=pathlib.Path,default=pathlib.Path('docs/validation-results.json'));p.add_argument('--limit',type=int,default=7);a=p.parse_args();results=[];repo=pathlib.Path(__file__).resolve().parents[2]
 for name,lat,lon in POINTS[:a.limit]:
  result={'name':name,'lat':lat,'lon':lon}
  try:
   px,py=pixel(lon,lat,14);x,y=int(px//256),int(py//256);path=tile(14,x,y,a.data_dir)
   with rasterio.open(path) as ds:
    i,j=int(py)%256,int(px)%256;values=ds.read()[:,i,j];result['terrain']={k:float(v) if np.isfinite(v) else None for k,v in zip(ds.descriptions,values)};result['algorithm']=ds.tags()['algorithm']
   dem,source=download(14,x,y,a.data_dir);result['gsi_dem_value']=float(dem[i,j]);result['gsi_source']=source
   result['elevation_agreement']=abs(result['terrain']['elevation']-result['gsi_dem_value'])<.02
   # Independent 100 m north/south/east/west height contrast (same official DEM).
   degree_lat=100/111320;degree_lon=degree_lat/np.cos(np.radians(lat));contrasts={}
   for direction,ll in [('north',(lon,lat+degree_lat)),('south',(lon,lat-degree_lat)),('east',(lon+degree_lon,lat)),('west',(lon-degree_lon,lat))]:
    qx,qy=pixel(*ll,14);data,_=download(14,int(qx//256),int(qy//256),a.data_dir);v=data[int(qy)%256,int(qx)%256];contrasts[direction]=float(v) if np.isfinite(v) else None
   result['height_100m']=contrasts
   result['geology_source']=f'https://gbank.gsj.jp/seamless/v2/api/1.3.1/legend.json?point={lat},{lon}'
   with urllib.request.urlopen(result['geology_source'],timeout=30) as r:result['geology']=json.load(r)
   vx,vy=pixel(lon,lat,15);tx,ty=int(vx//256),int(vy//256)
   url=f'https://www.biodic.go.jp/kiso/vg/tile/veg2024vector/15/{tx}/{ty}.pbf';vpath=a.data_dir/'cache'/'vegetation'/'15'/str(tx)/f'{ty}.pbf';vpath.parent.mkdir(parents=True,exist_ok=True)
   if not vpath.exists():
    with urllib.request.urlopen(url,timeout=30) as r:vpath.write_bytes(r.read())
   code="import {readFileSync} from 'node:fs';import {inspectVegetation} from './dist/gis/vector.mjs';console.log(JSON.stringify(inspectVegetation(readFileSync(process.argv[1]),Number(process.argv[2]),Number(process.argv[3]))));"
   result['vegetation']=json.loads(subprocess.check_output(['node','--input-type=module','-e',code,str(vpath.resolve()),str(vx%256),str(vy%256)],cwd=repo));result['vegetation_source']=url
  except Exception as e:result['error']=str(e)
  results.append(result);a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(results,ensure_ascii=False,indent=2));print(name,result.get('terrain'),result.get('error'),flush=True)
if __name__=='__main__':main()
