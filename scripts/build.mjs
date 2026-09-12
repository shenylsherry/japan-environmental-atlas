import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
// Keep the authored static app, but package an ESM Worker so MOE tiles can be proxied.
const root=new URL('../',import.meta.url).pathname;
const publicDir=join(root,'dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.pbf':'application/x-protobuf','.md':'text/markdown; charset=utf-8'};
const assets={};
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){
 if(['server','.openai','tiles'].includes(e.name))continue;
 const p=join(dir,e.name);if(e.isDirectory()){await walk(p);continue;}
 if(/\.(m?js)$/.test(e.name))execFileSync(process.execPath,['--check',p]);
 const ext='.'+e.name.split('.').pop();assets['/'+relative(publicDir,p)]={type:mime[ext]||'application/octet-stream',body:(await readFile(p)).toString('base64')};
}}
await walk(publicDir);
if(!assets['/index.html'])throw Error('Missing entrypoint');
const source=await readFile(join(root,'worker/sources.mjs'),'utf8');
const code=`${source}\nconst assets=${JSON.stringify(assets)};\nexport default {async fetch(request,env,ctx){const path=new URL(request.url).pathname;if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});if(path.startsWith('/api/'))return proxySource(request,env,ctx);const a=assets[path==='/'?'/index.html':path];if(!a)return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)),{headers:{'Content-Type':a.type,'Cache-Control':path.endsWith('sw.js')?'no-cache':'public,max-age=300','X-Content-Type-Options':'nosniff'}});}};\n`;
await mkdir(join(publicDir,'server'),{recursive:true});await mkdir(join(publicDir,'.openai'),{recursive:true});
await writeFile(join(publicDir,'server/index.js'),code);
await writeFile(join(publicDir,'.openai/hosting.json'),await readFile(join(root,'.openai/hosting.json')));
execFileSync(process.execPath,['--check',join(publicDir,'server/index.js')]);
console.log(`Built Worker with ${Object.keys(assets).length} assets; ${(Buffer.byteLength(code)/1024/1024).toFixed(2)} MB uncompressed`);
