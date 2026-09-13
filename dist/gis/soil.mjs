import {SOIL_CLASSES,SOIL_TEXTURES} from './soil-catalog.mjs';
import {lonLatToPixel,groundResolution} from './coordinates.mjs';

const hex=row=>'#'+row.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');
const classes=new Map(SOIL_CLASSES.map(r=>[r.slice(0,3).join(','),r]));
const textures=new Map(SOIL_TEXTURES.map(r=>[r.slice(0,3).join(','),r]));
const byCode=new Map(SOIL_CLASSES.map(r=>[r[3],r]));
export const SOIL_ATTRIBUTION='農研機構日本土壌インベントリー（NARO, Japanese Soil Inventory）';
export const SOIL_LAYERS=Object.freeze([
 {id:'soil',name:'土壤类型 · 全国',zoom:12,legend:SOIL_CLASSES.filter(r=>r[3].length===2).map(r=>[`${r[3]} ${r[4]}`,hex(r)]),note:'全国 1:200,000 土壤图；保留全国层级，放大不切换成农耕地图。图例为群级主色，细分类别请点选。'},
 {id:'soil-upper',name:'土壤质地 · 表层',zoom:15,legend:SOIL_TEXTURES.map(r=>[r[3],hex(r)]),note:'NARO 表層土性図。覆盖有限，山地可能无数据；表层不是统一的厘米深度。'},
 {id:'soil-lower',name:'土壤质地 · 下层',zoom:15,legend:SOIL_TEXTURES.map(r=>[r[3],hex(r)]),note:'NARO 下層土性図。覆盖有限；质地描述颗粒组成，不是实测团粒结构。'},
]);
export function soilSampleLocation(kind,lon,lat){
 const layer=SOIL_LAYERS.find(l=>l.id===kind);
 if(!layer)throw Error('Unknown soil layer');
 const z=layer.zoom,[px,py]=lonLatToPixel(lon,lat,z),x=Math.floor(px/256),y=Math.floor(py/256);
 return {z,x,y,pixelX:Math.floor(px-x*256),pixelY:Math.floor(py-y*256),resolution:groundResolution(lat,z),url:`/api/tiles/${kind}/${z}/${x}/${y}.png`};
}
/** Official encoded palette only. No nearest-color guess at mixed boundaries. */
export function decodeSoilPixel(kind,rgba){
 if(!SOIL_LAYERS.some(l=>l.id===kind))throw Error('Unknown soil layer');
 if(!rgba||rgba.length!==4||rgba.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('Invalid soil pixel');
 const [r,g,b,a]=rgba;
 if(a===0)return {status:'nodata',label:'无覆盖 / 海域'};
 if(a!==255)return {status:'unmatched',label:'边界像元 / 未匹配，无法确定'};
 const row=(kind==='soil'?classes:textures).get([r,g,b].join(','));
 if(!row)return {status:'unmatched',label:'边界像元 / 未匹配，无法确定'};
 if(kind!=='soil')return {status:row[3]==='不明'?'unknown':'ok',label:row[3],color:hex(row)};
 // National map query uses z12. Its class generalization follows NARO's z10–12 rule.
 const original=byCode.get(row[3].slice(0,4))||row;
 return {status:'ok',code:original[3],label:original[4],group:byCode.get(original[3].slice(0,2))?.[4]??null,color:hex(row),encodedCode:row[3]};
}
