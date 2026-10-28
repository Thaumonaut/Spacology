(function(root){
  'use strict';
  const SQ3=Math.sqrt(3),DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]],SPEED=1.6,SUMMARY_LIMIT=4096,CLIFF_SHARE=.85;
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
    const BIOMES={sea:'Coastal shallows',beach:'Beach',snow:'Snowfield',alpine:'Alpine rock',tundra:'Tundra',boreal:'Boreal forest',forest:'Temperate forest',rainforest:'Rainforest',grassland:'Grassland',savanna:'Savanna',desert:'Desert',wetland:'Wetland',gorge:'Gorge',montane:'Montane conifer forest',subalpine:'Subalpine parkland',glacier:'Glacier',meadow:'Alpine meadow',redwood:'Redwood forest',steppe:'Steppe',
      flowers:'Wildflower meadow',autumn:'Autumn woodland',blossom:'Blossom grove',fen:'Mossy fen',heath:'Heather moor',golden:'Golden savanna',bamboo:'Bamboo grove',badlands:'Badlands',pinkgrass:'Rosegrass prairie'};
    const SETTINGS={craton:'Stable craton',collision:'Collision range',subduction:'Coastal arc range',trench:'Trench margin',arc:'Volcanic island arc',rift:'Rift valley',transform:'Transform fault',shelf:'Continental shelf',ocean:'Ocean basin'};
    const dominant=a=>{const n={};let best=a[0];for(const v of a){n[v]=(n[v]||0)+1;if(n[v]>n[best])best=v;}return best;};
    function summary(q,r){
      const k=key(q,r);if(summaries.has(k))return summaries.get(k);
      const c=center(q,r),points=[c,...corners(q,r).map(p=>({x:c.x+(p.x-c.x)*.6,z:c.z+(p.z-c.z)*.6}))];
      const heights=points.map(p=>world.ground(p.x,p.z)),inside=heights.every(h=>h!==null)&&(world.infinite||c.x>4&&c.z>4&&c.x<world.extent-4&&c.z<world.extent-4);
      const g=points.map(p=>world.geography(p.x,p.z)),count=f=>g.filter(f).length,sea=world.infinite&&count(s=>s.sea)>=4;
      const water=count(s=>s.riverDistance<4),basalt=count(s=>s.exposed),clearing=count(s=>s.clearing>.5),wet=count(s=>s.wet);
      const valid=heights.filter(h=>h!==null),relief=valid.length?Math.max(...valid)-Math.min(...valid):0;
      const t=world.infinite?terrain(c,q,r):{kind:null},barrier=t.kind==='cliff'||t.kind==='gorge';
      const isRoot=q===rootHex.q&&r===rootHex.r,signs=isRoot||!barrier&&g.some(s=>s.exposed&&s.riverDistance>12),uplift=t.kind==='highland'||t.kind==='pass'||t.rim;
      const value=Object.freeze({q,r,key:k,x:c.x,z:c.z,inside:inside&&!sea,height:valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:0,relief,
        terrain:t.kind,barrier,rock:barrier?t.rock:null,span:t.span??null,rim:!!t.rim,
        biome:sea?'Open sea':t.kind==='gorge'?'Gorge':t.kind==='cliff'?'Cliff edge':t.kind==='pass'?'Mountain pass':t.kind==='highland'?'Highland plateau':water>=3?'River channel':basalt>=3?'Basalt ridge':world.infinite?BIOMES[dominant(g.map(s=>s.biome))]:clearing>=3?'Clearing':wet>=3?'Wetland margin':'Grass and woodland',
        setting:world.infinite?SETTINGS[g[0].setting]:null,sea,
        resource:isRoot?'Ferrite root':signs?uplift?'Uplift signs':'Ferrite signs':null,root:isRoot,
        cost:barrier?null:Math.round((1+relief/2+(water>=3?3:0)+(t.kind==='pass'?2:0))*10)/10});
      summaries.set(k,value);if(summaries.size>SUMMARY_LIMIT)summaries.delete(summaries.keys().next().value);
      return value;
    }
    // Barriers: a 1 m grid over the hex. A gorge floor blocks crew travel, and so does a 2.5 m step unless
    // most of the hex stays one walkable patch (a wall clipping a corner can be walked around).
    function walkable(hs,own,w,cells){
      const seen=new Uint8Array(w*w);let best=0;
      for(let s=0;s<w*w;s++){if(!own[s]||seen[s])continue;let size=0;const stack=[s];seen[s]=1;
        while(stack.length){const t=stack.pop(),i=t%w,j=(t-i)/w;size++;for(const [di,dj] of [[1,0],[0,1],[-1,0],[0,-1]]){const a=i+di,b=j+dj,u=b*w+a;if(a>=0&&b>=0&&a<w&&b<w&&own[u]&&!seen[u]&&Math.abs(hs[u]-hs[t])<2.5){seen[u]=1;stack.push(u);}}}
        best=Math.max(best,size);}
      return best/cells;
    }
    function terrain(c,q,r){
      const n=Math.ceil(radius)+1,w=2*n+1,hs=new Float32Array(w*w),own=new Uint8Array(w*w);let steps=0,gorge=null,high=0,pass=0,rim=false,cells=0;
      for(let j=0;j<w;j++)for(let i=0;i<w;i++){const x=c.x+i-n,z=c.z+j-n,h=hexAt(x,z);hs[j*w+i]=world.ground(x,z);own[j*w+i]=h.q===q&&h.r===r;}
      for(let j=0;j<w;j++)for(let i=0;i<w;i++){
        if(!own[j*w+i])continue;const x=c.x+i-n,z=c.z+j-n,g=world.geography(x,z),h=hs[j*w+i];cells++;
        if(g.gorge&&!gorge)gorge=g;if(g.highland)high++;if(g.pass)pass++;if(!g.gorge&&g.gorgeDistance<g.gorgeHalf+4)rim=true;
        for(const [di,dj] of [[1,0],[0,1],[-1,0],[0,-1]]){const a=i+di,b=j+dj;if(a>=0&&b>=0&&a<w&&b<w&&Math.abs(hs[b*w+a]-h)>=2.5)steps++;}
      }
      const rock=world.geography(c.x,c.z).rock;
      if(gorge)return {kind:'gorge',rock,span:Math.round(gorge.gorgeHalf*4)/2};
      if(steps&&walkable(hs,own,w,cells)<CLIFF_SHARE)return {kind:'cliff',rock};
      return {kind:pass?'pass':high>cells/2?'highland':null,rim};
    }
    const known=(q,r)=>knowledge.get(key(q,r));
    function learn(q,r,fields){const k=key(q,r),entry=knowledge.get(k)||{q,r,key:k,surveyed:false,sampled:false,identified:false};Object.assign(entry,fields);knowledge.set(k,entry);return entry;}
    learn(rootHex.q,rootHex.r,{surveyed:true,sampled:true,identified:true});
    function frontier(){
      const seen=new Map();
      for(const e of knowledge.values())if(e.surveyed)for(const [dq,dr] of DIRS){const q=e.q+dq,r=e.r+dr,k=key(q,r);if(!seen.has(k)&&!known(q,r)?.surveyed&&summary(q,r).inside&&!summary(q,r).barrier)seen.set(k,{q,r,key:k});}
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
