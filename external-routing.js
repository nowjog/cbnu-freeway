/* Public, low-volume pedestrian routing; not an accessibility assessment. */
'use strict';
const ExternalRouting=(()=>{
 const base='https://routing.openstreetmap.de/routed-foot/route/v1/driving/';
 const valid=c=>Array.isArray(c)&&c.length>=2&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90;
 function metres(a,b){const rad=Math.PI/180, dlat=(b[1]-a[1])*rad,dlon=(b[0]-a[0])*rad;const h=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2;return 12742000*Math.asin(Math.sqrt(Math.min(1,h)))}
 let last=0;
 async function walk(start,end,{signal,fetcher=fetch}={}){
  if(!valid(start)||!valid(end)||metres(start,end)<2)throw Error('출발지와 도착지를 다시 확인해 주세요.');
  if(Date.now()-last<1050)throw Error('연속 요청을 제한하고 있습니다. 잠시 후 다시 선택해 주세요.');
  last=Date.now();
  const coord=c=>c.slice(0,2).map(n=>n.toFixed(6)).join(',');
  const url=base+coord(start)+';'+coord(end)+'?overview=full&geometries=geojson&steps=false&alternatives=false&radiuses=40;40';
  const res=await fetcher(url,{signal,cache:'no-store'});if(!res.ok)throw Error('외부 도보 경로 서버에 연결하지 못했습니다.');
  const data=await res.json();const r=data.routes?.[0],coords=r?.geometry?.coordinates;
  if(data.code!=='Ok'||r?.geometry?.type!=='LineString'||!Array.isArray(coords)||coords.length<2||!coords.every(valid)||!Number.isFinite(r.distance)||r.distance<=0)throw Error('일반 도보 경로를 찾지 못했습니다.');
  const startGap=metres(start,coords[0]),endGap=metres(end,coords[coords.length-1]);if(startGap>45||endGap>45)throw Error('외부 경로가 지정한 지점에서 너무 멀리 떨어져 있습니다.');
  return {coords,distance:r.distance,duration:Number.isFinite(r.duration)&&r.duration>0?r.duration:null,startGap,endGap};
 }
 function naverURL(start,end,appname){const p=new URLSearchParams({slat:String(start.coords[1]),slng:String(start.coords[0]),sname:start.label,dlat:String(end.coords[1]),dlng:String(end.coords[0]),dname:end.label,appname});return 'nmap://route/walk?'+p.toString();}
 return {walk,naverURL,metres};
})();
if(typeof module!=='undefined')module.exports=ExternalRouting;
