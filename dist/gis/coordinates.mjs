export const EARTH_RADIUS=6378137;
export const ASPECTS=['N','NE','E','SE','S','SW','W','NW'];
export function validLocation(lon,lat){return Number.isFinite(lon)&&Number.isFinite(lat)&&Math.abs(lon)<=180&&Math.abs(lat)<=85.05112878;}
export function lonLatToPixel(lon,lat,z){
 if(!validLocation(lon,lat)||!Number.isInteger(z)||z<0||z>22)throw Error('Invalid coordinates');
 const n=256*2**z, r=lat*Math.PI/180;
 return [(lon+180)/360*n,(1-Math.asinh(Math.tan(r))/Math.PI)/2*n];
}
export function pixelToLonLat(x,y,z){const n=256*2**z;return [x/n*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI];}
export function groundResolution(lat,z){return 2*Math.PI*EARTH_RADIUS*Math.cos(lat*Math.PI/180)/(256*2**z);}
export function aspectSector(angle){return Number.isFinite(angle)?ASPECTS[Math.floor((((angle%360)+360)%360+22.5)/45)%8]:null;}
export function slopeClass(value){return !Number.isFinite(value)||value<0||value>90?null:value<2?'flat':value<10?'gentle':value<25?'moderate':value<40?'steep':'very steep';}
export function decodeElevation(r,g,b,a=255){const v=r*65536+g*256+b;return a===0||v===8388608?NaN:(v>8388608?v-16777216:v)*.01;}
