import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
test('built Worker serves all application modules and rejects unknown routes',async t=>{
 if(!existsSync(new URL('../dist/server/index.js',import.meta.url))){t.skip('Run npm run build first');return;}
 const {default:worker}=await import('../dist/server/index.js');
 for(const path of ['/','/app.js','/styles.css','/gis/terrain-worker.mjs','/gis/soil.mjs','/gis/soil-client.mjs','/gis/soil-catalog.mjs','/maplibre-gl.js']){
  const r=await worker.fetch(new Request('https://kinoko.test'+path));assert.equal(r.status,200);assert.ok((await r.arrayBuffer()).byteLength>100);
 }
 const invalid=await worker.fetch(new Request('https://kinoko.test/api/proxy?url=https://example.com'));assert.equal(invalid.status,400);
 const missing=await worker.fetch(new Request('https://kinoko.test/missing'));assert.equal(missing.status,404);
 const post=await worker.fetch(new Request('https://kinoko.test/',{method:'POST'}));assert.equal(post.status,405);
});

test('built map APIs work when the runtime forbids the default cache',async t=>{
 const {default:worker}=await import('../dist/server/index.js');
 const original=Object.getOwnPropertyDescriptor(globalThis,'caches');
 const forbidden={get default(){throw Error('This Worker is not permitted to access the default cache.');}};
 Object.defineProperty(globalThis,'caches',{configurable:true,value:forbidden});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'caches',original);else delete globalThis.caches;});
 const {sourceRequest}=await import('../worker/sources.mjs');
 const routes=['/api/tiles/pale/13/7263/3226.png','/api/tiles/std/13/7263/3226.png','/api/tiles/seamlessphoto/13/7263/3226.jpg','/api/tiles/dem/14/14525/6452.png','/api/tiles/vegetation/13/7263/3226.pbf','/api/tiles/geology/13/7263/3226.png','/api/geology?lat=35.625&lon=139.243'];
 for(const route of routes){
  const source=sourceRequest('https://kinoko.test'+route),body=new Uint8Array([0,128,255,42]);
  const upstream=t.mock.method(globalThis,'fetch',async(url,options)=>{
   assert.equal(url,source.url);assert.equal(options.headers.Accept,source.type);
   return new Response(body,{headers:{'Set-Cookie':'upstream-secret=1'}});
  });
  const r=await worker.fetch(new Request('https://kinoko.test'+route));
  assert.equal(r.status,200,route);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),body);
  assert.equal(r.headers.get('Content-Type'),source.type);assert.equal(r.headers.get('X-Data-Source'),source.url);
  assert.equal(r.headers.get('Cache-Control'),'public,max-age=86400');assert.equal(r.headers.get('Set-Cookie'),null);
  assert.equal(upstream.mock.callCount(),1);upstream.mock.restore();
 }
});

test('built map APIs preserve missing tiles and do not cache upstream failures',async t=>{
 const {default:worker}=await import('../dist/server/index.js');
 for(const [upstreamStatus,expected]of [[404,404],[429,502],[500,502],[null,502]]){
  const upstream=t.mock.method(globalThis,'fetch',async()=>{if(upstreamStatus===null)throw Error('Connection failed');return new Response('source failure',{status:upstreamStatus});});
  const r=await worker.fetch(new Request('https://kinoko.test/api/tiles/dem/14/14525/6452.png'));
  assert.equal(r.status,expected);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.ok((await r.json()).error);
  upstream.mock.restore();
 }
});
