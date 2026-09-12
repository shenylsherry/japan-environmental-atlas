/** Minimal MVT polygon decoder; preserves all attribute values. No global GeoJSON. */
const td=new TextDecoder();
function vint(b,pos){let v=0,m=1,i=pos;while(i<b.length){const c=b[i++];v+=(c&127)*m;if(c<128)return [v,i];m*=128;if(m>2**56)throw Error('Invalid varint');}throw Error('Truncated PBF');}
function fields(b){let i=0,out=[];while(i<b.length){let tag;[tag,i]=vint(b,i);const w=tag%8;let value;
 if(w===0)[value,i]=vint(b,i);
 else if(w===2){let n;[n,i]=vint(b,i);if(i+n>b.length)throw Error('Truncated field');value=b.subarray(i,i+n);i+=n;}
 else if(w===1||w===5){const n=w===1?8:4;if(i+n>b.length)throw Error('Truncated number');value=b.subarray(i,i+n);i+=n;}
 else throw Error('Unsupported PBF wire type');out.push([Math.floor(tag/8),value]);}return out;}
function packed(b){const a=[];let i=0;while(i<b.length){let v;[v,i]=vint(b,i);a.push(v);}return a;}
const zig=v=>v%2?-(v+1)/2:v/2;
function value(b){const [type,v]=fields(b)[0]||[];if(type===1)return td.decode(v);if(type===2)return new DataView(v.buffer,v.byteOffset,v.byteLength).getFloat32(0,true);if(type===3)return new DataView(v.buffer,v.byteOffset,v.byteLength).getFloat64(0,true);if(type===6)return zig(v);if(type===7)return !!v;return v;}
function rings(b){const values=packed(b),out=[];let i=0,x=0,y=0,ring;
 while(i<values.length){const command=values[i++],id=command%8,count=Math.floor(command/8);
  if(id===1||id===2){for(let k=0;k<count;k++){x+=zig(values[i++]);y+=zig(values[i++]);if(id===1){ring=[];out.push(ring);}if(!ring)throw Error('Invalid geometry');ring.push([x,y]);}}
  else if(id===7){if(ring?.length)ring.push(ring[0]);}else throw Error('Invalid geometry command');
 }return out;
}
export function decodeTile(buffer){const b=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer),out=[];
 for(const [k,v]of fields(b)){if(k!==3)continue;const layer=fields(v),keys=layer.filter(([k])=>k===3).map(([,v])=>td.decode(v)),values=layer.filter(([k])=>k===4).map(([,v])=>value(v));
 const name=td.decode(layer.find(([k])=>k===1)?.[1]||new Uint8Array()),extent=layer.find(([k])=>k===5)?.[1]||4096;
 for(const [k,v]of layer){if(k!==2)continue;const f=new Map(fields(v));if(f.get(3)!==3)continue;const tags=packed(f.get(2)||new Uint8Array()),properties={};
 for(let i=0;i<tags.length;i+=2)properties[keys[tags[i]]]=values[tags[i+1]];
 out.push({layer:name,extent,properties,rings:rings(f.get(4))});}
 }return out;
}
export function pointInRings(x,y,rings){let inside=false;for(const ring of rings){for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const [xi,yi]=ring[i],[xj,yj]=ring[j];
 // Boundary belongs to the polygon. No screen-pixel search tolerance.
 const cross=(x-xi)*(yj-yi)-(y-yi)*(xj-xi);
 if(Math.abs(cross)<1e-8&&x>=Math.min(xi,xj)&&x<=Math.max(xi,xj)&&y>=Math.min(yi,yj)&&y<=Math.max(yi,yj))return true;
 if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
 }}return inside;}
export function inspectVegetation(buffer,pixelX,pixelY){return decodeTile(buffer).filter(f=>f.layer==='veg2024'&&pointInRings(pixelX/256*f.extent,pixelY/256*f.extent,f.rings)).map(f=>f.properties);}
