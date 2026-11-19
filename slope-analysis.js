/* Geometry-based proximity matching, not survey validation. No network requests. */
'use strict';
const SlopeAnalysis=(()=>{
 const RAD=Math.PI/180;
 const bands={low:[2.5,4],mid:[1.5,2.5],high:[0.8,1.5],unknown:[1.5,3.5]}; // km/h, illustrative assumptions only
 const label={low:'완만',mid:'중간',high:'급경사',unknown:'미확인'};
 const norm=v=>Math.hypot(...v),sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],at=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 const finite=c=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1]);
 function analyze(coords,routes){
  if(!Array.isArray(coords)||coords.length<2||!coords.every(finite))throw Error('경로 좌표를 확인할 수 없습니다.');
  const origin=coords[0],sx=111195*Math.cos(origin[1]*RAD),sy=111195;
  const xy=c=>[(c[0]-origin[0])*sx,(c[1]-origin[1])*sy];
  const ll=p=>[p[0]/sx+origin[0],p[1]/sy+origin[1]];
  const raw=[];
  for(const r of routes){if(!['live','history'].includes(r.source))continue;const g=r.f.geometry, ls=g.type==='MultiLineString'?g.coordinates:g.type==='LineString'?[g.coordinates]:[];for(const line of ls)for(let i=1;i<line.length;i++){if(!finite(line[i-1])||!finite(line[i]))continue;const a=xy(line[i-1]),b=xy(line[i]),v=sub(b,a),len=norm(v);if(len<.15)continue;raw.push({r,a,b,v,len});}}
  const path=coords.map(xy);let total=0;for(let i=1;i<path.length;i++)total+=norm(sub(path[i],path[i-1]));
  // Midpoints of <=5m intervals; for unusually long routes keep bounded work and reject coarse matching.
  const enabled=total<=30000,step=enabled?5:Math.max(5,total/6000);
  let samples=[],offset=0;
  function candidate(p,dir){
   if(!enabled)return null;
   const cand=new Map();
   for(const s of raw){const cos=Math.abs((s.v[0]*dir[0]+s.v[1]*dir[1])/s.len);if(cos<.88)continue;
    const q=sub(p,s.a),t=(q[0]*s.v[0]+q[1]*s.v[1])/(s.len*s.len);if(t<0||t>1)continue;
    const d=norm(sub(p,at(s.a,s.b,t))),limit=s.r.source==='live'?7:15;if(d>limit)continue;
    const old=cand.get(s.r.i);if(!old||d<old.d)cand.set(s.r.i,{r:s.r,d});}
   const all=[...cand.values()];const live=all.filter(x=>x.r.source==='live');const group=(live.length?live:all).sort((a,b)=>a.d-b.d);if(!group.length)return null;const best=group[0];
   // Distinct slopes almost equally near may be separate sidewalks or overlapping records: do not guess.
   if(group.some(x=>x.r.i!==best.r.i&&x.d-best.d<3&&(x.r.grade!==best.r.grade||(best.r.source==='live'&&Number.isFinite(x.r.pct)&&Number.isFinite(best.r.pct)&&Math.abs(x.r.pct-best.r.pct)>1))))return null;
   if(!['low','mid','high'].includes(best.r.grade))return null;return best;
  }
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],v=sub(b,a),len=norm(v);if(len<.001)continue;const n=Math.ceil(len/step),dir=v.map(x=>x/len);for(let j=0;j<n;j++){const p=at(a,b,j/n),q=at(a,b,(j+1)/n),m=at(p,q,.5),hit=candidate(m,dir),length=len/n;samples.push({p,q,m,length,start:offset+j*length,end:offset+(j+1)*length,hit});}offset+=len;}
  // Discard isolated matches: at least 10m sustained overlap (short whole journeys: 80%).
  const minRun=Math.min(10,total*.8);
  for(let i=0;i<samples.length;){let j=i+1;const id=samples[i].hit?.r.i;while(j<samples.length&&samples[j].hit?.r.i===id)j++;if(id!==undefined&&samples.slice(i,j).reduce((n,s)=>n+s.length,0)<minRun)for(let k=i;k<j;k++)samples[k].hit=null;i=j;}
  const distance={low:0,mid:0,high:0,unknown:0,live:0,history:0};const sections=[];
  for(let i=0;i<samples.length;){let j=i+1;const s=samples[i],r=s.hit?.r??null;while(j<samples.length&&(samples[j].hit?.r.i??null)===(r?.i??null))j++;
   const run=samples.slice(i,j),length=run.reduce((n,x)=>n+x.length,0),grade=r?.grade??'unknown';distance[grade]+=length;if(r)distance[r.source]+=length;
   if(r){const mid=run[Math.floor(run.length/2)],maxOffset=Math.max(...run.map(x=>x.hit.d));sections.push({r,grade,length,start:s.start,end:run.at(-1).end,center:ll(mid.m),coords:[ll(s.p),...run.map(x=>ll(x.q))],maxOffset});}i=j;}
  return {total,distance,sections,enabled};
 }
 function wheelchair(distance){let min=0,max=0;for(const key of Object.keys(bands)){const metres=distance[key]||0;min+=metres/bands[key][1]*3.6;max+=metres/bands[key][0]*3.6;}return {min,max};}
 function sectionTime(length,grade){return wheelchair({[grade]:length});}
 return {analyze,wheelchair,sectionTime,bands,label};
})();
if(typeof module!=='undefined')module.exports=SlopeAnalysis;
