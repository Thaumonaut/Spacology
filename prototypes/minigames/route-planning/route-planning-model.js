// Deterministic logistics network rules; no DOM. Recipes come from Supply Run, movement from this road simulation.
// Factories consume delivered inputs; dispatch orders score only before their deadlines. Warehouses reserve stock
// for a named destination. In-flight cargo reserves source recall capacity and destination storage across dusk.
// Drawn edges alone connect roads. Building plots have explicit entrances; freeways require directional ramps.
// Travel and pathfinding share acceleration/turn costs. Simultaneous admission respects lanes and junction conflicts.
// Night edits are atomic, fully refundable and undoable. Future sites never clear roads. Par replays a seeded planner.
// Puzzles without logistics:true retain the original direct producer/consumer rules for replay and fixture coverage.
(function(root){
  'use strict';
  const Supply=typeof module==='object'&&module.exports?require('../supply-run/supply-run-model.js'):root.SupplyRun;
  const Kit=typeof module==='object'&&module.exports&&typeof require==='function'?require('../../shared/minigames/minigame-kit.js'):root.MiniGameKit;

  const TICK=0.25,DAY_SECONDS=40,DAY_TICKS=DAY_SECONDS/TICK;
  const DIRS=[[0,-1],[1,0],[0,1],[-1,0]],DIR_NAMES=['north','east','south','west'];
  const OPP=d=>(d+2)&3;
  const TERRAIN=[
    {id:'grass',label:'Open ground',mult:1},
    {id:'river',label:'River: a road here is a bridge (×4 cost)',mult:4},
    {id:'rough',label:'Rough ground (×2 cost)',mult:2},
    {id:'mountain',label:'Mountain: dirt tracks only',mult:2}
  ];
  const T_GRASS=0,T_RIVER=1,T_ROUGH=2,T_MOUNT=3;
  // Road tiers: credits per tile, ticks to cross a tile, vehicles per direction.
  const ROADS=[null,
    {id:'dirt',label:'Dirt track',role:'Slow mountain and remote routes',cost:1,ticks:6,cap:1},
    {id:'road',label:'Collector',role:'Gather neighbourhood traffic',cost:2,ticks:3,cap:2},
    {id:'highway',label:'Freeway',role:'Uninterrupted inter-district travel; ramps only',cost:5,ticks:2,cap:3},
    {id:'local',label:'Local',role:'Paved building access and tight turns',cost:2,ticks:3,cap:1},
    {id:'ramp',label:'Ramp',role:'One-way acceleration and deceleration link',cost:3,ticks:3,cap:1}];
  const TIER_ID={dirt:1,road:2,highway:3,local:4,collector:2,arterial:3,freeway:3,ramp:5};
  const ITEM_KEYS=['ore','crystal','plate','cell','gear'],OUTPUT_CAP=12,SIGNAL_COST=4,OVERPASS_COST=8;
  const RECIPES={};for(const id of ['refinery','synth','workshop']){const s=Supply.STATIONS[id];RECIPES[ITEM_KEYS.indexOf(s.out)]={input:Object.fromEntries(Object.entries(s.in).map(([k,n])=>[ITEM_KEYS.indexOf(k),n])),ticks:Math.ceil(s.ticks*Supply.TICK_MS/(TICK*1000)),name:s.name};}
  const JUNCTION_TICKS=2,BUILDING_TICKS=2,ROUND_COST=6,ONEWAY_COST=1;
  const WH_COST=24,WH_CAP=6,WH_UP_COST=12,WH_UP=4,WH_MAX_UP=3;
  const PROD_CAP=4,MAX_OPEN=4,DELIVERY_CREDIT=1,STIPEND=20,GROWTH_CREDIT=10,CLEAN_BONUS=8,LOAD_EVERY=4,RELAXED=1.75;
  const TYPES=ITEM_KEYS.map((id,i)=>({id,sym:['●','◆','■','▲','⬡'][i],name:Supply.ITEMS[id].name,color:Supply.ITEMS[id].color}));
  // prod: seconds per item at each producer; dem: seconds between requests at each consumer on day 1, shrinking by
  // `growth` each day; unlock: the day each type first appears.
  const DIFFICULTIES=[
    {id:'easy',label:'Easy · 6 days',target:300,W:28,H:20,types:5,days:6,prod:3.4,dem:7.5,growth:0.05,patience:30,unlock:[1,1],twin:0.25,credits:0},
    {id:'normal',label:'Normal · 8 days',target:420,W:32,H:22,types:5,days:8,prod:3.2,dem:7,growth:0.06,patience:26,unlock:[1,1,3],twin:0.3,credits:0},
    {id:'hard',label:'Hard · 10 days',target:540,W:34,H:24,types:5,days:10,prod:3,dem:6.5,growth:0.06,patience:24,unlock:[1,1,2],twin:0.35,credits:0},
    {id:'expert',label:'Expert · 12 days',target:660,W:36,H:24,types:5,days:12,prod:2.8,dem:6,growth:0.06,patience:22,unlock:[1,1,3,5],twin:0.4,credits:0}
  ];
  const PRODUCER_NAMES=['Orin','Halvard','Corve','Maren','Tesk','Bastion','Ferro','Quill','Ashby','Dunlow'];
  const CONSUMER_NAMES=['Kessel','Vyre','Ostrow','Brand','Lume','Sabre','Dunmore','Achen','Rook','Tamsin','Holm','Ember','Wick','Garron'];
  const CONSUMER_KINDS=['front','plant','base'];

  const supply=t=>TYPES[t].sym+' '+TYPES[t].name;
  const popcount=m=>(m&1)+((m>>1)&1)+((m>>2)&1)+((m>>3)&1);

  // ---- generation ---------------------------------------------------------------------------------------------------
  function generate(seed,difficulty,opts){
    const diff=DIFFICULTIES.find(d=>d.id===difficulty)||DIFFICULTIES[1],s=Number(seed)>>>0;
    let pz=null;
    for(let attempt=0;attempt<40&&!pz;attempt++)pz=districtLayout(Kit.rng(Kit.hashSeed(`route-logistics:${diff.id}:${s}:${attempt}`)),diff,s);
    if(!pz)throw new Error('Could not lay out a map');
    // Starting credits: enough to link tonight's stations with plain roads, plus some to spare.
    const probe=create({...pz,credits0:1e6});
    const before=probe.credits;connectPass(pz,probe,null);
    pz.connectCost=before-probe.credits;
    pz.credits0=Math.ceil((pz.connectCost*1.6+30)/5)*5;
    if(opts&&opts.noPlan)return pz;
    const t0=Date.now(),refined=planRun(pz,{refine:true}),a=planRun(pz,{refine:false});
    const plan=refined.result.score>=a.result.score?refined:a;
    pz.plan=plan.nights;pz.par=plan.result.score;pz.parStats=plan.result;pz.planUse=plan.use;pz.planMs=Date.now()-t0;
    pz.autoScore=a.result.score;
    return pz;
  }

  function districtLayout(r,diff,seed){
    const {W,H}=diff,N=W*H,terrain=new Array(N).fill(0),bAt=new Array(N).fill(-1),stations=[];
    let river=Math.floor(W/2);
    for(let y=0;y<H;y++){if(r.chance(0.2))river=Math.max(W/2-2,Math.min(W/2+1,river+(r.chance(0.5)?1:-1)));terrain[y*W+Math.floor(river)]=T_RIVER;}
    for(let k=0;k<8;k++){let x=r.range(1,W-2),y=r.range(1,H-2);for(let j=0;j<8;j++){const i=y*W+x;if(!terrain[i])terrain[i]=k<3?T_MOUNT:T_ROUGH;const d=DIRS[r.int(4)];x=Math.max(1,Math.min(W-2,x+d[0]));y=Math.max(1,Math.min(H-2,y+d[1]));}}
    const districts=[{name:'Ore ridge',x:Math.round(W*0.22),y:Math.round(H*0.23)},
      {name:'Crystal basin',x:Math.round(W*0.22),y:Math.round(H*0.74)},
      {name:'Assembly quarter',x:Math.round(W*0.74),y:Math.round(H*0.38)},
      {name:'Dispatch district',x:Math.round(W*0.76),y:Math.round(H*0.8)}];
    const specs=[{type:0},{type:2},{type:1},{type:3},{type:4},{type:null}].map(s=>({...s,day:1}));
    for(let day=2;day<=diff.days;day++)specs.push({type:day%3===0?(day%2?2:3):day%4===0?day%2:null,day});
    for(const sp of specs){
      const kind=sp.type===null?'consumer':'producer',recipe=RECIPES[sp.type],district=sp.type===0||sp.type===2?0:sp.type===1||sp.type===3?1:sp.type===4?2:3;
      const large=!!recipe,w=large?3:2,h=2,center=districts[district],opts=[];
      for(let y=1;y<H-h-1;y++)for(let x=1;x<W-w-1;x++){
        const port=y*W+x-1,foot=[];for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)foot.push((y+dy)*W+x+dx);
        const parcel=[port,...foot];
        if(parcel.some(i=>terrain[i]===T_RIVER||bAt[i]>=0))continue;
        if(stations.some(s=>Math.abs(s.x-(x-1))<4&&Math.abs(s.y-y)<3))continue;
        opts.push({x,y,port,foot,rank:Math.abs(x-center.x)+Math.abs(y-center.y)+r.int(5)});
      }
      opts.sort((a,b)=>a.rank-b.rank||a.port-b.port);const p=opts[0];if(!p)return null;
      const id=stations.length,name=kind==='consumer'?`${CONSUMER_NAMES[id%CONSUMER_NAMES.length]} dispatch`:recipe?recipe.name:`${PRODUCER_NAMES[id%PRODUCER_NAMES.length]} ${TYPES[sp.type].name.toLowerCase()} mine`;
      const st={id,kind,type:sp.type,needs:recipe?Object.keys(recipe.input).map(Number):kind==='consumer'?[4]:[],recipe:recipe||null,
        x:p.x-1,y:p.y,tile:p.port,footprint:p.foot,plot:{x:p.x,y:p.y,w,h},large,district,day:sp.day,short:name.split(' ')[0],name,initialStock:kind==='consumer'?0:recipe?sp.type===4?3:2:4,
        initialInput:recipe&&sp.day===1?recipe.input:{}};
      stations.push(st);for(const i of [p.port,...p.foot]){bAt[i]=id;terrain[i]=T_GRASS;}
    }
    return {id:'route-planning',logistics:true,seed,difficulty:diff.id,W,H,terrain,bAt,stations,districts,days:diff.days,dayTicks:DAY_TICKS,types:5,
      prodTicks:8,dem:diff.dem,growth:diff.growth,patience:diff.patience,credits0:0};
  }

  function schedule(pz,day,id,relaxed=false){
    const s=pz.stations[id];if(!s||s.day>day)return [];
    if(s.kind==='producer')return s.recipe?[]:[{tick:0,end:40,type:s.type,qty:2,label:'Early output ×2'}];
    const tick=96+(id%3)*4;
    return [{tick:32,type:4,qty:1,deadline:96,label:'Routine order'},
      {tick,type:4,qty:2+((pz.seed+day+id)%3),deadline:Math.min(pz.dayTicks-1,tick+(relaxed?66:44)),label:'Dispatch peak'}];
  }

  function layout(r,diff,s){
    const W=diff.W,H=diff.H,N=W*H,terrain=new Array(N).fill(T_GRASS),at=(x,y)=>y*W+x,inMap=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
    // The Ash runs north to south, wandering a column at a time.
    const mid=Math.floor(W/2);let rx=mid+r.range(-1,0);
    const lo=mid-2,hi=mid+1;
    for(let y=0;y<H;y++){
      terrain[at(rx,y)]=T_RIVER;
      if(y<H-1&&r.chance(0.3)){const nx=Math.max(lo,Math.min(hi,rx+(r.chance(0.5)?1:-1)));terrain[at(nx,y)]=T_RIVER;rx=nx;}
    }
    const riverCol=y=>{for(let x=0;x<W;x++)if(terrain[at(x,y)]===T_RIVER)return x;return mid;};
    const nearRiver=(x,y)=>{for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(inMap(x+dx,y+dy)&&terrain[at(x+dx,y+dy)]===T_RIVER)return true;return false;};
    const blob=(kind,count,size)=>{
      for(let k=0;k<count;k++){
        let x=r.int(W),y=r.int(H),tries=0;
        while((terrain[at(x,y)]!==T_GRASS||nearRiver(x,y))&&tries++<30){x=r.int(W);y=r.int(H);}
        if(tries>=30)continue;
        const n=r.range(size[0],size[1]);
        for(let i=0;i<n;i++){
          if(terrain[at(x,y)]===T_GRASS&&!nearRiver(x,y))terrain[at(x,y)]=kind;
          const d=DIRS[r.int(4)];if(inMap(x+d[0],y+d[1]))x+=d[0],y+=d[1];
        }
      }
    };
    blob(T_MOUNT,2+(W>=17?1:0),[2,4]);
    blob(T_ROUGH,3+(W>=16?1:0),[3,6]);

    // The schedule: which stations appear on which day.
    const specs=[],unlocked=d=>diff.unlock.map((u,t)=>u<=d?t:-1).filter(t=>t>=0);
    const addP=(t,day)=>specs.push({kind:'producer',type:t,day});
    const addC=(needs,day)=>specs.push({kind:'consumer',needs,day});
    const pickNeeds=day=>{
      const ts=unlocked(day),cover=ts.map(t=>specs.filter(x=>x.kind==='consumer'&&x.needs.includes(t)).length);
      const min=Math.min(...cover),a=ts.filter((t,i)=>cover[i]===min)[0];
      if(ts.length>1&&r.chance(diff.twin)){const others=ts.filter(t=>t!==a);return [a,r.pick(others)].sort((x,y)=>x-y);}
      return [a];
    };
    for(const t of unlocked(1))addP(t,1);
    addC([0],1);addC([1],1);
    let extra=0;
    for(let d=2;d<=diff.days;d++){
      const fresh=diff.unlock.map((u,t)=>u===d?t:-1).filter(t=>t>=0);
      for(const t of fresh){addP(t,d);addC([t],d);}
      let n=(d%3===0?2:1)-2*fresh.length;
      if(!fresh.length&&n<1)n=1;
      for(let k=0;k<n;k++){
        extra++;
        if(extra%3===0){
          const ts=unlocked(d),ratio=ts.map(t=>specs.filter(x=>x.kind==='consumer'&&x.needs.includes(t)).length/specs.filter(x=>x.kind==='producer'&&x.type===t).length);
          const best=Math.max(...ratio);addP(ts[ratio.indexOf(best)],d);
        }else addC(pickNeeds(d),d);
      }
    }
    // Places: producers mostly on the west bank, consumers mostly east; stations at least two tiles apart.
    const stations=[],taken=[],pn=r.shuffle(PRODUCER_NAMES),cn=r.shuffle(CONSUMER_NAMES);
    let pi=0,ci=0;
    for(const sp of specs){
      const west=sp.kind==='producer'?r.chance(0.75):r.chance(0.25);
      const opts=[];
      for(let y=0;y<H;y++){const c=riverCol(y);for(let x=0;x<W;x++){
        if(west?x>=c-1:x<=c+1)continue;
        const t=terrain[at(x,y)];if(t!==T_GRASS&&t!==T_ROUGH)continue;
        if(taken.some(p=>Math.max(Math.abs(p.x-x),Math.abs(p.y-y))<2))continue;
        let open=0;for(const d of DIRS)if(inMap(x+d[0],y+d[1])&&terrain[at(x+d[0],y+d[1])]!==T_MOUNT)open++;
        if(open<2)continue;
        if(sp.kind==='consumer'&&stations.some(o=>o.kind==='producer'&&sp.needs.includes(o.type)&&Math.abs(o.x-x)+Math.abs(o.y-y)<4))continue;
        opts.push({x,y});
      }}
      if(!opts.length)return null;
      const district=stations.filter(o=>o.kind===sp.kind&&(o.x<riverCol(o.y))===west);
      const distance=p=>Math.min(...district.map(o=>Math.abs(o.x-p.x)+Math.abs(o.y-p.y)));
      const nearby=district.length?opts.filter(p=>distance(p)<=5):[];
      const p=r.pick(nearby.length?nearby:opts);taken.push(p);
      terrain[at(p.x,p.y)]=T_GRASS;
      const id=stations.length;
      if(sp.kind==='producer'){const nm=pn[pi++%pn.length];stations.push({id,kind:'producer',x:p.x,y:p.y,tile:at(p.x,p.y),type:sp.type,needs:[],day:sp.day,short:nm,name:`${nm} ${TYPES[sp.type].name} works`});}
      else{const nm=cn[ci++%cn.length],kind=CONSUMER_KINDS[r.int(CONSUMER_KINDS.length)];stations.push({id,kind:'consumer',x:p.x,y:p.y,tile:at(p.x,p.y),type:null,needs:sp.needs,day:sp.day,short:nm,name:`${nm} ${kind}`});}
    }
    // Every station must be reachable over buildable ground.
    const seen=new Uint8Array(N),q=[stations[0].tile];seen[q[0]]=1;
    while(q.length){const a=q.pop(),x=a%W,y=(a-x)/W;for(const d of DIRS){const nx=x+d[0],ny=y+d[1];if(!inMap(nx,ny))continue;const b=at(nx,ny);if(!seen[b]&&terrain[b]!==T_MOUNT){seen[b]=1;q.push(b);}}}
    if(stations.some(st=>!seen[st.tile]))return null;
    const bAt=new Array(N).fill(-1);for(const st of stations)bAt[st.tile]=st.id;
    return {id:'route-planning',seed:s,difficulty:diff.id,W,H,terrain,stations,bAt,days:diff.days,dayTicks:DAY_TICKS,types:diff.types,
      prodTicks:Math.round(diff.prod/TICK),dem:diff.dem,growth:diff.growth,patience:diff.patience,credits0:0};
  }

  // ---- state ----------------------------------------------------------------------------------------------------------
  function create(pz,opts){
    const N=pz.W*pz.H;
    const sim={phase:'night',day:1,tick:0,relaxed:!!(opts&&opts.relaxed),credits:pz.credits0,
      net:{tier:new Array(N).fill(0),e:new Array(N).fill(0),blk:new Array(N).fill(0),rb:new Array(N).fill(0),paid:new Array(N).fill(0),built:new Array(N).fill(0),rbPaid:new Array(N).fill(0),control:new Array(N).fill('stop'),over:new Array(N).fill(null),reserved:new Array(N).fill(-1)},
      wh:[],
      st:pz.stations.map(s=>({stock:pz.logistics?s.initialStock||0:0,input:TYPES.map((_,t)=>s.initialInput?.[t]||0),acc:0,reqs:[],next:0,dacc:0,starved:false})),
      veh:[],vid:1,occ:new Array(N*4).fill(0),load:new Array(N).fill(0),q:new Array(N).fill(0),loadVer:0,ver:0,
      score:0,deliveries:0,cleanDays:0,days:[],ds:null,report:null,fx:[],
      log:[],tonight:[],nightStart:null};
    enterNight(pz,sim);
    return sim;
  }
  const clone=sim=>typeof structuredClone==='function'?structuredClone(sim):JSON.parse(JSON.stringify(sim));
  const isActive=(pz,sim,id)=>pz.stations[id].day<=sim.day;
  const stationAt=(pz,sim,idx)=>{const id=pz.bAt[idx];return id>=0&&isActive(pz,sim,id)?id:-1;};
  const whAt=(sim,idx)=>{for(let k=0;k<sim.wh.length;k++)if(sim.wh[k].tile===idx)return k;return -1;};
  const isBuilding=(pz,sim,idx)=>stationAt(pz,sim,idx)>=0||whAt(sim,idx)>=0;
  const isNode=(pz,sim,idx)=>sim.net.tier[idx]>0||isBuilding(pz,sim,idx);
  const neighbour=(pz,idx,d)=>{const x=idx%pz.W,y=(idx-x)/pz.W,nx=x+DIRS[d][0],ny=y+DIRS[d][1];return nx>=0&&ny>=0&&nx<pz.W&&ny<pz.H?ny*pz.W+nx:-1;};
  const dirTo=(pz,a,b)=>{for(let d=0;d<4;d++)if(neighbour(pz,a,d)===b)return d;return -1;};
  const isJunction=(sim,idx)=>sim.net.tier[idx]>0&&popcount(sim.net.e[idx])>=3;
  function snapshot(sim){return {net:clone(sim.net),wh:clone(sim.wh),credits:sim.credits};}
  function restore(sim,s){sim.net=clone(s.net);sim.wh=clone(s.wh);sim.credits=s.credits;sim.ver++;}

  function enterNight(pz,sim){
    sim.ver++;sim.nightStart=snapshot(sim);sim.tonight=[];sim.log[sim.day-1]=sim.tonight;
  }
  function clearTile(pz,sim,i){
    const n=sim.net;
    for(let d=0;d<4;d++){const b=neighbour(pz,i,d);if(b>=0){n.e[b]&=~(1<<OPP(d));n.blk[b]&=~(1<<OPP(d));}}
    n.tier[i]=0;n.e[i]=0;n.blk[i]=0;n.rb[i]=0;n.paid[i]=0;n.built[i]=0;n.rbPaid[i]=0;
    n.control[i]='stop';n.over[i]=null;for(let k=0;k<n.reserved.length;k++)if(n.reserved[k]===i)n.reserved[k]=-1;
  }
  function removeWarehouse(pz,sim,k){
    const i=sim.wh[k].tile;
    for(let t=0;t<sim.net.reserved.length;t++)if(sim.net.reserved[t]===i)sim.net.reserved[t]=-1;
    for(let d=0;d<4;d++){const b=neighbour(pz,i,d);if(b>=0){sim.net.e[b]&=~(1<<OPP(d));sim.net.blk[b]&=~(1<<OPP(d));}}
    sim.net.e[i]=0;sim.net.blk[i]=0;sim.wh.splice(k,1);
  }
  function join(pz,sim,a,b){
    const d=dirTo(pz,a,b);if(d<0)return false;
    if(pz.logistics&&connectionWhy(pz,sim,a,b))return false;
    if(isBuilding(pz,sim,a)&&isBuilding(pz,sim,b)&&!sim.net.tier[a]&&!sim.net.tier[b])return false;
    if(!isNode(pz,sim,a)||!isNode(pz,sim,b))return false;
    if(sim.net.e[a]&(1<<d))return false;
    sim.net.e[a]|=1<<d;sim.net.e[b]|=1<<OPP(d);return true;
  }
  const buildCost=(pz,idx,tier)=>ROADS[tier].cost*TERRAIN[pz.terrain[idx]].mult;

  function roadAllowed(pz,i,tier){return !(pz.terrain[i]===T_MOUNT&&tier!==1||tier===3&&pz.terrain[i]!==T_GRASS||tier===5&&pz.terrain[i]!==T_GRASS);}
  function roadTier(sim,i,d){const o=sim.net.over[i];return o&&d%2!==o.axis?o.tier:sim.net.tier[i];}
  function connectionWhy(pz,sim,a,b){
    const d=dirTo(pz,a,b),ta=roadTier(sim,a,d),tb=roadTier(sim,b,OPP(d));
    for(const [i,tier] of [[a,tb],[b,ta]]){
      const id=pz.bAt[i],w=whAt(sim,i),st=id>=0?pz.stations[id]:null;
      if(st&&st.tile!==i)return 'Roads cannot occupy a reserved building footprint.';
      if(st||w>=0){const large=st?st.large:true;if(tier&&tier!==4&&!(large&&tier===2))return large?'Large buildings require a local or collector entrance.':'Small buildings require a paved local entrance.';}
    }
    if((ta===3&&tb!==3&&tb!==5)||(tb===3&&ta!==3&&ta!==5))return 'Freeways connect through directional ramps, never directly to streets or buildings.';
    for(const [i,tier,other] of [[a,ta,tb],[b,tb,ta]])if(tier===3&&!sim.net.over[i]&&other!==5){
      const direction=dirTo(pz,i,i===a?b:a);if(!(sim.net.e[i]&(1<<direction))){let branches=0;for(let k=0;k<4;k++)if(sim.net.e[i]&(1<<k)&&sim.net.tier[neighbour(pz,i,k)]!==5)branches++;if(branches>=2)return 'Freeway branches require ramps or an overpass.';}
    }
    return null;
  }

  // ---- night edits ----------------------------------------------------------------------------------------------------
  // road {tiles, tier}: lay (or re-tier) a dragged path and join consecutive tiles; single taps preserve topology.
  //   erase {tiles}: remove roads and warehouses. oneway {tiles}: make each step along the
  //   path one-way in that direction (the same drag again makes it two-way). roundabout {tile}: toggle. warehouse {tile}:
  //   place one on empty ground, joined to the roads around it. whcap {tile}: +4 capacity.
  function costOf(pz,sim,a){return check(pz,clone(sim),a);}
  function check(pz,sim,a){const before=sim.credits,why=apply(pz,sim,a);return why?{why}:{cost:before-sim.credits};}
  function edit(pz,sim,a){
    if(sim.phase!=='night')return {why:sim.phase==='day'?'Roads can only be changed at night. Watch the traffic, then build at dusk.':'The run is over.'};
    const trial=clone(sim),before=sim.credits,why=apply(pz,trial,a);
    if(why)return {why};
    apply(pz,sim,a);sim.ver++;sim.tonight.push(a);
    return {cost:before-sim.credits};
  }
  function undo(pz,sim){
    if(sim.phase!=='night'||!sim.tonight.length)return false;
    const rest=sim.tonight.slice(0,-1);restore(sim,sim.nightStart);sim.tonight.length=0;
    for(const a of rest){apply(pz,sim,a);sim.tonight.push(a);}
    sim.ver++;return true;
  }
  function tilesOk(pz,tiles){
    if(!Array.isArray(tiles)||!tiles.length)return 'No tiles.';
    for(const t of tiles)if(!Number.isInteger(t)||t<0||t>=pz.W*pz.H)return 'Off the map.';
    for(let i=1;i<tiles.length;i++)if(dirTo(pz,tiles[i-1],tiles[i])<0)return 'A road must run between neighbouring tiles.';
    return null;
  }
  function apply(pz,sim,a){
    if(!a||typeof a!=='object')return 'No edit.';
    const n=sim.net;
    if(a.type==='road'){
      const w=tilesOk(pz,a.tiles);if(w)return w;
      const tier=!pz.logistics&&a.tier==='local'?1:TIER_ID[a.tier||'road'];if(!tier||tier===5)return 'Use the directional ramp tool for ramps.';
      const tiles=[...new Set(a.tiles)],interior=new Set(a.tiles.slice(1,-1));
      const accessOnly=t=>isBuilding(pz,sim,t)&&!interior.has(t)&&!n.tier[t];
      let cost=0,changed=false;
      for(const t of tiles){
        if(pz.logistics&&pz.bAt[t]>=0&&pz.stations[pz.bAt[t]].tile!==t)return 'Roads cannot occupy a reserved building footprint.';
        if(accessOnly(t))continue;
        if(!pz.logistics&&pz.terrain[t]===T_MOUNT)return 'Mountains cannot be built on.';
        if(pz.logistics){
          if(!roadAllowed(pz,t,tier))return pz.terrain[t]===T_MOUNT?'Mountains support dirt tracks only.':'Freeways require normal ground.';
          if(n.reserved[t]>=0)return 'That space belongs to a roundabout.';
          const st=pz.stations[pz.bAt[t]];if(st&&(st.tile!==t||tier!==4&&!(st.large&&tier===2)))return 'Keep the planned footprint clear and use its marked local/collector entrance.';
          if(n.over[t]&&tier!==n.tier[t])return 'Remove the overpass before changing its road type.';
        }
        if(n.tier[t]===tier)continue;
        cost+=buildCost(pz,t,tier)-n.paid[t];
      }
      if(cost>sim.credits)return `That needs ${cost} credits; you have ${sim.credits}.`;
      sim.credits-=cost;
      for(const t of tiles){
        if(accessOnly(t)||n.tier[t]===tier)continue;
        n.paid[t]=buildCost(pz,t,tier);n.built[t]=sim.day;
        n.tier[t]=tier;changed=true;
      }
      if(a.tiles.length===1&&!pz.logistics){const t=a.tiles[0];if(n.tier[t])for(let d=0;d<4;d++){const b=neighbour(pz,t,d);if(b>=0&&join(pz,sim,t,b))changed=true;}}
      else for(let i=1;i<a.tiles.length;i++){
        if(pz.logistics){const why=connectionWhy(pz,sim,a.tiles[i-1],a.tiles[i]);if(why)return why;}
        if(join(pz,sim,a.tiles[i-1],a.tiles[i]))changed=true;
      }
      if(pz.logistics)for(const t of tiles)for(let d=0;d<4;d++)if(n.e[t]&(1<<d)){const b=neighbour(pz,t,d);const why=connectionWhy(pz,sim,t,b);if(why)return why;}
      if(pz.logistics)for(const t of tiles)if(n.tier[t]===3&&!n.over[t]&&DIRS.filter((_,d)=>n.e[t]&(1<<d)&&n.tier[neighbour(pz,t,d)]!==5).length>2)return 'Freeway branches require ramps or an overpass.';
      return changed?null:'That road is already there.';
    }
    if(a.type==='erase'){
      if(!Array.isArray(a.tiles)||!a.tiles.length)return 'No tiles.';
      let changed=false;
      for(const t of a.tiles){
        if(!Number.isInteger(t)||t<0||t>=pz.W*pz.H)return 'Off the map.';
        if(n.tier[t]){sim.credits+=n.paid[t]+n.rbPaid[t];clearTile(pz,sim,t);changed=true;}
        const k=whAt(sim,t);if(k>=0){sim.credits+=sim.wh[k].paid;removeWarehouse(pz,sim,k);changed=true;}
      }
      return changed?null:'Nothing to erase there.';
    }
    if(a.type==='oneway'){
      const w=tilesOk(pz,a.tiles);if(w)return w;
      if(a.tiles.length<2)return 'Drag along a road to set its direction.';
      const steps=[];
      for(let i=1;i<a.tiles.length;i++){const x=a.tiles[i-1],y=a.tiles[i],d=dirTo(pz,x,y);if(!(n.e[x]&(1<<d)))return 'One-way works along an existing road.';steps.push([x,y,d]);}
      // The same drag again turns the stretch back into a two-way road.
      const already=steps.every(([x,y,d])=>!(n.blk[x]&(1<<d))&&(n.blk[y]&(1<<OPP(d))));
      let cost=0;if(!already)cost=steps.filter(([x,y,d])=>!(n.blk[y]&(1<<OPP(d)))||(n.blk[x]&(1<<d))).length*ONEWAY_COST;
      if(cost>sim.credits)return `That needs ${cost} credits; you have ${sim.credits}.`;
      sim.credits-=cost;
      for(const [x,y,d] of steps){n.blk[x]&=~(1<<d);if(already)n.blk[y]&=~(1<<OPP(d));else n.blk[y]|=1<<OPP(d);}
      return null;
    }
    if(a.type==='roundabout'){
      if(pz.logistics)return setControl(pz,sim,{...a,control:n.control[a.tile]==='roundabout'?'stop':'roundabout'});
      const t=a.tile;if(!Number.isInteger(t)||t<0||t>=pz.W*pz.H)return 'Off the map.';
      if(!n.tier[t])return 'A roundabout goes on a road tile.';
      if(n.rb[t]){sim.credits+=n.rbPaid[t];n.rb[t]=0;n.rbPaid[t]=0;return null;}
      if(popcount(n.e[t])<3)return 'A roundabout only helps where three or more roads meet.';
      if(ROUND_COST>sim.credits)return `That needs ${ROUND_COST} credits; you have ${sim.credits}.`;
      sim.credits-=ROUND_COST;n.rb[t]=sim.day;n.rbPaid[t]=ROUND_COST;return null;
    }
    if(a.type==='warehouse'){
      const t=a.tile;if(!Number.isInteger(t)||t<0||t>=pz.W*pz.H)return 'Off the map.';
      if(n.tier[t]||isBuilding(pz,sim,t)||pz.bAt[t]>=0||n.reserved[t]>=0)return 'A warehouse needs empty ground outside a planned building site.';
      if(pz.terrain[t]===T_RIVER||pz.terrain[t]===T_MOUNT)return 'A warehouse needs dry, flat ground.';
      if(pz.logistics&&!DIRS.some((_,d)=>{const b=neighbour(pz,t,d);return b>=0&&[2,4].includes(n.tier[b]);}))return 'Place a warehouse beside a local or collector road.';
      if(WH_COST>sim.credits)return `That needs ${WH_COST} credits; you have ${sim.credits}.`;
      sim.credits-=WH_COST;sim.wh.push({tile:t,cap:WH_CAP,ups:0,stock:new Array(TYPES.length).fill(0),inc:new Array(TYPES.length).fill(0),paid:WH_COST,built:sim.day});
      if(pz.logistics){const east=neighbour(pz,t,1),body=[east,neighbour(pz,t,2),east>=0?neighbour(pz,east,2):-1];if(body.some(i=>i<0||n.tier[i]||pz.bAt[i]>=0||isBuilding(pz,sim,i)||n.reserved[i]>=0||pz.terrain[i]===T_RIVER||pz.terrain[i]===T_MOUNT))return 'A warehouse needs room east and south of its entrance.';sim.wh.at(-1).footprint=body;for(const i of body)n.reserved[i]=t;}
      for(let d=0;d<4;d++){const b=neighbour(pz,t,d);if(b>=0&&(n.tier[b]===2||n.tier[b]===4||!pz.logistics&&n.tier[b]))join(pz,sim,t,b);}
      return null;
    }
    if(a.type==='whcap'){
      const k=whAt(sim,a.tile);if(k<0)return 'No warehouse there.';
      const w=sim.wh[k];if(w.ups>=WH_MAX_UP)return 'That warehouse is as big as it gets.';
      if(WH_UP_COST>sim.credits)return `That needs ${WH_UP_COST} credits; you have ${sim.credits}.`;
      sim.credits-=WH_UP_COST;w.paid+=WH_UP_COST;w.ups++;w.cap+=WH_UP;return null;
    }
    if(a.type==='connection'){
      const x=a.tile,y=neighbour(pz,x,a.dir);if(!Number.isInteger(x)||x<0||x>=pz.W*pz.H||!Number.isInteger(a.dir)||a.dir<0||a.dir>3||y<0)return 'Invalid connection.';
      if(n.e[x]&(1<<a.dir)){if(n.tier[x]===5||n.tier[y]===5)return 'Erase the ramp to remove its connections.';n.e[x]&=~(1<<a.dir);n.e[y]&=~(1<<OPP(a.dir));n.blk[x]&=~(1<<a.dir);n.blk[y]&=~(1<<OPP(a.dir));return null;}
      const why=connectionWhy(pz,sim,x,y);if(why)return why;return join(pz,sim,x,y)?null:'Both ends need a road or marked entrance.';
    }
    if(a.type==='control')return setControl(pz,sim,a);
    if(a.type==='overpass')return buildOverpass(pz,sim,a);
    if(a.type==='interchange'){
      const t=a.tile;if(!Number.isInteger(t)||n.tier[t]!==3||![5,10].includes(n.e[t]))return 'Choose a straight freeway with space for a ramp pair.';
      const along=n.e[t]===10?1:2,side=Number.isInteger(a.side)?a.side:along===1?2:1;
      if(side%2===along%2||side<0||side>3)return 'Ramps need to sit beside the freeway.';
      const at=(x,y)=>{let i=t;for(let k=0;k<Math.abs(x)&&i>=0;k++)i=neighbour(pz,i,x<0?OPP(along):along);for(let k=0;k<y&&i>=0;k++)i=neighbour(pz,i,side);return i;};
      const street=Array.from({length:7},(_,k)=>at(k-3,3)),on=[3,2,1,0].map(y=>at(-2,y)),off=[0,1,2,3].map(y=>at(2,y));
      if([...street,...on,...off].some(i=>i<0))return 'The ramp pair does not fit here.';
      for(const act of [{type:'road',tier:'road',tiles:street},{type:'ramp',tiles:on},{type:'ramp',tiles:off}]){const why=apply(pz,sim,act);if(why&&!(act.type==='road'&&why==='That road is already there.'))return why;}
      return null;
    }
    if(a.type==='ramp'){
      const why=tilesOk(pz,a.tiles);if(why)return why;
      if(a.tiles.length<4)return 'A ramp needs a street, at least two approach tiles, and a freeway.';
      const start=a.tiles[0],end=a.tiles.at(-1),on=n.tier[end]===3,off=n.tier[start]===3;
      if(on===off||![2,4].includes(n.tier[on?start:end]))return 'Draw from a local/collector to a freeway (on), or from freeway to street (off).';
      const middle=a.tiles.slice(1,-1);if(new Set(a.tiles).size!==a.tiles.length)return 'A ramp cannot loop back on itself.';
      if(middle.some(i=>!roadAllowed(pz,i,5)||n.tier[i]||pz.bAt[i]>=0||n.reserved[i]>=0||isBuilding(pz,sim,i)))return 'Ramp approaches need empty normal ground.';
      const f=on?end:start,adj=on?a.tiles.at(-2):a.tiles[1],d=dirTo(pz,f,adj);
      if(n.over[f]||popcount(n.e[f])!==2||![5,10].includes(n.e[f])||(n.e[f]&(1<<d)))return 'Join the side of a straight freeway, away from another ramp.';
      const cost=middle.length*ROADS[5].cost;if(cost>sim.credits)return `That needs ${cost} credits; you have ${sim.credits}.`;
      sim.credits-=cost;for(const i of middle){n.tier[i]=5;n.paid[i]=ROADS[5].cost;n.built[i]=sim.day;}
      for(let k=1;k<a.tiles.length;k++){const x=a.tiles[k-1],y=a.tiles[k],d=dirTo(pz,x,y),why=connectionWhy(pz,sim,x,y);if(why)return why;join(pz,sim,x,y);n.blk[y]|=1<<OPP(d);}
      return null;
    }
    if(a.type==='prepare'){
      const k=whAt(sim,a.tile),s=pz.stations[a.target],type=Number(a.item);
      if(k<0||!s||s.day>sim.day||!s.needs.includes(type))return 'Choose an active destination and one of its required goods.';
      const qty=Math.floor(Number(a.qty));if(!Number.isFinite(qty)||qty<1||qty>sim.wh[k].cap)return 'Stock target must fit the warehouse.';
      sim.wh[k].plan={target:s.id,type,qty};return null;
    }
    if(a.type==='unprepare'){const k=whAt(sim,a.tile);if(k<0)return 'No warehouse there.';sim.wh[k].plan=null;return null;}
    return 'Unknown edit.';
  }

  function setControl(pz,sim,a){
    const n=sim.net,t=a.tile,c=a.control;
    if(!Number.isInteger(t)||!n.tier[t]||popcount(n.e[t])<3&&!(c==='stop'&&n.rbPaid[t]))return 'Choose a junction with three or more roads.';
    if(!['stop','signal','roundabout'].includes(c)||n.tier[t]===3||n.tier[t]===5||n.over[t])return 'Signals, stops and roundabouts belong on streets, not freeway mainlines or overpasses.';
    if(n.control[t]===c)return 'That control is already installed.';
    const corners=[t-pz.W-1,t-pz.W+1,t+pz.W-1,t+pz.W+1];
    if(c==='roundabout'&&(t%pz.W===0||t%pz.W===pz.W-1||corners.some(i=>i<0||i>=pz.W*pz.H||n.tier[i]||pz.bAt[i]>=0||isBuilding(pz,sim,i)||n.reserved[i]>=0)))return 'A roundabout needs a clear 3×3 footprint around its approaches.';
    const cost=(c==='signal'?SIGNAL_COST:c==='roundabout'?ROUND_COST:0)-n.rbPaid[t];if(cost>sim.credits)return `That needs ${cost} credits; you have ${sim.credits}.`;
    sim.credits-=cost;for(let i=0;i<n.reserved.length;i++)if(n.reserved[i]===t)n.reserved[i]=-1;
    n.control[t]=c;n.rb[t]=c==='roundabout'?sim.day:0;n.rbPaid[t]=c==='signal'?SIGNAL_COST:c==='roundabout'?ROUND_COST:0;
    if(c==='roundabout')for(const i of corners)n.reserved[i]=t;
    return null;
  }
  function buildOverpass(pz,sim,a){
    const n=sim.net,t=a.tile;if(!Number.isInteger(t)||!n.tier[t]||n.tier[t]===5)return 'Choose a straight road for the upper crossing.';
    if(n.over[t]){if(n.tier[t]===3)for(const d of [(n.over[t].axis+1)%2,(n.over[t].axis+1)%2+2]){const b=neighbour(pz,t,d);n.e[t]&=~(1<<d);if(b>=0)n.e[b]&=~(1<<OPP(d));}sim.credits+=n.rbPaid[t];n.rbPaid[t]=0;n.over[t]=null;n.control[t]='stop';return null;}
    if(![5,10,15].includes(n.e[t])||pz.bAt[t]>=0)return 'An overpass needs a straight road, or a four-way crossing.';
    const axis=Number.isInteger(a.axis)?a.axis:n.e[t]===5?0:1,side=(axis+1)%2,tier=2,approaches=[];
    if(axis<0||axis>1)return 'Choose north/south or east/west for the upper road.';
    for(const d of [side,side+2]){let i=t;for(let k=0;k<2;k++){i=neighbour(pz,i,d);if(i<0||pz.bAt[i]>=0||isBuilding(pz,sim,i)||n.reserved[i]>=0||!roadAllowed(pz,i,tier)||n.tier[i]&&n.tier[i]!==tier)return 'The lower road needs two clear collector approach tiles on each side.';approaches.push(i);}}
    for(const d of [axis,axis+2]){let i=t;for(let k=0;k<2;k++){i=neighbour(pz,i,d);if(i<0||!n.tier[i]||pz.bAt[i]>=0)return 'The upper road needs two existing straight approach tiles on each side.';}}
    const cost=OVERPASS_COST-n.rbPaid[t]+approaches.reduce((sum,i)=>sum+(n.tier[i]?0:buildCost(pz,i,tier)),0);
    if(cost>sim.credits)return `That needs ${cost} credits; you have ${sim.credits}.`;
    sim.credits-=cost;n.over[t]={axis,tier};n.control[t]='overpass';n.rb[t]=0;n.rbPaid[t]=OVERPASS_COST;
    for(let i=0;i<n.reserved.length;i++)if(n.reserved[i]===t)n.reserved[i]=-1;
    for(const i of approaches)if(!n.tier[i]){n.tier[i]=tier;n.paid[i]=buildCost(pz,i,tier);n.built[i]=sim.day;}
    for(const d of [side,side+2]){const i=neighbour(pz,t,d),j=neighbour(pz,i,d);join(pz,sim,t,i);join(pz,sim,i,j);}
    return null;
  }

  // ---- the road graph ---------------------------------------------------------------------------------------------------
  // Cached per network version (not cloned with the state). out[a] lists the tiles a vehicle may drive to from a.
  const graphs=new WeakMap();
  function graph(pz,sim){
    let c=graphs.get(sim);if(c&&c.ver===sim.ver)return c.g;
    const N=pz.W*pz.H,n=sim.net,out=new Array(N),ticks=new Int16Array(N),cap=new Int16Array(N),shared=new Uint8Array(N),bld=new Uint8Array(N);
    for(let i=0;i<N;i++){
      out[i]=[];
      const b=isBuilding(pz,sim,i);bld[i]=b&&!n.tier[i]?1:0;
      if(!n.tier[i]&&!b)continue;
      for(let d=0;d<4;d++)if(n.e[i]&(1<<d)&&!(n.blk[i]&(1<<d))){const j=neighbour(pz,i,d);if(j>=0&&(n.tier[j]||isBuilding(pz,sim,j)))out[i].push(j);}
      if(b&&!n.tier[i]){ticks[i]=BUILDING_TICKS;cap[i]=999;continue;}
      const R=ROADS[n.tier[i]],junction=popcount(n.e[i])>=3;
      if(junction){shared[i]=n.rb[i]?0:1;ticks[i]=R.ticks+(n.rb[i]?0:JUNCTION_TICKS);cap[i]=R.cap;}
      else{ticks[i]=R.ticks;cap[i]=R.cap*(isOneWay(pz,sim,i)?2:1);}
    }
    if(pz.logistics)for(let i=0;i<N;i++)if(n.tier[i]){
      const tier=n.tier[i];ticks[i]=tier===1?5:tier===2?2:tier===3?1:3;
      if(n.over[i]||tier===3||n.control[i]==='signal'||n.control[i]==='roundabout')shared[i]=0;
      if(shared[i])cap[i]=1;
      if(n.control[i]==='roundabout')cap[i]=1;
    }
    const laneCap=new Int16Array(N*4);for(let i=0;i<N;i++)for(let d=0;d<4;d++)laneCap[i*4+d]=n.over[i]?ROADS[roadTier(sim,i,d)].cap:cap[i];
    const g={N,out,ticks,cap,shared,bld,laneCap};
    graphs.set(sim,{ver:sim.ver,g,dist:new Map(),key:''});
    return g;
  }
  // A road tile is a one-way stretch (double capacity) when every join it has is blocked in one direction.
  function isOneWay(pz,sim,i){
    const n=sim.net;if(!n.e[i])return false;
    for(let d=0;d<4;d++)if(n.e[i]&(1<<d)){
      const j=neighbour(pz,i,d);
      if(!(n.blk[i]&(1<<d))&&!(j>=0&&n.blk[j]&(1<<OPP(d))))return false;
    }
    return true;
  }
  // Binary-heap Dijkstra from src. Buildings without an explicit through road remain endpoints.
  function dijkstra(g,src,weight){
    const N=g.N,dist=new Float64Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1),hc=[],hn=[];
    const push=(c,v)=>{let i=hc.length;hc.push(c);hn.push(v);while(i>0){const p=(i-1)>>1;if(hc[p]<hc[i]||(hc[p]===hc[i]&&hn[p]<=hn[i]))break;[hc[p],hc[i]]=[hc[i],hc[p]];[hn[p],hn[i]]=[hn[i],hn[p]];i=p;}};
    const pop=()=>{const c=hc[0],v=hn[0],lc=hc.pop(),lv=hn.pop();if(hc.length){hc[0]=lc;hn[0]=lv;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;
      if(l<hc.length&&(hc[l]<hc[m]||(hc[l]===hc[m]&&hn[l]<hn[m])))m=l;if(r<hc.length&&(hc[r]<hc[m]||(hc[r]===hc[m]&&hn[r]<hn[m])))m=r;if(m===i)break;
      [hc[m],hc[i]]=[hc[i],hc[m]];[hn[m],hn[i]]=[hn[i],hn[m]];i=m;}}return [c,v];};
    dist[src]=0;push(0,src);
    while(hc.length){
      const [d,a]=pop();if(d>dist[a])continue;if(a!==src&&g.bld[a])continue;
      const o=g.out[a];for(let k=0;k<o.length;k++){const b=o[k],nd=d+weight(b);if(nd<dist[b]){dist[b]=nd;prev[b]=a;push(nd,b);}}
    }
    return {dist,prev};
  }
  const pathTo=(res,dst)=>{if(res.dist[dst]===Infinity)return null;if(res.paths)return res.paths(dst);const p=[dst];let c=dst;while(res.prev[c]>=0){c=res.prev[c];p.push(c);}return p.reverse();};
  // Travel-time distances given the traffic snapshot (refreshed once a simulated second).
  function routes(pz,sim,src){
    const g=graph(pz,sim),c=graphs.get(sim),key=sim.loadVer;
    if(c.key!==key){c.dist=new Map();c.key=key;}
    let r=c.dist.get(src);
    if(!r){const L=sim.load;r=pz.logistics?travelRoutes(pz,sim,src,L):dijkstra(g,src,b=>g.ticks[b]*(1+1.5*L[b]));c.dist.set(src,r);}
    return r;
  }
  // Free-flow distances (no traffic), cached per network version.
  function freeRoutes(pz,sim,src){
    const g=graph(pz,sim),c=graphs.get(sim);if(!c.free)c.free=new Map();
    let r=c.free.get(src);if(!r){r=pz.logistics?travelRoutes(pz,sim,src):dijkstra(g,src,b=>g.ticks[b]);c.free.set(src,r);}
    return r;
  }
  function travelStep(pz,sim,cur,next,heading,run,stopped=false){
    const d=dirTo(pz,cur,next),tier=roadTier(sim,next,d),turn=heading>=0&&heading!==d;
    const junction=isJunction(sim,next)&&!sim.net.over[next]&&tier!==3&&tier!==5,c=sim.net.control[next];
    let straight=turn||stopped||isBuilding(pz,sim,cur)?0:run;
    if(roadTier(sim,cur,d)!==tier)straight=0;
    let ticks=tier===1?5:tier===2?2:tier===3?Math.max(1,5-straight):3;
    if(turn)ticks+=tier===3?5:tier===2?2:0;
    if(junction){ticks+=c==='stop'?3:c==='roundabout'?4:2;straight=0;}
    if(isBuilding(pz,sim,next)&&!sim.net.tier[next])ticks=BUILDING_TICKS;
    return {ticks,run:Math.min(4,straight+1),dir:d};
  }
  function travelRoutes(pz,sim,src,load){
    const g=graph(pz,sim),dist=new Float64Array(g.N).fill(Infinity),best=new Int32Array(g.N).fill(-1),prev=new Map(),cost=new Map(),heap=[];
    const push=(key,value)=>{let i=heap.length;heap.push([value,key]);while(i){const p=(i-1)>>1;if(heap[p][0]<value||heap[p][0]===value&&heap[p][1]<=key)break;heap[i]=heap[p];i=p;heap[i]=[value,key];}};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){let m=i,l=2*i+1,r=l+1;for(const j of [l,r])if(j<heap.length&&(heap[j][0]<heap[m][0]||heap[j][0]===heap[m][0]&&heap[j][1]<heap[m][1]))m=j;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m;}}return top;};
    const start=src*25+20;cost.set(start,0);push(start,0);
    while(heap.length){const [value,key]=pop();if(value!==cost.get(key))continue;const cur=Math.floor(key/25),state=key%25,heading=Math.floor(state/5),run=state%5;
      if(value<dist[cur]){dist[cur]=value;best[cur]=key;}
      if(cur!==src&&g.bld[cur])continue;
      for(const next of g.out[cur]){const dir=dirTo(pz,cur,next);if(heading<4&&dir===OPP(heading))continue;if(sim.net.over[cur]&&heading<4&&dir!==heading)continue;
        const step=travelStep(pz,sim,cur,next,heading===4?-1:heading,run),nk=next*25+dir*5+step.run;
        const controlWait=isJunction(sim,next)?sim.net.control[next]==='signal'?4:sim.net.control[next]==='stop'?2:0:0;
        const nv=value+(step.ticks+controlWait)*(1+1.5*(load?.[next]||0));if(nv<(cost.get(nk)??Infinity)){cost.set(nk,nv);prev.set(nk,key);push(nk,nv);}
      }
    }
    return {dist,paths:dst=>{let key=best[dst];if(key<0)return null;const path=[];while(key!==undefined){path.push(Math.floor(key/25));key=prev.get(key);}return path.reverse();}};
  }
  // Tiles on the shortest path ignoring one-way rules and traffic (the baseline for detours).
  function plainTiles(pz,sim,src,dst){
    const N=pz.W*pz.H,seen=new Int32Array(N).fill(-1),q=[src];seen[src]=0;
    for(let h=0;h<q.length;h++){const a=q[h];if(a===dst)return seen[a];if(a!==src&&isBuilding(pz,sim,a)&&!sim.net.tier[a])continue;
      for(let d=0;d<4;d++)if(sim.net.e[a]&(1<<d)){const b=neighbour(pz,a,d);if(b>=0&&seen[b]<0){seen[b]=seen[a]+1;q.push(b);}}}
    return -1;
  }

  // ---- the day ------------------------------------------------------------------------------------------------------------
  const demTicks=(pz,day)=>Math.max(8,Math.round(pz.dem*Math.pow(1-pz.growth,day-1)/TICK));
  const growthCredit=(pz,day)=>pz.stations.filter(s=>s.day===day&&day>1).length*GROWTH_CREDIT;
  const patienceTicks=(pz,sim)=>Math.round(pz.patience*(sim.relaxed?RELAXED:1)/TICK);
  function startDay(pz,sim){
    if(sim.phase!=='night')return false;
    sim.log[sim.day-1]=sim.tonight.slice();sim.phase='day';sim.tick=0;sim.report=null;sim.ver++;
    const N=pz.W*pz.H;
    sim.ds={deliveries:0,score0:sim.score,jam:new Array(N).fill(0),busy:new Array(N).fill(0),full:new Array(pz.stations.length).fill(0),
      wait:new Array(pz.stations.length).fill(0),waitType:new Array(pz.stations.length).fill(-1),
      detour:new Array(pz.stations.length).fill(0),detourPath:new Array(pz.stations.length).fill(null),fromWh:0,oneway:0};
    sim.load.fill(0);sim.q.fill(0);sim.loadVer++;
    const dt=demTicks(pz,sim.day);
    pz.stations.forEach((s,i)=>{if(s.kind==='consumer'&&s.day===sim.day)sim.st[i].dacc=(i*13)%dt;});
    return true;
  }
  function stockOf(pz,sim,tile,type){
    const id=stationAt(pz,sim,tile);if(id>=0)return pz.stations[id].kind==='producer'&&pz.stations[id].type===type?sim.st[id].stock:0;
    const k=whAt(sim,tile);return k>=0?sim.wh[k].stock[type]:0;
  }
  function take(pz,sim,tile,type,n){
    const id=stationAt(pz,sim,tile);if(id>=0){sim.st[id].stock+=n;return;}
    const k=whAt(sim,tile);if(k>=0)sim.wh[k].stock[type]+=n;
  }
  function newVehicle(sim,kind,home,dst,type,path,req){
    const v={id:sim.vid++,kind,home,dst,type,path,i:0,t:0,wait:0,slot:-1,req,heading:-1,run:0};sim.veh.push(v);return v;
  }
  function production(pz,sim){
    for(const s of pz.stations){if(s.day>sim.day)continue;const x=sim.st[s.id];
      if(s.kind==='producer'){
        if(x.stock+outbound(sim,s.tile)>=OUTPUT_CAP){sim.ds.full[s.id]++;continue;}
        if(s.recipe){
          const ready=Object.entries(s.recipe.input).every(([t,n])=>x.input[t]>=n);
          if(ready&&++x.acc>=s.recipe.ticks){for(const [t,n] of Object.entries(s.recipe.input))x.input[t]-=n;x.stock++;x.acc=0;}
          for(const [t,n] of Object.entries(s.recipe.input)){
            const pending=x.reqs.filter(r=>r.type===Number(t)).length,target=n*2;
            for(let k=x.input[t]+pending;k<target;k++)x.reqs.push({type:Number(t),age:0,v:0,input:true});
          }
        }else if(++x.acc>=(sim.tick<40?pz.prodTicks/2:pz.prodTicks)){x.acc=0;x.stock++;}
      }else{
        for(const event of schedule(pz,sim.day,s.id,sim.relaxed))if(event.tick===sim.tick)for(let k=0;k<event.qty;k++)x.reqs.push({type:event.type,age:0,v:0,peak:event.label==='Dispatch peak',deadline:event.deadline});
        for(const r of x.reqs){r.age++;const late=r.late||(r.deadline!==undefined?sim.tick>r.deadline:r.age>=patienceTicks(pz,sim));if(late){r.late=true;if(!x.starved){x.starved=true;sim.fx.push({kind:'starve',st:s.id});}}}
      }
    }
  }
  function warehouseOrders(pz,sim){
    for(const w of sim.wh){const plan=w.plan;if(!plan)continue;
      const destination=pz.stations[plan.target],used=w.stock.reduce((a,b)=>a+b,0)+w.inc.reduce((a,b)=>a+b,0)+outbound(sim,w.tile);
      if(used>=w.cap||w.stock[plan.type]+w.inc[plan.type]>=plan.qty)continue;
      const peak=schedule(pz,sim.day,plan.target).find(e=>e.label==='Dispatch peak');
      if(destination.kind==='consumer'&&peak&&sim.tick>peak.tick&&!sim.st[destination.id].reqs.some(r=>r.peak&&!r.late))continue;
      let source=-1,best=Infinity;
      for(const s of pz.stations){if(s.kind!=='producer'||s.type!==plan.type||s.day>sim.day||sim.st[s.id].stock<=0)continue;
        const distance=routes(pz,sim,s.tile).dist[w.tile];if(distance<best){source=s.tile;best=distance;}}
      if(source>=0){take(pz,sim,source,plan.type,-1);w.inc[plan.type]++;newVehicle(sim,'stock',source,w.tile,plan.type,pathTo(routes(pz,sim,source),w.tile),-1);}
    }
  }
  function outbound(sim,tile){return sim.veh.filter(v=>v.kind!=='home'&&!v.dead&&v.home===tile).length;}
  function movementMask(incoming,outgoing){
    const first=[4,8,1,2],second=[2,4,8,1],third=[1,2,4,8],turn=(outgoing-incoming+4)%4;
    return first[incoming]|(turn===1?0:second[incoming])|(turn===3?third[incoming]:0);
  }
  function admission(pz,sim,v,cur,next){
    if(!pz.logistics||!isJunction(sim,next)||sim.net.over[next]||sim.net.tier[next]===3)return {allowed:true,mask:0};
    const d=dirTo(pz,cur,next),exit=dirTo(pz,next,v.path[v.i+2]),control=sim.net.control[next],mask=movementMask(d,exit<0?d:exit);
    if(control==='stop')return {allowed:v.wait>=2,mask:0};
    if(control==='signal'){
      const phase=sim.tick%24,green=phase<10?0:phase>=12&&phase<22?1:-1;
      if(d%2!==green)return {allowed:false,mask};
      for(const other of sim.veh)if(other!==v&&other.slot>=0&&other.path[other.i]===next){const heading=other.slot%4,out=dirTo(pz,next,other.path[other.i+1]);if(mask&movementMask(heading,out<0?heading:out))return {allowed:false,mask};}
      return {allowed:true,mask};
    }
    if(control==='roundabout')return {allowed:sim.occ.slice(next*4,next*4+4).reduce((a,b)=>a+b,0)<2&&sim.occ[next*4+((d+3)&3)]===0,mask:0};
    return {allowed:true,mask:0};
  }
  function step(pz,sim){
    if(sim.phase!=='day')return;
    const g=graph(pz,sim),S=pz.stations,ds=sim.ds,occ=sim.occ;sim.fx=[];
    // The traffic estimate used for route choice refreshes once a simulated second.
    if(sim.tick%LOAD_EVERY===0){
      for(let i=0;i<g.N;i++){if(!g.out[i].length&&!g.bld[i]){sim.load[i]=0;continue;}const o=occ[i*4]+occ[i*4+1]+occ[i*4+2]+occ[i*4+3];sim.load[i]=g.bld[i]?0:(o+sim.q[i])/(g.cap[i]*(g.shared[i]?1:2));}
      sim.loadVer++;
    }
    // Production and demand.
    const dt=demTicks(pz,sim.day),pt=patienceTicks(pz,sim);
    if(pz.logistics)production(pz,sim);
    else for(let i=0;i<S.length;i++){
      if(S[i].day>sim.day)continue;const s=S[i],x=sim.st[i];
      if(s.kind==='producer'){
        if(x.stock>=PROD_CAP)ds.full[i]++;
        else if(++x.acc>=pz.prodTicks){x.acc=0;x.stock++;}
      }else{
        if(++x.dacc>=dt){x.dacc=0;if(x.reqs.length<MAX_OPEN){x.reqs.push({type:s.needs[x.next%s.needs.length],age:0,v:0});x.next++;}}
        for(const r of x.reqs){r.age++;if(r.age>=pt&&!x.starved){x.starved=true;sim.fx.push({kind:'starve',st:i});}}
      }
    }
    if(pz.logistics)warehouseOrders(pz,sim);
    // Dispatch: every waiting request is served by the nearest eligible source holding its item.
    const sources=[];for(let i=0;i<S.length;i++)if(S[i].kind==='producer'&&S[i].day<=sim.day&&g.out[S[i].tile].length)sources.push(S[i].tile);
    for(const w of sim.wh)if(g.out[w.tile].length)sources.push(w.tile);
    for(let i=0;i<S.length;i++){
      if((!pz.logistics&&S[i].kind!=='consumer')||S[i].day>sim.day)continue;
      const c=S[i].tile;
      for(const r of pz.logistics?[...sim.st[i].reqs].sort((a,b)=>Number(!!a.late)-Number(!!b.late)):sim.st[i].reqs){
        if(r.v)continue;
        let best=-1,bd=Infinity;
        for(const src of sources){if(src===c||stockOf(pz,sim,src,r.type)<=0)continue;
          const w=sim.wh[whAt(sim,src)];if(pz.logistics&&w?.plan&&w.plan.type===r.type&&(w.plan.target!==i||!r.input&&(!r.peak||r.late)))continue;
          const d=routes(pz,sim,src).dist[c];if(d<bd){bd=d;best=src;}}
        if(best<0)continue;
        take(pz,sim,best,r.type,-1);
        const v=newVehicle(sim,'deliver',best,c,r.type,pathTo(routes(pz,sim,best),c),i);r.v=v.id;
        if(whAt(sim,best)>=0)ds.fromWh++;
      }
    }
    // Surplus: a full producer sends one item to the nearest warehouse with room.
    if(!pz.logistics&&sim.wh.length)for(let i=0;i<S.length;i++){
      const s=S[i];if(s.kind!=='producer'||s.day>sim.day||sim.st[i].stock<PROD_CAP||!g.out[s.tile].length)continue;
      const R=routes(pz,sim,s.tile);let best=-1,bd=Infinity;
      for(let k=0;k<sim.wh.length;k++){const w=sim.wh[k],used=w.stock.reduce((a,b)=>a+b,0)+w.inc.reduce((a,b)=>a+b,0);if(used<w.cap&&R.dist[w.tile]<bd){bd=R.dist[w.tile];best=k;}}
      if(best<0)continue;
      sim.st[i].stock--;sim.wh[best].inc[s.type]++;newVehicle(sim,'stock',s.tile,sim.wh[best].tile,s.type,pathTo(R,sim.wh[best].tile),-1);
    }
    // Reserve simultaneous departures before admitting arrivals, so even a full loop can advance without overfilling.
    const q=new Array(g.N).fill(0),moves=[];let dead=false;
    for(const v of sim.veh){
      if(v.t>0&&--v.t>0)continue;
      const cur=v.path[v.i],nxt=v.path[v.i+1];
      if(v.i+1===v.path.length-1){
        if(v.slot>=0)occ[v.slot]--;v.slot=-1;
        arrive(pz,sim,v,nxt);if(v.dead)dead=true;continue;
      }
      const d=dirTo(pz,cur,nxt);
      const gate=admission(pz,sim,v,cur,nxt);
      moves.push({v,nxt,slot:nxt*4+d,accepted:false,...gate});
    }
    const key=slot=>g.shared[slot>>2]?slot&~3:slot,projected=occ.slice(),outgoing=new Map(),reserved=[];
    for(let i=0;i<g.N;i++)if(g.shared[i]){projected[i*4]+=projected[i*4+1]+projected[i*4+2]+projected[i*4+3];projected.fill(0,i*4+1,i*4+4);}
    moves.sort((a,b)=>b.v.wait-a.v.wait||a.v.id-b.v.id);
    for(const m of moves){
      if(m.v.slot<0||!m.allowed)continue;
      const k=key(m.v.slot);if(!outgoing.has(k))outgoing.set(k,[]);outgoing.get(k).push(m);
    }
    function reserve(m){
      if(!m.allowed||m.mask&&reserved.some(r=>r.nxt===m.nxt&&(r.mask&m.mask)))return false;
      if(pz.logistics&&sim.net.control[m.nxt]==='roundabout'&&reserved.filter(r=>r.nxt===m.nxt).length+occ.slice(m.nxt*4,m.nxt*4+4).reduce((a,b)=>a+b,0)>=2)return false;
      const start=reserved.length,k=key(m.slot);m.accepted=true;reserved.push(m);
      if(m.v.slot>=0)projected[key(m.v.slot)]--;
      projected[k]++;
      // Reserve a departure to make room; a full cycle can release all its spaces together.
      for(const next of outgoing.get(k)||[]){
        if(projected[k]<=g.laneCap[k])break;
        if(!next.accepted)reserve(next);
      }
      if(projected[k]<=g.laneCap[k])return true;
      while(reserved.length>start){
        const r=reserved.pop();r.accepted=false;projected[key(r.slot)]--;
        if(r.v.slot>=0)projected[key(r.v.slot)]++;
      }
      return false;
    }
    for(const m of moves)if(!m.accepted)reserve(m);
    for(const m of moves)if(m.accepted&&m.v.slot>=0)occ[m.v.slot]--;
    for(const m of moves){
      const {v,nxt}=m;
      if(!m.accepted){v.wait++;q[nxt]++;if(q[nxt]===1)ds.jam[nxt]++;continue;}
      const cur=v.path[v.i],heading=v.heading??(v.i?dirTo(pz,v.path[v.i-1],cur):-1),travel=pz.logistics?travelStep(pz,sim,cur,nxt,heading,v.run||0,v.wait>0):null;
      v.slot=m.slot;occ[v.slot]++;v.i++;v.t=travel?travel.ticks:g.ticks[nxt];v.total=v.t;v.heading=travel?.dir??dirTo(pz,cur,nxt);v.run=travel?.run||0;v.wait=0;
    }
    if(dead)sim.veh=sim.veh.filter(v=>!v.dead);
    sim.q=q;
    for(let i=0;i<g.N;i++){if(occ[i*4]+occ[i*4+1]+occ[i*4+2]+occ[i*4+3])ds.busy[i]++;}
    sim.tick++;
    if(sim.tick>=pz.dayTicks)dusk(pz,sim);
  }
  function arrive(pz,sim,v,tile){
    const ds=sim.ds;
    if(v.kind==='deliver'){
      const x=sim.st[v.req],k=x.reqs.findIndex(r=>r.v===v.id),req=x.reqs[k];
      if(k>=0){const r=x.reqs[k];x.reqs.splice(k,1);if(r.age>ds.wait[v.req]){ds.wait[v.req]=r.age;ds.waitType[v.req]=r.type;}}
      const input=pz.logistics&&pz.stations[v.req].kind==='producer';
      if(input)x.input[v.type]++;
      else{sim.deliveries++;if(!pz.logistics||!req?.late&&(req?.deadline===undefined||sim.tick<=req.deadline))sim.score++;else ds.late=(ds.late||0)+1;ds.deliveries++;sim.credits+=DELIVERY_CREDIT;}
      sim.fx.push({kind:'deliver',tile,type:v.type,st:v.req});
      // How far out of its way the vehicle went, against the plainest route.
      const id=pz.bAt[v.home],base=plainTiles(pz,sim,v.home,tile),det=base>=0?v.path.length-1-base:0;
      const key=id>=0&&isActive(pz,sim,id)?id:-1;
      if(key>=0&&det>ds.detour[key]){ds.detour[key]=det;ds.detourPath[key]=v.path.slice();}
    }else if(v.kind==='stock'){
      const k=whAt(sim,tile);if(k>=0){sim.wh[k].inc[v.type]--;sim.wh[k].stock[v.type]++;}
      sim.fx.push({kind:'stock',tile,type:v.type});
    }
    if(v.kind==='home'){v.dead=true;return;}
    const p=pathTo(routes(pz,sim,tile),v.home);
    if(!p){v.dead=true;return;}
    v.kind='home';v.dst=v.home;v.path=p;v.i=0;v.t=BUILDING_TICKS;v.wait=0;v.req=-1;v.run=0;v.heading=-1;
  }
  function dusk(pz,sim){
    const ds=sim.ds,S=pz.stations;
    // Vehicles still out are recalled: their cargo goes back where it came from.
    for(const v of sim.veh){
      if(v.kind==='deliver'){take(pz,sim,v.home,v.type,1);const r=sim.st[v.req].reqs.find(x=>x.v===v.id);if(r)r.v=0;}
      else if(v.kind==='stock'){take(pz,sim,v.home,v.type,1);const k=whAt(sim,v.dst);if(k>=0)sim.wh[k].inc[v.type]--;}
    }
    sim.veh=[];sim.occ.fill(0);sim.q.fill(0);
    const starved=[];
    for(let i=0;i<S.length;i++){
      if(S[i].day>sim.day||!pz.logistics&&S[i].kind!=='consumer')continue;const x=sim.st[i];
      for(const r of x.reqs){if(r.age>ds.wait[i]){ds.wait[i]=r.age;ds.waitType[i]=r.type;}r.age=0;r.v=0;delete r.deadline;}
      if(x.starved)starved.push(i);x.starved=false;
    }
    const clean=!starved.length;if(clean){sim.cleanDays++;sim.score+=CLEAN_BONUS;}
    const grant=growthCredit(pz,sim.day+1);
    sim.credits+=STIPEND+grant;
    let worst=null;for(const i of starved)if(!worst||ds.wait[i]<worst.ticks)worst={st:i,type:ds.waitType[i],ticks:ds.wait[i]};
    const summary={day:sim.day,deliveries:ds.deliveries,clean,starved,worst,score:sim.score-ds.score0,fromWh:ds.fromWh,grant};
    sim.days.push(summary);
    sim.report={day:sim.day,summary,problems:problems(pz,sim),ds};
    sim.day++;sim.tick=0;
    if(sim.day>pz.days)sim.phase='done';
    else{sim.phase='night';enterNight(pz,sim);}
  }
  function runDay(pz,sim){if(sim.phase==='night')startDay(pz,sim);while(sim.phase==='day')step(pz,sim);return sim;}
  // Skip to dusk: the rest of the day at once, with the same result as watching it.
  function skipToDusk(pz,sim){while(sim.phase==='day')step(pz,sim);return sim;}

  // ---- the end-of-day report -----------------------------------------------------------------------------------------------
  function nearestStation(pz,sim,idx){
    const x=idx%pz.W,y=(idx-x)/pz.W;let best=null,bd=Infinity;
    for(const s of pz.stations)if(s.day<=sim.day){const d=Math.abs(s.x-x)+Math.abs(s.y-y);if(d<bd){bd=d;best=s;}}
    return best;
  }
  function placeName(pz,sim,idx){
    const near=nearestStation(pz,sim,idx),by=near?` near ${near.name}`:'';
    if(pz.terrain[idx]===T_RIVER)return `The Ash bridge${by}`;
    if(isJunction(sim,idx))return `The ${sim.net.rb[idx]?'roundabout':'junction'}${by}`;
    return `The road${by}`;
  }
  function problems(pz,sim){
    const ds=sim.ds,S=pz.stations,out=[],ticks=pz.dayTicks,pt=patienceTicks(pz,sim);
    // Consumers with a need nothing can reach.
    for(const s of S)if((s.kind==='consumer'||pz.logistics&&s.recipe)&&s.day<=sim.day)for(const t of s.needs){
      const ok=S.some(p=>p.kind==='producer'&&p.type===t&&p.day<=sim.day&&freeRoutes(pz,sim,p.tile).dist[s.tile]<Infinity)||
        sim.wh.some(w=>freeRoutes(pz,sim,w.tile).dist[s.tile]<Infinity&&w.stock[t]>0);
      if(!ok)out.push({kind:'unlinked',sev:200,text:`${s.name} has no road from a ${TYPES[t].sym} maker`,tiles:[s.tile],st:s.id});
    }
    if(pz.logistics)for(const s of S)if(s.recipe&&s.day<=sim.day){const missing=s.needs.filter(t=>sim.st[s.id].input[t]<(s.recipe.input[t]||1));if(missing.length)out.push({kind:'input',sev:80,text:`${s.name} needs ${missing.map(t=>supply(t)).join(' and ')} to produce ${supply(s.type)}`,tiles:[s.tile],st:s.id});}
    // Congested tiles, one per neighbourhood.
    const hot=[];for(let i=0;i<ds.jam.length;i++)if(ds.jam[i]/ticks>=0.12)hot.push(i);
    hot.sort((a,b)=>ds.jam[b]-ds.jam[a]||a-b);
    const picked=[];
    for(const i of hot){
      if(picked.some(j=>Math.abs(j%pz.W-i%pz.W)+Math.abs(Math.floor(j/pz.W)-Math.floor(i/pz.W))<=2))continue;
      picked.push(i);if(picked.length>=3)break;
      const pct=Math.round(ds.jam[i]/ticks*100);
      out.push({kind:'jam',sev:pct,text:`${placeName(pz,sim,i)} was congested ${pct}% of the day`,tiles:[i]});
    }
    // Long waits.
    for(const s of S)if(s.kind==='consumer'&&s.day<=sim.day&&ds.wait[s.id]>=pt*0.5&&ds.waitType[s.id]>=0){
      const sec=Math.round(ds.wait[s.id]*TICK),star=ds.wait[s.id]>=pt;
      out.push({kind:'wait',sev:Math.round(ds.wait[s.id]/pt*60),text:`${s.name} waited ${sec} s for ${TYPES[ds.waitType[s.id]].sym}${star?' and starved':''}`,tiles:[s.tile],st:s.id});
    }
    // Detours.
    for(const s of S)if(s.kind==='producer'&&ds.detour[s.id]>=3){
      out.push({kind:'detour',sev:ds.detour[s.id]*6,text:`Vehicles from ${s.name} detoured ${ds.detour[s.id]} tiles`,tiles:ds.detourPath[s.id]||[s.tile],st:s.id});
    }
    // Producers that sat full.
    for(const s of S)if(s.kind==='producer'&&s.day<=sim.day&&ds.full[s.id]/ticks>=0.3){
      const pct=Math.round(ds.full[s.id]/ticks*100);
      out.push({kind:'full',sev:Math.round(pct*0.4),text:`${s.name} sat full ${pct}% of the day: a warehouse or another customer would take its surplus`,tiles:[s.tile],st:s.id});
    }
    out.sort((a,b)=>b.sev-a.sev);
    return out.slice(0,3);
  }

  // ---- replay and scoring ---------------------------------------------------------------------------------------------------
  // Replays a list of nights (each a list of edits) and runs every day; missing nights build nothing.
  function replay(pz,nights,opts){
    const sim=create(pz,opts),errors=[];
    while(sim.phase!=='done'){
      for(const a of (nights&&nights[sim.day-1])||[]){const r=edit(pz,sim,a);if(r.why)errors.push({day:sim.day,why:r.why});}
      runDay(pz,sim);
    }
    sim.errors=errors;return sim;
  }
  function result(pz,sim){
    return {score:sim.score,deliveries:sim.deliveries,cleanDays:sim.cleanDays,daysRun:sim.days.length,finished:sim.phase==='done',
      starvedDays:sim.days.filter(d=>!d.clean).length,credits:sim.credits};
  }
  function simulate(pz,nights,opts){const sim=replay(pz,nights,opts);return {...result(pz,sim),sim};}
  const parCache=new WeakMap();
  function parFor(pz,relaxed){
    if(!relaxed)return pz.par;
    if(!parCache.has(pz))parCache.set(pz,simulate(pz,pz.plan,{relaxed:true}).score);
    return Math.max(pz.par,parCache.get(pz));
  }
  function tier(pz,res,relaxed){
    if(!res.deliveries)return 'failed';
    const par=parFor(pz,relaxed);
    if(res.score>=par)return 'perfect';
    if(res.score>=Math.ceil(par*0.85))return 'good';
    return 'partial';
  }
  function nearMiss(pz,sim,relaxed){
    const res=result(pz,sim),par=parFor(pz,relaxed);
    if(res.score>=par)return '';
    const gap=par-res.score,goodAt=Math.ceil(par*0.85);
    let line=res.score<goodAt&&goodAt-res.score<gap?`${goodAt-res.score} more points would have made Good; ${gap} would have matched par.`:`${gap} more point${gap===1?'':'s'} would have matched par (${par}).`;
    let best=null;for(const d of sim.days)if(!d.clean&&d.worst&&(!best||d.starved.length<best.starved.length||(d.starved.length===best.starved.length&&d.worst.ticks<best.worst.ticks)))best=d;
    if(best){
      const s=pz.stations[best.worst.st],lim=Math.round(patienceTicks(pz,sim)*TICK);
      line+=` Day ${best.day} lost its +${CLEAN_BONUS} clean-day bonus: ${s.name} waited ${Math.round(best.worst.ticks*TICK)} s for ${TYPES[best.worst.type]?.sym||'goods'} (limit ${lim} s)${best.starved.length>1?` and ${best.starved.length-1} more starved`:''}.`;
    }
    return line;
  }

  // ---- the planner (par, hints and Skip) ---------------------------------------------------------------------------------------
  // Cheapest buildable path from a to b for a plain road. Existing roads are reused at `reuse` per tile (respecting
  // one-way joins); `avoid` (0–1 per tile) makes busy tiles dearer; buildings other than the ends are never crossed.
  function buildPath(pz,sim,a,b,opts){
    const o=opts||{},N=pz.W*pz.H,n=sim.net,reuse=o.reuse??0.3,avoid=o.avoid,block=o.block;
    const dist=new Float64Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1),open=[a];dist[a]=0;
    const done=new Uint8Array(N);
    // N is small (≤ 216): a simple scan keeps it obviously deterministic.
    for(;;){
      let u=-1,ud=Infinity;for(const i of open)if(!done[i]&&(dist[i]<ud||(dist[i]===ud&&i<u))){ud=dist[i];u=i;}
      if(u<0||u===b)break;done[u]=1;
      if(u!==a&&isBuilding(pz,sim,u)&&!n.tier[u])continue;
      for(let d=0;d<4;d++){
        const v=neighbour(pz,u,d);if(v<0||done[v])continue;
        let c;
        if(v===b)c=0.01;
        else if(isBuilding(pz,sim,v)&&!n.tier[v])continue;
        else if(pz.terrain[v]===T_MOUNT)continue;
        else if(pz.logistics&&(pz.bAt[v]>=0&&pz.stations[pz.bAt[v]].tile!==v||n.reserved[v]>=0))continue;
        else if(n.tier[v]){
          if(n.tier[v]===3)continue;
          if(block&&block[v])continue;
          c=reuse*(1+(avoid?avoid[v]*8:0));
        }else c=buildCost(pz,v,2)+0.02;
        // One-way joins can only be driven forwards.
        if(n.e[u]&(1<<d)&&(n.blk[u]&(1<<d)))continue;
        if(n.tier[u]&&n.tier[v]&&!(n.e[u]&(1<<d))&&o.noNewJoins)c+=4;
        if(isJunction(sim,v)&&!(n.e[u]&(1<<d)))c+=0.5;
        const nd=dist[u]+c;
        if(nd<dist[v]){if(dist[v]===Infinity)open.push(v);dist[v]=nd;prev[v]=u;}
      }
    }
    if(dist[b]===Infinity)return null;
    const p=[b];let c=b;while(prev[c]>=0){c=prev[c];p.push(c);}
    return p.reverse();
  }
  const pathCost=(pz,sim,tiles)=>{let c=0;for(const t of tiles)if(!sim.net.tier[t]&&!isBuilding(pz,sim,t))c+=buildCost(pz,t,2);return c;};
  const reachable=(pz,sim,from,to)=>freeRoutes(pz,sim,from).dist[to]<Infinity;
  // Links every consumer's unserved need to the producer of that type with the cheapest road. Applies the edits to sim.
  function connectPass(pz,sim,out){
    const S=pz.stations,acts=[];
    let more=true;
    while(more){
      more=false;const cands=[];
      for(const c of S){
        if((c.kind!=='consumer'&&!(pz.logistics&&c.recipe))||c.day>sim.day)continue;
        for(const t of c.needs){
          if(S.some(p=>p.kind==='producer'&&p.type===t&&p.day<=sim.day&&reachable(pz,sim,p.tile,c.tile)&&reachable(pz,sim,c.tile,p.tile)))continue;
          for(const p of S){if(p.kind!=='producer'||p.type!==t||p.day>sim.day)continue;
            const path=buildPath(pz,sim,p.tile,c.tile);if(!path)continue;
            cands.push({c,t,p,path,cost:pathCost(pz,sim,path)});}
        }
      }
      if(!cands.length)break;
      cands.sort((x,y)=>x.cost-y.cost||x.path.length-y.path.length||x.c.id-y.c.id||x.p.id-y.p.id);
      for(const k of cands){
        const a={type:'road',tier:pz.logistics?'local':'road',tiles:k.path},r=edit(pz,sim,a);
        if(r.why)continue;
        acts.push({act:a,kind:'link',gain:100,text:`${k.c.name} needs ${TYPES[k.t].sym} and no road brings it. Link it to ${k.p.name}${r.cost?` (${r.cost} credits)`:''}.`});
        more=true;break;
      }
    }
    if(out)out.push(...acts);
    return acts;
  }
  // A preview of the next day: deliveries plus the clean-day bonus, minus a little for waiting.
  function preview(pz,sim,days){
    const c=clone(sim);let value=0,report=null,day=null;
    for(let k=0;k<(days||1)&&c.phase==='night';k++){
      runDay(pz,c);day=c.days[c.days.length-1];report=report||c.report;
      let wait=0;for(const w of c.report.ds.wait)wait+=w;
      value+=day.score-wait*TICK/200;
    }
    return {value,report,day};
  }
  function candidates(pz,sim,base){
    const ds=base.report.ds,S=pz.stations,out=[],ticks=pz.dayTicks,N=pz.W*pz.H;
    const avoid=new Array(N).fill(0);for(let i=0;i<N;i++)avoid[i]=Math.min(1,(ds.jam[i]+ds.busy[i]*0.25)/ticks);
    const hot=[];for(let i=0;i<N;i++)if(sim.net.tier[i]&&ds.jam[i]/ticks>=0.08)hot.push(i);
    hot.sort((a,b)=>ds.jam[b]-ds.jam[a]||a-b);
    // The pairs that waited longest, served from their nearest connected producer.
    const pairs=[];
    for(const c of S){if(c.kind!=='consumer'||c.day>sim.day)continue;
      for(const t of c.needs){let best=null,bd=Infinity;
        for(const p of S)if(p.kind==='producer'&&p.type===t&&p.day<=sim.day){const d=freeRoutes(pz,sim,p.tile).dist[c.tile];if(d<bd){bd=d;best=p;}}
        if(best&&bd<Infinity)pairs.push({c,p:best,t,w:ds.wait[c.id],d:bd});}}
    pairs.sort((a,b)=>b.w-a.w||b.d-a.d||a.c.id-b.c.id);
    const seenPath=new Set();
    const bypass=(p,c,block,why)=>{
      const path=buildPath(pz,sim,p.tile,c.tile,{reuse:0.6,avoid,block});
      if(!path)return;const key=path.join(',');if(seenPath.has(key))return;seenPath.add(key);
      const fresh=path.filter(t=>!sim.net.tier[t]&&!isBuilding(pz,sim,t));if(fresh.length<2)return;
      out.push({kind:'bypass',acts:[{type:'road',tier:'road',tiles:path}],text:`${why} A second road from ${p.name} to ${c.name} splits the traffic.`});
      // The same bypass as a one-way stretch (double capacity), outbound only; return trips keep the old road.
      const runs=[];let cur=null;
      for(let i=1;i<path.length;i++){const isNew=!sim.net.tier[path[i]]&&!isBuilding(pz,sim,path[i]);
        if(isNew){if(!cur)cur=[path[i-1]];cur.push(path[i]);}else if(cur){cur.push(path[i]);runs.push(cur);cur=null;}}
      if(runs.length)out.push({kind:'oneway',acts:[{type:'road',tier:'road',tiles:path},...runs.map(r=>({type:'oneway',tiles:r}))],
        text:`${why} A one-way road from ${p.name} toward ${c.name} carries double, and return trips keep the old road.`});
    };
    // Around each of the worst jams: a new road for a pair whose usual route runs through it.
    for(const h of hot.slice(0,2)){
      const pct=Math.round(ds.jam[h]/ticks*100),why=`${placeName(pz,sim,h)} was congested ${pct}% of the day.`;
      let n=0;
      for(const pr of pairs){if(n>=2)break;const path=pathTo(freeRoutes(pz,sim,pr.p.tile),pr.c.tile);if(!path||!path.includes(h))continue;
        const block=new Array(N).fill(0);block[h]=1;bypass(pr.p,pr.c,block,why);n++;}
    }
    // For the pairs that waited longest: a road that keeps clear of busy tiles.
    for(const pr of pairs.slice(0,2)){
      const block=new Array(N).fill(0);for(const h of hot.slice(0,4))block[h]=1;
      bypass(pr.p,pr.c,block,`${pr.c.name} waited ${Math.round(pr.w*TICK)} s for ${TYPES[pr.t].sym}.`);
    }
    // A roundabout at the busiest junction.
    let rbs=0;for(const h of hot)if(isJunction(sim,h)&&!sim.net.rb[h]&&rbs++<2){out.push({kind:'roundabout',acts:[{type:'roundabout',tile:h}],text:`${placeName(pz,sim,h)} was congested ${Math.round(ds.jam[h]/ticks*100)}% of the day. A roundabout stops it costing extra time.`});}
    // A warehouse near a consumer that waited, when a producer sat full: the surplus is stored close by.
    const fullP=S.filter(p=>p.kind==='producer'&&p.day<=sim.day&&ds.full[p.id]/ticks>=0.1);
    if(fullP.length&&sim.wh.length<3){
      const seenC=new Set();
      for(const pr of pairs){
        if(seenC.has(pr.c.id)||seenC.size>=2)continue;seenC.add(pr.c.id);
        const c=pr.c;let best=-1,bd=Infinity;
        for(let i=0;i<N;i++){
          if(sim.net.tier[i]||isBuilding(pz,sim,i)||pz.bAt[i]>=0||pz.terrain[i]!==T_GRASS&&pz.terrain[i]!==T_ROUGH)continue;
          let road=false;for(let d=0;d<4;d++){const b=neighbour(pz,i,d);if(b>=0&&sim.net.tier[b]&&popcount(sim.net.e[b])<3&&reachable(pz,sim,b,c.tile))road=true;}
          if(!road)continue;
          const dd=Math.abs(i%pz.W-c.x)+Math.abs(Math.floor(i/pz.W)-c.y);if(dd<bd){bd=dd;best=i;}
        }
        if(best>=0&&bd<=4)out.push({kind:'warehouse',days:2,acts:[{type:'warehouse',tile:best}],text:`${fullP[0].name} sat full while ${c.name} waited. A warehouse near ${c.name} stores the surplus close by.`});
      }
    }
    // An idle duplicate producer linked to the nearest consumer that uses its type.
    for(const p of S){if(p.kind!=='producer'||p.day>sim.day)continue;
      if(S.some(c=>c.kind==='consumer'&&c.day<=sim.day&&c.needs.includes(p.type)&&reachable(pz,sim,p.tile,c.tile)))continue;
      let best=null;for(const c of S)if(c.kind==='consumer'&&c.day<=sim.day&&c.needs.includes(p.type)){const path=buildPath(pz,sim,p.tile,c.tile);if(path&&(!best||pathCost(pz,sim,path)<best.cost))best={c,path,cost:pathCost(pz,sim,path)};}
      if(best)out.push({kind:'link2',acts:[{type:'road',tier:'road',tiles:best.path}],text:`${p.name} is not linked to anyone yet. A road to ${best.c.name} puts it to work.`});
    }
    return out;
  }
  // One night of planning, applied to sim. Returns the steps taken, in order, each with its reason.
  function planNight(pz,sim,opts){
    const o=opts||{},steps=[];
    connectPass(pz,sim,steps);
    if(pz.logistics){
      for(let i=0;i<sim.net.tier.length;i++)if(sim.net.tier[i]===4&&pz.bAt[i]<0&&!DIRS.some((_,d)=>{const b=neighbour(pz,i,d),id=b>=0?pz.bAt[b]:-1;return id>=0&&pz.stations[id].tile===b&&!pz.stations[id].large&&(sim.net.e[i]&(1<<d));})){
        const act={type:'road',tier:'road',tiles:[i]};if(!edit(pz,sim,act).why)steps.push({act,kind:'collector',text:'Keep local streets at small entrances and use collectors for through traffic.'});
      }
      return steps;
    }
    if(o.refine===false)return steps;
    for(let round=0;round<(o.rounds||5);round++){
      const base=preview(pz,sim);let base2=null,best=null;
      for(const c of candidates(pz,sim,base)){
        const t=clone(sim);let ok=true,cost=0;
        for(const a of c.acts){const r=edit(pz,t,a);if(r.why){ok=false;break;}cost+=r.cost;}
        if(!ok)continue;
        // Warehouses fill during their first day, so they are judged over two days.
        let gain;
        if(c.days>1){if(!base2)base2=preview(pz,sim,2);gain=(preview(pz,t,2).value-base2.value)/2;}
        else gain=preview(pz,t).value-base.value;
        gain-=cost*0.04;
        if(gain>0.25&&(!best||gain>best.gain))best={...c,gain};
      }
      if(!best)break;
      for(const a of best.acts)edit(pz,sim,a);
      steps.push({act:best.acts[0],acts:best.acts,kind:best.kind,gain:best.gain,text:best.text});
    }
    return steps;
  }
  // Plans a whole run from the start (par) or from a given state (Skip). Returns the nights' edits and the result.
  function planRun(pz,opts){
    const o=opts||{},sim=o.sim||create(pz,o);
    const use={warehouse:0,oneway:0,roundabout:0,bypass:0,link2:0};
    if(sim.phase==='day')skipToDusk(pz,sim);
    while(sim.phase!=='done'){
      for(const s of planNight(pz,sim,o))if(s.kind in use)use[s.kind]++;
      runDay(pz,sim);
    }
    return {nights:sim.log.map(n=>n.slice()),result:result(pz,sim),sim,use};
  }
  // Skip: the remaining nights are auto-built with collector links only (no refinements).
  function auto(pz,sim){planRun(pz,{refine:false,sim});return result(pz,sim);}
  // Tonight's hint: the planner's first step from here, with its reason.
  function hint(pz,sim){
    if(sim.phase!=='night')return null;
    const c=clone(sim),steps=planNight(pz,c,{rounds:1});
    if(!steps.length)return {act:null,text:'Your network should handle tomorrow. Save the credits for the stations still to come.'};
    const s=steps[0],tiles=s.act.tiles||[s.act.tile];
    return {act:s.act,acts:s.acts||[s.act],kind:s.kind,text:s.text,tiles};
  }

  const api={TICK,DAY_SECONDS,DAY_TICKS,DIRS,DIR_NAMES,TERRAIN,ROADS,TIER_ID,TYPES,DIFFICULTIES,JUNCTION_TICKS,BUILDING_TICKS,
    ITEM_KEYS,RECIPES,OUTPUT_CAP,SIGNAL_COST,OVERPASS_COST,schedule,roadAllowed,roadTier,travelStep,pathTo,movementMask,admission,
    ROUND_COST,ONEWAY_COST,WH_COST,WH_CAP,WH_UP_COST,WH_UP,PROD_CAP,MAX_OPEN,DELIVERY_CREDIT,STIPEND,GROWTH_CREDIT,CLEAN_BONUS,RELAXED,
    generate,create,clone,edit,undo,costOf,startDay,step,runDay,skipToDusk,replay,simulate,result,tier,parFor,nearMiss,
    planNight,planRun,auto,hint,buildPath,graph,routes,freeRoutes,isJunction,isOneWay,stationAt,whAt,isBuilding,neighbour,dirTo,
    patienceTicks,demTicks,growthCredit,placeName,buildCost,supply,popcount};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RoutePlanning=api;
})(typeof globalThis==='object'?globalThis:this);
