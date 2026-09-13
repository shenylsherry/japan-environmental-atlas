import {SOIL_LAYERS,decodeSoilPixel,soilSampleLocation} from './soil.mjs';

// Three small point samples run independently of the terrain worker queue.
// HTTP caching handles repeat tiles; no persistent or unbounded bitmap cache.
export async function inspectSoil(lon,lat,signal){
 const results=await Promise.all(SOIL_LAYERS.map(async layer=>{
  const sample=soilSampleLocation(layer.id,lon,lat);
  try{
   const r=await fetch(sample.url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)});
   if(r.status===404||r.headers.get('X-Soil-NoData')==='missing-tile')return {id:layer.id,...sample,status:'nodata',label:'官方未提供该处瓦片'};
   if(!r.ok)throw Error(`请求失败 (${r.status})`);
   const bitmap=await createImageBitmap(await r.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
   try{
    if(bitmap.width!==256||bitmap.height!==256)throw Error('土壤瓦片尺寸异常');
    const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(1,1):Object.assign(document.createElement('canvas'),{width:1,height:1});
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw Error('无法读取土壤像元');
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(bitmap,sample.pixelX,sample.pixelY,1,1,0,0,1,1);
    return {id:layer.id,...sample,...decodeSoilPixel(layer.id,Array.from(ctx.getImageData(0,0,1,1).data))};
   }finally{bitmap.close();}
  }catch(e){
   if(signal?.aborted)throw e;
   return {id:layer.id,...sample,status:'error',label:e.name==='TimeoutError'?'官方请求超时':e.message};
  }
 }));
 return Object.fromEntries(results.map(r=>[r.id,r]));
}
