/** Verified endpoints: docs/data-sources.md. No arbitrary URL proxying. */
export const OFFICIAL = Object.freeze({
 vegetation: 'https://www.biodic.go.jp/kiso/vg/tile/veg2024vector',
 gsi: 'https://cyberjapandata.gsi.go.jp/xyz',
 geology: 'https://gbank.gsj.jp/seamless/v2/api/1.3.1',
});
export function sourceRequest(input) {
 const u = new URL(input), p = u.pathname;
 if(p === '/api/geology') {
  if(!u.searchParams.has('lat') || !u.searchParams.has('lon')) throw Error('Coordinates required');
  const lat=Number(u.searchParams.get('lat')), lon=Number(u.searchParams.get('lon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<20||lat>46.5||lon<122||lon>154) throw Error('Outside Japan query bounds');
  return {url:`${OFFICIAL.geology}/legend.json?point=${lat},${lon}`,type:'application/json',ttl:86400};
 }
 const m=p.match(/^\/api\/tiles\/(vegetation|dem|geology|pale|std|seamlessphoto)\/(\d+)\/(\d+)\/(\d+)\.(pbf|png|jpg)$/);
 if(!m) throw Error('Unknown source route');
 const [,kind,zs,xs,ys,ext]=m, z=Number(zs), x=Number(xs), y=Number(ys);
 const max=kind==='vegetation'?15:kind==='dem'?14:kind==='geology'?13:18;
 const min=kind==='vegetation'?5:kind==='dem'?1:kind==='geology'?0:2;
 if(z<min||z>max||x>=2**z||y>=2**z) throw Error('Invalid tile coordinates');
 if(ext !== (kind==='vegetation'?'pbf':kind==='seamlessphoto'?'jpg':'png')) throw Error('Invalid tile format');
 const url=kind==='vegetation'?`${OFFICIAL.vegetation}/${z}/${x}/${y}.pbf`:kind==='geology'?`${OFFICIAL.geology}/tiles/${z}/${y}/${x}.png?layer=g`: `${OFFICIAL.gsi}/${kind==='dem'?'dem_png':kind}/${z}/${x}/${y}.${ext}`;
 return {url,type:kind==='vegetation'?'application/x-protobuf':kind==='seamlessphoto'?'image/jpeg':'image/png',ttl:86400};
}
export async function proxySource(request, env, ctx) {
 let source;
 try {source=sourceRequest(request.url);} catch(e){return Response.json({error:e.message},{status:400});}
 // Sites does not grant access to caches.default. HTTP response caching and the
 // bounded browser terrain cache are sufficient; never depend on platform cache APIs.
 try {
  const r=await fetch(source.url,{signal:AbortSignal.timeout(20000),headers:{Accept:source.type}});
  if(!r.ok) return Response.json({error:'Official source unavailable',source:source.url,status:r.status},{status:r.status===404?404:502,headers:{'Cache-Control':'no-store'}});
  // Never forward cookies or source-specific security/CORS headers.
  const b=await r.arrayBuffer();
  if(b.byteLength>8*1024*1024) throw Error('Tile exceeds 8 MB limit');
  const out=new Response(b,{headers:{'Content-Type':source.type,'Cache-Control':`public,max-age=${source.ttl}`,'X-Data-Source':source.url,'X-Content-Type-Options':'nosniff'}});
  return out;
 } catch(e){return Response.json({error:'Official source request failed',detail:e.message},{status:502,headers:{'Cache-Control':'no-store'}});}
}
