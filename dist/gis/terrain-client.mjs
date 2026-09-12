export function createTerrainClient(){
 const worker=new Worker(new URL('./terrain-worker.mjs',import.meta.url),{type:'module'}),pending=new Map();let seq=0;
 worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);p.cleanup();e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.result);};
 worker.onerror=e=>{for(const p of pending.values()){p.cleanup();p.reject(Error(e.message||'地形计算线程不可用'));}pending.clear();};
 function request(type,params,signal){return new Promise((resolve,reject)=>{
  const id=++seq,abort=()=>{if(pending.delete(id)){worker.postMessage({type:'cancel',id});reject(new DOMException('Cancelled','AbortError'));}};
  if(signal?.aborted){reject(new DOMException('Cancelled','AbortError'));return;}
  pending.set(id,{resolve,reject,cleanup:()=>signal?.removeEventListener('abort',abort)});
  signal?.addEventListener('abort',abort,{once:true});worker.postMessage({type,id,...params});
 });}
 return {request,destroy(){worker.terminate();for(const p of pending.values()){p.cleanup();p.reject(Error('Worker stopped'));}pending.clear();}};
}
