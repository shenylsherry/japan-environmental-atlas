import {defineConfig} from 'vite';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {proxySource,sourceRequest} from './worker/sources.mjs';
const fixtureDir=new URL('./data/cache/browser-fixtures/',import.meta.url).pathname;
export default defineConfig({
 root:'dist',server:{host:'0.0.0.0',allowedHosts:['terminal.local']},
 plugins:[{name:'official-gis-adapter',configureServer(server){
  server.middlewares.use('/api',async(req,res)=>{
   const route='/api'+req.url,request=new Request(`http://localhost${route}`);
   if(route==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({adapter:'fixture-aware-v2',fixtures:existsSync(join(fixtureDir,'manifest.json'))}));return;}
   const manifestPath=join(fixtureDir,'manifest.json');
   // Explicitly prepared source snapshots allow reproducible QA without outside access.
   // This branch exists only in Vite; production uses worker/sources.mjs directly.
   if(existsSync(manifestPath)){
    const fixture=JSON.parse(readFileSync(manifestPath,'utf8'))[route];
    if(fixture){const b=readFileSync(join(fixtureDir,fixture.file));if(createHash('sha256').update(b).digest('hex')!==fixture.sha256){res.writeHead(500);res.end('Fixture hash mismatch');return;}
     res.writeHead(200,{'Content-Type':sourceRequest(request.url).type,'X-Kinoko-Validation-Fixture':'true','X-Data-Source':fixture.source});res.end(b);return;}
   }
   const result=await proxySource(request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  });
 }}]
});
