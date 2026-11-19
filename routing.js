/* Reference-only campus routing. No external requests or location storage. */
'use strict';
const CampusRouting=(()=>{
 const SX=89400,SY=111195,ORIGIN=[127.458,36.628];
 const xy=c=>[(c[0]-ORIGIN[0])*SX,(c[1]-ORIGIN[1])*SY], ll=p=>[p[0]/SX+ORIGIN[0],p[1]/SY+ORIGIN[1]];
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]), cross=(a,b)=>a[0]*b[1]-a[1]*b[0], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], at=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 function proj(p,a,b){const v=sub(b,a),w=sub(p,a),den=v[0]*v[0]+v[1]*v[1],t=den?Math.max(0,Math.min(1,(v[0]*w[0]+v[1]*w[1])/den)):0;const q=at(a,b,t);return {t,q,d:dist(p,q)}}
 function segmentize(routes,opts){const out=[];for(const r of routes){if(r.source==='history'&&!opts.history)continue;const cs=r.f.geometry.type==='MultiLineString'?r.f.geometry.coordinates:[r.f.geometry.coordinates];const grade=r.grade,live=r.source==='live',known=live&&Number.isFinite(r.pct)&&r.pct>=0;const bad=grade==='high'||(live&&r.status!=='recommended');const allowed=grade&&(!bad||opts.steep)&&(!live||known);const slope=known?r.pct:grade==='low'?100/18:grade==='mid'?100/12:null;for(const line of cs){for(let i=1;i<line.length;i++){const a=xy(line[i-1]),b=xy(line[i]);if(dist(a,b)<.05)continue;out.push({a,b,r,grade,allowed,slope,bad,ts:[0,1],allStart:i===1,allEnd:i===line.length-1})}}}
 // Do not let a nearby parallel historical line bypass a known caution segment.
 if(!opts.steep){const blocked=out.filter(s=>s.r.source==='live'&&!s.allowed);for(const h of out){if(h.r.source!=='history'||!h.allowed)continue;const hv=sub(h.b,h.a),hl=dist(h.a,h.b);for(const e of blocked){const ev=sub(e.b,e.a),el=dist(e.a,e.b);if(Math.abs((hv[0]*ev[0]+hv[1]*ev[1])/(hl*el))<.94)continue;const samples=[.2,.5,.8].filter(t=>proj(at(e.a,e.b,t),h.a,h.b).d<=5).length;if(samples>=2){h.allowed=false;break}}}}
 return out}
 function intersect(s,t){const v=sub(s.b,s.a),w=sub(t.b,t.a),u=sub(t.a,s.a),den=cross(v,w);if(Math.abs(den)<1e-7)return null;const a=cross(u,w)/den,b=cross(u,v)/den;return a>=-1e-8&&a<=1+1e-8&&b>=-1e-8&&b<=1+1e-8?[Math.max(0,Math.min(1,a)),Math.max(0,Math.min(1,b))]:null}
 function nearest(p,segs){let best=null;for(const s of segs){const x=proj(p,s.a,s.b);if(!best||x.d<best.d)best={...x,s}}return best}
 function solve(routes,start,end,opts={history:true,steep:false,gaps:false}){
  const segs=segmentize(routes,opts);if(!segs.length)return {error:'선택한 자료에 경로가 없습니다.'};
  const a=nearest(xy(start),segs),b=nearest(xy(end),segs);if(!a||!b||a.d>35||b.d>35)return {error:'출발지 또는 도착지에서 35m 이내에 등록된 조사선이 없습니다. 지도에서 조사선 가까이 지정해 주세요.'};
  if(!a.s.allowed||!b.s.allowed)return {error:'출발지 또는 도착지가 현재 설정에서 제외된 구간에 있습니다. 지점을 변경하거나 경로 설정을 확인해 주세요.'};
  // Split at actual line intersections; do not fabricate long missing links.
  const active=segs.filter(s=>s.allowed),gaps=[];a.s.ts.push(a.t);b.s.ts.push(b.t);
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){const s=active[i],t=active[j];if(s.r.i===t.r.i)continue;const hit=intersect(s,t);if(hit){s.ts.push(hit[0]);t.ts.push(hit[1]);}else{
   // Collinear exact intersections at endpoints (within 0.1 m).
   for(const [u,v] of [[s,t],[t,s]])for(const [k,flag] of [[0,u.allStart],[1,u.allEnd]]){const p=at(u.a,u.b,k),q=proj(p,v.a,v.b);if(q.d<=.10){v.ts.push(q.t);gaps.push({p,q:q.q,exact:true})}else if(opts.gaps&&flag&&q.d<=6){v.ts.push(q.t);gaps.push({p,q:q.q,exact:false})}}
  }}
  const nodes=[],ids=new Map(),adj=[];function node(p){const key=p.map(v=>Math.round(v*1000)).join(',');if(ids.has(key))return ids.get(key);const i=nodes.length;nodes.push(p);adj.push([]);ids.set(key,i);return i}
  function edge(a,b,cost,meta){if(a===b)return;const len=dist(nodes[a],nodes[b]);adj[a].push({to:b,cost,len,meta});adj[b].push({to:a,cost,len,meta})}
  for(const s of active){const ts=[...new Set(s.ts.map(t=>Math.round(t*1e10)/1e10))].sort((a,b)=>a-b);for(let i=1;i<ts.length;i++){const p=at(s.a,s.b,ts[i-1]),q=at(s.a,s.b,ts[i]);const len=dist(p,q),slope=s.slope??15;const cost=len*(1+3*(slope/8.33)**2+(s.r.source==='history'?.35:0)+(s.bad?8:0));edge(node(p),node(q),cost,{source:s.r.source,grade:s.grade,slope:s.slope,bad:s.bad,route:s.r.name})}}
  for(const g of gaps){const u=node(g.p),v=node(g.q),len=dist(g.p,g.q);edge(u,v,g.exact?len:len*20,{source:g.exact?'junction':'gap',grade:null,slope:null,bad:!g.exact})}
  const from=node(a.q),to=node(b.q);if(from===to)return {error:'출발지와 도착지가 같은 조사 지점에 있습니다. 다른 지점을 선택해 주세요.'};
  const costs=nodes.map(()=>Infinity),prev=nodes.map(()=>null),done=new Set();costs[from]=0;
  for(let k=0;k<nodes.length;k++){let u=-1,m=Infinity;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&costs[i]<m){m=costs[i];u=i}if(u<0||u===to)break;done.add(u);for(const e of adj[u])if(costs[u]+e.cost<costs[e.to]){costs[e.to]=costs[u]+e.cost;prev[e.to]={from:u,e}}}
  if(!Number.isFinite(costs[to]))return {error:'현재 설정에서 두 지점을 연결하는 연속 조사 경로를 찾지 못했습니다. 지점 또는 경로 설정을 변경해 주세요. 미조사 구간은 임의로 연결하지 않습니다.'};
  const path=[];let u=to;while(u!==from){const p=prev[u];if(!p)return {error:'연결 경로를 계산하지 못했습니다.'};path.push({coords:[ll(nodes[p.from]),ll(nodes[u])],length:p.e.len,...p.e.meta});u=p.from}path.reverse();
  const summary={distance:0,live:0,history:0,gap:0,high:0,mid:0,low:0,caution:0,maxLive:null};for(const e of path){summary.distance+=e.length;if(e.source in summary)summary[e.source]+=e.length;if(e.grade in summary)summary[e.grade]+=e.length;if(e.bad)summary.caution+=e.length;if(e.source==='live'&&e.slope!==null)summary.maxLive=Math.max(summary.maxLive??0,e.slope)}
  return {path,summary,startSnap:ll(a.q),endSnap:ll(b.q),startGap:a.d,endGap:b.d};
 }
 return {solve,xy,ll,dist,proj};
})();
if(typeof module!=='undefined')module.exports=CampusRouting;
