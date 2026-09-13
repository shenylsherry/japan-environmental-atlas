import {VEGETATION_GROUPS,normalizeVegetation,normalizeGeology} from './gis/normalize.mjs';
import {ASPECTS,aspectSector,groundResolution} from './gis/coordinates.mjs';
import {TERRAIN_NAMES,TERRAIN_COLORS} from './gis/terrain.mjs';
import {createTerrainClient} from './gis/terrain-client.mjs';
import {SOIL_LAYERS,SOIL_ATTRIBUTION} from './gis/soil.mjs';
import {inspectSoil} from './gis/soil-client.mjs';
const el=id=>document.getElementById(id),japanBounds=[[122,20],[154,46.5]];
const terrainLabels=['未知','山脊','上部凸坡','中坡','下部凹坡','谷地','平地'];
const layers=[
 {id:'vegetation',name:'植生',on:true,opacity:.6,type:'fill',legend:Object.values(VEGETATION_GROUPS).map(g=>[g.label,g.color]).concat([['其他林地','#98b67d'],['其他植生 / 土地利用','#d5d7d2']])},
 {id:'geology',name:'地质 / 岩性',on:false,opacity:.6,type:'raster'},
 ...SOIL_LAYERS.map(l=>({...l,on:false,opacity:.65,type:'raster'})),
 {id:'elevation',name:'海拔',on:false,opacity:.65,type:'raster',legend:[['0 m','#528d75'],['600','#a4b579'],['1,400','#c9b688'],['2,400','#a28d7c'],['3,776','#f8f7ef']]},
 {id:'slope',name:'坡度',on:false,opacity:.7,type:'raster',legend:[['0°','#eef1dc'],['10°','#b5c99b'],['25°','#e6b85c'],['40°','#cd764c'],['60°+','#863b49']]},
 {id:'aspect',name:'坡向',on:false,opacity:.7,type:'raster',legend:ASPECTS.map((v,i)=>[v,['#337abb','#45baba','#68a958','#c6b442','#db8551','#c55770','#906cb4','#636bb3'][i]])},
 {id:'curvature',name:'曲率 / 凸凹',on:false,opacity:.7,type:'raster',legend:[['凹 −0.02 m⁻¹','#37688c'],['0','#f0f2ed'],['凸 +0.02 m⁻¹','#be743c']]},
 {id:'terrain',name:'地形位置',on:false,opacity:.7,type:'raster',legend:terrainLabels.slice(1).map((v,i)=>[v,TERRAIN_COLORS[i+1]])},
 {id:'base',name:'GSI 底图',on:true,opacity:1,type:'raster',legend:[['道路、等高线、地名 · GSI 原始配色','#e5e9df']]},
];
let map,client,marker,inspectionController,inspectionId=0,ready=false;
const failures=new Map();
const nameExpr=['to-string',['coalesce',['get','凡例名'],'']],contains=words=>['any',...words.map(w=>['in',w,nameExpr])];
const palette=['case',...Object.values(VEGETATION_GROUPS).flatMap(g=>[contains(g.words),g.color]),['in',['to-string',['get','植生自然度']],['literal',['6','7','8','9']]],'#98b67d','#d5d7d2'];
const places={takao:[139.243,35.625],fuji_n:[138.728,35.393],fuji_s:[138.728,35.329],daisen:[133.544,35.378],asahidake:[142.851,43.67],kirishima:[130.86,31.927],yakushima:[130.505,30.336]};
function status(text){el('status').textContent=text;}
function setPanel(open){el('panel').classList.toggle('open',open);el('workspace').classList.toggle('closed-panel',!open);el('toggle').setAttribute('aria-expanded',String(open));}
function save(){try{localStorage.setItem('kinoko-layers-v2',JSON.stringify(layers.map(({id,on,opacity})=>({id,on,opacity}))));}catch{}}
function load(){try{const saved=JSON.parse(localStorage.getItem('kinoko-layers-v2')||'[]');for(const s of saved){const l=layers.find(v=>v.id===s.id);if(l&&typeof s.on==='boolean'&&Number.isFinite(s.opacity)){l.on=s.on;l.opacity=Math.max(0,Math.min(1,s.opacity));}}}catch{}}
function renderLayers(){el('layers').replaceChildren();for(const [i,l]of layers.entries()){
 const box=document.createElement('div');box.className='layer';
 const top=document.createElement('div');top.className='layer-title';
 const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=l.on;check.id='layer-'+l.id;label.append(check,document.createTextNode(l.name));
 check.onchange=()=>{l.on=check.checked;applyLayers();save();};top.append(label);
 for(const [label,delta]of [['↑',-1],['↓',1]]){const b=document.createElement('button');b.className='order';b.textContent=label;b.setAttribute('aria-label',l.name+(delta<0?'上移':'下移'));b.disabled=i+delta<0||i+delta>=layers.length;b.onclick=()=>{[layers[i],layers[i+delta]]=[layers[i+delta],layers[i]];renderLayers();applyLayers();};top.append(b);}
 const row=document.createElement('div');row.className='opacity';const slider=document.createElement('input'),out=document.createElement('output');slider.type='range';slider.min=0;slider.max=100;slider.value=String(Math.round(l.opacity*100));slider.setAttribute('aria-label',l.name+'不透明度');out.textContent=slider.value+'%';slider.oninput=()=>{l.opacity=Number(slider.value)/100;out.textContent=slider.value+'%';applyLayers();save();};row.append(slider,out);
 const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='图例'+(l.id==='geology'?' · 点选显示原始类别':'');detail.append(summary);
 const legend=document.createElement('div');legend.className='legend';
 if(l.legend)for(const [text,color]of l.legend){const s=document.createElement('span'),sw=document.createElement('i');sw.style.background=color;s.append(sw,document.createTextNode(text));legend.append(s);}
 else{const p=document.createElement('p');p.className='meta';p.textContent='GSJ 原始地质配色。点击地图后，地点详情显示该位置颜色、符号、岩性与时代。';legend.append(p);}
 if(l.note){const p=document.createElement('p');p.className='meta';p.textContent=l.note;legend.append(p);}
 detail.append(legend);box.append(top,row,detail);el('layers').append(box);
}}
function applyLayers(){if(!ready)return;for(const l of [...layers].reverse()){
 map.setLayoutProperty(l.id,'visibility',l.on?'visible':'none');map.setPaintProperty(l.id,l.type==='fill'?'fill-opacity':'raster-opacity',l.opacity);map.moveLayer(l.id);
 if(l.id==='vegetation'){map.moveLayer('edges');map.setLayoutProperty('edges','visibility',l.on&&el('borders').checked?'visible':'none');map.setPaintProperty('edges','line-opacity',l.opacity*.85);}
 }refresh();}
