"""Metric, north-up terrain derivatives. Positive curvature means convex.
Matches dist/gis/terrain.mjs; scales are square-window half widths in metres.
"""
import numpy as np
from scipy.ndimage import uniform_filter, minimum_filter
VERSION='terrain-1.0.0'
NAMES=['elevation','slope','aspect','curvature','profileCurvature','planCurvature','tpiSmall','tpiLarge','tpiSmallZ','tpiLargeZ','terrain']

def derive_grid(data, resolution, halo=64, size=256, small_m=75, large_m=350):
    a=np.asarray(data,dtype=np.float64)
    if a.shape != (size+2*halo,size+2*halo): raise ValueError('Unexpected halo grid size')
    m=np.broadcast_to(np.asarray(resolution,dtype=np.float64), (size,))[:,None]
    if np.any(m<=0): raise ValueError('Resolution must be positive')
    c=a[halo:halo+size,halo:halo+size]
    def offset(y,x):return a[halo+y:halo+y+size,halo+x:halo+x+size]
    nw,n,ne,w,e,sw,s,se=[offset(y,x) for y,x in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]]
    p=((ne+2*e+se)-(nw+2*w+sw))/(8*m)
    q=((sw+2*s+se)-(nw+2*n+ne))/(8*m)
    g2=p*p+q*q
    slope=np.degrees(np.arctan(np.sqrt(g2)))
    aspect=(np.degrees(np.arctan2(-p,q))+360)%360
    aspect[slope<2]=np.nan
    r=(e-2*c+w)/(m*m);t=(se-sw-ne+nw)/(4*m*m);u=(s-2*c+n)/(m*m)
    curvature=-(r+u)
    with np.errstate(divide='ignore',invalid='ignore'):
        profile=-(p*p*r+2*p*q*t+q*q*u)/(g2*(1+g2)**1.5)
        plan=-(q*q*r-2*p*q*t+p*p*u)/(g2**1.5)
    profile[g2<=1e-12]=np.nan;plan[g2<=1e-12]=np.nan
    valid=np.isfinite(a);filled=np.where(valid,a,0)
    rs=np.maximum(1,np.floor(small_m/m[:,0]+.5).astype(int))
    rl=np.maximum(rs+1,np.floor(large_m/m[:,0]+.5).astype(int))
    if np.any(rl>=halo):raise ValueError('Insufficient DEM halo')
    def tpi(radii):
        raw=np.full_like(c,np.nan);standard=np.full_like(c,np.nan)
        for radius in np.unique(radii):
            window=2*int(radius)+1
            count=uniform_filter(valid.astype(float),window,mode='constant')
            mean=uniform_filter(filled,window,mode='constant')/np.maximum(count,1e-12)
            square=uniform_filter(filled**2,window,mode='constant')/np.maximum(count,1e-12)
            stdev=np.sqrt(np.maximum(0,square-mean**2))
            cut=(slice(halo,halo+size),slice(halo,halo+size))
            val=c-mean[cut]
            z=np.where(stdev[cut]<.01,0,val/np.maximum(stdev[cut],.01))
            val[count[cut]<.95]=np.nan;z[count[cut]<.95]=np.nan
            rows=radii==radius;raw[rows]=val[rows];standard[rows]=z[rows]
        return raw,standard
    ts,zs=tpi(rs);tl,zl=tpi(rl)
    terrain=np.full_like(c,3)
    flat=(slope<2)&(np.abs(zl)<.35)&(np.abs(zs)<.35)
    terrain[flat]=6
    terrain[(zl<-.35)&(zs<0)&(profile<0)]=4
    terrain[(zl>.35)&(zs>0)&(profile>0)]=2
    terrain[(zl<-1)&(zs<-.5)]=5
    terrain[(zl>1)&(zs>.5)]=1
    terrain[~(np.isfinite(slope)&np.isfinite(zs)&np.isfinite(zl)&np.isfinite(curvature))]=0
    out=dict(zip(NAMES,[c,slope,aspect,curvature,profile,plan,ts,tl,zs,zl,terrain]))
    local_valid=minimum_filter(valid.astype(int),3,mode='constant')[halo:halo+size,halo:halo+size].astype(bool)
    for key in NAMES[1:]:
        if key=='terrain':out[key][~local_valid]=0
        else:out[key][~local_valid]=np.nan
    return {key:v.astype(np.float32) for key,v in out.items()}
