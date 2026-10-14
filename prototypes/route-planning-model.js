// Route planning (Logistics): build a road network that keeps goods flowing, Mini Motorways style. Pure rules, no DOM.
// Every puzzle, every simulated day and the planner's par are deterministic from (seed, difficulty) and the edits made
// each night.
//
// Rules
// - The map is a tile grid with a river (the Ash), rough ground and mountains. Producers ("Makes ▲") make one type of
//   goods on a schedule; consumers ("Needs ▲ ■") open requests for the types they use, in turn. Shapes ● ▲ ■ ◆ mark
//   the four types.
// - A run is several days. At night the clock stops: lay, re-tier or erase roads, set one-way edges, build roundabouts
//   and warehouses, and spend credits. By day nothing can be edited; the traffic runs and you watch where it slows.
//   New stations appear each night ("NEW TONIGHT") and demand rises day by day.
// - Roads join along the direction they were dragged (and a single tapped tile joins all its neighbours), so two
//   parallel roads side by side stay separate. A road on a river tile is a bridge (four times the cost); rough ground
//   costs double; mountains cannot be built on. Erasing refunds half (all of it on the night the road was laid).
// - Each request is served by the nearest source that holds the item (a producer, or a warehouse), by travel time on
//   the network. A vehicle leaves with one item along the fastest path given the traffic at that moment, delivers, then
//   drives home. Road tiles hold one vehicle per direction (two on a one-way stretch or a highway); a junction (three
//   or more joins) holds one vehicle in total and costs extra time unless it is a roundabout. Vehicles queue behind a
//   full tile: one trunk road jams, a few parallel roads flow.
// - A producer whose store is full sends its surplus to the nearest warehouse with space; a warehouse serves requests
//   like a producer.
// - A request open longer than the patience limit starves its consumer for that day. Starving is gentle: it only costs
//   that day's clean-day bonus. Score: one point per delivery, plus 8 for each day where no consumer starved.
//   Credits: 1 per delivery and 5 each dusk.
// - Par is the score of the automatic planner, which builds every night with the same budget: it links every unserved
//   need with the cheapest road, then tries bypasses (two-way or one-way), roundabouts, warehouses and extra producer
//   links, keeping each only if a simulated day comes out better. Perfect: at par or better. Good: 85% of par.
(function(root){
  'use strict';
  const Kit=typeof module==='object'&&module.exports&&typeof require==='function'?require('./minigame-kit.js'):root.MiniGameKit;

  const TICK=0.25,DAY_SECONDS=40,DAY_TICKS=DAY_SECONDS/TICK;
  const DIRS=[[0,-1],[1,0],[0,1],[-1,0]],DIR_NAMES=['north','east','south','west'];
  const OPP=d=>(d+2)&3;
  const TERRAIN=[
    {id:'grass',label:'Open ground',mult:1},
    {id:'river',label:'River: a road here is a bridge (×4 cost)',mult:4},
    {id:'rough',label:'Rough ground (×2 cost)',mult:2},
    {id:'mountain',label:'Mountain (impassable)',mult:Infinity}
  ];
  const T_GRASS=0,T_RIVER=1,T_ROUGH=2,T_MOUNT=3;
  // Road tiers: credits per tile, ticks to cross a tile, vehicles per direction.
  const ROADS=[null,
    {id:'dirt',label:'Dirt track',cost:1,ticks:6,cap:1},
    {id:'road',label:'Road',cost:2,ticks:3,cap:1},
    {id:'highway',label:'Highway',cost:5,ticks:2,cap:2}];
  const TIER_ID={dirt:1,road:2,highway:3};
  const JUNCTION_TICKS=2,BUILDING_TICKS=2,ROUND_COST=6,ROUND_CAP=2,ONEWAY_COST=1;
  const WH_COST=24,WH_CAP=6,WH_UP_COST=12,WH_UP=4,WH_MAX_UP=3;
  const PROD_CAP=4,MAX_OPEN=4,DELIVERY_CREDIT=1,STIPEND=5,CLEAN_BONUS=8,STUCK_TICKS=32,LOAD_EVERY=4,RELAXED=1.75;
  const TYPES=[
    {sym:'●',name:'fuel',color:'#e7c18b'},
    {sym:'▲',name:'munitions',color:'#f08c7a'},
    {sym:'■',name:'rations',color:'#a9cf7b'},
    {sym:'◆',name:'medical',color:'#8fb8ec'}
  ];
  // prod: seconds per item at each producer; dem: seconds between requests at each consumer on day 1, shrinking by
  // `growth` each day; unlock: the day each type first appears.
  const DIFFICULTIES=[
    {id:'easy',label:'Easy · 6 days',target:300,W:14,H:10,types:2,days:6,prod:3.4,dem:7.5,growth:0.05,patience:30,unlock:[1,1],twin:0.25,credits:0},
    {id:'normal',label:'Normal · 8 days',target:420,W:16,H:11,types:3,days:8,prod:3.2,dem:7,growth:0.06,patience:26,unlock:[1,1,3],twin:0.3,credits:0},
    {id:'hard',label:'Hard · 10 days',target:540,W:17,H:12,types:3,days:10,prod:3,dem:6.5,growth:0.06,patience:24,unlock:[1,1,2],twin:0.35,credits:0},
    {id:'expert',label:'Expert · 12 days',target:660,W:18,H:12,types:4,days:12,prod:2.8,dem:6,growth:0.06,patience:22,unlock:[1,1,3,5],twin:0.4,credits:0}
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
    for(let attempt=0;attempt<40&&!pz;attempt++)pz=layout(Kit.rng(Kit.hashSeed(`route-planning-roads:${diff.id}:${s}:${attempt}`)),diff,s);
    if(!pz)throw new Error('Could not lay out a map');
    // Starting credits: enough to link tonight's stations with plain roads, plus some to spare.
    const probe=create({...pz,credits0:1e6});
    const before=probe.credits;connectPass(pz,probe,null);
    pz.connectCost=before-probe.credits;
    pz.credits0=Math.ceil((pz.connectCost*1.3+12)/5)*5;
    if(opts&&opts.noPlan)return pz;
    const t0=Date.now(),plan=planRun(pz,{refine:true});
    pz.plan=plan.nights;pz.par=plan.result.score;pz.parStats=plan.result;pz.planUse=plan.use;pz.planMs=Date.now()-t0;
    const a=planRun(pz,{refine:false});pz.autoScore=a.result.score;
    return pz;
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
      const p=r.pick(opts);taken.push(p);
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
      net:{tier:new Array(N).fill(0),e:new Array(N).fill(0),blk:new Array(N).fill(0),rb:new Array(N).fill(0),paid:new Array(N).fill(0),built:new Array(N).fill(0),rbPaid:new Array(N).fill(0)},
      wh:[],
      st:pz.stations.map(s=>({stock:0,acc:0,reqs:[],next:0,dacc:0,starved:false})),
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
    // Tonight's new stations clear their ground (full refund).
    for(const st of pz.stations)if(st.day===sim.day){
      const i=st.tile;
      if(sim.net.tier[i]){sim.credits+=sim.net.paid[i]+sim.net.rbPaid[i];clearTile(pz,sim,i);}
      const k=whAt(sim,i);if(k>=0){sim.credits+=sim.wh[k].paid;removeWarehouse(pz,sim,k);}
    }
    sim.ver++;sim.nightStart=snapshot(sim);sim.tonight=[];sim.log[sim.day-1]=sim.tonight;
  }
  function clearTile(pz,sim,i){
    const n=sim.net;
    for(let d=0;d<4;d++){const b=neighbour(pz,i,d);if(b>=0){n.e[b]&=~(1<<OPP(d));n.blk[b]&=~(1<<OPP(d));}}
    n.tier[i]=0;n.e[i]=0;n.blk[i]=0;n.rb[i]=0;n.paid[i]=0;n.built[i]=0;n.rbPaid[i]=0;
  }
  function removeWarehouse(pz,sim,k){
    const i=sim.wh[k].tile;
    for(let d=0;d<4;d++){const b=neighbour(pz,i,d);if(b>=0){sim.net.e[b]&=~(1<<OPP(d));sim.net.blk[b]&=~(1<<OPP(d));}}
    sim.net.e[i]=0;sim.net.blk[i]=0;sim.wh.splice(k,1);
  }
  function join(pz,sim,a,b){
    const d=dirTo(pz,a,b);if(d<0)return false;
    if(isBuilding(pz,sim,a)&&isBuilding(pz,sim,b))return false;
    if(!isNode(pz,sim,a)||!isNode(pz,sim,b))return false;
    if(sim.net.e[a]&(1<<d))return false;
    sim.net.e[a]|=1<<d;sim.net.e[b]|=1<<OPP(d);return true;
  }
  const buildCost=(pz,idx,tier)=>ROADS[tier].cost*TERRAIN[pz.terrain[idx]].mult;
  const refundOf=(sim,paid,built)=>built===sim.day?paid:Math.floor(paid/2);

  // ---- night edits ----------------------------------------------------------------------------------------------------
  // road {tiles, tier}: lay (or re-tier) road along a dragged path of adjacent tiles and join consecutive tiles; a single
  //   tile joins every neighbour. erase {tiles}: remove roads and warehouses. oneway {tiles}: make each step along the
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
      const tier=TIER_ID[a.tier||'road'];if(!tier)return 'No such road type.';
      let cost=0,changed=false;
      for(const t of a.tiles){
        if(isBuilding(pz,sim,t))continue;
        if(pz.terrain[t]===T_MOUNT)return 'Mountains cannot be built on.';
        if(pz.bAt[t]>=0&&pz.stations[pz.bAt[t]].day<=sim.day)continue;
        if(n.tier[t]===tier)continue;
        if(n.tier[t])cost+=Math.max(0,buildCost(pz,t,tier)-n.paid[t]);else cost+=buildCost(pz,t,tier);
      }
      if(cost>sim.credits)return `That needs ${cost} credits; you have ${sim.credits}.`;
      for(const t of a.tiles){
        if(isBuilding(pz,sim,t)||n.tier[t]===tier)continue;
        if(n.tier[t]){const c=Math.max(0,buildCost(pz,t,tier)-n.paid[t]);n.paid[t]+=c;sim.credits-=c;}
        else{const c=buildCost(pz,t,tier);n.paid[t]=c;n.built[t]=sim.day;sim.credits-=c;}
        n.tier[t]=tier;changed=true;
      }
      if(a.tiles.length===1){const t=a.tiles[0];if(n.tier[t])for(let d=0;d<4;d++){const b=neighbour(pz,t,d);if(b>=0&&join(pz,sim,t,b))changed=true;}}
      else for(let i=1;i<a.tiles.length;i++)if(join(pz,sim,a.tiles[i-1],a.tiles[i]))changed=true;
      return changed?null:'That road is already there.';
    }
    if(a.type==='erase'){
      if(!Array.isArray(a.tiles)||!a.tiles.length)return 'No tiles.';
      let changed=false;
      for(const t of a.tiles){
        if(!Number.isInteger(t)||t<0||t>=pz.W*pz.H)return 'Off the map.';
        if(n.tier[t]){sim.credits+=refundOf(sim,n.paid[t],n.built[t])+refundOf(sim,n.rbPaid[t],n.rb[t]);clearTile(pz,sim,t);changed=true;}
        const k=whAt(sim,t);if(k>=0){sim.credits+=refundOf(sim,sim.wh[k].paid,sim.wh[k].built);removeWarehouse(pz,sim,k);changed=true;}
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
      const t=a.tile;if(!Number.isInteger(t)||t<0||t>=pz.W*pz.H)return 'Off the map.';
      if(!n.tier[t])return 'A roundabout goes on a road tile.';
      if(n.rb[t]){sim.credits+=refundOf(sim,n.rbPaid[t],n.rb[t]);n.rb[t]=0;n.rbPaid[t]=0;return null;}
      if(popcount(n.e[t])<3)return 'A roundabout only helps where three or more roads meet.';
      if(ROUND_COST>sim.credits)return `That needs ${ROUND_COST} credits; you have ${sim.credits}.`;
      sim.credits-=ROUND_COST;n.rb[t]=sim.day;n.rbPaid[t]=ROUND_COST;return null;
    }
    if(a.type==='warehouse'){
      const t=a.tile;if(!Number.isInteger(t)||t<0||t>=pz.W*pz.H)return 'Off the map.';
      if(n.tier[t]||isBuilding(pz,sim,t)||pz.bAt[t]>=0&&pz.stations[pz.bAt[t]].day<=sim.day)return 'A warehouse needs empty ground.';
      if(pz.terrain[t]===T_RIVER||pz.terrain[t]===T_MOUNT)return 'A warehouse needs dry, flat ground.';
      if(WH_COST>sim.credits)return `That needs ${WH_COST} credits; you have ${sim.credits}.`;
      sim.credits-=WH_COST;sim.wh.push({tile:t,cap:WH_CAP,ups:0,stock:new Array(TYPES.length).fill(0),inc:new Array(TYPES.length).fill(0),paid:WH_COST,built:sim.day});
      for(let d=0;d<4;d++){const b=neighbour(pz,t,d);if(b>=0&&n.tier[b])join(pz,sim,t,b);}
      return null;
    }
    if(a.type==='whcap'){
      const k=whAt(sim,a.tile);if(k<0)return 'No warehouse there.';
      const w=sim.wh[k];if(w.ups>=WH_MAX_UP)return 'That warehouse is as big as it gets.';
      if(WH_UP_COST>sim.credits)return `That needs ${WH_UP_COST} credits; you have ${sim.credits}.`;
      sim.credits-=WH_UP_COST;w.paid+=WH_UP_COST;w.ups++;w.cap+=WH_UP;return null;
    }
    return 'Unknown edit.';
  }

  // ---- the road graph ---------------------------------------------------------------------------------------------------
  // Cached per network version (not cloned with the state). out[a] lists the tiles a vehicle may drive to from a.
  const graphs=new WeakMap();
  function graph(pz,sim){
    let c=graphs.get(sim);if(c&&c.ver===sim.ver)return c.g;
    const N=pz.W*pz.H,n=sim.net,out=new Array(N),ticks=new Int16Array(N),cap=new Int16Array(N),shared=new Uint8Array(N),bld=new Uint8Array(N);
    for(let i=0;i<N;i++){
      out[i]=[];
      const b=isBuilding(pz,sim,i);bld[i]=b?1:0;
      if(!n.tier[i]&&!b)continue;
      for(let d=0;d<4;d++)if(n.e[i]&(1<<d)&&!(n.blk[i]&(1<<d))){const j=neighbour(pz,i,d);if(j>=0&&(n.tier[j]||isBuilding(pz,sim,j)))out[i].push(j);}
      if(b){ticks[i]=BUILDING_TICKS;cap[i]=999;continue;}
      const R=ROADS[n.tier[i]],junction=popcount(n.e[i])>=3;
      if(junction){shared[i]=1;ticks[i]=R.ticks+(n.rb[i]?0:JUNCTION_TICKS);cap[i]=n.rb[i]?ROUND_CAP:1;}
      else{ticks[i]=R.ticks;cap[i]=R.cap*(isOneWay(pz,sim,i)?2:1);}
    }
    const g={N,out,ticks,cap,shared,bld};
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
  // Binary-heap Dijkstra from src. Buildings other than src are end points only: vehicles never drive through them.
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
  const pathTo=(res,dst)=>{if(res.dist[dst]===Infinity)return null;const p=[dst];let c=dst;while(res.prev[c]>=0){c=res.prev[c];p.push(c);}return p.reverse();};
  // Travel-time distances given the traffic snapshot (refreshed once a simulated second).
  function routes(pz,sim,src){
    const g=graph(pz,sim),c=graphs.get(sim),key=sim.loadVer;
    if(c.key!==key){c.dist=new Map();c.key=key;}
    let r=c.dist.get(src);
    if(!r){const L=sim.load;r=dijkstra(g,src,b=>g.ticks[b]*(1+1.5*L[b]));c.dist.set(src,r);}
    return r;
  }
  // Free-flow distances (no traffic), cached per network version.
  function freeRoutes(pz,sim,src){
    const g=graph(pz,sim),c=graphs.get(sim);if(!c.free)c.free=new Map();
    let r=c.free.get(src);if(!r){r=dijkstra(g,src,b=>g.ticks[b]);c.free.set(src,r);}
    return r;
  }
  // Tiles on the shortest path ignoring one-way rules and traffic (the baseline for detours).
  function plainTiles(pz,sim,src,dst){
    const N=pz.W*pz.H,seen=new Int32Array(N).fill(-1),q=[src];seen[src]=0;
    for(let h=0;h<q.length;h++){const a=q[h];if(a===dst)return seen[a];if(a!==src&&isBuilding(pz,sim,a))continue;
      for(let d=0;d<4;d++)if(sim.net.e[a]&(1<<d)){const b=neighbour(pz,a,d);if(b>=0&&seen[b]<0){seen[b]=seen[a]+1;q.push(b);}}}
    return -1;
  }

  // ---- the day ------------------------------------------------------------------------------------------------------------
  const demTicks=(pz,day)=>Math.max(8,Math.round(pz.dem*Math.pow(1-pz.growth,day-1)/TICK));
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
    const v={id:sim.vid++,kind,home,dst,type,path,i:0,t:0,wait:0,slot:-1,req};sim.veh.push(v);return v;
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
    for(let i=0;i<S.length;i++){
      if(S[i].day>sim.day)continue;const s=S[i],x=sim.st[i];
      if(s.kind==='producer'){
        if(x.stock>=PROD_CAP)ds.full[i]++;
        else if(++x.acc>=pz.prodTicks){x.acc=0;x.stock++;}
      }else{
        if(++x.dacc>=dt){x.dacc=0;if(x.reqs.length<MAX_OPEN){x.reqs.push({type:s.needs[x.next%s.needs.length],age:0,v:0});x.next++;}}
        for(const r of x.reqs){r.age++;if(r.age>=pt&&!x.starved){x.starved=true;sim.fx.push({kind:'starve',st:i});}}
      }
    }
    // Dispatch: every waiting request is served by the nearest source holding its item.
    const sources=[];for(let i=0;i<S.length;i++)if(S[i].kind==='producer'&&S[i].day<=sim.day&&g.out[S[i].tile].length)sources.push(S[i].tile);
    for(const w of sim.wh)if(g.out[w.tile].length)sources.push(w.tile);
    for(let i=0;i<S.length;i++){
      if(S[i].kind!=='consumer'||S[i].day>sim.day)continue;
      const c=S[i].tile;
      for(const r of sim.st[i].reqs){
        if(r.v)continue;
        let best=-1,bd=Infinity;
        for(const src of sources){if(stockOf(pz,sim,src,r.type)<=0)continue;const d=routes(pz,sim,src).dist[c];if(d<bd){bd=d;best=src;}}
        if(best<0)continue;
        take(pz,sim,best,r.type,-1);
        const v=newVehicle(sim,'deliver',best,c,r.type,pathTo(routes(pz,sim,best),c),i);r.v=v.id;
        if(whAt(sim,best)>=0)ds.fromWh++;
      }
    }
    // Surplus: a full producer sends one item to the nearest warehouse with room.
    if(sim.wh.length)for(let i=0;i<S.length;i++){
      const s=S[i];if(s.kind!=='producer'||s.day>sim.day||sim.st[i].stock<PROD_CAP||!g.out[s.tile].length)continue;
      const R=routes(pz,sim,s.tile);let best=-1,bd=Infinity;
      for(let k=0;k<sim.wh.length;k++){const w=sim.wh[k],used=w.stock.reduce((a,b)=>a+b,0)+w.inc.reduce((a,b)=>a+b,0);if(used<w.cap&&R.dist[w.tile]<bd){bd=R.dist[w.tile];best=k;}}
      if(best<0)continue;
      sim.st[i].stock--;sim.wh[best].inc[s.type]++;newVehicle(sim,'stock',s.tile,sim.wh[best].tile,s.type,pathTo(R,sim.wh[best].tile),-1);
    }
    // Movement: in vehicle order, each vehicle that has crossed its tile tries to enter the next one.
    const q=new Array(g.N).fill(0);let dead=false;
    for(const v of sim.veh){
      if(v.t>0&&--v.t>0)continue;
      const cur=v.path[v.i],nxt=v.path[v.i+1];
      if(v.i+1===v.path.length-1){
        if(v.slot>=0)occ[v.slot]--;v.slot=-1;
        arrive(pz,sim,v,nxt);if(v.dead)dead=true;continue;
      }
      const d=dirTo(pz,cur,nxt);
      const full=g.shared[nxt]?(occ[nxt*4]+occ[nxt*4+1]+occ[nxt*4+2]+occ[nxt*4+3])>=g.cap[nxt]:occ[nxt*4+d]>=g.cap[nxt];
      if(full&&v.wait<STUCK_TICKS){v.wait++;q[nxt]++;if(q[nxt]===1)ds.jam[nxt]++;continue;}
      if(v.slot>=0)occ[v.slot]--;v.slot=nxt*4+d;occ[v.slot]++;v.i++;v.t=g.ticks[nxt];v.wait=0;
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
      const x=sim.st[v.req],k=x.reqs.findIndex(r=>r.v===v.id);
      if(k>=0){const r=x.reqs[k];x.reqs.splice(k,1);if(r.age>ds.wait[v.req]){ds.wait[v.req]=r.age;ds.waitType[v.req]=r.type;}}
      sim.deliveries++;sim.score++;ds.deliveries++;sim.credits+=DELIVERY_CREDIT;
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
    v.kind='home';v.dst=v.home;v.path=p;v.i=0;v.t=BUILDING_TICKS;v.wait=0;v.req=-1;
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
      if(S[i].kind!=='consumer'||S[i].day>sim.day)continue;const x=sim.st[i];
      for(const r of x.reqs){if(r.age>ds.wait[i]){ds.wait[i]=r.age;ds.waitType[i]=r.type;}r.age=0;r.v=0;}
      if(x.starved)starved.push(i);x.starved=false;
    }
    const clean=!starved.length;if(clean){sim.cleanDays++;sim.score+=CLEAN_BONUS;}
    sim.credits+=STIPEND;
    let worst=null;for(const i of starved)if(!worst||ds.wait[i]<worst.ticks)worst={st:i,type:ds.waitType[i],ticks:ds.wait[i]};
    const summary={day:sim.day,deliveries:ds.deliveries,clean,starved,worst,score:sim.score-ds.score0,fromWh:ds.fromWh};
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
    for(const s of S)if(s.kind==='consumer'&&s.day<=sim.day)for(const t of s.needs){
      const ok=S.some(p=>p.kind==='producer'&&p.type===t&&p.day<=sim.day&&freeRoutes(pz,sim,p.tile).dist[s.tile]<Infinity)||
        sim.wh.some(w=>freeRoutes(pz,sim,w.tile).dist[s.tile]<Infinity&&w.stock[t]>0);
      if(!ok)out.push({kind:'unlinked',sev:200,text:`${s.name} has no road from a ${TYPES[t].sym} maker`,tiles:[s.tile],st:s.id});
    }
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
      if(u!==a&&isBuilding(pz,sim,u))continue;
      for(let d=0;d<4;d++){
        const v=neighbour(pz,u,d);if(v<0||done[v])continue;
        let c;
        if(v===b)c=0.01;
        else if(isBuilding(pz,sim,v)||pz.bAt[v]>=0&&pz.stations[pz.bAt[v]].day<=sim.day)continue;
        else if(pz.terrain[v]===T_MOUNT)continue;
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
        if(c.kind!=='consumer'||c.day>sim.day)continue;
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
        const a={type:'road',tier:'road',tiles:k.path},r=edit(pz,sim,a);
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
  // Skip: the remaining nights are auto-built with plain links only (no bypasses), so it scores below par.
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
    ROUND_COST,ONEWAY_COST,WH_COST,WH_CAP,WH_UP_COST,WH_UP,PROD_CAP,MAX_OPEN,DELIVERY_CREDIT,STIPEND,CLEAN_BONUS,STUCK_TICKS,RELAXED,
    generate,create,clone,edit,undo,costOf,startDay,step,runDay,skipToDusk,replay,simulate,result,tier,parFor,nearMiss,
    planNight,planRun,auto,hint,buildPath,graph,routes,freeRoutes,isJunction,isOneWay,stationAt,whAt,isBuilding,neighbour,dirTo,
    patienceTicks,demTicks,placeName,buildCost,supply,popcount};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RoutePlanning=api;
})(typeof globalThis==='object'?globalThis:this);
