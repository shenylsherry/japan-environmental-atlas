export const VEGETATION_GROUPS={
 red_pine:{label:'アカマツ',words:['アカマツ'],color:'#c28724'},
 black_pine:{label:'クロマツ',words:['クロマツ'],color:'#917339'},
 larch:{label:'カラマツ',words:['カラマツ'],color:'#dfad4a'},
 dwarf_pine:{label:'ハイマツ',words:['ハイマツ'],color:'#345e5b'},
 oak:{label:'コナラ・ミズナラ・クヌギ',words:['コナラ','ミズナラ','クヌギ'],color:'#49844b'},
 beech:{label:'ブナ',words:['ブナ'],color:'#6caa73'},
 evergreen:{label:'シイ・カシ',words:['シラカシ','アラカシ','ウラジロガシ','アカガシ','ツクバネガシ','シイ・カシ','スダジイ','コジイ'],color:'#145a48'},
 cedar:{label:'スギ・ヒノキ・サワラ',words:['スギ','ヒノキ','サワラ'],color:'#738bbb'},
};
export function normalizeVegetation(properties={}){
 const original=String(properties['凡例名']||'');
 const groups=Object.entries(VEGETATION_GROUPS).filter(([,g])=>g.words.some(w=>original.includes(w))).map(([key])=>key);
 return {original,groups,plantation:original.includes('植林'),method:'name-match',properties};
}
export function normalizeGeology(raw={}){
 const text=`${raw.lithology_ja||''} ${raw.lithology_en||''}`.toLowerCase();
 const group=`${raw.group_ja||''} ${raw.group_en||''}`.toLowerCase();
 let normalized='other';
 // Specific metamorphic/loose materials precede parent igneous/sedimentary groups.
 if(/変成|片麻|片岩|metamorph|gneiss|schist/.test(text+' '+group))normalized='metamorphic';
 else if(/未固結|堆積物|unconsolidated|deposits|沖積/.test(text))normalized='unconsolidated';
 else if(/花崗|トーナル|granito|granite|granodi|tonalite/.test(text))normalized='granitoid';
 else if(/火山|溶岩|火砕|玄武|安山|流紋|volcan|lava|basalt|andesite|rhyolite|pyroclast/.test(text))normalized='volcanic';
 else if(/堆積岩|sedimentary/.test(group)||/砂岩|泥岩|石灰岩|sandstone|mudstone|limestone/.test(text))normalized='sedimentary';
 return {original:raw.symbol||null,lithology:raw.lithology_ja||raw.lithology_en||null,age:raw.formationAge_ja||raw.formationAge_en||null,normalized,raw};
}
