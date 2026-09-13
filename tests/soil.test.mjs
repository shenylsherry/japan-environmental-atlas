import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SOIL_CLASSES,SOIL_TEXTURES} from '../dist/gis/soil-catalog.mjs';
import {decodeSoilPixel,soilSampleLocation} from '../dist/gis/soil.mjs';
import {inspectSoil} from '../dist/gis/soil-client.mjs';
import {sourceRequest} from '../worker/sources.mjs';

test('soil query coordinates use national z12 and independent z15 texture tiles',()=>{
 const p=soilSampleLocation('soil',139.243,35.625);
 assert.equal(p.z,12);assert.equal(p.x,3632);assert.equal(p.y,1613);
 assert.equal(soilSampleLocation('soil-upper',140.087325,36.032116).url,'/api/tiles/soil-upper/15/29135/12863.png');
 assert.throws(()=>soilSampleLocation('unknown',139,35));
 assert.throws(()=>soilSampleLocation('soil',181,35));
});

test('soil palette keeps original codes, exact matches, unknown and transparent distinct',()=>{
 for(const r of SOIL_CLASSES)assert.notEqual(decodeSoilPixel('soil',[...r.slice(0,3),255]).status,'unmatched');
 for(const r of SOIL_TEXTURES)assert.equal(decodeSoilPixel('soil-upper',[...r.slice(0,3),255]).label,r[3]);
 assert.equal(decodeSoilPixel('soil',[34,140,34,255]).code,'I1');
 assert.equal(decodeSoilPixel('soil-upper',[0,0,0,255]).label,'泥炭層');
 assert.equal(decodeSoilPixel('soil-upper',[0,0,0,0]).status,'nodata');
 assert.equal(decodeSoilPixel('soil-upper',[153,51,255,255]).status,'unknown');
 assert.equal(decodeSoilPixel('soil',[34,140,34,128]).status,'unmatched');
 assert.equal(decodeSoilPixel('soil',[1,2,3,255]).status,'unmatched');
 assert.throws(()=>decodeSoilPixel('soil',[-1,0,0,255]));
 assert.throws(()=>decodeSoilPixel('soil',[0,0,0]));
});

test('official point snapshots across Japan retain classes and texture gaps',()=>{
 const samples=JSON.parse(readFileSync(new URL('./fixtures/soil-samples.json',import.meta.url)));
 for(const s of samples){const p=soilSampleLocation(s.layer,s.lon,s.lat);assert.equal(p.z,s.z);assert.equal(p.x,s.x);assert.equal(p.y,s.y);assert.deepEqual([p.pixelX,p.pixelY],s.pixel);
  const value=decodeSoilPixel(s.layer,s.rgba);assert.equal(value.status,s.expected.status,s.name);assert.equal(value.label,s.expected.label,s.name);
 }
});

test('soil proxy has fixed sources and prevents agricultural zoom replacing nationwide soil',()=>{
 for(const [kind,path]of [['soil','figure'],['soil-upper','soil_properties_upper'],['soil-lower','soil_properties_lower']]){
  const r=sourceRequest(`https://atlas.test/api/tiles/${kind}/12/3632/1613.png`);
  assert.equal(r.url,`https://soil-inventory.rad.naro.go.jp/tile/${path}/12/3632/1613.png`);assert.equal(r.type,'image/png');
 }
 for(const path of ['soil/13/7264/3227.png','soil/5/28/12.png','soil-upper/16/0/0.png','soil/12/4096/0.png','soil/12/1/1.jpg','soil-ph/12/1/1.png'])assert.throws(()=>sourceRequest('https://atlas.test/api/tiles/'+path));
});

test('built soil routes preserve valid PNGs and distinguish missing coverage from failure',async t=>{
 const {default:worker}=await import('../dist/server/index.js');
 let upstream=t.mock.method(globalThis,'fetch',async()=>new Response('',{status:404}));
 const missing=await worker.fetch(new Request('https://atlas.test/api/tiles/soil-upper/15/29135/12863.png'));
 assert.equal(missing.status,200);assert.equal(missing.headers.get('X-Soil-NoData'),'missing-tile');
 const png=await missing.arrayBuffer();assert.equal(new DataView(png).getUint32(16),256);assert.equal(new DataView(png).getUint32(20),256);upstream.mock.restore();
 for(const kind of ['soil','soil-upper','soil-lower']){
  upstream=t.mock.method(globalThis,'fetch',async()=>new Response(png));
  const r=await worker.fetch(new Request(`https://atlas.test/api/tiles/${kind}/12/3632/1613.png`));
  assert.equal(r.status,200);assert.equal(r.headers.get('X-Soil-NoData'),null);assert.deepEqual(await r.arrayBuffer(),png);upstream.mock.restore();
 }
 for(const [body,status]of [['<html>maintenance</html>',200],['limited',429],['failed',500]]){
  upstream=t.mock.method(globalThis,'fetch',async()=>new Response(body,{status}));
  const r=await worker.fetch(new Request('https://atlas.test/api/tiles/soil/12/3632/1613.png'));
  assert.equal(r.status,502);assert.equal(r.headers.get('Cache-Control'),'no-store');upstream.mock.restore();
 }
});

test('soil point requests keep successful fields if another source fails and close bitmaps',async t=>{
 let closed=0;
 t.mock.method(globalThis,'fetch',async url=>url.includes('soil-upper')?new Response('',{status:502}):url.includes('soil-lower')?new Response('',{status:404}):new Response('mock bitmap'));
 const restore=(name,value)=>{const d=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{configurable:true,value});t.after(()=>d?Object.defineProperty(globalThis,name,d):delete globalThis[name]);};
 restore('createImageBitmap',async()=>({width:256,height:256,close(){closed++;}}));
 restore('OffscreenCanvas',class{getContext(){return {drawImage(){},getImageData(){return {data:new Uint8ClampedArray([34,140,34,255])};}};}});
 const result=await inspectSoil(139.243,35.625);
 assert.equal(result.soil.code,'I1');assert.equal(result['soil-upper'].status,'error');assert.equal(result['soil-lower'].status,'nodata');assert.equal(closed,1);
});

test('soil inspection propagates cancellation rather than returning stale values',async t=>{
 t.mock.method(globalThis,'fetch',async(_,options)=>{options.signal.throwIfAborted();throw Error('unexpected request');});
 await assert.rejects(inspectSoil(139.243,35.625,AbortSignal.abort()),{name:'AbortError'});
});