function refresh(){if(!ready)return;const c=map.getCenter();el('center-coordinates').textContent=`${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;el('zoom-readout').textContent=`z${map.getZoom().toFixed(1)}`;
 const errors=[...failures].filter(([id])=>layers.some(l=>(l.id===id||id==='veg'&&l.id==='vegetation')&&l.on));
 if(errors.length){status(`${errors.map(([id])=>layers.find(l=>l.id===id)?.name||'植生').join('、')}数据请求失败；空白区域不能解释为没有该环境。`);return;}
 const terrainOn=layers.some(l=>['elevation','slope','aspect','curvature','terrain'].includes(l.id)&&l.on);
 const soilOn=layers.some(l=>l.id.startsWith('soil')&&l.on);
 status((terrainOn?(map.getZoom()<11?'地形图层：放大至 z11；点选可查询精细地形。':`地形图层：约 ${groundResolution(c.lat,Math.min(14,Math.floor(map.getZoom()))).toFixed(0)} m 网格 · 点查询固定 z14`):'日本全国 · 点击查询地形、植生、地质和土壤')+(soilOn?(map.getZoom()<6?' · 土壤图层需放大至 z6':' · 土壤空白可表示无覆盖；放大不提高源精度'):''));
}
function filter(){if(!ready)return;const g=VEGETATION_GROUPS[el('forest').value],f=g?contains(g.words):null;map.setFilter('vegetation',f);map.setFilter('edges',f);}
function section(target,title,rows,source,extra){const box=el(target);box.replaceChildren();const s=document.createElement('section');s.className='result';const h=document.createElement('h3');h.textContent=title;s.append(h);const dl=document.createElement('dl');for(const [key,value]of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value??'不可用';dl.append(dt,dd);}s.append(dl);if(extra){const d=document.createElement('details'),summary=document.createElement('summary');summary.textContent='原始属性';d.append(summary);const raw=document.createElement('dl');for(const [k,v]of Object.entries(extra)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=String(v);raw.append(dt,dd);}d.append(raw);s.append(d);}const p=document.createElement('p');p.className='source';p.textContent=source;s.append(p);box.append(s);}
function failure(target,title,error){section(target,title,[['状态',error.name==='AbortError'?'查询已取消':error.message]],'未返回有效数据');}
const fmt=(v,unit,digits=1)=>Number.isFinite(v)?`${v.toFixed(digits)} ${unit}`:'不可用';
async function inspect(lon,lat){if(!client)return;if(lon<122||lon>154||lat<20||lat>46.5){status('请选择日本范围内的地点。');return;}
 const id=++inspectionId;inspectionController?.abort();inspectionController=new AbortController();const {signal}=inspectionController;
 if(ready){marker?.remove();marker=new maplibregl.Marker({color:'#175c88'}).setLngLat([lon,lat]).addTo(map);}
 el('inspect').hidden=false;el('point-title').textContent='地点信息';el('point-coordinates').textContent=`${lat.toFixed(6)}, ${lon.toFixed(6)}`;
 if(matchMedia('(max-width:760px)').matches)setPanel(false);
 for(const [target,title]of [['terrain-result','地形'],['vegetation-result','植生'],['geology-result','地质'],['soil-result','土壤']])section(target,title,[['状态','正在查询…']],'');
 const current=()=>id===inspectionId;
 const terrain=client.request('point',{lon,lat},signal).then(d=>{if(!current())return;
 section('terrain-result','地形',[['海拔',fmt(d.elevation,'m')],['坡度',fmt(d.slope,'°')],['坡向',d.aspect===null?(d.slope===null?'不可用':'近水平 / 未定义'):aspectSector(d.aspect)],['坡向角',fmt(d.aspect,'°')],['地形位置',terrainLabels[d.terrain||0]],['曲率',fmt(d.curvature,'m⁻¹',5)],['TPI 75 / 350 m',`${fmt(d.tpiSmall,'m')} / ${fmt(d.tpiLarge,'m')}`]],`GSI DEM10B → Japan Environmental Atlas ${d.algorithm} · z14 / 约 ${d.resolution.toFixed(1)} m 像元。地形分类为待验证派生值。`);
 }).catch(e=>{if(current()&&e.name!=='AbortError')failure('terrain-result','地形',e);});
 const vegetation=client.request('vegetation',{lon,lat},signal).then(d=>{if(!current())return;const raw=d.properties[0];if(!raw){section('vegetation-result','植生',[['原始类别','该点未返回植生多边形']],'环境省 现存植生图2024 · z15。无数据不代表无植生。');return;}
 const v=normalizeVegetation(raw);section('vegetation-result','植生',[['原始类别',v.original],['归一分组',v.groups.map(k=>VEGETATION_GROUPS[k].label).join(' / ')||'其他 / 未归一'],['群落属性',v.plantation?'名称含「植林」':'保留官方名称'],['边界匹配',d.properties.length>1?`${d.properties.length} 个匹配，可能位于边界`:'该点所在多边形']], '环境省生物多様性センター · 現存植生図2024 · z15 原始属性；归一分组为名称匹配。',raw);
 }).catch(e=>{if(current()&&e.name!=='AbortError')failure('vegetation-result','植生',e);});
 const geology=fetch(`/api/geology?lat=${lat}&lon=${lon}`,{signal}).then(async r=>{if(!r.ok)throw Error(`地质请求失败 (${r.status})`);return r.json();}).then(raw=>{if(!current())return;const g=normalizeGeology(raw);section('geology-result','地质',[['原始符号',g.original||'该点无地质记录'],['岩性',g.lithology],['归一分组',g.original?g.normalized:'不可用'],['地质时代',g.age]],'産総研地質調査総合センター · 20万分の1日本シームレス地質図V2 · 原始版。比例尺 1:200,000，不代表林地微尺度边界。',raw);
 if(raw.value){const sw=document.createElement('span');sw.className='geology-chip';sw.style.cssText=`display:inline-block;width:20px;height:12px;margin-left:8px;border:1px solid #0003;background:#${/^[\da-f]{6}$/i.test(raw.value)?raw.value:'ffffff'}`;el('geology-result').querySelector('h3').append(sw);}
 }).catch(e=>{if(current()&&e.name!=='AbortError')failure('geology-result','地质',e);});
 const soil=inspectSoil(lon,lat,signal).then(d=>{if(!current())return;
 const type=d.soil,upper=d['soil-upper'],lower=d['soil-lower'];
 section('soil-result','土壤',[['原始类型',type.label],['分类代码',type.code],['土壤群',type.group],['表层质地',upper.label],['下层质地',lower.label],['现场土壤结构','未接入实测数据']],`${SOIL_ATTRIBUTION} · CC BY 4.0。类型：全国 1:200,000 图，固定 z12；质地：覆盖有限，固定 z15。按官方编码表读取地图像元，边界未匹配时不推测。表层/下层未指定统一厘米深度。`,Object.fromEntries(Object.values(d).map(v=>[SOIL_LAYERS.find(l=>l.id===v.id).name,`${v.status} · z${v.z}/${v.x}/${v.y} · 像元约 ${v.resolution.toFixed(1)} m（非测量精度）${v.encodedCode?' · 编码 '+v.encodedCode:''}`])));
 const a=document.createElement('a');a.href=`https://soil-inventory.rad.naro.go.jp/figure.html?lat=${lat}&lng=${lon}&zoom=12`;a.target='_blank';a.rel='noopener';a.textContent='在 NARO 原图核对';el('soil-result').querySelector('section').append(a);
 }).catch(e=>{if(current()&&e.name!=='AbortError')failure('soil-result','土壤',e);});
 await Promise.allSettled([terrain,vegetation,geology,soil]);
}
async function init(){try{load();renderLayers();client=createTerrainClient();
 maplibregl.addProtocol('terrain',async(params,abortController)=>{const m=params.url.match(/^terrain:\/\/(elevation|slope|aspect|curvature|terrain)\/(\d+)\/(\d+)\/(\d+)\.png$/);if(!m)throw Error('Invalid terrain request');const [,kind,z,x,y]=m;return {data:await client.request('tile',{kind,z:Number(z),x:Number(x),y:Number(y)},abortController.signal)};});
 const sources={base:{type:'raster',tiles:[`${location.origin}/api/tiles/pale/{z}/{x}/{y}.png`],tileSize:256,minzoom:2,maxzoom:18,attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'},veg:{type:'vector',tiles:[`${location.origin}/api/tiles/vegetation/{z}/{x}/{y}.pbf`],minzoom:5,maxzoom:15,bounds:[122,20,154,46.5],attribution:'出典：<a href="https://www.biodic.go.jp/">環境省 現存植生図2024</a> / Japan Environmental Atlas 加工'},geology:{type:'raster',tiles:[`${location.origin}/api/tiles/geology/{z}/{x}/{y}.png`],tileSize:256,maxzoom:13,bounds:[122,20,154,46.5],attribution:'<a href="https://gbank.gsj.jp/seamless/">20万分の1日本シームレス地質図V2（©産総研地質調査総合センター）</a>'}};
 const mapLayers=[{id:'background',type:'background',paint:{'background-color':'#e0e9e6'}},{id:'base',type:'raster',source:'base'},{id:'geology',type:'raster',source:'geology',layout:{visibility:'none'}}];
 for(const layer of SOIL_LAYERS){sources[layer.id]={type:'raster',tiles:[`${location.origin}/api/tiles/${layer.id}/{z}/{x}/{y}.png`],tileSize:256,minzoom:6,maxzoom:layer.zoom,bounds:[122,20,154,46.5],attribution:`<a href="https://soil-inventory.rad.naro.go.jp/">${SOIL_ATTRIBUTION}</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>`};mapLayers.push({id:layer.id,type:'raster',source:layer.id,minzoom:6,layout:{visibility:'none'},paint:{'raster-resampling':'nearest','raster-fade-duration':0}});}
 for(const kind of ['elevation','slope','aspect','curvature','terrain']){sources[kind]={type:'raster',tiles:[`terrain://${kind}/{z}/{x}/{y}.png`],tileSize:256,minzoom:11,maxzoom:14,bounds:[122,20,154,46.5],attribution:'地形：国土地理院 DEM / Japan Environmental Atlas 派生'};mapLayers.push({id:kind,type:'raster',source:kind,minzoom:11,layout:{visibility:'none'},paint:{'raster-resampling':'nearest','raster-fade-duration':0}});}
 mapLayers.push({id:'vegetation',type:'fill',source:'veg','source-layer':'veg2024',paint:{'fill-color':palette,'fill-opacity':.6}},{id:'edges',type:'line',source:'veg','source-layer':'veg2024',minzoom:12,paint:{'line-color':'#345740','line-width':.5,'line-opacity':.5}});
 map=new maplibregl.Map({container:'map',style:{version:8,sources,layers:mapLayers},center:[139.243,35.625],zoom:13,minZoom:3,maxZoom:18,maxBounds:[[120,18],[156,48]],maxTileCacheSize:50,renderWorldCopies:false});
 map.addControl(new maplibregl.NavigationControl({showCompass:true}),'top-right');map.addControl(new maplibregl.ScaleControl({maxWidth:120,unit:'metric'}),'bottom-left');
 map.on('load',()=>{ready=true;applyLayers();filter();});map.on('moveend',refresh);map.on('click',e=>inspect(e.lngLat.lng,e.lngLat.lat));
 map.on('error',e=>{if(e.error?.name==='AbortError')return;failures.set(e.sourceId||'base',e.error?.message||'Error');refresh();});
 map.on('sourcedata',e=>{if(e.isSourceLoaded&&e.sourceDataType==='content'){failures.delete(e.sourceId);refresh();}});
 }catch(e){status(/WebGL|webgl/.test(e.message)?'此浏览器无法启动 WebGL 地图；坐标查询仍可使用。':'地图启动失败：'+e.message);}}
el('toggle').onclick=()=>setPanel(!el('panel').classList.contains('open'));el('close-panel').onclick=()=>setPanel(false);el('close-inspect').onclick=()=>{inspectionId++;inspectionController?.abort();el('inspect').hidden=true;};
el('home').onclick=()=>map?.fitBounds(japanBounds,{padding:50,duration:600});
el('base').onchange=()=>{const b=el('base').value;map?.getSource('base')?.setTiles([`${location.origin}/api/tiles/${b}/{z}/{x}/{y}.${b==='seamlessphoto'?'jpg':'png'}`]);};
el('borders').onchange=applyLayers;el('forest').onchange=()=>{el('preset').value='all';filter();};el('preset').onchange=()=>{el('forest').value=el('preset').value==='hana'?'larch':'all';filter();};
el('places').onchange=()=>{const p=places[el('places').value];if(p){map?.flyTo({center:p,zoom:14});inspect(...p);}};
el('coordinate-form').onsubmit=e=>{e.preventDefault();const parts=el('coordinates').value.trim().split(/[,，\s]+/);const [lat,lon]=parts.map(Number);if(parts.length!==2||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<20||lat>46.5||lon<122||lon>154){status('输入日本范围内的 纬度, 经度，例如 35.625, 139.243');return;}map?.flyTo({center:[lon,lat],zoom:14});inspect(lon,lat);};
el('locate').onclick=()=>{if(!navigator.geolocation){status('此浏览器不支持定位');return;}el('locate').disabled=true;status('正在获取一次当前位置…');navigator.geolocation.getCurrentPosition(p=>{el('locate').disabled=false;map?.flyTo({center:[p.coords.longitude,p.coords.latitude],zoom:14});inspect(p.coords.longitude,p.coords.latitude);},()=>{el('locate').disabled=false;status('无法获取位置：请检查定位权限或信号。');},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){setPanel(false);inspectionId++;inspectionController?.abort();el('inspect').hidden=true;}});
if(matchMedia('(max-width:760px)').matches)setPanel(false);
init();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
