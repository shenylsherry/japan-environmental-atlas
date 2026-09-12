import {decodeElevation,groundResolution,pixelToLonLat,lonLatToPixel} from './coordinates.mjs';
import {deriveGrid,TERRAIN_COLORS,TERRAIN_NAMES,TERRAIN_VERSION} from './terrain.mjs';
import {inspectVegetation} from './vector.mjs';
const raw=new Map(),derived=new Map(),pending=new Map(),queue=[],cancelled=new Set();
let busy=false,activeFetch=0;const fetchQueue=[];
function trim(m,n){while(m.size>n)m.delete(m.keys().next().value);}
async function limitedFetch(url){if(activeFetch>=4)await new Promise(resolve=>fetchQueue.push(resolve));activeFetch++;
 try{return await fetch(url,{signal:AbortSignal.timeout(25000)});}finally{activeFetch--;fetchQueue.shift()?.();}}
async function dem(z,x,y){const key=`${z}/${x}/${y}`;if(raw.has(key))return raw.get(key);if(pending.has(key))return pending.get(key);
 const task=(async()=>{
  const r=await limitedFetch(`/api/tiles/dem/${key}.png`);
  if(r.status===404)return new Float32Array(65536).fill(NaN);
  if(!r.ok)throw Error(`DEM 请求失败 (${r.status})`);
  const bitmap=await createImageBitmap(await r.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
  const canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();
  const bytes=ctx.getImageData(0,0,256,256).data,a=new Float32Array(65536);
  for(let i=0;i<a.length;i++)a[i]=decodeElevation(bytes[4*i],bytes[4*i+1],bytes[4*i+2],bytes[4*i+3]);
  raw.set(key,a);trim(raw,24);return a;
 })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
async function terrain(z,x,y){const key=`${z}/${x}/${y}`;if(derived.has(key))return derived.get(key);
 const halo=64,w=256+2*halo,grid=new Float32Array(w*w).fill(NaN);
 const neighbors=await Promise.all([-1,0,1].flatMap(dy=>[-1,0,1].map(async dx=>({dx,dy,data:await dem(z,x+dx,y+dy)}))));
 for(const {dx,dy,data}of neighbors){
  const x0=Math.max(0,dx*256+halo),x1=Math.min(w,(dx+1)*256+halo),y0=Math.max(0,dy*256+halo),y1=Math.min(w,(dy+1)*256+halo);
  for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++)grid[yy*w+xx]=data[(yy-dy*256-halo)*256+xx-dx*256-halo];
 }
 const out=deriveGrid(grid,w,w,halo,256,row=>groundResolution(pixelToLonLat(x*256,(y*256)+row+.5,z)[1],z));
 derived.set(key,out);trim(derived,3);return out;
}
const rgb=hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
const aspectColors=['#337abb','#45baba','#68a958','#c6b442','#db8551','#c55770','#906cb4','#636bb3'].map(rgb),terrainColors=TERRAIN_COLORS.map(rgb);
function color(kind,v){
 if(!Number.isFinite(v)||kind==='terrain'&&v===0)return [0,0,0,0];
 if(kind==='aspect')return [...aspectColors[Math.floor((v+22.5)/45)%8],255];
 if(kind==='terrain')return [...terrainColors[Math.round(v)],255];
 const stops=kind==='slope'?[[0,'#eef1dc'],[10,'#b5c99b'],[25,'#e6b85c'],[40,'#cd764c'],[60,'#863b49']]:kind==='curvature'?[[-.02,'#37688c'],[0,'#f0f2ed'],[.02,'#be743c']]:[[0,'#528d75'],[600,'#a4b579'],[1400,'#c9b688'],[2400,'#a28d7c'],[3776,'#f8f7ef']];
 let a=stops[0],b=stops.at(-1);for(let i=1;i<stops.length;i++){if(v<=stops[i][0]){a=stops[i-1];b=stops[i];break;}}
 const t=Math.max(0,Math.min(1,(v-a[0])/(b[0]-a[0]))),ca=rgb(a[1]),cb=rgb(b[1]);return [...ca.map((c,i)=>Math.round(c+(cb[i]-c)*t)),255];
}
async function execute(m){
 if(m.type==='vegetation'){
  const [px,py]=lonLatToPixel(m.lon,m.lat,15),x=Math.floor(px/256),y=Math.floor(py/256);
  const r=await limitedFetch(`/api/tiles/vegetation/15/${x}/${y}.pbf`);if(r.status===404)return {properties:[],sourceZoom:15};if(!r.ok)throw Error(`植生请求失败 (${r.status})`);
  return {properties:inspectVegetation(await r.arrayBuffer(),px-x*256,py-y*256),sourceZoom:15};
 }
 if(m.type==='point'){
  const [px,py]=lonLatToPixel(m.lon,m.lat,14),x=Math.floor(px/256),y=Math.floor(py/256),d=await terrain(14,x,y),i=Math.floor(py-y*256)*256+Math.floor(px-x*256);
  const values=Object.fromEntries(Object.entries(d).map(([key,v])=>[key,Number.isFinite(v[i])?v[i]:null]));
  return {...values,terrainName:TERRAIN_NAMES[values.terrain||0],resolution:groundResolution(m.lat,14),zoom:14,algorithm:TERRAIN_VERSION};
 }
 const d=await terrain(m.z,m.x,m.y),a=d[m.kind];if(!a)throw Error('Unknown terrain layer');
 const canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,256);
 for(let i=0;i<a.length;i++)pixels.data.set(color(m.kind,a[i]),i*4);ctx.putImageData(pixels,0,0);
 return await (await canvas.convertToBlob({type:'image/png'})).arrayBuffer();
}
async function drain(){if(busy)return;busy=true;while(queue.length){const m=queue.shift();if(cancelled.delete(m.id))continue;
 try{const result=await execute(m);if(!cancelled.delete(m.id))self.postMessage({id:m.id,result},result instanceof ArrayBuffer?[result]:[]);}
 catch(e){if(!cancelled.delete(m.id))self.postMessage({id:m.id,error:e.message});}
 }busy=false;}
self.onmessage=e=>{const m=e.data;if(m.type==='cancel'){cancelled.add(m.id);return;}if(m.type==='tile')queue.push(m);else queue.unshift(m);drain();};
