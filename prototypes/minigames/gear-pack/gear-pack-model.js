// Gear assembly (Logistics, night). Exploration posts gear orders at dusk: "Gear kit for Daven (Sustain): Guard ≥ 8,
// Pace ≥ 3, fits a 4×3 frame". Overnight, logistics picks parts from a small tray (whatever the supply run made) and
// fits them into each order's frame so every stat target is met. Each part shows its stat plainly before placement.
// Two synergy rules, drawn on the parts:
//   Power: a part touching a Power cell gets +1 to its own stat (+1 per Power cell it touches).
//   Focus: a Ranging lens touching a Sequencer adds +2 Burst to that Sequencer.
// Spare frame space is fine. Par = the solver's minimum total parts that meets every order together; Perfect needs
// every order met at par, with no hints and without the Relaxed assist.
// Pure rules, no DOM: deterministic from (seed, difficulty). Loads as a classic script (window.GearPack) or in Node.
(function(root){
  'use strict';
  const Kit=typeof module==='object'&&module.exports&&typeof require==='function'?require('../../shared/minigames/minigame-kit.js'):root.MiniGameKit;
  const STATS=['Guard','Pace','Burst','Mend'];
  const STAT_INFO={Guard:{color:'#92b9e4',icon:'⛨'},Pace:{color:'#8fd18a',icon:'»'},Burst:{color:'#f0a08c',icon:'✶'},Mend:{color:'#c7a8f0',icon:'✚'}};
  const POWER=1,FOCUS=2,MAXK=5;
  const parse=s=>{const out=[];s.split('|').forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='X')out.push([x,y]);}));return out;};
  const T=(name,code,stat,value,color,shape,rule,text)=>({name,code,stat,value,color,shape:parse(shape),rule:rule||null,text});
  const TYPES={
    cell:T('Power cell','Pw',null,0,'#e7c18b','XX','power','No stat of its own. Each part touching it gets +1 to its stat.'),
    lens:T('Ranging lens','Ln','Burst',1,'#f6dfae','X','focus','Burst +1. Adds +2 Burst to a Sequencer it touches.'),
    sequencer:T('Sequencer','Sq','Burst',2,'#d9a066','XXX',null,'Burst +2. A touching Ranging lens adds +2 more.'),
    bore:T('Bore','Br','Burst',3,'#e6a48d','XXX|X..',null,'Burst +3.'),
    plate:T('Catch plate','Pl','Guard',3,'#92b9e4','XX|X.',null,'Guard +3.'),
    lattice:T('Barrier lattice','Lt','Guard',4,'#7c9fd8','XXXX',null,'Guard +4.'),
    pin:T('Brace pin','Bp','Guard',1,'#b6cdee','X',null,'Guard +1.'),
    bell:T('Recovery bell','Bl','Mend',2,'#c7a8f0','X|X',null,'Mend +2.'),
    vessel:T('Culture vessel','Vs','Mend',4,'#a98bd8','XX|XX',null,'Mend +4.'),
    spring:T('Return spring','Sp','Pace',2,'#8fd18a','XX',null,'Pace +2.'),
    relay:T('Charge relay','Rl','Pace',3,'#6cc49a','XXX|.X.',null,'Pace +3.')
  };
  const ROLES={
    Sustain:{main:'Guard',side:['Pace','Mend']},
    DPS:{main:'Burst',side:['Pace','Guard']},
    Support:{main:'Mend',side:['Pace','Guard']}
  };
  const CREW=[['Daven','Sustain'],['Hanae','Support'],['Ivara','DPS'],['Arunima','Support'],['Roonie','DPS'],['Veska','Sustain'],['Silen','DPS']];
  const RULES=[
    '<b>Orders</b> come from exploration at dusk: a crewmate, the stats their kit needs, and the frame it must fit.',
    '<b>Choose parts</b> from the tray: each card shows its stat. Tap a part, then a frame cell (or drag it there); ↻ turns it.',
    '<b>Power</b> ⚡: a part touching a Power cell gets <b>+1</b> to its stat. The bolts on the cell light up when they touch.',
    '<b>Focus</b> ◎: a Ranging lens touching a Sequencer adds <b>+2 Burst</b> to it.',
    'Meet every target. Spare frame space is fine. <b>Perfect</b>: every order met with the fewest parts (par), no hints, not Relaxed.',
    'Tap a stat bar to see which parts feed it. Parts you leave in the tray stay in stock for other orders.'
  ];
  const ASSIST_LEVELS=[
    {id:'puzzle',label:'Puzzle',note:'Just the parts and the rules.'},
    {id:'guided',label:'Guided',note:'Parts that can still help an unmet target glow in the tray.'},
    {id:'relaxed',label:'Relaxed',note:'Tap a part and it drops into its best spot. Results are never Perfect.'}
  ];
  const DIFFICULTIES=[
    {id:'easy',label:'Easy · 1 order',target:60,orders:[1,1],frames:[[4,3]],targets:[2,2],plant:[3,3],decoys:[2,2]},
    {id:'normal',label:'Normal · 1 order',target:90,orders:[1,1],frames:[[4,3],[5,3]],targets:[2,3],plant:[3,4],decoys:[2,3]},
    {id:'hard',label:'Hard · 2 orders',target:150,orders:[2,2],frames:[[3,3],[4,3],[5,3]],targets:[2,3],plant:[3,4],decoys:[2,3]},
    {id:'expert',label:'Expert · 2–3 orders',target:210,orders:[2,3],frames:[[3,3],[4,3],[4,4],[5,3]],targets:[2,3],plant:[3,4],decoys:[2,3]}
  ];
  const SIDES=[[-1,0,'l'],[1,0,'r'],[0,-1,'t'],[0,1,'b']];

  // ---- geometry ----
  const R1=([x,y])=>[-y,x];
  const turn=(pts,r)=>{let o=pts;for(let k=0;k<((r%4)+4)%4;k++)o=o.map(R1);return o;};
  function orient(shape,r){const c=turn(shape,r),mx=Math.min(...c.map(p=>p[0])),my=Math.min(...c.map(p=>p[1]));return {cells:c.map(([x,y])=>[x-mx,y-my]),off:[mx,my]};}
  // The pivot is the cell nearest the shape's centre: the cell that lands under your finger.
  function pivot(cells){const cx=cells.reduce((s,c)=>s+c[0],0)/cells.length,cy=cells.reduce((s,c)=>s+c[1],0)/cells.length;let best=cells[0],d=1e9;for(const c of cells){const v=(c[0]-cx)**2+(c[1]-cy)**2;if(v<d-1e-9){d=v;best=c;}}return best;}
  const size=type=>TYPES[type].shape.length;
  const popcount=m=>{let n=0;while(m){m&=m-1;n++;}return n;};
  // Every placement of a part type in a w×h frame: {rot,x,y,mask,nbr}. Rotations with the same footprint are kept once
  // (the lowest rot), so the solver does not repeat itself. mask/nbr are bit sets over the frame's cells (y*w+x).
  const PLC=new Map();
  function placements(type,w,h){
    const key=`${type}|${w}|${h}`;let L=PLC.get(key);if(L)return L;L=[];const seen=new Set();
    for(let r=0;r<4;r++){const o=orient(TYPES[type].shape,r).cells,sig=o.map(c=>c.join(',')).sort().join(';');if(seen.has(sig))continue;seen.add(sig);
      const ow=Math.max(...o.map(c=>c[0]))+1,oh=Math.max(...o.map(c=>c[1]))+1;
      for(let y=0;y+oh<=h;y++)for(let x=0;x+ow<=w;x++){let mask=0,nbr=0;
        for(const [cx,cy] of o)mask|=1<<((y+cy)*w+x+cx);
        for(const [cx,cy] of o)for(const [dx,dy] of SIDES){const X=x+cx+dx,Y=y+cy+dy;if(X>=0&&Y>=0&&X<w&&Y<h)nbr|=1<<(Y*w+X);}
        L.push({rot:r,x,y,mask,nbr:nbr&~mask});}}
    PLC.set(key,L);return L;
  }
  function footprint(type,p,w,h){const o=orient(TYPES[type].shape,p.rot).cells;let mask=0,nbr=0,out=false;
    for(const [cx,cy] of o){const X=p.x+cx,Y=p.y+cy;if(X<0||Y<0||X>=w||Y>=h)out=true;else mask|=1<<(Y*w+X);}
    for(const [cx,cy] of o)for(const [dx,dy] of SIDES){const X=p.x+cx+dx,Y=p.y+cy+dy;if(X>=0&&Y>=0&&X<w&&Y<h)nbr|=1<<(Y*w+X);}
    return {mask,nbr:nbr&~mask,out};}
  const cellsAt=(type,p)=>orient(TYPES[type].shape,p.rot).cells.map(([x,y])=>[p.x+x,p.y+y]);

  // ---- stats of one frame ----
  // items: [{i,type,mask,nbr}]. Returns totals per stat and where every point came from:
  // from[stat] = [{part, amount, kind:'base'|'power'|'focus', via}] (via = the Power cell or lens that gave it).
  function frameStats(items,syn=true){
    const tot={},from={};for(const s of STATS){tot[s]=0;from[s]=[];}
    for(const a of items){const t=TYPES[a.type];if(!t.stat)continue;
      tot[t.stat]+=t.value;from[t.stat].push({part:a.i,amount:t.value,kind:'base',via:-1});
      if(!syn)continue;
      for(const b of items){if(b===a||!(b.mask&a.nbr))continue;const r=TYPES[b.type].rule;
        if(r==='power'){tot[t.stat]+=POWER;from[t.stat].push({part:a.i,amount:POWER,kind:'power',via:b.i});}
        else if(r==='focus'&&a.type==='sequencer'){tot.Burst+=FOCUS;from.Burst.push({part:a.i,amount:FOCUS,kind:'focus',via:b.i});}}}
    return {tot,from};
  }
  const meets=(tot,targets)=>Object.entries(targets).every(([s,v])=>tot[s]>=v);
  const progress=(tot,targets)=>Object.entries(targets).reduce((n,[s,v])=>n+Math.min(tot[s],v),0);

  // ---- rules ----
  const initial=P=>({placed:P.parts.map(()=>null)});
  const isInt=v=>Number.isInteger(v);
  const partName=(P,i)=>TYPES[P.parts[i].type].name;
  const crewOf=(P,o)=>P.orders[o].crew;
  // The parts in frame o as solver items, optionally leaving one part out.
  function itemsIn(P,st,o,skip=-1){const O=P.orders[o],out=[];
    st.placed.forEach((p,i)=>{if(!p||p.order!==o||i===skip)return;const f=footprint(P.parts[i].type,p,O.w,O.h);out.push({i,type:P.parts[i].type,mask:f.mask,nbr:f.nbr});});return out;}
  function validate(P,st,m){
    if(!m||typeof m!=='object')return 'Unknown move.';
    if(!isInt(m.part)||m.part<0||m.part>=P.parts.length)return 'Unknown part.';
    if(m.type==='remove')return st.placed[m.part]?null:'That part is still in the tray.';
    if(m.type!=='place')return 'Unknown move.';
    if(!isInt(m.order)||m.order<0||m.order>=P.orders.length)return 'Unknown order.';
    if(!isInt(m.rot)||m.rot<0||m.rot>3||!isInt(m.x)||!isInt(m.y))return 'Pick a cell in a frame.';
    const O=P.orders[m.order],f=footprint(P.parts[m.part].type,m,O.w,O.h);
    if(f.out)return `That runs outside ${O.crew}'s ${O.w}×${O.h} frame.`;
    for(const it of itemsIn(P,st,m.order,m.part))if(it.mask&f.mask)return `That overlaps the ${partName(P,it.i)}.`;
    return null;
  }
  // Apply a move to a copy of the state. Invalid moves return {error} and leave the state untouched.
  function apply(P,st,m){
    const err=validate(P,st,m);if(err)return {error:err};
    const s={placed:st.placed.slice()};
    s.placed[m.part]=m.type==='place'?{order:m.order,rot:m.rot,x:m.x,y:m.y}:null;
    return {state:s};
  }
  // Full evaluation for display, scoring, hints and output.
  //   orders[o]: {stats:{Guard:{value,target,met,from}}, met, parts:[i], missing:[{stat,value,target}]}
  //   marks: synergy markers drawn on Power cells and lenses: one per cell edge facing another cell of the frame.
  function evaluate(P,st){
    const orders=P.orders.map((O,o)=>{
      const items=itemsIn(P,st,o),fs=frameStats(items),stats={};
      for(const [s,v] of Object.entries(O.targets))stats[s]={value:fs.tot[s],target:v,met:fs.tot[s]>=v,from:fs.from[s]};
      const extra={};for(const s of STATS)if(!(s in O.targets)&&fs.tot[s])extra[s]=fs.tot[s];
      const missing=Object.entries(stats).filter(([,v])=>!v.met).map(([stat,v])=>({stat,value:v.value,target:v.target}));
      return {stats,extra,met:!missing.length,missing,parts:items.map(x=>x.i),progress:progress(fs.tot,O.targets),tot:fs.tot};
    });
    const marks=[];
    st.placed.forEach((p,i)=>{if(!p)return;const t=TYPES[P.parts[i].type];if(!t.rule)return;const O=P.orders[p.order];
      const grid=new Map();st.placed.forEach((q,j)=>{if(q&&q.order===p.order)for(const [x,y] of cellsAt(P.parts[j].type,q))grid.set(x+','+y,j);});
      for(const [x,y] of cellsAt(P.parts[i].type,p))for(const [dx,dy,side] of SIDES){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=O.w||Y>=O.h)continue;const j=grid.get(X+','+Y);if(j===i)continue;
        const tj=j===undefined?null:P.parts[j].type;
        const lit=tj!==null&&(t.rule==='power'?!!TYPES[tj].stat:tj==='sequencer');
        marks.push({part:i,order:p.order,x,y,side,kind:t.rule,lit,by:lit?j:-1});}});
    const used=st.placed.filter(Boolean).length,met=orders.filter(o=>o.met).length;
    return {orders,marks,used,met,allMet:met===P.orders.length};
  }
  // tier(P, ev, {hints, level}): Perfect needs every order met at par, no hints, and no Relaxed assist.
  function tier(P,ev,opt={}){
    if(ev.allMet)return ev.used<=P.par&&!opt.hints&&opt.level!=='relaxed'?'perfect':'good';
    return ev.met?'partial':'failed';
  }

  // ---- solver ----
  // Can frame o take these free parts (plus its fixed items) and meet its targets? Returns placements or null.
  // Power cells and lenses are placed first, then the rest largest first; an upper bound on every target prunes.
  function pack(P,o,fixed,free,syn){
    const O=P.orders[o],w=O.w,h=O.h,targets=Object.entries(O.targets);
    const rank=t=>TYPES[t].rule==='power'?0:TYPES[t].rule==='focus'?1:2;
    const list=free.slice().sort((a,b)=>rank(P.parts[a].type)-rank(P.parts[b].type)||size(P.parts[b].type)-size(P.parts[a].type)||(P.parts[a].type<P.parts[b].type?-1:P.parts[a].type>P.parts[b].type?1:0)||a-b);
    const all=fixed.concat(list.map(i=>({i,type:P.parts[i].type})));
    const nPow=syn?all.filter(x=>TYPES[x.type].rule==='power').length:0,nLens=syn?all.filter(x=>TYPES[x.type].rule==='focus').length:0;
    const placed=fixed.slice(),out=[];let occ=0;for(const f of fixed)occ|=f.mask;
    const bound=k=>{
      const b={};for(const [s] of targets)b[s]=0;
      let powLeft=0,lensLeft=0;for(let j=k;j<list.length;j++){const r=TYPES[P.parts[list[j]].type].rule;if(r==='power'&&syn)powLeft++;if(r==='focus'&&syn)lensLeft++;}
      for(const a of placed){const t=TYPES[a.type];if(!t.stat||!(t.stat in b))continue;let v=t.value;
        if(syn){for(const c of placed)if(c!==a&&(c.mask&a.nbr)){const r=TYPES[c.type].rule;if(r==='power')v+=POWER;else if(r==='focus'&&a.type==='sequencer')v+=FOCUS;}
          v+=powLeft*POWER;if(a.type==='sequencer')v+=lensLeft*FOCUS;}
        b[t.stat]+=v;}
      for(let j=k;j<list.length;j++){const ty=P.parts[list[j]].type,t=TYPES[ty];if(!t.stat||!(t.stat in b))continue;b[t.stat]+=t.value+nPow*POWER+(ty==='sequencer'?nLens*FOCUS:0);}
      return targets.every(([s,v])=>b[s]>=v);
    };
    const dfs=(k,minIdx)=>{
      if(!bound(k))return false;
      if(k===list.length)return meets(frameStats(placed,syn).tot,O.targets);
      const i=list[k],ty=P.parts[i].type,L=placements(ty,w,h),sameAsPrev=k>0&&P.parts[list[k-1]].type===ty;
      for(let n=sameAsPrev?minIdx+1:0;n<L.length;n++){const pl=L[n];if(pl.mask&occ)continue;
        occ|=pl.mask;placed.push({i,type:ty,mask:pl.mask,nbr:pl.nbr});out.push({part:i,order:o,rot:pl.rot,x:pl.x,y:pl.y});
        if(dfs(k+1,n))return true;
        occ&=~pl.mask;placed.pop();out.pop();}
      return false;
    };
    return dfs(0,-1)?out.slice():null;
  }
  // Inclusion-minimal sets of free parts that complete frame o (with what is already in it). [{mask, moves}]
  function options(P,st,o,freeIdx,syn){
    const O=P.orders[o],fixed=itemsIn(P,st,o),area=O.w*O.h;let used=0;for(const f of fixed)used+=popcount(f.mask);
    if(meets(frameStats(fixed,syn).tot,O.targets))return [{mask:0,moves:[]}];
    const cand=freeIdx.filter(i=>{const t=TYPES[P.parts[i].type];return t.stat?t.stat in O.targets:syn&&t.rule==='power';});
    const n=cand.length,found=[],byK=[];
    for(let m=1;m<(1<<n);m++){const k=popcount(m);if(k>MAXK)continue;(byK[k]||(byK[k]=[])).push(m);}
    for(const list of byK){if(!list)continue;
      for(const m of list){
        if(found.some(f=>(f.local&m)===f.local))continue;
        const parts=[];let cells=used;for(let b=0;b<n;b++)if(m>>b&1){parts.push(cand[b]);cells+=size(P.parts[cand[b]].type);}
        if(cells>area)continue;
        const moves=pack(P,o,fixed,parts,syn);
        if(moves){let mask=0;for(const i of parts)mask|=1<<i;found.push({local:m,mask,moves});}
      }}
    return found.map(f=>({mask:f.mask,moves:f.moves}));
  }
  // The fewest parts that meet every order together, keeping what st already has placed (pass initial(P) for par).
  // Returns {total, added, moves} or null. opt.syn=false switches the synergy rules off (a generator check).
  function solve(P,st,opt={}){
    const syn=opt.syn!==false,free=P.parts.map((_,i)=>i).filter(i=>!st.placed[i]);
    const opts=P.orders.map((_,o)=>options(P,st,o,free,syn).sort((a,b)=>popcount(a.mask)-popcount(b.mask)));
    if(opts.some(l=>!l.length))return null;
    const order=P.orders.map((_,o)=>o).sort((a,b)=>opts[a].length-opts[b].length||a-b);
    let best=null;const pick=[];
    const dfs=(k,used,n)=>{
      if(best&&n>=best.n)return;
      if(k===order.length){best={n,pick:pick.slice()};return;}
      for(const op of opts[order[k]]){if(op.mask&used)continue;pick.push(op);dfs(k+1,used|op.mask,n+popcount(op.mask));pick.pop();}
    };
    dfs(0,0,0);if(!best)return null;
    const moves=best.pick.flatMap(op=>op.moves).map(m=>({type:'place',...m}));
    return {total:st.placed.filter(Boolean).length+best.n,added:best.n,moves};
  }
  const stateFrom=(P,moves)=>{let s=initial(P);for(const m of moves){const r=apply(P,s,m);if(r.error)throw new Error(r.error);s=r.state;}return s;};

  // ---- greedy helpers (Skip, Relaxed and Guided) ----
  // How much closer part i at placement m gets its order (capped at the targets), from st without i.
  function gainAt(P,st,i,m){
    const r=apply(P,st,{type:'place',part:i,...m});if(r.error)return null;
    const O=P.orders[m.order],before=st.placed[i]&&st.placed[i].order===m.order?apply(P,st,{type:'remove',part:i}).state:st;
    const a=frameStats(itemsIn(P,before,m.order)).tot,b=frameStats(itemsIn(P,r.state,m.order)).tot;
    return progress(b,O.targets)-progress(a,O.targets);
  }
  // Best spot for part i across every frame whose order is still short: {order,rot,x,y,gain} or null.
  function greedySpot(P,st,i,onlyOrder){
    const ev=evaluate(P,st),ty=P.parts[i].type;let best=null;
    P.orders.forEach((O,o)=>{if(onlyOrder!==undefined&&o!==onlyOrder)return;if(ev.orders[o].met&&!(st.placed[i]&&st.placed[i].order===o))return;
      for(const pl of placements(ty,O.w,O.h)){const m={order:o,rot:pl.rot,x:pl.x,y:pl.y},g=gainAt(P,st,i,m);if(g===null)continue;
        if(!best||g>best.gain)best={...m,gain:g};}});
    return best;
  }
  // Can part i (in the tray) still push an unmet target? (Guided highlight.)
  function helps(P,st,i){if(st.placed[i])return false;const s=greedySpot(P,st,i);return !!s&&s.gain>0;}
  // The automatic fallback: order by order, add whichever part and spot helps most right now, until met or stuck.
  // It looks one part ahead only, so it often spends extra parts or leaves a target short.
  function autoAssembly(P){
    let st=initial(P);
    P.orders.forEach((O,o)=>{
      for(let guard=0;guard<P.parts.length;guard++){
        if(evaluate(P,st).orders[o].met)break;let best=null;
        P.parts.forEach((pt,i)=>{if(st.placed[i])return;const s=greedySpot(P,st,i,o);if(s&&s.gain>0&&(!best||s.gain>best.gain||(s.gain===best.gain&&size(pt.type)<size(P.parts[best.i].type))))best={...s,i};});
        if(!best)break;st=apply(P,st,{type:'place',part:best.i,order:o,rot:best.rot,x:best.x,y:best.y}).state;
      }});
    const ev=evaluate(P,st);return {state:st,used:ev.used,met:ev.met,allMet:ev.allMet};
  }

  // ---- generator: plant an assembly per order, add decoys, verify with the solver ----
  function plantOrder(d,R,O,pool){
    const stats=Object.keys(O.targets),byStat=s=>Object.keys(TYPES).filter(k=>TYPES[k].stat===s);
    for(let attempt=0;attempt<40;attempt++){
      const n=R.range(d.plant[0],d.plant[1]),types=[];
      const power=R.chance(0.8),focus=stats.includes('Burst')&&R.chance(0.45)&&n-(power?1:0)>=3;
      if(power)types.push('cell');
      if(focus)types.push('lens','sequencer');
      for(const s of stats)if(!types.some(t=>TYPES[t].stat===s))types.push(R.pick(byStat(s)));
      while(types.length<n)types.push(R.pick(byStat(R.chance(0.6)?stats[0]:R.pick(stats))));
      if(types.length>n||types.reduce((a,t)=>a+size(t),0)>O.w*O.h-1)continue;
      // Arrange: Power cell first, then the rest preferring spots that touch it (and lens beside sequencer).
      const items=[];let occ=0,ok=true;
      for(const ty of types){
        let best=null,bv=-1e9;
        for(const pl of placements(ty,O.w,O.h)){if(pl.mask&occ)continue;let v=R.next();
          for(const it of items){if(!(it.mask&pl.nbr))continue;const r=TYPES[it.type].rule;
            if(r==='power'&&TYPES[ty].stat)v+=3;if(ty==='sequencer'&&r==='focus')v+=4;if(ty==='lens'&&it.type==='sequencer')v+=4;}
          if(v>bv){bv=v;best=pl;}}
        if(!best){ok=false;break;}
        occ|=best.mask;items.push({i:pool+items.length,type:ty,mask:best.mask,nbr:best.nbr,p:{rot:best.rot,x:best.x,y:best.y}});
      }
      if(!ok)continue;
      const fs=frameStats(items);
      // Every planted synergy part must earn its place: a Power cell powering 2+ parts, a lens focusing its Sequencer.
      if(power){const c=items[0],n2=items.filter(it=>it!==c&&TYPES[it.type].stat&&(it.mask&c.nbr)).length;if(n2<2)continue;}
      if(focus&&!fs.from.Burst.some(f=>f.kind==='focus'))continue;
      const targets={};for(const s of stats)targets[s]=fs.tot[s];
      if(targets[stats[0]]<5||stats.some(s=>targets[s]<2))continue;
      return {types,items,targets};
    }
    return null;
  }
  function build(seed,d,R){
    const nOrders=R.range(d.orders[0],d.orders[1]),crew=R.shuffle(CREW).slice(0,nOrders),frames=R.shuffle(d.frames);
    const orders=crew.map(([name,role],o)=>{const f=frames[o%frames.length],R0=ROLES[role],k=R.range(d.targets[0],d.targets[1]);
      const stats=[R0.main,...R.shuffle(R0.side).slice(0,k-1)];return {crew:name,role,w:f[0],h:f[1],targets:Object.fromEntries(stats.map(s=>[s,0]))};});
    const parts=[],plants=[];
    for(const O of orders){const pl=plantOrder(d,R,O,parts.length);if(!pl)return null;O.targets=Object.fromEntries(STATS.filter(s=>s in pl.targets).map(s=>[s,pl.targets[s]]));
      pl.types.forEach(t=>parts.push({type:t}));plants.push(pl);}
    // Decoys: a part with a stat some order wants but a worse shape or value, an extra Power cell, or an off-stat part.
    const wanted=[...new Set(orders.flatMap(O=>Object.keys(O.targets)))],nd=R.range(d.decoys[0],d.decoys[1]);
    for(let k=0;k<nd;k++){const r=R.next();let t;
      if(r<0.6){const s=R.pick(wanted);t=R.pick(Object.keys(TYPES).filter(x=>TYPES[x].stat===s));}
      else if(r<0.75&&parts.filter(p=>p.type==='cell').length<=orders.length)t='cell';else t=R.pick(Object.keys(TYPES).filter(x=>TYPES[x].stat&&!wanted.includes(TYPES[x].stat)));
      if(!t)t=R.pick(Object.keys(TYPES));parts.push({type:t});}
    // Tray order: shuffled, so the planted parts are not grouped. Plant moves are remapped to the new indices.
    const perm=R.shuffle(parts.map((_,i)=>i)),inv=[];perm.forEach((old,nw)=>{inv[old]=nw;});
    const P={game:'gear-pack',seed,difficulty:d.id,orders,parts:perm.map(i=>parts[i])};
    const plantMoves=plants.flatMap((pl,o)=>pl.items.map(it=>({type:'place',part:inv[it.i],order:o,...it.p})));
    const plantState=stateFrom(P,plantMoves);if(!evaluate(P,plantState).allMet)return null;
    // A single part never meets an order alone (orders have 2+ stats), but a target must not be met for free either.
    if(orders.some(O=>Object.values(O.targets).some(v=>v<2)))return null;
    const sol=solve(P,initial(P));if(!sol)return null;
    // Synergy must matter: without the two rules the tray needs more parts, or cannot meet the orders at all.
    const flat=solve(P,initial(P),{syn:false});
    if(flat&&flat.total<=sol.total)return null;
    const auto=autoAssembly(P);
    if(auto.allMet&&auto.used<=sol.total&&R.chance(d.id==='easy'?0.7:0.9))return null; // most puzzles beat the one-step greedy
    return Object.assign(P,{par:sol.total,solution:sol.moves,plant:plantMoves,
      checks:{plantParts:plantMoves.length,par:sol.total,flatPar:flat?flat.total:null,autoUsed:auto.used,autoMet:auto.met,autoBelowPar:!auto.allMet||auto.used>sol.total}});
  }
  function generate(seed,difficulty){
    const d=DIFFICULTIES.find(x=>x.id===difficulty)||DIFFICULTIES[1],R=Kit.rng(Kit.hashSeed(`gear-pack|${seed}|${d.id}`));
    for(let attempt=0;attempt<200;attempt++){const P=build(seed,d,R);if(P){P.attempts=attempt+1;return P;}}
    throw new Error(`gear-pack: no puzzle for seed ${seed} (${d.id})`);
  }

  // ---- player help ----
  const statLine=(stats,keys)=>keys.map(s=>`${s} ${stats[s]}`).join(' · ');
  // Why a placement helps, in words: "Catch plate + Power cell gets Daven to Guard 8".
  function reason(P,st,m){
    const before=evaluate(P,st),r=apply(P,st,m);if(r.error)return '';const after=evaluate(P,r.state),o=m.order,O=P.orders[o];
    const i=m.part,t=TYPES[P.parts[i].type],names=new Set([t.name]);
    let best=null;
    for(const [s,v] of Object.entries(after.orders[o].stats)){const was=before.orders[o].stats[s].value;if(v.value===was)continue;
      for(const f of v.from){if(f.part===i&&f.via>=0)names.add(partName(P,f.via));if(f.via===i)names.add(partName(P,f.part));}
      const c={s,v,was,gain:Math.min(v.value,v.target)-Math.min(was,v.target)};if(!best||c.gain>best.gain)best=c;}
    if(!best)return t.rule==='power'?`the Power cell will give +1 to each part fitted beside it`:`the ${t.name} adds nothing ${O.crew}'s order still needs`;
    const who=[...names].join(' + ');
    return best.v.met?`${who} gets ${O.crew} to ${best.s} ${best.v.value} (needs ${best.v.target})`:`${who} brings ${O.crew}'s ${best.s} to ${best.v.value} of ${best.v.target}`;
  }
  const isPar=(P,st)=>{const ev=evaluate(P,st);return ev.allMet&&ev.used<=P.par;};
  // One move toward a par solution, with its reason. Keeps the player's placements when par is still reachable with
  // them; otherwise lifts or moves the one part that blocks par; otherwise steps toward the stored solution.
  function hint(P,st){
    if(isPar(P,st))return null;
    // The step that helps most right now; on ties, ordinary parts before Power cells (which pay once neighbours arrive).
    const best=(moves,s)=>{let b=null;for(const m of moves){const g=gainAt(P,s,m.part,m);if(g===null)continue;const v=g*2+(TYPES[P.parts[m.part].type].rule==='power'?0:1);if(!b||v>b.v)b={m,v};}return b&&b.m;};
    const placeHint=(m,why)=>({move:m,text:`Put the ${partName(P,m.part)} in ${crewOf(P,m.order)}'s frame on the glowing cells: ${why||reason(P,st,m)}.`});
    const keep=solve(P,st);
    if(keep&&keep.total<=P.par&&keep.moves.length)return placeHint(best(keep.moves,st));
    // Lift or move one placed part.
    const placed=st.placed.map((p,i)=>p?i:-1).filter(i=>i>=0);
    for(const i of placed){const s2=apply(P,st,{type:'remove',part:i}).state,sol=solve(P,s2);if(!sol||sol.total>P.par)continue;
      const mv=sol.moves.find(m=>m.part===i);
      if(mv){const r=apply(P,st,mv);if(!r.error)return placeHint(mv,`it does more there. ${reason(P,s2,mv)}`);}
      if(!mv||apply(P,st,mv).error)return {move:{type:'remove',part:i},text:`Lift the ${partName(P,i)} back to the tray: par ${P.par} does not need it ${mv?'where it is':'at all'}.`};}
    // Far from par: step toward the stored solution. Blocking parts go back to the tray first.
    const S=P.solution;
    for(const i of placed){const m=S.find(x=>x.part===i);if(!m)return {move:{type:'remove',part:i},text:`Lift the ${partName(P,i)} back to the tray: par ${P.par} does not use it.`};}
    const todo=S.filter(m=>{const p=st.placed[m.part];return !(p&&p.order===m.order&&p.rot===m.rot&&p.x===m.x&&p.y===m.y);});
    const open=best(todo.filter(m=>!apply(P,st,m).error),st);if(open)return placeHint(open);
    for(const m of todo){
      const O=P.orders[m.order],f=footprint(P.parts[m.part].type,m,O.w,O.h),blk=itemsIn(P,st,m.order,m.part).find(it=>it.mask&f.mask);
      if(blk)return {move:{type:'remove',part:blk.i},text:`Lift the ${partName(P,blk.i)} out of ${O.crew}'s frame: par needs that space for the ${partName(P,m.part)}.`};}
    return null;
  }
  // Relaxed: the best spot for a tray part. A par-completing spot if there is one, else the most progress now.
  function bestSpot(P,st,i){
    const keep=solve(P,st);if(keep){const m=keep.moves.find(x=>x.part===i);if(m)return {order:m.order,rot:m.rot,x:m.x,y:m.y};}
    const g=greedySpot(P,st,i);return g&&g.gain>0?{order:g.order,rot:g.rot,x:g.x,y:g.y}:null;
  }
  // The part choice that wasted the most, or the unmet target, in one sentence.
  function nearMiss(P,st){
    const ev=evaluate(P,st);if(isPar(P,st))return '';
    const placed=st.placed.map((p,i)=>p?i:-1).filter(i=>i>=0);
    // Wasted: a placed part whose removal costs no progress toward any target.
    const waste=placed.filter(i=>{const o=st.placed[i].order,s2=apply(P,st,{type:'remove',part:i}).state;return evaluate(P,s2).orders[o].progress===ev.orders[o].progress;})
      .sort((a,b)=>size(P.parts[b].type)-size(P.parts[a].type)||a-b);
    const w=waste.length?`The ${partName(P,waste[0])} in ${crewOf(P,st.placed[waste[0]].order)}'s frame added nothing a target needed`:'';
    const short=ev.orders.map((x,o)=>({x,o})).filter(({x})=>!x.met);
    if(short.length){const {x,o}=short[0],m=x.missing[0];
      return `${crewOf(P,o)}'s kit missed ${m.stat} ${m.value} of ${m.target}.${w?` ${w}.`:''}`;}
    if(w)return `${w}: every kit shipped, but par is ${P.par} parts and you used ${ev.used}.`;
    const parSt=stateFrom(P,P.solution);
    const o=P.orders.findIndex((_,k)=>evaluate(P,parSt).orders[k].parts.length<ev.orders[k].parts.length);
    const parKit=o>=0?` Par builds ${crewOf(P,o)}'s kit from ${evaluate(P,parSt).orders[o].parts.map(i=>partName(P,i)).join(' + ')}.`:'';
    return `Every kit shipped with ${ev.used} parts; par is ${P.par}.${parKit}`;
  }
  // "Shipped at dawn: Daven's kit (Guard 9 · Pace 3)". Unmet kits are held back with the target they missed.
  function output(P,st){
    const ev=evaluate(P,st),ok=[],held=[];
    ev.orders.forEach((x,o)=>{const O=P.orders[o],vals=Object.fromEntries(Object.entries(x.stats).map(([s,v])=>[s,v.value]));
      if(x.met)ok.push(`${O.crew}'s kit (${statLine(vals,Object.keys(O.targets))})`);
      else held.push(`${O.crew}'s kit (${x.missing.map(m=>`${m.stat} ${m.value} of ${m.target}`).join(', ')})`);});
    return [ok.length?`Shipped at dawn: ${ok.join('; ')}.`:'',held.length?`Held back: ${held.join('; ')}.`:''].filter(Boolean).join(' ');
  }
  // Tap or drop snapping: the placement with this rotation that covers (x,y) in frame o, legal, pivot nearest the tap.
  function snap(P,st,i,o,rot,x,y){
    const cells=orient(TYPES[P.parts[i].type].shape,rot).cells,pv=pivot(cells);let best=null,bd=1e9;
    for(const [cx,cy] of cells){const p={rot,x:x-cx,y:y-cy};if(validate(P,st,{type:'place',part:i,order:o,...p}))continue;const d=(p.x+pv[0]-x)**2+(p.y+pv[1]-y)**2;if(d<bd){bd=d;best={order:o,...p};}}
    return best;
  }
  const oriented=(P,i,rot)=>orient(TYPES[P.parts[i].type].shape,rot).cells;

  const api={TYPES,STATS,STAT_INFO,ROLES,RULES,ASSIST_LEVELS,DIFFICULTIES,POWER,FOCUS,orient,pivot,placements,frameStats,
    generate,initial,validate,apply,evaluate,tier,solve,stateFrom,autoAssembly,hint,bestSpot,helps,nearMiss,output,reason,snap,oriented,
    cellsAt:(P,i,p)=>cellsAt(P.parts[i].type,p),partName};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.GearPack=api;
})(typeof globalThis==='object'?globalThis:this);
