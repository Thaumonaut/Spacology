(function(root){
  'use strict';
  const SQ3=Math.sqrt(3),DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]],SPEED=1.6,SUMMARY_LIMIT=4096;
  const ROLES=Object.freeze(['explore','logistics','research']);
  function createAtlas(world,{radius=6}={}){
    const key=(q,r)=>`${q},${r}`,summaries=new Map(),knowledge=new Map();
    const center=(q,r)=>({x:radius*SQ3*(q+r/2),z:radius*1.5*r});
    const corners=(q,r)=>{const c=center(q,r);return DIRS.map((_,i)=>{const a=Math.PI/180*(60*i-30);return {x:c.x+radius*Math.cos(a),z:c.z+radius*Math.sin(a)};});};
    const distance=(a,b)=>(Math.abs(a.q-b.q)+Math.abs(a.q+a.r-b.q-b.r)+Math.abs(a.r-b.r))/2;
    function hexAt(x,z){
      const fq=(SQ3/3*x-z/3)/radius,fr=(2/3*z)/radius,fs=-fq-fr;
      let q=Math.round(fq),r=Math.round(fr);const s=Math.round(fs),dq=Math.abs(q-fq),dr=Math.abs(r-fr),ds=Math.abs(s-fs);
      if(dq>dr&&dq>ds)q=-r-s;else if(dr>ds)r=-q-s;
      return {q,r};
    }
    const rootHex=hexAt(world.deposit.x,world.deposit.z),camp={x:world.deposit.x+1.5,z:world.deposit.z+1.5};
    function summary(q,r){
      const k=key(q,r);if(summaries.has(k))return summaries.get(k);
      const c=center(q,r),points=[c,...corners(q,r).map(p=>({x:c.x+(p.x-c.x)*.6,z:c.z+(p.z-c.z)*.6}))];
      const heights=points.map(p=>world.ground(p.x,p.z)),inside=heights.every(h=>h!==null)&&(world.infinite||c.x>4&&c.z>4&&c.x<world.extent-4&&c.z<world.extent-4);
      const g=points.map(p=>world.geography(p.x,p.z)),count=f=>g.filter(f).length;
      const water=count(s=>s.riverDistance<4),basalt=count(s=>s.exposed),clearing=count(s=>s.clearing>.5),wet=count(s=>s.wet);
      const valid=heights.filter(h=>h!==null),relief=valid.length?Math.max(...valid)-Math.min(...valid):0;
      const isRoot=q===rootHex.q&&r===rootHex.r,signs=isRoot||g.some(s=>s.exposed&&s.riverDistance>12);
      const value=Object.freeze({q,r,key:k,x:c.x,z:c.z,inside,height:valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:0,relief,
        biome:water>=3?'River channel':basalt>=3?'Basalt ridge':clearing>=3?'Clearing':wet>=3?'Wetland margin':'Grass and woodland',
        resource:isRoot?'Ferrite root':signs?'Ferrite signs':null,root:isRoot,
        cost:Math.round((1+relief/2+(water>=3?3:0))*10)/10});
      summaries.set(k,value);if(summaries.size>SUMMARY_LIMIT)summaries.delete(summaries.keys().next().value);
      return value;
    }
    const known=(q,r)=>knowledge.get(key(q,r));
    function learn(q,r,fields){const k=key(q,r),entry=knowledge.get(k)||{q,r,key:k,surveyed:false,sampled:false,identified:false};Object.assign(entry,fields);knowledge.set(k,entry);return entry;}
    learn(rootHex.q,rootHex.r,{surveyed:true,sampled:true,identified:true});
    function frontier(){
      const seen=new Map();
      for(const e of knowledge.values())if(e.surveyed)for(const [dq,dr] of DIRS){const q=e.q+dq,r=e.r+dr,k=key(q,r);if(!seen.has(k)&&!known(q,r)?.surveyed&&summary(q,r).inside)seen.set(k,{q,r,key:k});}
      return [...seen.values()];
    }
    const crew=[
      {role:'explorer',worker:false,x:camp.x-1,z:camp.z,y:0,yaw:0,phase:0,walking:false,task:null,carrying:null},
      {role:'researcher',worker:true,x:camp.x+1,z:camp.z,y:0,yaw:0,phase:2,walking:false,task:null,carrying:null},
    ];
    const away=(h,p)=>{const c=center(h.q,h.r);return Math.hypot(c.x-p.x,c.z-p.z);};
    const nearest=(list,score)=>list.map(h=>({h,d:score(h)})).sort((a,b)=>a.d-b.d||a.h.key.localeCompare(b.h.key))[0]?.h;
    const taskAt=(kind,q,r,source,work=2)=>{const c=center(q,r);return {kind,q,r,key:key(q,r),target:{x:c.x,z:c.z},work,source};};
    function autoTask(a){
      if(a.role==='explorer'){const h=nearest(frontier(),h=>away(h,camp)+away(h,a)*.5);return h&&taskAt('survey',h.q,h.r,'auto');}
      const leads=[...knowledge.values()].filter(e=>e.surveyed&&!e.sampled&&summary(e.q,e.r).resource);
      const h=nearest(leads,h=>away(h,camp));return h?taskAt('sample',h.q,h.r,'auto'):Math.hypot(a.x-camp.x-1,a.z-camp.z)>.05?{kind:'return',target:{x:camp.x+1,z:camp.z},work:0,source:'auto'}:null;
    }
    function assign(q,r){
      const s=summary(q,r),e=known(q,r);
      if(!s.inside)return 'Outside the surveyable world.';
      if(!e?.surveyed){crew[0].task=taskAt('survey',q,r,'player');return 'Explorer assigned to survey this hex.';}
      if(!s.resource)return 'Surveyed; no resource signs for Research.';
      if(!e.sampled){crew[1].task=taskAt('sample',q,r,'player');crew[1].carrying=null;return 'Researcher assigned to collect a sample.';}
      return e.identified?'Identified; Logistics can use this resource.':'Sample is being studied at camp.';
    }
    function complete(a,t){
      if(t.kind==='survey'){learn(t.q,t.r,{surveyed:true});a.task=null;}
      else if(t.kind==='sample'){learn(t.q,t.r,{sampled:true});a.carrying=t.key;a.task={kind:'study',q:t.q,r:t.r,key:t.key,target:{...camp},work:3,source:t.source};}
      else if(t.kind==='study'){learn(t.q,t.r,{identified:true});a.carrying=null;a.task=null;}
      else a.task=null;
    }
    function update(dt){
      for(const a of crew){
        if(!a.task)a.task=autoTask(a);
        const t=a.task;a.walking=false;
        if(t){
          const dx=t.target.x-a.x,dz=t.target.z-a.z,d=Math.hypot(dx,dz),stride=SPEED*dt;
          if(d>1e-6){a.walking=true;a.yaw=Math.atan2(dx,dz);if(d<=stride){a.x=t.target.x;a.z=t.target.z;}else{a.x+=dx/d*stride;a.z+=dz/d*stride;}}
          else{t.work-=dt;if(t.work<=0)complete(a,t);}
        }
        a.y=world.ground(a.x,a.z)??0;
      }
    }
    function view(role){
      const out=[];
      for(const e of knowledge.values()){
        const s=summary(e.q,e.r);
        if(role==='explore')out.push({...s,state:'surveyed'});
        else if(role==='logistics'&&e.surveyed)out.push({...s,state:e.identified&&s.resource?'usable':s.resource?'unconfirmed':'ground',steps:distance(e,rootHex)});
        else if(role==='research'&&s.resource)out.push({...s,state:e.identified?'identified':e.sampled?'studying':'needs-sample'});
      }
      if(role==='explore')for(const h of frontier())out.push({...summary(h.q,h.r),state:'frontier'});
      return out;
    }
    function snapshot(){
      const list=[...knowledge.values()];
      return {radius,rootHex:{...rootHex},camp:{...camp},surveyed:list.filter(e=>e.surveyed).length,sampled:list.filter(e=>e.sampled).length,identified:list.filter(e=>e.identified).length,frontier:frontier().length,summaryEntries:summaries.size,
        tasks:crew.map(a=>a.task&&{role:a.role,kind:a.task.kind,key:a.task.key??null,source:a.task.source})};
    }
    return {radius,key,center,corners,hexAt,distance,summary,known,frontier,crew,assign,update,view,snapshot,rootHex,camp};
  }
  const api={createAtlas,ROLES};
  root.HexAtlas=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
