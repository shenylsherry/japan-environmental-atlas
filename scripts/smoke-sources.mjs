import {proxySource} from '../worker/sources.mjs';
import {decodeTile} from '../dist/gis/vector.mjs';
const routes=['/api/geology?lat=35.625&lon=139.243','/api/tiles/dem/14/14525/6452.png','/api/tiles/vegetation/13/7263/3226.pbf','/api/tiles/geology/13/7263/3226.png','/api/tiles/std/13/7263/3226.png','/api/tiles/pale/13/7263/3226.png','/api/tiles/seamlessphoto/13/7263/3226.jpg'];
routes.push('/api/tiles/soil/12/3632/1613.png','/api/tiles/soil-upper/15/29135/12863.png','/api/tiles/soil-lower/15/29135/12863.png');
const origin=process.env.KINOKO_SITE_ORIGIN;
// Credentials stay in the process environment and are never forwarded on redirects.
if(origin&&new URL(origin).protocol!=='https:')throw Error('Deployed checks require HTTPS');
const headers=process.env.KINOKO_SITE_TOKEN?{'OAI-Sites-Authorization':`Bearer ${process.env.KINOKO_SITE_TOKEN}`} : {};
let failed=false;
console.log(JSON.stringify({mode:origin?'deployed':'local adapter',origin:origin?new URL(origin).origin:null}));
await Promise.all(routes.map(async route=>{
 try {
  const r=origin?await fetch(new URL(route,origin),{headers,redirect:'manual',signal:AbortSignal.timeout(30000)}):await proxySource(new Request('https://kinoko.test'+route));
  const b=new Uint8Array(await r.arrayBuffer()),type=r.headers.get('content-type')||'';
  let valid=false;
  if(r.ok&&route.endsWith('.png'))valid=type.startsWith('image/png')&&Buffer.from(b.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  else if(r.ok&&route.endsWith('.jpg'))valid=type.startsWith('image/jpeg')&&b[0]===255&&b[1]===216&&b[2]===255;
  else if(r.ok&&route.endsWith('.pbf'))valid=type.includes('protobuf')&&decodeTile(b).some(f=>f.properties['凡例名']);
  else if(r.ok&&type.includes('application/json')){const json=JSON.parse(new TextDecoder().decode(b));valid=!!(json.symbol&&json.lithology_ja);}
  console.log(JSON.stringify({route,status:r.status,bytes:b.byteLength,type,valid,requestId:r.headers.get('cf-ray')}));
  if(!valid)failed=true;
 }catch{console.log(JSON.stringify({route,valid:false,error:'Request or payload validation failed'}));failed=true;}
}));
if(failed)process.exitCode=1;
