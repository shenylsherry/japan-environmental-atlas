import {aspectSector} from './coordinates.mjs';
export const TERRAIN_VERSION='terrain-1.0.0';
export const TERRAIN_NAMES=['unknown','ridge','upper convex slope','midslope','lower concave slope','valley','flat'];
export const TERRAIN_COLORS=['#000000','#805b36','#c99a4c','#a6b68d','#589d99','#346995','#d2d2cc'];
/** x east, y south. Aspect is DOWNHILL, clockwise from true/grid north. */
export function derivatives(a,dx,dy=dx){
 if(a.length!==9||!a.every(Number.isFinite))return null;
 const [nw,n,ne,w,c,e,sw,s,se]=a;
 const p=((ne+2*e+se)-(nw+2*w+sw))/(8*dx);
 const q=((sw+2*s+se)-(nw+2*n+ne))/(8*dy);
 const g2=p*p+q*q, slope=Math.atan(Math.sqrt(g2))*180/Math.PI;
 const aspect=slope<2?NaN:(Math.atan2(-p,q)*180/Math.PI+360)%360;
 const r=(e-2*c+w)/(dx*dx), t=(se-sw-ne+nw)/(4*dx*dy), u=(s-2*c+n)/(dy*dy);
 const profile=g2>1e-12?-(p*p*r+2*p*q*t+q*q*u)/(g2*(1+g2)**1.5):NaN;
 const plan=g2>1e-12?-(q*q*r-2*p*q*t+p*p*u)/(g2**1.5):NaN;
 return {elevation:c,slope,aspect,aspectSector:aspectSector(aspect),curvature:-(r+u),profileCurvature:profile,planCurvature:plan};
}
export function terrainClass(slope,small,large,curvature){
 if(![slope,small,large,curvature].every(Number.isFinite))return 0;
 if(large>1&&small>.5)return 1;
 if(large< -1&&small< -.5)return 5;
 if(large>.35&&small>0&&curvature>0)return 2;
 if(large< -.35&&small<0&&curvature<0)return 4;
 if(slope<2&&Math.abs(large)<.35&&Math.abs(small)<.35)return 6;
 return 3;
}
function integral(data,w,h){
 const stride=w+1,n=(w+1)*(h+1),sum=new Float64Array(n),sq=new Float64Array(n),count=new Uint32Array(n);
 for(let y=0;y<h;y++){let s=0,ss=0,c=0;for(let x=0;x<w;x++){
  const v=data[y*w+x];if(Number.isFinite(v)){s+=v;ss+=v*v;c++;}
  const i=(y+1)*stride+x+1;sum[i]=sum[i-stride]+s;sq[i]=sq[i-stride]+ss;count[i]=count[i-stride]+c;
 }}return {sum,sq,count,stride};
}
function windowTPI(ii,x,y,r,v){
 const {stride}=ii,x0=x-r,y0=y-r,x1=x+r+1,y1=y+r+1;
 const area=(2*r+1)**2;
 const box=a=>a[y1*stride+x1]-a[y0*stride+x1]-a[y1*stride+x0]+a[y0*stride+x0];
 const count=box(ii.count);if(count<area*.95)return [NaN,NaN];
 const mean=box(ii.sum)/count,std=Math.sqrt(Math.max(0,box(ii.sq)/count-mean*mean));
 return [v-mean,std<.01?0:(v-mean)/std];
}
/** Halo must include largeRadius+1. Return only central tile. */
export function deriveGrid(data,w,h,halo,size,resolution,smallMeters=75,largeMeters=350){
 const ii=integral(data,w,h),names=['elevation','slope','aspect','curvature','profileCurvature','planCurvature','tpiSmall','tpiLarge','tpiSmallZ','tpiLargeZ','terrain'];
 const result=Object.fromEntries(names.map(n=>[n,new Float32Array(size*size).fill(NaN)]));
 for(let y=0;y<size;y++){
  const m=typeof resolution==='function'?resolution(y):resolution;
  const rs=Math.max(1,Math.round(smallMeters/m)),rl=Math.max(rs+1,Math.round(largeMeters/m));
  if(rl>=halo)throw Error('Insufficient DEM halo');
  for(let x=0;x<size;x++){
   const X=x+halo,Y=y+halo,k=y*size+x,i=Y*w+X;
   const a=[data[i-w-1],data[i-w],data[i-w+1],data[i-1],data[i],data[i+1],data[i+w-1],data[i+w],data[i+w+1]];
   result.elevation[k]=data[i];const d=derivatives(a,m);if(!d)continue;
   for(const n of ['slope','aspect','curvature','profileCurvature','planCurvature'])result[n][k]=d[n];
   const [ts,zs]=windowTPI(ii,X,Y,rs,data[i]),[tl,zl]=windowTPI(ii,X,Y,rl,data[i]);
   result.tpiSmall[k]=ts;result.tpiLarge[k]=tl;result.tpiSmallZ[k]=zs;result.tpiLargeZ[k]=zl;
   result.terrain[k]=terrainClass(d.slope,zs,zl,Number.isFinite(d.profileCurvature)?d.profileCurvature:d.curvature);
  }
 }return result;
}
