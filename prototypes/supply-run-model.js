// Supply run (Logistics): a walk-and-carry base game. Pure rules, no DOM. Deterministic from (seed, difficulty,
// relaxed) plus the list of tick-stamped movement commands the player gives.
//
// Rules (one fixed tick = 0.1 s of shift time; nothing here reads a clock):
// - The world is an open 40 × 25 unit area. Positions are whole milli-units (1 unit = 1000), so every step is integer
//   arithmetic. You move freely: a `move` command sets your heading (any integer vector, normalised here with
//   Math.sqrt, which is exact under IEEE 754) and you keep walking that way, 4.5 units a second, until the next `move`
//   ({x:0,y:0} stops). A `goto` command walks straight to a point and stops there (tap-to-walk). Only changes of
//   heading are recorded, so a replay of the same commands lands on exactly the same positions.
// - Zones, not buttons. Standing in a zone acts on it, one item at a time:
//   resource node: an item pops off and lands on your back (after a short settle, then every 2 ticks);
//   station input pad: unloads one matching item from your stack every tick into the station's hopper;
//   station output pad: picks up finished goods every tick; dispatch pad: hands one item an open request needs every
//   tick; scrap bin: throws away your top item. Your pack holds 8 items at first (14 and 20 after pack unlocks).
// - Stations take a recipe from their hopper (e.g. 2 ore → 1 plate) and work it for a few seconds; finished goods
//   pile on the output pad (12 at most). Hoppers hold 10 of each input.
// - Pay-to-unlock pads. A pad shows a price; after you stand on it for half a second your coins stream in and the
//   price counts down (paid coins stay paid if you leave). At zero it unlocks a resource node, a station and its
//   recipe, a bigger pack, or a worker. New pads appear as earlier ones unlock.
// - Coins. A filled request drops its reward as a coin pile beside the dispatch pad; walk over a pile to pick it up.
// - Workers walk their own default loop (ore hauler: ore vein → refinery; crystal hauler: crystal bloom →
//   synthesiser; workshop courier: refinery and synthesiser output → workshop input), slower than you, 4 items a trip.
//   Two early runners automate the first deliveries: the plate runner takes plates from the refinery and the cell
//   runner takes Aether cells from the synthesiser to the dispatch pad, but only as many as open requests need.
// - Crafting ladder: ore → plate, crystal → Aether cell (tier 1); plate + cell → gear kit, cell + crystal → burst core
//   (tier 2); gear kit + salvage parts → field shield, gear kit + burst core → Weaver relay (tier 3).
// - Requests: each lieutenant has one slot. When it opens, the request is picked from the items you can make right
//   now, weighted towards higher tiers, using rolls fixed by the seed. So requests escalate as the ladder grows.
//   Filled before its timer runs out, it pays its credits as coins; otherwise it is missed. A new one opens 3 s later.
// - Score = credits earned from filled requests (spending never lowers it). Par = the scripted planner below playing
//   the same shift with recorded heading changes. Perfect ≥ 85 % of par, Good ≥ 60 %, Partial = something filled.
(function(root){
  'use strict';
  const Kit=typeof module==='object'&&module.exports&&typeof require==='function'?require('./minigame-kit.js'):root.MiniGameKit;

  const TICK_MS=100,TPS=10,U=1000,MAP={w:40*U,h:25*U},EDGE=600;
  const SPEED=450,WORKER_SPEED=300,SLOW=0.5;
  const CARRY=[8,14,20],IN_MAX=10,OUT_MAX=12,WORKER_CAP=4,GAP=30;
  const DWELL={node:3,in:1,out:1,dispatch:1,bin:4,unlock:5},PERIOD={node:2,in:1,out:1,dispatch:1,bin:2};
  const PERFECT=0.85,GOOD=0.6,RELAXED=1.5;

  const ITEMS={
    ore:{name:'Ore',plural:'ore',icon:'🪨',color:'#c98a5a',tier:0},
    crystal:{name:'Crystal',plural:'crystal',icon:'💎',color:'#b597ff',tier:0},
    parts:{name:'Salvage part',plural:'salvage parts',icon:'🔩',color:'#a9b4bc',tier:0},
    plate:{name:'Plate',plural:'plates',icon:'🔳',color:'#dfe6ea',tier:1,value:6},
    cell:{name:'Aether cell',plural:'Aether cells',icon:'🔋',color:'#6fe3d2',tier:1,value:8},
    gear:{name:'Gear kit',plural:'gear kits',icon:'🧰',color:'#e7c18b',tier:2,value:22},
    core:{name:'Burst core',plural:'burst cores',icon:'☄️',color:'#f08a5d',tier:2,value:26},
    shield:{name:'Field shield',plural:'field shields',icon:'🛡️',color:'#7fb4ff',tier:3,value:58},
    relay:{name:'Weaver relay',plural:'Weaver relays',icon:'📡',color:'#f2d36b',tier:3,value:90}
  };
  const ITEM_IDS=Object.keys(ITEMS),RAW=ITEM_IDS.filter(i=>!ITEMS[i].tier),CRAFTED=ITEM_IDS.filter(i=>ITEMS[i].tier);
  const P=(x,y)=>({x:Math.round(x*U),y:Math.round(y*U)});
  const NODES={
    ore:{name:'Ore vein',item:'ore',...P(3.5,7),r:1500},
    crystal:{name:'Crystal bloom',item:'crystal',...P(3.5,18),r:1500},
    salvage:{name:'Salvage heap',item:'parts',...P(37,13),r:1500}
  };
  // Each station has its building at (x, y), an input pad 2 units left and an output pad 2 units right.
  const STATIONS={
    refinery:{name:'Refinery',...P(11,7),in:{ore:2},out:'plate',ticks:8},
    synth:{name:'Synthesiser',...P(11,18),in:{crystal:2},out:'cell',ticks:10},
    workshop:{name:'Workshop',...P(20,6),in:{plate:1,cell:1},out:'gear',ticks:15},
    press:{name:'Core press',...P(20,20.5),in:{cell:1,crystal:2},out:'core',ticks:15},
    armoury:{name:'Armoury',...P(30,7),in:{gear:1,parts:2},out:'shield',ticks:20},
    loom:{name:'Relay loom',...P(30,19),in:{gear:1,core:1},out:'relay',ticks:25}
  };
  const NODE_IDS=Object.keys(NODES),STATION_IDS=Object.keys(STATIONS);
  const DISPATCH={name:'Dispatch pad',...P(24,13),r:1500},BIN={name:'Scrap bin',...P(26.6,16.4),r:800};
  const COIN_SPOTS=[P(22.6,15.6),P(24,16.1),P(25.4,15.6),P(23.3,17.2),P(24.7,17.2)],COIN_R=900;
  const START=P(16,12.5),PAD_R=900,UNLOCK_R=1000;
  const SOURCE={};for(const n of NODE_IDS)SOURCE[NODES[n].item]=n;
  const MAKER={};for(const s of STATION_IDS)MAKER[STATIONS[s].out]=s;
  const JOBS={
    ore:{name:'Ore hauler',stops:[{z:'node:ore',do:'gather'},{z:'in:refinery',do:'unload'}]},
    crystal:{name:'Crystal hauler',stops:[{z:'node:crystal',do:'gather'},{z:'in:synth',do:'unload'}]},
    courier:{name:'Workshop courier',stops:[{z:'out:refinery',do:'take',n:2},{z:'out:synth',do:'take',n:2},{z:'in:workshop',do:'unload'}]},
    plates:{name:'Plate runner',stops:[{z:'out:refinery',do:'take',n:WORKER_CAP,need:true},{z:'dispatch',do:'deliver'}]},
    cells:{name:'Cell runner',stops:[{z:'out:synth',do:'take',n:WORKER_CAP,need:true},{z:'dispatch',do:'deliver'}]}
  };
  // Unlock pads, in the order they are revealed. `after`: what must be unlocked before the pad appears.
  const UNLOCKS={
    crystal:{kind:'node',target:'crystal',name:'Crystal bloom',price:6,after:[],...P(3.5,18)},
    synth:{kind:'station',target:'synth',name:'Synthesiser',price:12,after:['crystal'],...P(11,18)},
    workshop:{kind:'station',target:'workshop',name:'Workshop',price:20,after:['synth'],...P(20,6)},
    pack1:{kind:'pack',cap:CARRY[1],name:'Bigger pack',price:18,after:['synth'],...P(16.5,16.5)},
    // Early automation: the ore hauler is on offer from the start, and each runner follows soon after.
    oreHauler:{kind:'worker',job:'ore',name:'Ore hauler',price:10,after:[],...P(7,10.8)},
    plateRunner:{kind:'worker',job:'plates',name:'Plate runner',price:14,after:['oreHauler'],...P(14.2,4.2)},
    cellRunner:{kind:'worker',job:'cells',name:'Cell runner',price:18,after:['synth','plateRunner'],...P(14.5,21.5)},
    press:{kind:'station',target:'press',name:'Core press',price:40,after:['workshop'],...P(20,20.5)},
    salvage:{kind:'node',target:'salvage',name:'Salvage heap',price:25,after:['workshop'],...P(37,13)},
    armoury:{kind:'station',target:'armoury',name:'Armoury',price:45,after:['salvage'],...P(30,7)},
    crystalHauler:{kind:'worker',job:'crystal',name:'Crystal hauler',price:20,after:['synth','oreHauler'],...P(7,14.3)},
    courier:{kind:'worker',job:'courier',name:'Workshop courier',price:35,after:['workshop','crystalHauler'],...P(15.5,9.6)},
    loom:{kind:'station',target:'loom',name:'Relay loom',price:70,after:['press','armoury'],...P(30,19)},
    pack2:{kind:'pack',cap:CARRY[2],name:'Big pack',price:70,after:['pack1','workshop'],...P(16.5,16.5)}
  };
  const UNLOCK_IDS=Object.keys(UNLOCKS);
  const LTS=[{name:'Lt Vega',front:'North ridge'},{name:'Lt Okafor',front:'Ash flats'},{name:'Lt Sato',front:'Glass canyon'}];
  const DIFFICULTIES=[
    {id:'easy',label:'Easy · 3½ min',target:210,shift:210,lts:2,time:1.4},
    {id:'normal',label:'Normal · 4 min',target:240,shift:240,lts:3,time:1.15},
    {id:'hard',label:'Hard · 5 min',target:300,shift:300,lts:3,time:0.95}
  ];

  const sec=t=>Math.round(t/TPS);
  const clock=t=>{const s=Math.max(0,Math.round(t/TPS));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
  const qty=(n,item)=>`${n} ${n===1?ITEMS[item].name.toLowerCase().replace('aether','Aether').replace('weaver','Weaver'):ITEMS[item].plural}`;
  const article=item=>/^[aeiou]/i.test(ITEMS[item].name)?'an':'a';
  const lowerName=item=>ITEMS[item].name.charAt(0)+ITEMS[item].name.slice(1).toLowerCase().replace('aether','Aether').replace('weaver','Weaver');
  const aName=item=>`${article(item)} ${/^[A-Z][a-z]+ [A-Z]/.test(ITEMS[item].name)?ITEMS[item].name:ITEMS[item].name.toLowerCase()}`;

  // ---- zones -------------------------------------------------------------------------------------------------------
  // Zone ids: node:<id>, in:<station>, out:<station>, dispatch, bin, unlock:<id>.
  function zoneSpec(id){
    const [kind,key]=id.split(':');
    if(kind==='node')return {id,kind:'node',key,x:NODES[key].x,y:NODES[key].y,r:NODES[key].r,item:NODES[key].item};
    if(kind==='in'||kind==='out'){const s=STATIONS[key];return {id,kind,key,x:s.x+(kind==='in'?-2*U:2*U),y:s.y,r:PAD_R};}
    if(kind==='dispatch')return {id,kind,x:DISPATCH.x,y:DISPATCH.y,r:DISPATCH.r};
    if(kind==='bin')return {id,kind,x:BIN.x,y:BIN.y,r:BIN.r};
    if(kind==='unlock')return {id,kind,key,x:UNLOCKS[key].x,y:UNLOCKS[key].y,r:UNLOCK_R};
    return null;
  }
  const ZONE={};
  for(const n of NODE_IDS)ZONE['node:'+n]=zoneSpec('node:'+n);
  for(const s of STATION_IDS){ZONE['in:'+s]=zoneSpec('in:'+s);ZONE['out:'+s]=zoneSpec('out:'+s);}
  ZONE.dispatch=zoneSpec('dispatch');ZONE.bin=zoneSpec('bin');
  for(const u of UNLOCK_IDS)ZONE['unlock:'+u]=zoneSpec('unlock:'+u);

  const isOpen=(st,key)=>!!st.unlocked[key];
  const padVisible=(st,u)=>!st.unlocked[u]&&UNLOCKS[u].after.every(a=>st.unlocked[a]);
  function zoneActive(st,id){
    const z=ZONE[id];
    if(z.kind==='node'||z.kind==='in'||z.kind==='out')return isOpen(st,z.key);
    if(z.kind==='unlock')return padVisible(st,z.key);
    return true;
  }
  function activeZones(st){return Object.keys(ZONE).filter(id=>zoneActive(st,id));}
  const d2=(ax,ay,bx,by)=>(ax-bx)*(ax-bx)+(ay-by)*(ay-by);
  function zoneAt(st,x,y){
    let best=null,bd=Infinity;
    for(const id in ZONE){const z=ZONE[id];const d=d2(x,y,z.x,z.y);if(d<=z.r*z.r&&d<bd&&zoneActive(st,id)){best=id;bd=d;}}
    return best;
  }

  // ---- generation --------------------------------------------------------------------------------------------------
  function difficultyOf(id){return DIFFICULTIES.find(d=>d.id===id)||DIFFICULTIES[1];}
  function duration(item,n,diff,relaxed){
    const base={1:[16,6],2:[26,13],3:[40,20]}[ITEMS[item].tier];
    return Math.round((base[0]+base[1]*n)*diff.time*(relaxed?RELAXED:1))*TPS;
  }
  function generate(seed,difficulty,opts){
    const diff=difficultyOf(difficulty),relaxed=!!(opts&&opts.relaxed),s=Number(seed)>>>0;
    const r=Kit.rng(Kit.hashSeed('supply-run:'+diff.id+':'+s));
    const lts=[];
    for(let i=0;i<diff.lts;i++){
      const rolls=[];for(let k=0;k<60;k++)rolls.push([r.int(1000),r.int(1000)]);
      lts.push({...LTS[i],rolls,first:10+i*40});
    }
    const pz={seed:s,difficulty:diff.id,relaxed,time:diff.time*(relaxed?RELAXED:1),hard:diff.id==='hard',shiftTicks:diff.shift*TPS,target:diff.target,lts};
    const par=planner(pz);
    pz.par=par.score;pz.parFilled=par.filled;pz.plan=par.commands;pz.parUnlocks=par.unlocks;
    pz.perfectAt=Math.ceil(pz.par*PERFECT);pz.goodAt=Math.ceil(pz.par*GOOD);
    return pz;
  }
  // The request a lieutenant opens now: from the crafted items whose station is open, weighted 2 / 5 / 10 by tier,
  // using the seed's fixed rolls for this slot.
  function rollRequest(pz,st,lt){
    const L=pz.lts[lt],idx=st.lts[lt].idx,[a,b]=L.rolls[idx%L.rolls.length];
    const avail=CRAFTED.filter(i=>isOpen(st,MAKER[i]));
    const w=avail.map(i=>[0,2,5,10][ITEMS[i].tier]),tot=w.reduce((x,y)=>x+y,0);
    let pick=a*tot/1000,item=avail[0];
    for(let k=0;k<avail.length;k++){if(pick<w[k]){item=avail[k];break;}pick-=w[k];}
    const tier=ITEMS[item].tier,q=b/1000;
    const n=tier===1?2+Math.floor(q*3):tier===2?1+Math.floor(q*(pz.hard?3:2)):1+Math.floor(q*(pz.hard?2:1.4));
    return {lt,idx,item,qty:n,got:0,reward:n*ITEMS[item].value,duration:duration(item,n,{time:pz.time},false)};
  }

  // ---- state -------------------------------------------------------------------------------------------------------
  function create(pz,opts){
    const st={tick:0,wallet:0,earned:0,cap:CARRY[0],unlocked:{ore:true,refinery:true},unlockedAt:{},paid:{},
      player:{x:START.x,y:START.y,vx:0,vy:0,hx:0,hy:0,goto:null,stack:[],zone:null,dwell:0},
      stations:{},workers:[],piles:[],reqs:[],
      lts:pz.lts.map(l=>({idx:0,req:null,readyAt:l.first})),fills:0,slow:false,done:false,fx:opts&&opts.fx?[]:null};
    for(const s of STATION_IDS)st.stations[s]={in:Object.fromEntries(Object.keys(STATIONS[s].in).map(k=>[k,0])),busy:0,out:0,made:0};
    for(const u of UNLOCK_IDS)st.paid[u]=0;
    return st;
  }
  const clone=st=>JSON.parse(JSON.stringify(st));
  const count=(stack,item)=>{let n=0;for(const x of stack)if(x===item)n++;return n;};
  const emit=(st,e)=>{if(st.fx)st.fx.push({tick:st.tick,...e});};
  const speedOf=st=>st.slow?Math.round(SPEED*SLOW):SPEED;
  const openReqs=st=>st.lts.map(l=>l.req).filter(Boolean);
  const left=r=>r.qty-r.got;

  // ---- commands ----------------------------------------------------------------------------------------------------
  // move {x,y}: walk in that direction until told otherwise ({0,0} stops). goto {x,y}: walk to that point (milli-units).
  function validate(pz,st,cmd){
    if(st.done)return 'The shift is over.';
    if(!cmd||typeof cmd!=='object')return 'No command.';
    const ok=v=>Number.isInteger(v)&&Math.abs(v)<=1e7;
    if(cmd.type==='move'){if(!ok(cmd.x)||!ok(cmd.y))return 'A heading needs whole numbers.';return null;}
    if(cmd.type==='goto'){if(!ok(cmd.x)||!ok(cmd.y))return 'A target needs whole numbers.';if(cmd.x<0||cmd.y<0||cmd.x>MAP.w||cmd.y>MAP.h)return 'That point is off the map.';return null;}
    return 'Unknown command.';
  }
  function heading(st,x,y){
    const p=st.player,sp=speedOf(st);p.hx=x;p.hy=y;
    if(!x&&!y){p.vx=0;p.vy=0;return;}
    const len=Math.sqrt(x*x+y*y);p.vx=Math.round(x*sp/len);p.vy=Math.round(y*sp/len);
  }
  function apply(pz,st,cmd){
    const err=validate(pz,st,cmd);if(err)return err;
    const p=st.player;
    if(cmd.type==='move'){p.goto=null;heading(st,cmd.x,cmd.y);}
    else{const x=Math.min(MAP.w-EDGE,Math.max(EDGE,cmd.x)),y=Math.min(MAP.h-EDGE,Math.max(EDGE,cmd.y));p.goto={x,y};heading(st,0,0);}
    return null;
  }

  // ---- simulation --------------------------------------------------------------------------------------------------
  const clampX=x=>Math.min(MAP.w-EDGE,Math.max(EDGE,x)),clampY=y=>Math.min(MAP.h-EDGE,Math.max(EDGE,y));
  function moveToward(a,tx,ty,sp){
    const dx=tx-a.x,dy=ty-a.y,d=Math.sqrt(dx*dx+dy*dy);
    if(d<=sp){a.x=tx;a.y=ty;return true;}
    a.x+=Math.round(dx*sp/d);a.y+=Math.round(dy*sp/d);return false;
  }
  function movePlayer(st){
    const p=st.player;
    if(p.goto){if(moveToward(p,p.goto.x,p.goto.y,speedOf(st)))p.goto=null;return;}
    if(p.vx||p.vy){p.x=clampX(p.x+p.vx);p.y=clampY(p.y+p.vy);}
  }
  const inputFor=(s,item)=>item in STATIONS[s].in;
  function topIndex(stack,ok){for(let i=stack.length-1;i>=0;i--)if(ok(stack[i]))return i;return -1;}
  function neededBy(st,item){let n=0;for(const r of openReqs(st))if(r.item===item)n+=left(r);return n;}
  function actPlayer(pz,st){
    const p=st.player,z=zoneAt(st,p.x,p.y);
    if(z!==p.zone){p.zone=z;p.dwell=0;}else p.dwell++;
    if(!z)return;
    const Z=ZONE[z],kind=Z.kind,dw=p.dwell-DWELL[kind];
    if(dw<0)return;
    if(kind==='unlock'){payInto(pz,st,Z.key);return;}
    if(dw%PERIOD[kind])return;
    if(kind==='node'){if(p.stack.length<st.cap){p.stack.push(Z.item);emit(st,{type:'gather',item:Z.item,zone:z,who:'player'});}}
    else if(kind==='in'){
      const S=st.stations[Z.key],i=topIndex(p.stack,x=>inputFor(Z.key,x)&&S.in[x]<IN_MAX);
      if(i>=0){const item=p.stack.splice(i,1)[0];S.in[item]++;emit(st,{type:'load',item,zone:z,who:'player'});}
    }else if(kind==='out'){
      const S=st.stations[Z.key];
      if(S.out>0&&p.stack.length<st.cap){S.out--;const item=STATIONS[Z.key].out;p.stack.push(item);emit(st,{type:'pickup',item,zone:z,who:'player'});}
    }else if(kind==='dispatch'){
      const i=topIndex(p.stack,x=>neededBy(st,x)>0);
      if(i>=0)deliver(pz,st,p.stack.splice(i,1)[0]);
    }else if(kind==='bin'){
      if(p.stack.length){const item=p.stack.pop();emit(st,{type:'scrap',item,zone:z});}
    }
  }
  function payInto(pz,st,u){
    const U_=UNLOCKS[u],rest=U_.price-st.paid[u];
    if(rest<=0||st.wallet<=0)return;
    const n=Math.min(rest,st.wallet,Math.max(1,Math.ceil(U_.price/12)));
    st.wallet-=n;st.paid[u]+=n;emit(st,{type:'pay',id:u,n,left:U_.price-st.paid[u]});
    if(st.paid[u]>=U_.price)unlock(pz,st,u);
  }
  function unlock(pz,st,u){
    const U_=UNLOCKS[u];st.unlocked[u]=true;st.unlockedAt[u]=st.tick;
    if(U_.kind==='node'||U_.kind==='station')st.unlocked[U_.target]=true;
    if(U_.kind==='pack')st.cap=Math.max(st.cap,U_.cap);
    if(U_.kind==='worker')st.workers.push({id:u,job:U_.job,x:U_.x,y:U_.y,stack:[],stop:0,t:0,wait:0,took:0});
    emit(st,{type:'unlock',id:u,kind:U_.kind});
    if(U_.kind==='station')emit(st,{type:'recipe',station:U_.target,item:STATIONS[U_.target].out});
  }
  function deliver(pz,st,item){
    const r=openReqs(st).filter(x=>x.item===item&&left(x)>0).sort((a,b)=>a.deadline-b.deadline)[0];
    r.got++;emit(st,{type:'deliver',item,lt:r.lt});
    if(r.got>=r.qty){
      r.status='filled';r.closedAt=st.tick;st.earned+=r.reward;
      const spot=COIN_SPOTS[st.fills%COIN_SPOTS.length];st.fills++;
      const pile=st.piles.find(q=>q.x===spot.x&&q.y===spot.y);
      if(pile)pile.n+=r.reward;else st.piles.push({x:spot.x,y:spot.y,n:r.reward});
      emit(st,{type:'fill',item,lt:r.lt,reward:r.reward,tier:ITEMS[item].tier,qty:r.qty});
      st.lts[r.lt].req=null;st.lts[r.lt].readyAt=st.tick+GAP;
    }
  }
  function collectCoins(st){
    const p=st.player;
    for(let i=st.piles.length-1;i>=0;i--){const c=st.piles[i];if(d2(p.x,p.y,c.x,c.y)<=COIN_R*COIN_R){st.wallet+=c.n;emit(st,{type:'coins',n:c.n,x:c.x,y:c.y});st.piles.splice(i,1);}}
  }
  function runStations(st){
    for(const s of STATION_IDS){
      if(!isOpen(st,s))continue;
      const S=st.stations[s],R=STATIONS[s];
      if(S.busy>0){S.busy--;if(S.busy===0){S.out++;S.made++;emit(st,{type:'made',station:s,item:R.out});}}
      if(S.busy===0&&S.out<OUT_MAX&&Object.entries(R.in).every(([k,n])=>S.in[k]>=n)){
        for(const [k,n] of Object.entries(R.in))S.in[k]-=n;S.busy=R.ticks;
      }
    }
  }
  function runWorkers(pz,st){
    for(const w of st.workers){
      const job=JOBS[w.job],stop=job.stops[w.stop],Z=ZONE[stop.z];
      if(!(w.x===Z.x&&w.y===Z.y)){moveToward(w,Z.x,Z.y,st.slow?Math.round(WORKER_SPEED*SLOW):WORKER_SPEED);w.t=0;continue;}
      w.t++;
      const next=()=>{w.stop=(w.stop+1)%job.stops.length;w.t=0;w.wait=0;w.took=0;};
      if(stop.do==='gather'){
        if(w.stack.length>=WORKER_CAP){next();continue;}
        if(w.t%4===0){w.stack.push(Z.item);emit(st,{type:'gather',item:Z.item,zone:stop.z,who:w.id});}
      }else if(stop.do==='unload'){
        if(w.t%2)continue;
        const S=st.stations[Z.key],i=topIndex(w.stack,x=>inputFor(Z.key,x)&&S.in[x]<IN_MAX);
        if(i>=0){const item=w.stack.splice(i,1)[0];S.in[item]++;w.wait=0;emit(st,{type:'load',item,zone:stop.z,who:w.id});}
        else if(!w.stack.some(x=>inputFor(Z.key,x))||++w.wait>40){w.stack=w.stack.filter(x=>inputFor(Z.key,x));next();}
      }else if(stop.do==='take'){
        if(w.t%2)continue;
        const S=st.stations[Z.key];
        if(w.took>=stop.n||w.stack.length>=WORKER_CAP){next();continue;}
        // Runners only take what open requests still need, so they never hoard goods a station could use.
        const item_=STATIONS[Z.key].out;
        if(stop.need&&neededBy(st,item_)<=w.stack.filter(x=>x===item_).length){if(++w.wait>(w.stack.length?10:30))next();continue;}
        if(S.out>0){S.out--;w.took++;const item=STATIONS[Z.key].out;w.stack.push(item);emit(st,{type:'pickup',item,zone:stop.z,who:w.id});}
        else if(++w.wait>(w.stack.length?20:60))next();
      }else if(stop.do==='deliver'){
        if(w.t%2)continue;
        const i=topIndex(w.stack,x=>neededBy(st,x)>0);
        if(i>=0){deliver(pz,st,w.stack.splice(i,1)[0]);w.wait=0;}
        else if(!w.stack.length||++w.wait>30)next();
      }
    }
  }
  function runRequests(pz,st){
    st.lts.forEach((L,i)=>{
      const r=L.req;
      if(r&&st.tick>=r.deadline){r.status='missed';r.closedAt=st.tick;L.req=null;L.readyAt=st.tick+GAP;emit(st,{type:'miss',lt:i,item:r.item});}
      if(!L.req&&st.tick>=L.readyAt){
        const q=rollRequest(pz,st,i);
        const req={...q,openedAt:st.tick,deadline:st.tick+q.duration,status:'open'};
        st.reqs.push(req);L.req=req;L.idx++;emit(st,{type:'open',lt:i,item:req.item});
      }
    });
  }
  function step(pz,st){
    if(st.done)return st;
    runRequests(pz,st);
    movePlayer(st);
    actPlayer(pz,st);
    collectCoins(st);
    runStations(st);
    runWorkers(pz,st);
    st.tick++;
    if(st.tick>=pz.shiftTicks){
      st.done=true;
      for(const r of openReqs(st)){r.status='unfinished';r.closedAt=st.tick;}
    }
    return st;
  }
  // Replay tick-stamped commands. opts.until stops early; opts.state continues from a state.
  function run(pz,commands,opts){
    const o=opts||{},st=o.state?clone(o.state):create(pz,o),list=(commands||[]).slice().sort((a,b)=>a.tick-b.tick),rejected=[];
    let i=0;const until=o.until??Infinity;
    while(!st.done&&st.tick<until){
      while(i<list.length&&list[i].tick<=st.tick){const e=apply(pz,st,list[i].cmd);if(e)rejected.push({...list[i],error:e});i++;}
      step(pz,st);
    }
    return {state:st,rejected};
  }
  function evaluate(pz,st){
    const filled=st.reqs.filter(r=>r.status==='filled'),delivered={};
    for(const r of filled)delivered[r.item]=(delivered[r.item]||0)+r.qty;
    return {score:st.earned,filled:filled.length,missed:st.reqs.filter(r=>r.status==='missed').length,delivered,
      unlocks:UNLOCK_IDS.filter(u=>st.unlocked[u]).length,topTier:Math.max(0,...filled.map(r=>ITEMS[r.item].tier))};
  }
  function tier(pz,ev){
    if(!ev.filled)return 'failed';
    if(ev.score>=pz.perfectAt)return 'perfect';
    if(ev.score>=pz.goodAt)return 'good';
    return 'partial';
  }

  // ---- display data ------------------------------------------------------------------------------------------------
  // What every node and station gives and takes, for signs on the map and the Recipes panel.
  function nodeInfo(id){const N=NODES[id];return {id,zone:'node:'+id,name:N.name,gives:N.item,icon:ITEMS[N.item].icon,color:ITEMS[N.item].color,x:N.x,y:N.y};}
  function stationInfo(st,id){
    const R=STATIONS[id],S=st?st.stations[id]:null;
    return {id,name:R.name,input:'in:'+id,output:'out:'+id,x:R.x,y:R.y,ticks:R.ticks,
      takes:Object.entries(R.in).map(([item,per])=>({item,per,icon:ITEMS[item].icon,loaded:S?S.in[item]:0,
        // progress towards the next batch, e.g. 1/2
        batch:S?Math.min(per,S.in[item]):0})),
      gives:{item:R.out,per:1,icon:ITEMS[R.out].icon,color:ITEMS[R.out].color},
      ready:S?S.out:0,busy:S?S.busy:0,open:st?isOpen(st,id):false,tier:ITEMS[R.out].tier};
  }
  function display(st){
    return {nodes:NODE_IDS.map(id=>({...nodeInfo(id),open:isOpen(st,id)})),stations:STATION_IDS.map(id=>stationInfo(st,id)),
      pads:UNLOCK_IDS.filter(u=>padVisible(st,u)).map(u=>padInfo(st,u))};
  }
  function padInfo(st,u){
    const U_=UNLOCKS[u];
    const gives=U_.kind==='node'?NODES[U_.target].item:U_.kind==='station'?STATIONS[U_.target].out:null;
    return {id:u,zone:'unlock:'+u,kind:U_.kind,name:U_.name,price:U_.price,paid:st.paid[u],left:U_.price-st.paid[u],x:U_.x,y:U_.y,gives,
      recipe:U_.kind==='station'?stationInfo(null,U_.target):null};
  }
  // Where an item comes from (a node, or a station's output pad) and where it is used (station inputs, the dispatch pad).
  function sources(item){return SOURCE[item]?['node:'+SOURCE[item]]:MAKER[item]?['out:'+MAKER[item]]:[];}
  function uses(item){return STATION_IDS.filter(s=>inputFor(s,item)).map(s=>'in:'+s).concat(ITEMS[item].tier?['dispatch']:[]);}
  // Everything needed to make an item, deepest first: the zones to visit and the recipe steps.
  function chain(item){
    const zones=[],items=[],steps=[];
    const visit=it=>{
      if(items.includes(it))return;
      if(MAKER[it]){const s=MAKER[it];for(const k of Object.keys(STATIONS[s].in))visit(k);steps.push({station:s,in:{...STATIONS[s].in},out:it});zones.push('in:'+s,'out:'+s);}
      else zones.push('node:'+SOURCE[it]);
      items.push(it);
    };
    visit(item);
    return {item,items,zones:[...new Set(zones)].concat('dispatch'),steps,stations:steps.map(s=>s.station),
      nodes:items.filter(i=>SOURCE[i]).map(i=>SOURCE[i])};
  }
  // The unlock pad that opens the station or node an item needs (null when it is already open).
  function unlockFor(item){
    if(SOURCE[item])return item==='ore'?null:UNLOCK_IDS.find(u=>UNLOCKS[u].kind==='node'&&UNLOCKS[u].target===SOURCE[item]);
    return MAKER[item]==='refinery'?null:UNLOCK_IDS.find(u=>UNLOCKS[u].kind==='station'&&UNLOCKS[u].target===MAKER[item]);
  }

  // ---- planner -----------------------------------------------------------------------------------------------------
  // A greedy courier. Each tick it decides where to stand: deliver what completes a request, collect coin piles, pay
  // the next unlock in a fixed order once it can afford it, otherwise work the chain of the soonest-due request. It
  // steers with recorded heading changes only: a straight `move` towards the target, a `move` 0,0 on arrival.
  const UNLOCK_ORDER=['crystal','oreHauler','synth','plateRunner','workshop','cellRunner','crystalHauler','pack1','press','salvage','armoury','courier','loom','pack2'];
  const REACT=3,ARRIVE=300;
  const zoneTarget=(id,o)=>({key:id,x:ZONE[id].x,y:ZONE[id].y,...o});
  // What to do so that the player carries n of an item. Returns an action, or null when already carried.
  function obtain(st,item,n,parent,depth){
    const p=st.player,c=count(p.stack,item),room=st.cap-p.stack.length;
    if(c>=n)return null;
    if(SOURCE[item]){
      if(!isOpen(st,SOURCE[item]))return {blocked:true};
      if(room<=0)return {free:true,item,parent};
      return zoneTarget('node:'+SOURCE[item],{verb:'collect',item,n:n-c,parent});
    }
    const s=MAKER[item];if(!isOpen(st,s))return {blocked:true};
    const S=st.stations[s],R=STATIONS[s];
    if(S.out>0){if(room<=0)return {free:true,item,parent};return zoneTarget('out:'+s,{verb:'pickup',item,n:Math.min(S.out,n-c),station:s,parent});}
    const ready=Math.min(...Object.entries(R.in).map(([k,per])=>Math.floor(S.in[k]/per)));
    const pipe=(S.busy>0?1:0)+ready;
    const batches=n-c-pipe;
    if(batches>0&&depth<5){
      for(const [k,per] of Object.entries(R.in)){
        const spare=S.in[k]-ready*per,need=Math.min(batches*per-spare,IN_MAX-S.in[k]);
        if(need<=0)continue;
        const ck=count(p.stack,k),want=Math.min(need,ck+room);
        if(ck>0&&ck>=want)return zoneTarget('in:'+s,{verb:'load',item:k,n:ck,station:s,parent:item});
        if(want<=0)return {free:true,item:k,parent:item};
        const sub=obtain(st,k,want,item,depth+1);
        if(sub&&!sub.blocked)return sub;
        if(sub&&sub.blocked)return sub;
        if(!sub)return zoneTarget('in:'+s,{verb:'load',item:k,n:ck,station:s,parent:item});
      }
    }
    if(pipe>0){
      const leftT=S.busy+Math.max(0,ready-(S.busy>0?0:1))*R.ticks+(S.busy>0?0:R.ticks);
      return zoneTarget('out:'+s,{verb:'wait',wait:true,item,n:n-c,station:s,left:leftT,parent});
    }
    return {blocked:true};
  }
  // Pack full of things the current goal cannot use: drop raws and parts at a hopper that takes them, deliver what a
  // request wants, otherwise scrap the top item.
  function freeUp(st,goal){
    const p=st.player,keep=new Set(chain(goal).items);
    for(let i=p.stack.length-1;i>=0;i--){
      const x=p.stack[i];if(keep.has(x))continue;
      if(neededBy(st,x)>0)return zoneTarget('dispatch',{verb:'deliver',item:x});
      const s=STATION_IDS.find(s=>isOpen(st,s)&&inputFor(s,x)&&st.stations[s].in[x]<IN_MAX);
      if(s)return zoneTarget('in:'+s,{verb:'load',item:x,station:s,free:true});
    }
    // Everything carried is for this goal: unload extras into the goal's hoppers, or scrap.
    for(let i=p.stack.length-1;i>=0;i--){
      const x=p.stack[i],s=STATION_IDS.find(s=>isOpen(st,s)&&inputFor(s,x)&&st.stations[s].in[x]<IN_MAX);
      if(s&&MAKER[goal]!==undefined&&chain(goal).stations.includes(s))return zoneTarget('in:'+s,{verb:'load',item:x,station:s,free:true});
    }
    return zoneTarget('bin',{verb:'scrap'});
  }
  function nextUnlock(st,order){return (order||UNLOCK_ORDER).find(u=>!st.unlocked[u]&&padVisible(st,u))||null;}
  const nearest=(p,list)=>list.slice().sort((a,b)=>d2(p.x,p.y,a.x,a.y)-d2(p.x,p.y,b.x,b.y))[0];
  function decide(pz,st,o){
    const opts=o||{},p=st.player,open=openReqs(st).slice().sort((a,b)=>a.deadline-b.deadline);
    const deliverable=p.stack.filter(x=>neededBy(st,x)>0).length;
    if(deliverable&&(open.some(r=>count(p.stack,r.item)>=left(r))||p.stack.length>=st.cap))return zoneTarget('dispatch',{verb:'deliver',need:open.find(r=>count(p.stack,r.item)>0)});
    const u=opts.noUnlock?null:nextUnlock(st,opts.order),pileSum=st.piles.reduce((a,c)=>a+c.n,0);
    if(st.piles.length){
      const c=nearest(p,st.piles),close=d2(p.x,p.y,c.x,c.y)<=(6*U)*(6*U);
      if(close||(u&&st.wallet<UNLOCKS[u].price-st.paid[u]&&st.wallet+pileSum>=UNLOCKS[u].price-st.paid[u]))
        return {key:'pile:'+c.x+':'+c.y,x:c.x,y:c.y,verb:'coins',n:c.n};
    }
    if(u&&st.wallet>=UNLOCKS[u].price-st.paid[u])return zoneTarget('unlock:'+u,{verb:'unlock',id:u});
    let waiting=null;
    for(const r of open){
      const a=obtain(st,r.item,left(r),null,0);
      if(!a)return zoneTarget('dispatch',{verb:'deliver',need:r});
      if(a.blocked)continue;
      if(a.free){const f=freeUp(st,r.item);f.need=r;f.for=a.item;return f;}
      a.need=r;
      if(a.wait){if(!waiting||a.left<waiting.left)waiting=a;continue;}
      return a;
    }
    if(waiting)return waiting;
    if(deliverable)return zoneTarget('dispatch',{verb:'deliver'});
    if(u)return zoneTarget('unlock:'+u,{verb:'save',id:u});
    return {verb:'idle'};
  }
  // Steering shared by the planner and Skip: aim straight at the target, stop on arrival. Returns the command to give.
  function steer(st,target,mem){
    const p=st.player;
    if(!target||target.x===undefined){if(p.vx||p.vy||p.goto)return {type:'move',x:0,y:0};mem.aim=null;return null;}
    const dx=target.x-p.x,dy=target.y-p.y;
    if(dx*dx+dy*dy<=ARRIVE*ARRIVE){mem.aim=null;mem.react=0;return (p.vx||p.vy)?{type:'move',x:0,y:0}:null;}
    if(mem.aim===target.key&&(p.vx||p.vy))return null;
    if(!(p.vx||p.vy)){ // starting from a standstill takes a moment's reaction
      if(mem.wait!==target.key){mem.wait=target.key;mem.react=REACT;}
      if(mem.react>0){mem.react--;return null;}
    }
    mem.aim=target.key;mem.wait=null;
    return {type:'move',x:dx,y:dy};
  }
  // The planner commits to a task until its job there is done, so hopper levels changing mid-walk do not flip it.
  function taskDone(st,t){
    const p=st.player,here=p.zone===t.key,S=t.station?st.stations[t.station]:null;
    if(st.tick-t.at>400)return true;
    switch(t.verb){
      case 'collect':return p.stack.length>=st.cap||count(p.stack,t.item)>=t.goal;
      case 'load':return !p.stack.some(x=>inputFor(t.station,x)&&S.in[x]<IN_MAX);
      case 'pickup':return p.stack.length>=st.cap||(here&&S.out===0);
      case 'wait':return S.out>0||p.stack.length>=st.cap||(S.busy===0&&!Object.entries(STATIONS[t.station].in).every(([k,n])=>S.in[k]>=n));
      case 'deliver':return !p.stack.some(x=>neededBy(st,x)>0);
      case 'coins':return !st.piles.some(c=>c.x===t.x&&c.y===t.y);
      case 'unlock':return !!st.unlocked[t.id]||st.wallet<=0;
      case 'scrap':return p.stack.length<t.size;
      default:return true;
    }
  }
  function choose(pz,st,opts,mem){
    if(mem.task&&!taskDone(st,mem.task))return mem.task;
    const a=decide(pz,st,opts);
    a.at=st.tick;
    if(a.verb==='collect')a.goal=count(st.player.stack,a.item)+a.n;
    if(a.verb==='scrap')a.size=st.player.stack.length;
    mem.task=a.x===undefined||a.verb==='save'?null:a;
    return a;
  }
  function planOnce(pz,opts){
    const st=create(pz),commands=[],mem={};
    while(!st.done){
      const a=choose(pz,st,opts,mem),cmd=steer(st,a,mem);
      if(cmd&&!apply(pz,st,cmd))commands.push({tick:st.tick,cmd});
      step(pz,st);
    }
    const ev=evaluate(pz,st);
    return {commands,state:st,score:ev.score,filled:ev.filled,unlocks:{...st.unlockedAt}};
  }
  const STYLES=[{},{order:['crystal','synth','oreHauler','workshop','pack1','crystalHauler','press','courier','salvage','armoury','loom','pack2']}];
  function planner(pz){
    let best=null;
    STYLES.forEach((style,i)=>{const r=planOnce(pz,style);r.style=i;if(!best||r.score>best.score)best=r;});
    return best;
  }
  // Skip: a slow courier (half speed, buys no unlocks) plays out the rest of the shift from the current state.
  function auto(pz,st0){
    const st=st0?clone(st0):create(pz);st.fx=null;st.slow=true;st.player.goto=null;
    const mem={};heading(st,0,0);
    while(!st.done){const cmd=steer(st,choose(pz,st,{noUnlock:true},mem),mem);if(cmd)apply(pz,st,cmd);step(pz,st);}
    st.slow=false;
    return {state:st,evaluation:evaluate(pz,st)};
  }

  // ---- hints, near-miss, text --------------------------------------------------------------------------------------
  function zoneName(id){
    const Z=ZONE[id];if(!Z)return 'the coins';
    if(Z.kind==='node')return 'the '+NODES[Z.key].name.toLowerCase();
    if(Z.kind==='in')return `the ${STATIONS[Z.key].name.toLowerCase()}'s input pad`;
    if(Z.kind==='out')return `the ${STATIONS[Z.key].name.toLowerCase()}'s output pad`;
    if(Z.kind==='unlock')return `the ${UNLOCKS[Z.key].name} pad`;
    return 'the '+(Z.kind==='bin'?'scrap bin':'dispatch pad');
  }
  function needText(pz,st,r){return r?`${pz.lts[r.lt].name} needs ${qty(left(r),r.item)} in ${Math.max(0,sec(r.deadline-st.tick))} s`:'';}
  function hintText(pz,st,a){
    const why=a.need?needText(pz,st,a.need):'';
    const station=s=>`the ${STATIONS[s].name.toLowerCase()}`;
    switch(a.verb){
      case 'deliver':return `Walk to the dispatch pad and deliver${why?': '+why:''}.`;
      case 'coins':return `Pick up the ${a.n}-coin pile by the dispatch pad.`;
      case 'unlock':return `Stand on the ${UNLOCKS[a.id].name} pad to unlock it (${UNLOCKS[a.id].price-st.paid[a.id]} coins).`;
      case 'save':return `Save up for the ${UNLOCKS[a.id].name} pad: ${UNLOCKS[a.id].price-st.paid[a.id]} coins.`;
      case 'collect':return `${a.parent?`${ITEMS[a.parent].name} needs ${ITEMS[a.item].plural}`:`Collect ${ITEMS[a.item].plural}`}: walk to ${zoneName(a.key)}.${why?' '+why+'.':''}`;
      case 'pickup':return `${a.parent?`${ITEMS[a.parent].name} needs ${aName(a.item)}`:`${ITEMS[a.item].name}s are ready`}: walk to ${zoneName(a.key)}.${why?' '+why+'.':''}`;
      case 'load':return a.free?`Pack full: drop your ${ITEMS[a.item].plural} at ${zoneName(a.key)}.`:`Load your ${ITEMS[a.item].plural} into ${station(a.station)}: walk to its input pad.${why?' '+why+'.':''}`;
      case 'wait':return `Wait on ${zoneName(a.key)}: ${aName(a.item)} is ready in ${Math.max(1,Math.ceil(a.left/TPS))} s.${why?' '+why+'.':''}`;
      case 'scrap':return 'Pack full of things nobody needs: drop the top one in the scrap bin.';
      default:return 'All caught up. Collect raw materials to keep the stations busy.';
    }
  }
  // Hint: where the planner would walk next from here, with the chain step named.
  function hint(pz,st){
    const a=decide(pz,st,{});
    return {target:a.x===undefined?null:{key:a.key,x:a.x,y:a.y},zone:ZONE[a.key]?a.key:null,text:hintText(pz,st,a),action:a};
  }
  const reqLabel=(pz,r)=>`${pz.lts[r.lt].name}'s ${qty(r.qty,r.item)}`;
  // Near-miss: the first request you missed, then the first unlock you got later than the planner (or never).
  function nearMiss(pz,commands,stIn){
    const st=stIn||run(pz,commands).state,ev=evaluate(pz,st);
    if(ev.score>=pz.perfectAt)return '';
    const out=[];
    const miss=st.reqs.filter(r=>r.status==='missed'||r.status==='unfinished').sort((a,b)=>a.closedAt-b.closedAt)[0];
    if(miss)out.push(miss.status==='missed'?`Missed ${reqLabel(pz,miss)} at ${clock(miss.closedAt)} with ${miss.got} of ${miss.qty} delivered.`
      :`${reqLabel(pz,miss)} was still open at the bell.`);
    const theirs=Object.entries(pz.parUnlocks||{}).sort((a,b)=>a[1]-b[1]);
    for(const [u,t] of theirs){
      const mine=st.unlockedAt[u];
      if(mine===undefined||mine>t+150){out.push(`The planner unlocked the ${UNLOCKS[u].name} at ${clock(t)}; ${mine===undefined?'you never did':'you at '+clock(mine)}. Earlier unlocks open richer requests.`);break;}
    }
    out.push(`${pz.perfectAt-ev.score} credits short of Perfect (${pz.perfectAt}).`);
    return out.join(' ');
  }
  function output(pz,ev){
    const parts=CRAFTED.filter(k=>ev.delivered[k]).map(k=>qty(ev.delivered[k],k));
    return parts.length?`${parts.join(', ')} to the lieutenants' fronts (${ev.filled} request${ev.filled===1?'':'s'} filled)`:'Nothing reached the fronts this shift';
  }

  const api={TICK_MS,TPS,U,MAP,SPEED,WORKER_SPEED,CARRY,IN_MAX,OUT_MAX,WORKER_CAP,GAP,DWELL,PERIOD,PERFECT,GOOD,RELAXED,
    ITEMS,ITEM_IDS,RAW,CRAFTED,NODES,STATIONS,NODE_IDS,STATION_IDS,DISPATCH,BIN,COIN_SPOTS,COIN_R,START,JOBS,UNLOCKS,UNLOCK_IDS,
    UNLOCK_ORDER,ZONE,SOURCE,MAKER,LTS,DIFFICULTIES,REACT,ARRIVE,STYLES,
    generate,create,clone,validate,apply,step,run,evaluate,tier,planner,planOnce,auto,decide,choose,taskDone,steer,obtain,hint,hintText,nearMiss,output,
    zoneAt,activeZones,zoneActive,padVisible,display,nodeInfo,stationInfo,padInfo,sources,uses,chain,unlockFor,zoneName,
    rollRequest,count,clock,qty,sec,left,openReqs,neededBy};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.SupplyRun=api;
})(typeof globalThis==='object'?globalThis:this);
