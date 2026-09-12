#!/usr/bin/env python3
"""Incremental official GSI DEM tiles -> eleven-band terrain COGs.
Example: python scripts/terrain/process.py --bbox 139.24 35.62 139.25 35.63
"""
import argparse, concurrent.futures, datetime, hashlib, io, json, logging, math, os, pathlib, sys, urllib.request, urllib.error
import numpy as np
from PIL import Image
import rasterio
from rasterio.transform import from_origin
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from core import derive_grid, VERSION, NAMES
R=6378137;BASE='https://cyberjapandata.gsi.go.jp/xyz/dem_png'

def pixel(lon,lat,z):return ((lon+180)/360*256*2**z,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*256*2**z)
def lonlat(x,y,z):return (x/(256*2**z)*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*y/(256*2**z))))))
def resolution(lat,z):return 2*math.pi*R*math.cos(math.radians(lat))/(256*2**z)
def sha(b):return hashlib.sha256(b).hexdigest()
def atomic(path,b):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_bytes(b);os.replace(tmp,path)

def decode(b):
    image=Image.open(io.BytesIO(b)).convert('RGBA')
    if image.size!=(256,256):raise ValueError('Unexpected DEM dimensions')
    a=np.asarray(image).astype(np.int32);v=a[:,:,0]*65536+a[:,:,1]*256+a[:,:,2]
    out=np.where(v>8388608,v-16777216,v).astype(np.float64)*.01
    out[(v==8388608)|(a[:,:,3]==0)]=np.nan
    return out.astype(np.float32)

def download(z,x,y,root,refresh=False):
    path=root/'cache'/'dem'/str(z)/str(x)/f'{y}.png';meta=path.with_suffix('.json');missing=path.with_suffix('.missing')
    url=f'{BASE}/{z}/{x}/{y}.png'
    if not refresh and missing.exists():return np.full((256,256),np.nan,dtype=np.float32),{'source':url,'status':'nodata'}
    if not refresh and path.exists() and meta.exists():
        b=path.read_bytes();j=json.loads(meta.read_text())
        if sha(b)==j['sha256']:return decode(b),j
    for attempt in range(2):
        try:
            with urllib.request.urlopen(url,timeout=30) as r:
                b=r.read(2*1024*1024);a=decode(b)
            j={'source':url,'sha256':sha(b),'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
            atomic(path,b);atomic(meta,json.dumps(j).encode());missing.unlink(missing_ok=True)
            return a,j
        except urllib.error.HTTPError as e:
            if e.code==404:
                atomic(missing,b'404');return np.full((256,256),np.nan,dtype=np.float32),{'source':url,'status':'nodata'}
            if attempt:raise
        except Exception:
            if attempt:raise

def tile(z,x,y,root,force=False,refresh=False):
    out=root/'processed'/VERSION/str(z)/str(x)/f'{y}.tif';manifest=out.with_suffix('.json')
    if out.exists() and manifest.exists() and not force and not refresh:
        j=json.loads(manifest.read_text())
        if j.get('algorithm')==VERSION and j.get('sha256')==sha(out.read_bytes()):
            logging.info('cached %s/%s/%s',z,x,y);return out
    neighbors=[(dx,dy) for dy in [-1,0,1] for dx in [-1,0,1]]
    def get(pair):
        dx,dy=pair;a,j=download(z,x+dx,y+dy,root,refresh);return dx,dy,a,j
    grid=np.full((768,768),np.nan,dtype=np.float32);sources=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for dx,dy,a,j in pool.map(get,neighbors):
            grid[(dy+1)*256:(dy+2)*256,(dx+1)*256:(dx+2)*256]=a;sources.append(j)
    halo=64;grid=grid[256-halo:512+halo,256-halo:512+halo]
    metres=np.array([resolution(lonlat(x*256,y*256+r+.5,z)[1],z) for r in range(256)])
    products=derive_grid(grid,metres)
    px=2*math.pi*R/(256*2**z);origin_x=-math.pi*R+x*256*px;origin_y=math.pi*R-y*256*px
    out.parent.mkdir(parents=True,exist_ok=True);tmp=out.with_suffix('.tmp.tif')
    # Nearest overviews avoid averaging azimuth across north or mixing class codes.
    with rasterio.open(tmp,'w',driver='COG',height=256,width=256,count=len(NAMES),dtype='float32',crs='EPSG:3857',transform=from_origin(origin_x,origin_y,px,px),nodata=np.nan,compress='DEFLATE',blocksize=256,overview_resampling='nearest') as dst:
        for i,key in enumerate(NAMES,1):dst.write(products[key],i);dst.set_band_description(i,key)
        dst.update_tags(algorithm=VERSION,source='GSI DEM10B',tpi_half_width_m='75,350',curvature_positive='convex',aspect='downhill clockwise from north; slope<2 undefined')
    os.replace(tmp,out)
    j={'algorithm':VERSION,'tile':[z,x,y],'crs':'EPSG:3857','bands':NAMES,'ground_pixel_m_range':[float(metres.min()),float(metres.max())],'scales_m':[75,350],'halo_px':64,'sha256':sha(out.read_bytes()),'sources':sources}
    atomic(manifest,json.dumps(j,indent=2).encode());logging.info('processed %s/%s/%s',z,x,y);return out

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--bbox',nargs=4,type=float,metavar=('WEST','SOUTH','EAST','NORTH'));p.add_argument('--tile',nargs=2,type=int,metavar=('X','Y'));p.add_argument('--zoom',type=int,default=14);p.add_argument('--data-dir',type=pathlib.Path,default=pathlib.Path(os.getenv('KINOKO_DATA_DIR','data')));p.add_argument('--force',action='store_true');p.add_argument('--refresh',action='store_true');p.add_argument('--max-tiles',type=int,default=256);p.add_argument('--dry-run',action='store_true');a=p.parse_args()
    if not 11<=a.zoom<=14:p.error('Terrain processing zoom must be 11–14')
    if bool(a.bbox)==bool(a.tile):p.error('Supply exactly one of --bbox or --tile')
    if a.bbox:
        w,s,e,n=a.bbox
        if not 122<=w<e<=154 or not 20<=s<n<=46.5:p.error('Invalid Japan bounding box')
        x0,y0=pixel(w,n,a.zoom);x1,y1=pixel(e,s,a.zoom)
        xs=range(int(x0//256),math.ceil(x1/256));ys=range(int(y0//256),math.ceil(y1/256));count=len(xs)*len(ys)
        if count>a.max_tiles and not a.dry_run:p.error(f'{count} tiles exceeds --max-tiles {a.max_tiles}; partition the region or explicitly increase')
        if a.dry_run:print(json.dumps({'tiles':count,'zoom':a.zoom}));return
        tiles=((x,y) for y in ys for x in xs)
    else:
        x,y=a.tile
        if not(1<=x<2**a.zoom-1 and 1<=y<2**a.zoom-1):p.error('Invalid tile coordinates')
        tiles=[(x,y)]
    a.data_dir.mkdir(parents=True,exist_ok=True)
    logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s',handlers=[logging.StreamHandler(),logging.FileHandler(a.data_dir/'terrain.log')])
    failed=0
    for x,y in tiles:
        try:tile(a.zoom,x,y,a.data_dir,a.force,a.refresh)
        except Exception:failed+=1;logging.exception('failed %s/%s/%s; resume will retry',a.zoom,x,y)
    if failed:raise SystemExit(1)
if __name__=='__main__':main()
