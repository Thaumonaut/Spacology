// Rocket loading (Logistics, night): load the dock into rocket cargo fairings and launch gear to the exploration fronts
// and samples up to the ship's lab. Pure rules, no DOM; deterministic from (seed, difficulty). The global keeps its old
// name, PalletStacking, and the engine still calls a fairing a "pallet".
//
// Rules (side view, rule-based, no physics):
// - Each fairing (pallet) has a width in columns, a height limit and a taper. The fairing narrows towards the top: with
//   taper T, a column d cells in from the nearer wall loses max(0, T-d) cells off the top, so the top row is T cells
//   narrower on each side than the base. Those shoulder cells are blocked: every column has its own ceiling (colH), and
//   a crate must stay under the ceiling of every column it covers. Tall crates therefore go low or central. A crate has
//   a base width, a height, a top surface (which columns of its top can hold something), a weight and tags.
// - A crate dropped at column x falls straight down and rests at the highest stack height under its base. It is legal
//   only if every column under its base is at that same height (no gaps, no overhang) and every one of those columns is
//   the floor or a supporting top column: a peaked top supports nothing, a narrow top only its middle, a half lid only
//   its left half, and a fragile crate supports nothing at all. A heavy crate may only rest on the floor or on heavy
//   crates. The stack must stay within the fairing's ceilings. Practice fairings have no weight limit: weight only counts
//   for balance, so space is always what runs out (voyage rockets do have a payload limit).
// - Centre of mass: at launch a fairing's centre of mass (by weight, each crate at the middle of its base) must lie
//   inside the middle half of the base, [W/4, 3W/4] inclusive. An off-centre rocket cannot launch and ships nothing.
// - Only a crate with nothing resting on it can be lifted back to the dock.
// - Goal: load every crate with every fairing centred. Every puzzle can be cleared: the generator first plants a
//   complete legal load that fills every fairing's tapered shape to the brim, then puts those crates on the dock in
//   shuffled order. Since the crates exactly fill the fairings, a clear dock means every fairing is FULL; a gap anywhere
//   means a crate somewhere is in the wrong place.
//
// Solver (exact): a clearing exists if the dock splits across the fairings so that each fairing's share can be stacked
// legally on top of what is already there and ends centred. A fairing's stack search is a skyline DFS (see pack)
// memoised on (crates left, column profile, torque); with full fairings it branches only on which crate fills the lowest
// gap, so solves of up to 15 crates stay in the low milliseconds. The taper only changes each column's ceiling: the
// skyline argument (the lowest, leftmost open cell is either covered by a crate whose left edge is there, or never
// covered) holds for any per-column ceiling, so the search stays exact; it simply rejects crates that would poke through
// a shoulder and counts each column's free cells up to its own ceiling.
(function(root){
  'use strict';
  const Kit=typeof module==='object'&&module.exports&&typeof require==='function'?require('../../shared/minigames/minigame-kit.js'):root.MiniGameKit;

  // top: 'flat' supports every column, 'narrow' only the middle (drops one column at each end), 'peak' nothing,
  // 'lid' only the left half (a hinged lid). Fragile crates support nothing whatever their shape.
  const CATALOG={
    core:{name:'Burst core',icon:'✷',w:2,h:2,top:'peak',fragile:true,wt:[3,4],color:'#e57a8f'},
    cells:{name:'Shield cells',icon:'⬡',w:2,h:1,top:'flat',wt:[2,3],color:'#92b9e4'},
    aether:{name:'Aether canisters',icon:'◈',w:1,h:2,top:'flat',wt:[1,2],color:'#6fc8e8'},
    rations:{name:'Ration packs',icon:'▤',w:3,h:1,top:'flat',wt:[2,3],color:'#b8cf8b'},
    salvage:{name:'Salvage drums',icon:'◉',w:2,h:2,top:'flat',heavy:true,wt:[5,7],color:'#b39a6b'},
    medkit:{name:'Med kits',icon:'✚',w:1,h:1,top:'flat',fragile:true,wt:[1,1],color:'#f0a08c'},
    ammo:{name:'Ammo crates',icon:'▮',w:3,h:1,top:'flat',heavy:true,wt:[4,6],color:'#c9a36a'},
    mast:{name:'Sensor mast',icon:'⟟',w:1,h:3,top:'peak',wt:[1,2],color:'#a5e0c9'},
    coil:{name:'Reactor coil',icon:'⌬',w:3,h:2,top:'narrow',heavy:true,wt:[5,7],color:'#e9d38a'},
    water:{name:'Water bladders',icon:'≋',w:4,h:1,top:'flat',wt:[3,4],color:'#7fb3d6'},
    drones:{name:'Drone rack',icon:'⌖',w:4,h:2,top:'narrow',wt:[3,5],color:'#9a86e0'},
    generator:{name:'Field generator',icon:'⏻',w:2,h:3,top:'peak',heavy:true,wt:[5,6],color:'#e7c18b'},
    spares:{name:'Spare parts',icon:'⚙',w:2,h:1,top:'lid',wt:[1,2],color:'#8fd18a'},
    fuel:{name:'Fuel cell',icon:'▯',w:1,h:1,top:'flat',wt:[1,2],color:'#d6b36f'}
  };
  const DEST_TO={front:'the front',lab:'the lab'};
  // Pallet sizes per difficulty; the planter tiles each pallet completely (maxDead: cells it may leave sealed, e.g.
  // above a peaked top). maxRandom: the most random legal play may clear (out of ROLLOUTS) for a puzzle to be accepted;
  // greedy loaders must always fail.
  // taper: shoulder depth of each practice fairing (1 = the top row is one cell narrower on each side).
  const PUZZLES=[
    {id:'easy',label:'Easy · 2 rockets',target:30,pallets:2,width:[3,3],height:[3,3],taper:1,crates:[3,4],maxDead:0,maxRandom:8},
    {id:'normal',label:'Normal · 2 rockets',target:45,pallets:2,width:[4,4],height:[3,4],taper:1,crates:[4,6],maxDead:0,maxRandom:5},
    {id:'hard',label:'Hard · 3 rockets',target:60,pallets:3,width:[3,4],height:[3,3],taper:1,crates:[3,5],maxDead:0,maxRandom:3},
    {id:'expert',label:'Expert · 3 rockets',target:90,pallets:3,width:[4,5],height:[3,3],taper:1,crates:[4,5],maxDead:0,maxRandom:2}
  ];
  const ROLLOUTS=40,NAMES=['',' II',' III',' IV'];

  // ---- fairing shape -----------------------------------------------------------------------------------------------
  // A taper never closes the top row: it is clamped so at least one column reaches the full height.
  const clampTaper=(W,H,T)=>Math.max(0,Math.min(Number(T)||0,Math.floor((W-1)/2),H-1));
  // Column ceilings of a W-wide, H-high fairing with taper T: the column d cells in from the nearer wall loses max(0, T-d).
  function fairing(W,H,T=0){const t=clampTaper(W,H,T);return Array.from({length:W},(_,x)=>H-Math.max(0,t-Math.min(x,W-1-x)));}
  // The ceilings of a pallet object ({width, height, taper?}); a pallet without a taper is a plain rectangle.
  const ceilings=pal=>pal.cap||fairing(pal.width,pal.height,pal.taper||0);
  const colH=(pal,x)=>ceilings(pal)[x];
  const shapeArea=pal=>ceilings(pal).reduce((a,b)=>a+b,0);
  // Whether a w×h crate fits somewhere on the floor of this fairing (some run of w columns all at least h high).
  function fitsShape(w,h,cap){for(let x=0;x+w<=cap.length;x++)if(cap.slice(x,x+w).every(c=>c>=h))return true;return false;}

  function topMask(kind,w){return Array.from({length:w},(_,i)=>kind==='flat'?1:kind==='narrow'?(i>0&&i<w-1?1:0):kind==='lid'?(i<Math.ceil(w/2)?1:0):0);}
  const lower=s=>s.charAt(0).toLowerCase()+s.slice(1);
  const the=c=>'the '+lower(c.name);
  const mkCrate=(k,weight)=>{const t=CATALOG[k];return {type:k,name:t.name,icon:t.icon,color:t.color,w:t.w,h:t.h,topKind:t.top,top:topMask(t.top,t.w),fragile:!!t.fragile,heavy:!!t.heavy,weight};};

  // ---- generator ---------------------------------------------------------------------------------------------------
  // Plants a complete legal load that fills each pallet (a skyline tiling that obeys every stacking rule, kept only if
  // the pallet ends level), then shuffles the crates onto the dock. Accepted only if the solver clears it, both greedy
  // loaders get stuck, random legal play rarely clears it, and the planted load interlocks (stacks on narrow tops,
  // lids or heavy bases, fragile crates up on a stack).
  function generate(seed,difficulty){
    // 'single' is the practice mode in the voyage game: the Normal-size single load.
    const diff=PUZZLES.find(d=>d.id===(difficulty==='single'?'normal':difficulty))||PUZZLES[0],s=Number(seed)>>>0;
    const r=Kit.rng(Kit.hashSeed('pallet-stacking:'+diff.id+':'+s));
    let fallback=null;
    for(let attempt=0;attempt<150;attempt++){
      const pz=plant(r,diff,s);if(!pz)continue;
      const plan=solve(pz);if(!plan)continue;   // the planted load proves this cannot happen; the solver double-checks
      pz.plan=plan;
      if(greedyClears(pz))continue;
      pz.stats={interlocks:interlocks(pz),randomClears:randomRate(pz,Kit.rng(Kit.hashSeed(`ps-random:${diff.id}:${s}:${attempt}`)),ROLLOUTS),emptyCells:emptyCells(pz)};
      const strict=pz.stats.interlocks.kinds>=2&&pz.stats.randomClears<=diff.maxRandom;
      if(strict)return pz;
      if(!fallback||pz.stats.randomClears<fallback.stats.randomClears)fallback=pz;
      if(attempt>=80&&fallback)return fallback;
    }
    return fallback||relaxed(r,diff,s);
  }
  // Last resort (not reached in testing): any planted load, still provably clearable.
  function relaxed(r,diff,s){for(;;){const pz=plant(r,diff,s);if(pz){pz.plan=solve(pz)||pz.planted;pz.stats={interlocks:interlocks(pz),randomClears:-1,emptyCells:emptyCells(pz)};return pz;}}}
  // Skyline tiling of one fairing (column ceilings cap): always fill the lowest, leftmost open column with a crate that
  // fits the flat run there and stays under every ceiling it covers. A column whose top holds nothing (peaked, fragile,
  // the edge of a narrow top or lid) is sealed; its cells up to its ceiling are dead. Returns the crates or null if it
  // left more than maxDead cells.
  function tile(r,cap,maxDead,used,keys){
    const W=cap.length,t=Array(W).fill(0),sup=Array(W).fill(1),hv=Array(W).fill(1),open=Array(W).fill(true),mine=[];let dead=0;
    const seal=x=>{if(open[x]){open[x]=false;dead+=cap[x]-t[x];}};
    for(;;){
      let x0=-1;for(let x=0;x<W;x++)if(open[x]&&(x0<0||t[x]<t[x0]))x0=x;
      if(x0<0)break;
      let L=0;while(x0+L<W&&open[x0+L]&&t[x0+L]===t[x0])L++;
      const y=t[x0],fits=keys.filter(k=>{const c=CATALOG[k];if(c.w>L)return false;for(let i=0;i<c.w;i++)if(y+c.h>cap[x0+i])return false;
        if((used[k]||0)+mine.filter(m=>m.k===k).length>=NAMES.length)return false;
        if(c.heavy)for(let i=0;i<c.w;i++)if(!hv[x0+i])return false;return true;});
      if(!fits.length){seal(x0);if(dead>maxDead)return null;continue;}
      const k=r.pick(fits),c=CATALOG[k],top=c.fragile?Array(c.w).fill(0):topMask(c.top,c.w);
      for(let i=0;i<c.w;i++){const x=x0+i;t[x]=y+c.h;sup[x]=top[i];hv[x]=c.heavy?1:0;if(t[x]>=cap[x])open[x]=false;else if(!sup[x])seal(x);}
      if(dead>maxDead)return null;
      mine.push({k,x:x0,y});
    }
    return mine;
  }
  function plant(r,diff,seed){
    const keys=Object.keys(CATALOG),used={},crates=[],planted=[],pallets=[];
    for(let p=0;p<diff.pallets;p++){
      const W=r.range(diff.width[0],diff.width[1]),H=r.range(diff.height[0],diff.height[1]),T=clampTaper(W,H,diff.taper||0),cap=fairing(W,H,T);let got=null;
      for(let tries=0;tries<200&&!got;tries++){
        const mine=tile(r,cap,diff.maxDead,used,keys);
        if(!mine||mine.length<diff.crates[0]||mine.length>diff.crates[1]||!mine.some(m=>m.y>0))continue;
        for(const m of mine)m.weight=r.range(CATALOG[m.k].wt[0],CATALOG[m.k].wt[1]);
        const w=mine.reduce((a,m)=>a+m.weight,0),tq=mine.reduce((a,m)=>a+m.weight*(m.x+CATALOG[m.k].w/2),0);
        if(tq/w>=W/4&&tq/w<=W*3/4)got=mine;
      }
      if(!got)return null;
      for(const m of got){used[m.k]=(used[m.k]||0)+1;crates.push({...mkCrate(m.k,m.weight),name:CATALOG[m.k].name+NAMES[used[m.k]-1]});planted.push({pallet:p,x:m.x,y:m.y});}
      pallets.push({id:p,name:'Rocket '+(p+1),width:W,height:H,taper:T,cap});
    }
    // Shuffle the dock so the planted order is not given away; keep planting order for the planted plan.
    const order=r.shuffle(crates.map((_,i)=>i)),newId=[];order.forEach((old,i)=>{newId[old]=i;});
    const dockCrates=order.map((old,i)=>({...crates[old],id:i}));
    return {seed,difficulty:diff.id,target:diff.target,pallets,crates:dockCrates,planted:planted.map((q,i)=>({type:'place',crate:newId[i],pallet:q.pallet,x:q.x,y:q.y})),plan:null,stats:null};
  }
  // Empty cells per fairing in the planted solution (the tapered shape's cells minus crate area).
  function emptyCells(pz){return pz.pallets.map((pal,p)=>shapeArea(pal)-pz.planted.filter(m=>m.pallet===p).reduce((a,m)=>a+pz.crates[m.crate].w*pz.crates[m.crate].h,0));}
  // What makes the planted load a puzzle: something stacked on a narrow top, on a half lid, on a heavy base, or a
  // fragile crate up on a stack. Counted per kind.
  function interlocks(pz){
    const st={placed:pz.planted.map(m=>({crate:m.crate,pallet:m.pallet,x:m.x,y:m.y}))},f={narrow:0,lid:0,heavyBase:0,fragileUp:0};
    for(const q of st.placed){const c=pz.crates[q.crate];
      if(c.fragile&&q.y>0)f.fragileUp++;
      for(const o of st.placed){if(o.pallet!==q.pallet||o.y!==q.y+c.h||o.x>=q.x+c.w||q.x>=o.x+pz.crates[o.crate].w)continue;
        if(c.topKind==='narrow')f.narrow++;else if(c.topKind==='lid')f.lid++;if(c.heavy)f.heavyBase++;}}
    return {...f,kinds:Object.values(f).filter(Boolean).length,stacked:st.placed.filter(q=>q.y>0).length};
  }

  // ---- state and moves -------------------------------------------------------------------------------------------
  // state = {placed:[{crate,pallet,x,y}]} in placement order. Moves: {type:'place',crate,pallet,x} | {type:'lift',crate}.
  const create=()=>({placed:[]});
  const clone=st=>({placed:st.placed.map(p=>({...p}))});
  const onPallet=(st,p)=>st.placed.filter(q=>q.pallet===p);
  const isPlaced=(st,i)=>st.placed.some(q=>q.crate===i);
  const dock=(pz,st)=>pz.crates.filter(c=>!isPlaced(st,c.id)).map(c=>c.id);
  // Per column of a pallet: stack height, whether that top can hold weight, whether it is heavy (or floor), and the owner.
  function profile(pz,st,p){
    const W=pz.pallets[p].width,t=Array(W).fill(0),sup=Array(W).fill(1),hv=Array(W).fill(1),own=Array(W).fill(-1);
    for(const q of onPallet(st,p)){const c=pz.crates[q.crate];for(let i=0;i<c.w;i++){const x=q.x+i;if(q.y+c.h>t[x]){t[x]=q.y+c.h;sup[x]=c.fragile?0:c.top[i];hv[x]=c.heavy?1:0;own[x]=c.id;}}}
    return {t,sup,hv,own};
  }
  // Where a crate would come to rest, and why it would not be legal there (reason null when legal).
  function landing(pz,st,crate,p,x){
    const c=pz.crates[crate],pal=pz.pallets[p];
    if(!c||!pal)return {y:0,reason:'No such crate or pallet'};
    if(isPlaced(st,crate))return {y:0,reason:`${c.name} is already loaded`};
    if(pal.away)return {y:0,reason:`${pal.name} is in orbit: back in ${pal.away} leg${pal.away===1?'':'s'}`};
    if(pal.dest&&c.dest&&pal.dest!==c.dest)return {y:0,reason:`${pal.name} is bound for ${DEST_TO[pal.dest]}: ${c.dest==='lab'?'samples go up to the lab':'gear goes to the front'}, so launch it or empty it first`};
    if(!Number.isInteger(x)||x<0||x+c.w>pal.width)return {y:0,reason:`${c.name} does not fit across ${pal.name} there`};
    const pr=profile(pz,st,p),cols=[...Array(c.w).keys()].map(i=>x+i),y=Math.max(...cols.map(i=>pr.t[i]));
    const named=i=>pz.crates[pr.own[i]];
    let reason=null;
    const gap=cols.find(i=>pr.t[i]!==y);
    if(gap!==undefined)reason=`Overhang: column ${gap+1} is ${y-pr.t[gap]} lower, nothing would hold that edge`;
    else{const bad=cols.find(i=>!pr.sup[i]);
      if(bad!==undefined){const o=named(bad);reason=o.fragile?`${o.name} is fragile: nothing may rest on it`:o.topKind==='peak'?`${o.name} has a peaked top: nothing rests on it`:`${o.name}'s top cannot hold weight at column ${bad+1}`;}
      else if(c.heavy&&!pal.reinforced&&cols.some(i=>!pr.hv[i]))reason=`${c.name} is heavy: only the floor or another heavy crate can take it`;
      else if(y+c.h>pal.height)reason=`Too tall: ${pal.name}'s fairing is ${pal.height} high`;
      else{const cap=ceilings(pal),low=cols.find(i=>y+c.h>cap[i]);
        if(low!==undefined)reason=`The fairing narrows: column ${low+1} is only ${cap[low]} high`;
        // Voyage rockets have a payload limit; practice fairings do not.
        else if(pal.maxWeight!=null){const wt=onPallet(st,p).reduce((a,q)=>a+pz.crates[q.crate].weight,0);if(wt+c.weight>pal.maxWeight)reason=`Over payload: ${wt+c.weight}/${pal.maxWeight} on ${pal.name}`;}}}
    return {y,reason};
  }
  // A crate can be lifted when nothing rests on any column of its top.
  function liftable(pz,st,crate){
    const q=st.placed.find(z=>z.crate===crate);if(!q)return false;const c=pz.crates[crate];
    return !st.placed.some(o=>o!==q&&o.pallet===q.pallet&&o.y===q.y+c.h&&o.x<q.x+c.w&&q.x<o.x+pz.crates[o.crate].w);
  }
  function validate(pz,st,m){
    if(!m||typeof m!=='object')return 'No move';
    if(m.type==='lift'){if(!isPlaced(st,m.crate))return 'That crate is on the dock';return liftable(pz,st,m.crate)?null:`Something is resting on ${the(pz.crates[m.crate])}`;}
    if(m.type==='place')return landing(pz,st,m.crate,m.pallet,m.x).reason;
    return 'Unknown move';
  }
  // Applies a legal move in place and returns null, or returns the reason and leaves the state untouched.
  function apply(pz,st,m){
    const why=validate(pz,st,m);if(why)return why;
    if(m.type==='lift')st.placed.splice(st.placed.findIndex(q=>q.crate===m.crate),1);
    else st.placed.push({crate:m.crate,pallet:m.pallet,x:m.x,y:landing(pz,st,m.crate,m.pallet,m.x).y});
    return null;
  }
  // The tapped column is the middle of the crate's base, clamped onto the pallet.
  const anchorFor=(pz,crate,p,col)=>{const c=pz.crates[crate];return Math.max(0,Math.min(pz.pallets[p].width-c.w,col-Math.floor((c.w-1)/2)));};
  const columnFor=(pz,crate,x)=>x+Math.floor((pz.crates[crate].w-1)/2);

  // ---- evaluation and tiers --------------------------------------------------------------------------------------
  function palletStats(pz,st,p){
    const pal=pz.pallets[p],qs=onPallet(st,p);let weight=0,torque=0;
    for(const q of qs){const c=pz.crates[q.crate];weight+=c.weight;torque+=c.weight*(q.x+c.w/2);}
    const lo=pal.width/4,hi=pal.width*3/4,com=weight?torque/weight:pal.width/2;
    // Fill: crate cells out of the fairing's open cells. Full: every column is at its ceiling or sealed by a top that
    // holds nothing.
    const pr=profile(pz,st,p),filled=qs.reduce((a,q)=>a+pz.crates[q.crate].w*pz.crates[q.crate].h,0),cap=ceilings(pal),area=cap.reduce((a,b)=>a+b,0);
    const full=qs.length>0&&pr.t.every((h,x)=>h>=cap[x]||!pr.sup[x]);
    return {pallet:p,count:qs.length,weight,com,lo,hi,balanced:com>=lo-1e-9&&com<=hi+1e-9,height:Math.max(0,...pr.t),filled,area,full};
  }
  // shipped: crates on level pallets (a tipped pallet ships nothing). Score = shipped.
  function evaluate(pz,st){
    const pallets=pz.pallets.map((_,p)=>palletStats(pz,st,p)),left=pz.crates.length-st.placed.length;
    const shipped=st.placed.filter(q=>pallets[q.pallet].balanced).map(q=>q.crate),tipped=pallets.filter(s=>s.count&&!s.balanced);
    return {pallets,left,cleared:left===0,tipped,allLevel:!tipped.length,shipped,total:pz.crates.length};
  }
  // Perfect: dock cleared, every pallet level, no hints. Good: the same with hints. Partial: crates left or a pallet
  // tipped. Failed: nothing shipped (the convoy left empty, or every loaded pallet tipped).
  function tier(pz,ev,hints=0){
    if(!ev.shipped.length)return 'failed';
    if(ev.cleared&&ev.allLevel)return hints?'good':'perfect';
    return 'partial';
  }

  // ---- solver ----------------------------------------------------------------------------------------------------
  // A full clearing from `st` by drops only (no lifts): every dock crate loaded and every pallet level. Returns the
  // moves [{type:'place',crate,pallet,x,y}] in a legal drop order ([] when the dock is already clear and level), or null.
  function solve(pz,st=create()){
    const P=pz.pallets.length,D=dock(pz,st),n=D.length,ALL=(1<<n)-1;
    const base=pz.pallets.map((_,p)=>{const qs=onPallet(st,p);
      return {weight:qs.reduce((a,q)=>a+pz.crates[q.crate].weight,0),torque2:qs.reduce((a,q)=>a+pz.crates[q.crate].weight*(2*q.x+pz.crates[q.crate].w),0),pr:profile(pz,st,p),area:qs.reduce((a,q)=>a+pz.crates[q.crate].w*pz.crates[q.crate].h,0)};});
    // Space is the limit: each pallet's share must fit its free cells (a necessary condition the DFS then checks exactly).
    const ceil=pz.pallets.map(ceilings),caps=pz.pallets.map((pal,p)=>shapeArea(pal)-base[p].area),capFrom=caps.map((_,p)=>caps.slice(p).reduce((a,b)=>a+b,0));
    const wt=new Int32Array(1<<n),area=new Int32Array(1<<n);
    for(let m=1;m<=ALL;m++){const b=31-Math.clz32(m&-m),c=pz.crates[D[b]],r=m&(m-1);wt[m]=wt[r]+c.weight;area[m]=area[r]+c.w*c.h;}
    if(area[ALL]>capFrom[0])return null;
    const slack=capFrom[0]-area[ALL];   // empty cells the finished convoy will have, across all pallets
    // Identical crates are interchangeable: only the lowest-numbered remaining one is tried, which cuts symmetric branches.
    const sig=D.map(ci=>{const c=pz.crates[ci];return [c.w,c.h,c.top.join(''),c.fragile,c.heavy,c.weight].join(',');});
    const twin=D.map((_,b)=>D.findIndex((_,a)=>a<b&&sig[a]===sig[b]));
    const packMemo=pz.pallets.map(()=>new Map());
    // Skyline search, complete for any final layout: the lowest, leftmost open cell (x0, t[x0]) is either covered by a
    // crate resting there with its left edge at x0 (everything to its left at that height is already taken, and no crate
    // can rest over an empty column), or that column never grows again ("closed"). Cells left empty — closed columns and
    // columns sealed by a top that holds nothing — must fit within the fairing's free cells minus the crates' area. Each
    // column's free cells run up to its own ceiling (CH), so the taper's shoulders are never counted or filled.
    function pack(p,T){
      const memo=packMemo[p];if(memo.has(T))return memo.get(T);
      const pal=pz.pallets[p],W=pal.width,CH=ceil[p],B=base[p];let out=null;
      const budget=caps[p]-area[T];
      if(budget>=0){
        const t=B.pr.t.slice(),sup=B.pr.sup.slice(),hv=B.pr.hv.slice(),closed=Array(W).fill(0),seq=[],dead=new Set();
        let spent=0;for(let x=0;x<W;x++)if(t[x]<CH[x]&&!sup[x])spent+=CH[x]-t[x];
        const balanced=(w,tq)=>w===0||(2*tq>=W*w&&2*tq<=3*W*w);
        const open=x=>!closed[x]&&t[x]<CH[x]&&sup[x];
        const dfs=(rem,w,tq)=>{
          if(!rem)return balanced(w,tq);
          let x0=-1;for(let x=0;x<W;x++)if(open(x)&&(x0<0||t[x]<t[x0]))x0=x;
          if(x0<0)return false;
          const key=rem+'|'+t.join('')+'|'+sup.join('')+hv.join('')+closed.join('')+'|'+tq;if(dead.has(key))return false;
          const y=t[x0];let L=0;while(x0+L<W&&open(x0+L)&&t[x0+L]===y)L++;
          for(let b=0;b<n;b++){
            if(!(rem>>b&1)||(twin[b]>=0&&rem>>twin[b]&1))continue;
            const c=pz.crates[D[b]];if(c.w>L)continue;
            let ok=true;for(let i=0;i<c.w;i++)if(y+c.h>CH[x0+i]||(c.heavy&&!hv[x0+i]))ok=false;if(!ok)continue;
            let cost=0;for(let i=0;i<c.w;i++){const s1=c.fragile?0:c.top[i];if(!s1)cost+=CH[x0+i]-y-c.h;}
            if(spent+cost>budget)continue;
            const su0=sup.slice(x0,x0+c.w),hv0=hv.slice(x0,x0+c.w);
            for(let i=0;i<c.w;i++){t[x0+i]=y+c.h;sup[x0+i]=c.fragile?0:c.top[i];hv[x0+i]=c.heavy?1:0;}
            spent+=cost;seq.push({type:'place',crate:D[b],pallet:p,x:x0,y});
            if(dfs(rem&~(1<<b),w+c.weight,tq+c.weight*(2*x0+c.w)))return true;
            seq.pop();spent-=cost;for(let i=0;i<c.w;i++){t[x0+i]=y;sup[x0+i]=su0[i];hv[x0+i]=hv0[i];}
          }
          const gapCells=CH[x0]-y;
          if(spent+gapCells<=budget){closed[x0]=1;spent+=gapCells;const r=dfs(rem,w,tq);closed[x0]=0;spent-=gapCells;if(r)return true;}
          dead.add(key);return false;
        };
        if(spent<=budget&&dfs(T,B.weight,B.torque2))out=seq.slice();
      }
      memo.set(T,out);return out;
    }
    const partMemo=new Map();
    function part(S,p){
      if(p===P-1){const s=pack(p,S);return s?[s]:null;}
      const key=p+':'+S;if(partMemo.has(key))return partMemo.get(key);
      let out=null;
      for(let T=S;;T=(T-1)&S){
        if(area[T]<=caps[p]&&area[T]>=caps[p]-slack&&area[S^T]<=capFrom[p+1]){const s=pack(p,T);if(s){const rest=part(S^T,p+1);if(rest){out=[s,...rest];break;}}}
        if(!T)break;
      }
      partMemo.set(key,out);return out;
    }
    const r=part(ALL,0);return r?r.flat():null;
  }

  // ---- greedy, random play, fallback ---------------------------------------------------------------------------------
  // A careless loader: crates in a fixed order, each to the legal spot that rests lowest and keeps its pallet nearest
  // centre; a crate with no legal spot is left on the dock.
  const ORDERS={
    big:(a,b)=>b.w*b.h-a.w*a.h||b.weight-a.weight||a.id-b.id,
    heavy:(a,b)=>b.weight-a.weight||b.w*b.h-a.w*a.h||a.id-b.id,
    dock:(a,b)=>a.id-b.id
  };
  function greedy(pz,order='big'){
    const st=create();
    for(const c of pz.crates.slice().sort(ORDERS[order])){
      let pick=null,score=Infinity;
      pz.pallets.forEach((pal,p)=>{for(let x=0;x+c.w<=pal.width;x++){const l=landing(pz,st,c.id,p,x);if(l.reason)continue;
        const s=palletStats(pz,st,p),com=(s.weight*s.com*(s.count?1:0)+c.weight*(x+c.w/2))/(s.weight+c.weight),sc=l.y*100+Math.abs(com-pal.width/2);
        if(sc<score-1e-9){score=sc;pick={type:'place',crate:c.id,pallet:p,x};}}});
      if(pick)apply(pz,st,pick);
    }
    return st;
  }
  const clears=(pz,st)=>{const ev=evaluate(pz,st);return ev.cleared&&ev.allLevel;};
  const greedyClears=pz=>Object.keys(ORDERS).some(o=>clears(pz,greedy(pz,o)));
  // Random legal play without lifts: a random dock crate that fits somewhere, at a random legal spot, until stuck.
  function randomPlay(pz,r){
    const st=create();
    for(;;){const ms=legalMoves(pz,st).filter(m=>m.type==='place');if(!ms.length)break;const c=r.pick([...new Set(ms.map(m=>m.crate))]);apply(pz,st,r.pick(ms.filter(m=>m.crate===c)));}
    return st;
  }
  function randomRate(pz,r,n){let k=0;for(let i=0;i<n;i++)if(clears(pz,randomPlay(pz,r)))k++;return k;}
  // The automatic fallback: the dock crew's careless loader. The generator guarantees it leaves something behind.
  function auto(pz){const st=greedy(pz,'big'),ev=evaluate(pz,st);return {state:st,evaluation:ev,shipped:ev.shipped.length};}

  // ---- hint and near-miss --------------------------------------------------------------------------------------------
  function hint(pz,st){
    const plan=solve(pz,st);
    if(plan){
      if(!plan.length)return {type:'dispatch',text:'The dock is clear and every rocket is centred. Launch them all.'};
      // The lowest-resting move of the clearing plan, so the player builds bottom-up like the plan does.
      const m=plan.slice().sort((a,b)=>a.y-b.y)[0],legal=!validate(pz,st,m)?m:plan[0];
      return {...legal,text:`Load ${the(pz.crates[legal.crate])} on ${pz.pallets[legal.pallet].name}, column ${columnFor(pz,legal.crate,legal.x)+1}.`};
    }
    // The dock cannot be cleared from here: lift a crate that makes it clearable again, or else the most recently
    // loaded liftable crate (each lift shrinks the stacks, so repeated hints always reach a clearable state).
    const tops=st.placed.filter(q=>liftable(pz,st,q.crate));
    const fix=tops.find(q=>{const s=clone(st);apply(pz,s,{type:'lift',crate:q.crate});return !!solve(pz,s);});
    const q=fix||tops.at(-1);if(!q)return {type:'dispatch',text:'Launch the rockets.'};
    return {type:'lift',crate:q.crate,text:`Lift ${the(pz.crates[q.crate])} off ${pz.pallets[q.pallet].name}: ${fix?'with it there the dock cannot be cleared':'the dock cannot be cleared from here; start unstacking'}.`};
  }
  // Names the first placement after which the dock could no longer be cleared, and a move that would have kept it open.
  function nearMiss(pz,st){
    const ev=evaluate(pz,st);if(ev.cleared&&ev.allLevel)return '';
    const prefix=k=>({placed:st.placed.slice(0,k).map(q=>({...q}))});
    for(let k=1;k<=st.placed.length;k++){
      if(solve(pz,prefix(k)))continue;
      const q=st.placed[k-1],c=pz.crates[q.crate],h=hint(pz,prefix(k-1));
      const instead=h.type==='place'?` Loading ${the(pz.crates[h.crate])} on ${pz.pallets[h.pallet].name}, column ${columnFor(pz,h.crate,h.x)+1}, instead would have kept it clearable.`:'';
      return `Loading ${the(c)} on ${pz.pallets[q.pallet].name}, column ${columnFor(pz,q.crate,q.x)+1} (move ${k}) made clearing the dock impossible.${instead}`;
    }
    const h=hint(pz,st);
    return `${ev.left} crate${ev.left===1?' was':'s were'} still on the dock and the load could still be finished: next, ${h.type==='place'?`load ${the(pz.crates[h.crate])} on ${pz.pallets[h.pallet].name}, column ${columnFor(pz,h.crate,h.x)+1}`:'dispatch'}.`;
  }
  function legalMoves(pz,st){
    const out=[];
    for(const ci of dock(pz,st))pz.pallets.forEach((pal,p)=>{for(let x=0;x+pz.crates[ci].w<=pal.width;x++){const m={type:'place',crate:ci,pallet:p,x};if(!validate(pz,st,m))out.push(m);}});
    for(const q of st.placed)if(liftable(pz,st,q.crate))out.push({type:'lift',crate:q.crate});
    return out;
  }
  function describe(pz,m){
    if(!m)return '';const c=pz.crates[m.crate];
    if(m.type==='lift')return `Lift ${the(c)}`;
    return `${c.name} → ${pz.pallets[m.pallet].name}, column ${columnFor(pz,m.crate,m.x)+1}`;
  }
  // Fiction output: what the practice launch carries to the lieutenants' fronts.
  function output(pz,ev){
    const left=pz.crates.filter(c=>!ev.shipped.includes(c.id)).map(c=>lower(c.name)),flew=ev.pallets.filter(s=>s.count&&s.balanced).length;
    return `Launched: ${flew} rocket${flew===1?'':'s'} · ${ev.shipped.length} of ${ev.total} crates to the front`+(left.length?` · held back: ${left.join(', ')}`:' · nothing held back');
  }

  // ==== Voyage mode ===================================================================================================
  // The launch pad grows over a voyage of legs. Each leg, goods arrive on the dock: gear and supplies for exploration's
  // fronts (the supply-run item ladder plus raw cargo; later legs bring bigger, heavier, more valuable goods) and sample
  // crates from exploration's fights for the ship's lab. Load rockets on the pad with the same stacking rules, then
  // Launch: a rocket carries one destination per launch (the first crate in an empty fairing tags the bay for the front or
  // for the lab), delivers at the end of the leg (credits paid then) and is in orbit for its trip. Every rocket starts as
  // a small Hopper and grows along one upgrade route: stat upgrades within a stage, and refits Hopper → Lifter → Heavy
  // lifter. Score = credits delivered; par = the planner below on the same seed and settings. Unlaunched goods wait on
  // the dock, which holds a limited number of items.
  const DEST={front:'Front',lab:'Orbit lab'},DEST_ICON={front:'⚔️',lab:'🔬'};
  const GOODS={
    ore:{name:'Ore',icon:'🪨',tier:0,w:1,h:1,top:'flat',heavy:true,weight:3,value:3,color:'#c98a5a',dest:'front'},
    crystal:{name:'Crystal',icon:'💎',tier:0,w:1,h:1,top:'flat',fragile:true,weight:1,value:4,color:'#b597ff',dest:'front'},
    parts:{name:'Salvage parts',icon:'🔩',tier:0,w:2,h:1,top:'lid',weight:2,value:3,color:'#a9b4bc',dest:'front'},
    plate:{name:'Plates',icon:'🔳',tier:1,w:2,h:1,top:'flat',weight:3,value:6,color:'#dfe6ea',dest:'front'},
    cell:{name:'Aether cell',icon:'🔋',tier:1,w:1,h:2,top:'flat',weight:2,value:8,color:'#6fe3d2',dest:'front'},
    gear:{name:'Gear kit',icon:'🧰',tier:2,w:2,h:2,top:'flat',weight:7,value:22,color:'#e7c18b',dest:'front'},
    core:{name:'Burst core',icon:'☄️',tier:2,w:2,h:2,top:'peak',fragile:true,weight:6,value:26,color:'#f08a5d',dest:'front'},
    shield:{name:'Field shield',icon:'🛡️',tier:3,w:3,h:2,top:'narrow',heavy:true,weight:16,value:58,color:'#7fb4ff',dest:'front'},
    relay:{name:'Weaver relay',icon:'📡',tier:3,w:1,h:3,top:'peak',weight:9,value:90,color:'#f2d36b',dest:'front'},
    // Sample crates from exploration's fights, for the lab's research mini-games: small, often fragile.
    datacore:{name:'Data core',icon:'💾',tier:0,w:1,h:1,top:'flat',weight:2,value:5,color:'#9fc3ff',dest:'lab',sample:true,src:'enemy'},
    groundcore:{name:'Ground core',icon:'🧪',tier:1,w:1,h:2,top:'flat',weight:3,value:10,color:'#d2a77c',dest:'lab',sample:true,src:'ground'},
    tissue:{name:'Tissue sample',icon:'🧫',tier:2,w:1,h:1,top:'flat',fragile:true,weight:1,value:14,color:'#ff9fc2',dest:'lab',sample:true,src:'enemy'}
  };
  const TIERS=[['ore','crystal','parts','datacore'],['plate','cell','groundcore'],['gear','core','tissue'],['shield','relay']];
  // Where samples come from: exploration's enemy archetypes (tissue, data cores) and the ground it fights on (cores).
  const SOURCES={enemy:['Chaff','Bruiser','Warden','Cleanser','Reflector','Anchor','Bulwark','Quickstep'],ground:['Basalt','Moss bed','Ember flat','Salt pan','Kelp shallows']};
  const LTS=['Lt Vega','Lt Okafor','Lt Sato'];
  // The upgrade route. A rocket's stats are its stage's base plus its upgrade levels (levels carry over when it refits;
  // each stage lists the price of every level it allows, so later stages raise the caps). Bigger stages come back from
  // orbit more slowly unless the turnaround (fast) is upgraded. taper: the fairing's shoulders (see fairing()); the
  // nose upgrade takes one step off them.
  const STAGES=[
    {id:'hopper',name:'Hopper',icon:'🚀',w:3,h:3,taper:1,weight:8,trip:1,ups:{wide:[15],tall:[20],load:[10,18],floor:[20]},next:40,text:'Small and quick: up and back in a leg'},
    {id:'lifter',name:'Lifter',icon:'🚀',w:4,h:3,taper:1,weight:16,trip:2,ups:{wide:[25,40],tall:[30],load:[12,20,30],fast:[45],floor:[20],nose:[30]},next:100,text:'A wider fairing and a real payload; slower'},
    {id:'heavy',name:'Heavy lifter',icon:'🚀',w:6,h:4,taper:2,weight:34,trip:3,reinforced:true,ups:{wide:[30,50],tall:[35],load:[20,30,45],fast:[50,80],nose:[40]},next:null,text:'A huge stepped fairing, big payload, reinforced deck; slow'}
  ];
  const UPGRADES={wide:{label:'Fairing +1 wide'},tall:{label:'Fairing +1 high'},load:{label:'Payload +6'},fast:{label:'Faster turnaround'},floor:{label:'Reinforced deck'},nose:{label:'Wider nose'},stage:{label:'Refit'}};
  const HOPPER_PRICES=[30,45,60,80,100];
  const VOYAGES=[
    {id:'easy',label:'Voyage · Easy',target:240,legs:6,slots:8,arrivals:[2,3],orderEvery:2,credits:35},
    {id:'normal',label:'Voyage · Normal',target:360,legs:8,slots:8,arrivals:[3,4],orderEvery:2,credits:30},
    {id:'hard',label:'Voyage · Hard',target:480,legs:10,slots:9,arrivals:[3,5],orderEvery:2,credits:25}
  ];
  const MODES=[...VOYAGES.map(v=>({id:v.id,label:v.label,target:v.target})),{id:'single',label:'Single launch (practice)',target:45}];
  // Voyage settings for tuning playtests. legs 0 = the difficulty's own length. Ids are stable (saved settings use them).
  const PRESETS=[
    {id:'lean',name:'One pad',start:1,maxFleet:3,priceScale:1,incomeScale:1,legs:0},
    {id:'fleet',name:'Two pads',start:2,maxFleet:5,priceScale:1,incomeScale:1,legs:0},
    {id:'generous',name:'Research grant',start:1,maxFleet:4,priceScale:0.6,incomeScale:1.25,legs:0},
    {id:'longhaul',name:'Long campaign',start:1,maxFleet:6,priceScale:1,incomeScale:1,legs:14}
  ];
  const DEFAULT_PRESET='fleet';
  const LIMITS={start:[1,3],maxFleet:[2,6],priceScale:[0.5,2],incomeScale:[0.5,2],legs:[0,6,8,10,14]};
  function normSettings(s){
    const base=PRESETS.find(p=>p.id===(s&&s.preset))||PRESETS.find(p=>p.id===DEFAULT_PRESET),o={...base,...(s||{})},clamp=(v,[a,b])=>Math.max(a,Math.min(b,Number(v)||a));
    const out={preset:o.preset||base.id,start:Math.round(clamp(o.start,LIMITS.start)),maxFleet:Math.round(clamp(o.maxFleet,LIMITS.maxFleet)),
      priceScale:Math.round(clamp(o.priceScale,LIMITS.priceScale)*100)/100,incomeScale:Math.round(clamp(o.incomeScale,LIMITS.incomeScale)*100)/100,legs:LIMITS.legs.includes(Number(o.legs))?Number(o.legs):0};
    out.maxFleet=Math.max(out.maxFleet,out.start);
    // A preset id only describes the settings if they still match it exactly.
    const p=PRESETS.find(x=>x.id===out.preset);if(!p||['start','maxFleet','priceScale','incomeScale','legs'].some(k=>p[k]!==out[k]))out.preset='custom';
    return out;
  }
  const settingsText=s=>`${s.preset==='custom'?'Custom':PRESETS.find(p=>p.id===s.preset).name}: ${s.start} rocket${s.start===1?'':'s'} to start, max ${s.maxFleet}, price ×${s.priceScale}, income ×${s.incomeScale}, ${s.legs||'default'} legs`;
  const GOOD_SHARE=0.8;

  // Deterministic arrival schedule: tiers climb with voyage progress f (0 → 1); about every other leg some goods are an
  // order with a deadline two or three legs out and a bonus per item, alternating between a lieutenant at the front
  // (gear) and the lab (samples). An order may ask for two of a small good.
  function schedule(seed,cfg,legs=cfg.legs,income=1){
    const r=Kit.rng(Kit.hashSeed('rocket-voyage:'+cfg.id+':'+legs+':'+seed)),out=[];let lt=0,n=0;
    for(let leg=1;leg<=legs;leg++){
      const f=(leg-1)/Math.max(1,legs-1),k=r.range(cfg.arrivals[0],cfg.arrivals[1]),list=[];
      for(let i=0;i<k;i++){const tier=Math.max(0,Math.min(3,Math.floor(f*3.2+r.next()*1.5-0.3))),kind=r.pick(TIERS[tier]),g={kind};
        if(GOODS[kind].src)g.src=r.pick(SOURCES[GOODS[kind].src]);list.push(g);}
      if(leg%cfg.orderEvery===0&&leg<legs){
        const team=n%2?'lab':'front',want=g=>GOODS[g.kind].dest===team&&(team==='lab'||GOODS[g.kind].tier>=1);
        let cands=list.filter(want);if(!cands.length)cands=list.filter(g=>GOODS[g.kind].tier>=1||GOODS[g.kind].sample);
        const g=cands.length?r.pick(cands):null;
        if(g){const t=GOODS[g.kind],by=t.dest==='lab'?'Lab':LTS[lt++%LTS.length];n++;
          const order={id:n,by,team:t.dest,due:Math.min(legs,leg+r.range(2,3)),bonus:Math.round((t.value*0.6+5)*income),qty:1};g.order=order;
          // Two of a small good: a twin from the same source joins this leg's arrivals if there is room.
          if(t.w*t.h<=2&&list.length<cfg.arrivals[1]&&r.chance(0.5)){list.push({kind:g.kind,...(g.src?{src:g.src}:{}),order});order.qty=2;}}}
      out.push(list);
    }
    return out;
  }
  const price=(V,base)=>Math.max(1,Math.round(base*V.settings.priceScale));
  const topRow=v=>v.cap.filter(c=>c===v.height).length;
  function restat(v){
    const s=STAGES[v.stage],L=v.levels;
    v.type=s.id;v.name=s.name;v.width=s.w+(L.wide||0);v.height=s.h+(L.tall||0);v.maxWeight=s.weight+6*(L.load||0);
    v.taper=clampTaper(v.width,v.height,s.taper-(L.nose||0));v.cap=fairing(v.width,v.height,v.taper);
    v.trip=Math.max(1,s.trip-(L.fast||0));v.reinforced=!!s.reinforced||!!L.floor;return v;
  }
  function newVehicle(id){return restat({id,stage:0,levels:{},away:0,load:[],departedLeg:0});}
  function createVoyage(seed,difficulty,opts={}){
    const cfg=VOYAGES.find(v=>v.id===difficulty)||VOYAGES[1],s=Number(seed)>>>0,settings=normSettings(opts.settings),legs=settings.legs||cfg.legs;
    const V={mode:'voyage',seed:s,difficulty:cfg.id,settings,legs,slots:cfg.slots,leg:1,credits:Math.round(cfg.credits*settings.incomeScale),delivered:0,bonuses:0,launches:0,
      items:[],dock:[],vehicles:[],pending:[],arrivals:schedule(s,cfg,legs,settings.incomeScale),log:[],over:false,par:null,parActions:null};
    for(let i=0;i<settings.start;i++)V.vehicles.push(newVehicle(i));
    arrive(V);
    if(opts.par!==false){const plan=planVoyage(s,cfg.id,settings);V.par=plan.delivered;V.parActions=plan.actions;V.parBuys=plan.buys;}
    return V;
  }
  const cloneVoyage=V=>JSON.parse(JSON.stringify(V));
  const goodName=g=>{const t=GOODS[g.kind];return g.src?`${g.src} ${lower(t.name)}`:t.name;};
  function arrive(V){
    for(const g of V.arrivals[V.leg-1]||[]){const t=GOODS[g.kind],id=V.items.length;
      V.items.push({id,kind:g.kind,name:goodName(g),icon:t.icon,color:t.color,w:t.w,h:t.h,topKind:t.top,top:topMask(t.top,t.w),fragile:!!t.fragile,heavy:!!t.heavy,
        weight:t.weight,value:Math.max(1,Math.round(t.value*V.settings.incomeScale)),tier:t.tier,dest:t.dest,sample:!!t.sample,order:g.order||null,arrived:V.leg,status:'dock'});
      V.dock.push(id);}
  }
  // A rocket's destination this launch: the destination of what it carries (null while the fairing is empty).
  const destOf=(V,v)=>v.load.length?V.items[v.load[0].item].dest||null:null;
  // The stacking engine works on {pallets, crates} + {placed}: project the voyage onto it. Pallet index = rocket index.
  function view(V){
    const pz={pallets:V.vehicles.map((v,i)=>({id:i,name:`${v.name} ${i+1}`,type:v.type,width:v.width,height:v.height,taper:v.taper,cap:v.cap,maxWeight:v.maxWeight,reinforced:v.reinforced,away:v.away,trip:v.trip,dest:destOf(V,v)})),crates:V.items};
    const st={placed:[]};V.vehicles.forEach((v,i)=>{for(const q of v.load)st.placed.push({crate:q.item,pallet:i,x:q.x,y:q.y});});
    return {pz,st};
  }
  const itemName=it=>it.name.charAt(0).toLowerCase()+it.name.slice(1);
  const vName=v=>`${v.name.toLowerCase()} ${v.id+1}`;
  function departCheck(V,vi){
    const v=V.vehicles[vi];if(!v)return 'No such rocket';
    if(v.away)return `The ${vName(v)} is in orbit: back in ${v.away} leg${v.away===1?'':'s'}`;
    if(!v.load.length)return `The ${vName(v)} is empty`;
    const {pz,st}=view(V),s=palletStats(pz,st,vi);
    if(!s.balanced)return `The ${vName(v)} is off-centre: centre of mass ${s.com.toFixed(2)}, keep it within ${s.lo}–${s.hi} to launch`;
    return null;
  }
  // Price of the next level of an upgrade (or of the next refit), or null when the route allows no more here.
  function upgradePrice(V,v,kind){
    const s=STAGES[v.stage];
    if(kind==='stage')return s.next==null?null:price(V,s.next);
    const list=s.ups[kind];if(!list)return null;const lvl=v.levels[kind]||0;if(lvl>=list.length)return null;
    if(kind==='fast'&&v.trip<=1)return null;
    if(kind==='nose'&&v.taper<=0)return null;
    return price(V,list[lvl]);
  }
  const hopperPrice=V=>V.vehicles.length>=V.settings.maxFleet?null:price(V,HOPPER_PRICES[Math.min(HOPPER_PRICES.length-1,V.vehicles.length-1)]);
  // Validates and applies one voyage action; returns null or the reason (state untouched).
  function act(V,a){
    const why=checkAct(V,a);if(why)return why;
    const {pz,st}=view(V);
    switch(a.type){
      case 'place':{const v=V.vehicles[a.vehicle],l=landing(pz,st,a.item,a.vehicle,a.x);if(!v.load.length)v.loadSince=V.leg;v.load.push({item:a.item,x:a.x,y:l.y});V.dock.splice(V.dock.indexOf(a.item),1);V.items[a.item].status='bed';break;}
      case 'lift':{const v=V.vehicles.find(v=>v.load.some(q=>q.item===a.item));v.load.splice(v.load.findIndex(q=>q.item===a.item),1);V.dock.push(a.item);V.items[a.item].status='dock';break;}
      case 'depart':{const v=V.vehicles[a.vehicle];V.pending.push({vehicle:a.vehicle,items:v.load.map(q=>q.item),leg:V.leg,dest:destOf(V,v)});for(const q of v.load)V.items[q.item].status='transit';
        v.load=[];v.away=v.trip;v.departedLeg=V.leg;V.launches=(V.launches||0)+1;break;}
      case 'buy':{V.credits-=hopperPrice(V);V.vehicles.push(newVehicle(V.vehicles.length));break;}
      case 'upgrade':{const v=V.vehicles[a.vehicle];V.credits-=upgradePrice(V,v,a.kind);if(a.kind==='stage')v.stage++;else v.levels[a.kind]=(v.levels[a.kind]||0)+1;restat(v);break;}
      case 'scrap':{V.dock.splice(V.dock.indexOf(a.item),1);V.items[a.item].status='scrapped';V.items[a.item].scrappedLeg=V.leg;break;}
      case 'end':endLeg(V);break;
    }
    V.log.push({leg:V.leg,...a});
    return null;
  }
  function checkAct(V,a){
    if(V.over)return 'The voyage is over';
    if(!a||typeof a!=='object')return 'No action';
    const {pz,st}=view(V);
    switch(a.type){
      case 'place':if(!V.dock.includes(a.item))return 'That item is not on the dock';if(!V.vehicles[a.vehicle])return 'No such rocket';return landing(pz,st,a.item,a.vehicle,a.x).reason;
      case 'lift':{const vi=V.vehicles.findIndex(v=>v.load.some(q=>q.item===a.item));if(vi<0)return 'That item is not in a fairing';return liftable(pz,st,a.item)?null:`Something is resting on the ${itemName(V.items[a.item])}`;}
      case 'depart':return departCheck(V,a.vehicle);
      case 'buy':{const pr=hopperPrice(V);if(pr==null)return `The pad is at its maximum of ${V.settings.maxFleet} rockets`;return V.credits>=pr?null:`Needs ${pr} cr (you have ${V.credits})`;}
      case 'upgrade':{const v=V.vehicles[a.vehicle];if(!v||!UPGRADES[a.kind])return 'No such upgrade';if(v.away)return `The ${vName(v)} is in orbit`;const pr=upgradePrice(V,v,a.kind);
        if(pr==null)return a.kind==='stage'?'Already a heavy lifter':a.kind==='nose'&&v.taper<=0&&STAGES[v.stage].ups.nose?`The ${vName(v)}'s fairing is already straight`:`No more ${UPGRADES[a.kind].label.toLowerCase()} at the ${v.name.toLowerCase()} stage`;return V.credits>=pr?null:`Needs ${pr} cr (you have ${V.credits})`;}
      case 'scrap':return V.dock.includes(a.item)?null:'That item is not on the dock';
      case 'end':return null;
    }
    return 'Unknown action';
  }
  // End of leg: rockets launched this leg deliver (gear to the front, samples to the lab; credits and order bonuses
  // paid), the dock overflows into scrap (lowest value first, orders last), rockets count down their return from orbit,
  // and the next leg's goods arrive.
  function endLeg(V){
    const report={paid:0,bonus:0,front:0,lab:0,scrapped:[],returned:[]};
    for(const p of V.pending){for(const id of p.items){const it=V.items[id];it.status='shipped';it.shippedLeg=p.leg;report.paid+=it.value;report[it.dest==='lab'?'lab':'front']++;
      if(it.order&&p.leg<=it.order.due){it.bonusPaid=it.order.bonus;report.bonus+=it.order.bonus;}}}
    V.pending=[];V.credits+=report.paid+report.bonus;V.delivered+=report.paid+report.bonus;V.bonuses+=report.bonus;
    while(V.dock.length>V.slots){const ids=V.dock.slice().sort((a,b)=>(!!V.items[a].order-!!V.items[b].order)||V.items[a].value-V.items[b].value||a-b);
      const id=ids[0];V.dock.splice(V.dock.indexOf(id),1);V.items[id].status='scrapped';V.items[id].scrappedLeg=V.leg;report.scrapped.push(id);}
    V.lastReport={leg:V.leg,...report};
    if(V.leg>=V.legs){V.over=true;return;}
    V.leg++;
    for(const v of V.vehicles)if(v.away){v.away--;if(!v.away)report.returned.push(v.id);}
    arrive(V);
  }
  // ---- planner (par), auto fallback and hint --------------------------------------------------------------------------
  const priority=(V,a,b)=>{const A=V.items[a],B=V.items[b],da=A.order&&V.leg<=A.order.due?A.order.due:99,db=B.order&&V.leg<=B.order.due?B.order.due:99;return da-db||B.value-A.value||a-b;};
  // Best legal placement of one item into one rocket on the pad that leaves it centred: lowest rest, then nearest centre.
  function bestSpot(V,pz,st,item,vi){
    const pal=pz.pallets[vi],c=pz.crates[item];if(pal.away)return null;let best=null,score=Infinity;
    const s=palletStats(pz,st,vi);
    for(let x=0;x+c.w<=pal.width;x++){const l=landing(pz,st,item,vi,x);if(l.reason)continue;
      const w=s.weight+c.weight,com=(s.weight*(s.count?s.com:0)+c.weight*(x+c.w/2))/w;if(com<pal.width/4-1e-9||com>pal.width*3/4+1e-9)continue;
      const sc=l.y*100+Math.abs(com-pal.width/2)+x*0.01;if(sc<score){score=sc;best={type:'place',item,vehicle:vi,x};}}
    return best;
  }
  // Rockets to try for an item: those already bound for its destination first, then empty ones.
  const padOrder=(pz,home,it)=>home.filter(vi=>pz.pallets[vi].dest===it.dest).concat(home.filter(vi=>!pz.pallets[vi].dest));
  const fitsSpec=(it,b)=>it.weight<=b.maxWeight&&fitsShape(it.w,it.h,b.cap);
  const after=(v,kind)=>{const b=JSON.parse(JSON.stringify(v));if(kind==='stage')b.stage++;else b.levels[kind]=(b.levels[kind]||0)+1;return restat(b);};
  // Cheapest single upgrade on a rocket on the pad that makes this good fit an empty fairing.
  function fixFor(V,it){
    const opts=[];
    V.vehicles.forEach((v,vi)=>{if(v.away)return;for(const kind of ['wide','tall','nose','load','stage']){const pr=upgradePrice(V,v,kind);if(pr==null)continue;if(fitsSpec(it,after(v,kind)))opts.push({type:'upgrade',vehicle:vi,kind,price:pr});}});
    opts.sort((a,b)=>a.price-b.price||a.vehicle-b.vehicle);return opts[0]||null;
  }
  function policy(V,mode='plan'){
    if(V.over)return null;
    const {pz,st}=view(V),home=V.vehicles.map((v,i)=>i).filter(i=>!V.vehicles[i].away),dock=V.dock.slice().sort((a,b)=>priority(V,a,b));
    if(mode==='plan'&&V.leg<=V.legs-1){
      // 1. A valuable good that fits no rocket at all: buy the cheapest fix.
      for(const id of dock){const it=V.items[id];if(V.vehicles.some(v=>fitsSpec(it,v)))continue;const p=fixFor(V,it);
        if(p&&V.credits>=p.price&&(it.value>=p.price*0.5||it.order)){const {price:_,...a}=p;return a;}}
      // 2. Goods are waiting that no rocket on the pad can take, and the pad can grow: build a hopper.
      const sp=hopperPrice(V),stuck=dock.filter(id=>!home.some(vi=>bestSpot(V,pz,st,id,vi))).length;
      if(sp!=null&&V.credits>=sp&&stuck>=2&&V.leg<=V.legs-2)return {type:'buy'};
      // 3. A rocket on the pad slowed by its stage: buy the faster turnaround.
      for(const vi of home){const v=V.vehicles[vi],pr=upgradePrice(V,v,'fast');if(pr!=null&&v.trip>1&&V.credits>=pr&&V.leg<=V.legs-2)return {type:'upgrade',vehicle:vi,kind:'fast'};}
      // 4. Refit the smallest rocket on the pad when there is money for the refit and the next stage's turnaround too
      //    (a bigger but slower rocket makes fewer trips, which can deliver less).
      if(V.leg<=V.legs-2){const vi=home.slice().sort((a,b)=>V.vehicles[a].stage-V.vehicles[b].stage||a-b).find(i=>upgradePrice(V,V.vehicles[i],'stage')!=null);
        if(vi!=null){const v=V.vehicles[vi],nx=after(v,'stage'),need=upgradePrice(V,v,'stage')+(nx.trip>1?upgradePrice(V,nx,'fast')||0:0);
          if(V.credits>=need)return {type:'upgrade',vehicle:vi,kind:'stage'};}}
      // 5. A rocket on the pad blocked only by payload from a valuable good: raise its limit.
      for(const vi of home){const v=V.vehicles[vi],pr=upgradePrice(V,v,'load');if(pr==null||V.credits<pr)continue;
        const loose={...pz,pallets:pz.pallets.map((p,i)=>i===vi?{...p,maxWeight:null}:p)};
        if(dock.some(id=>V.items[id].tier>=2&&!bestSpot(V,pz,st,id,vi)&&bestSpot(V,loose,st,id,vi)))return {type:'upgrade',vehicle:vi,kind:'load'};}
      // 6. Spare money (more than twice the price) and a good still waiting for room: widen a fairing.
      if(stuck)for(const vi of home){const pr=upgradePrice(V,V.vehicles[vi],'wide');if(pr!=null&&V.credits>=2*pr&&V.leg<=V.legs-2)return {type:'upgrade',vehicle:vi,kind:'wide'};}
    }
    // 7. Load: the highest-priority good that has a centred legal spot in a rocket on the pad, preferring a rocket already
    //    bound for its destination (auto: simply by value).
    const order=mode==='plan'?dock:V.dock.slice().sort((a,b)=>V.items[b].value-V.items[a].value||a-b);
    for(const id of order)for(const vi of padOrder(pz,home,V.items[id])){const m=bestSpot(V,pz,st,id,vi);if(m)return m;}
    // 8. Launch loaded rockets that are worth sending now (auto: anything loaded).
    for(const vi of home){const v=V.vehicles[vi];if(!v.load.length||departCheck(V,vi))continue;
      const s=palletStats(pz,st,vi),space=s.filled/s.area,weight=s.weight/v.maxWeight,due=v.load.some(q=>{const it=V.items[q.item];return it.order&&it.order.due<=V.leg+1&&V.leg<=it.order.due;});
      // A part load waits at most one leg for more goods; a 1-leg rocket never waits (it is back next leg anyway).
      if(mode!=='plan'||v.trip===1||space>=0.5||weight>=0.7||due||V.leg>=V.legs-1||(v.loadSince||V.leg)<V.leg)return {type:'depart',vehicle:vi};}
    return {type:'end'};
  }
  function playOut(V,mode){const actions=[];for(let i=0;i<8000&&!V.over;i++){const a=policy(V,mode);const why=act(V,a);if(why)throw new Error('policy made an illegal move: '+why+' '+JSON.stringify(a));actions.push(a);}return actions;}
  function planVoyage(seed,difficulty,settings){
    const V=createVoyage(seed,difficulty,{par:false,settings}),actions=playOut(V,'plan');
    return {actions,delivered:V.delivered,buys:V.log.filter(a=>a.type==='buy'||a.type==='upgrade').map(a=>({leg:a.leg,type:a.type,kind:a.kind,vehicle:a.vehicle})),final:V};
  }
  // Skip: the rest of the voyage loads greedily by value, launches anything loaded, never builds or upgrades.
  function autoVoyage(V){const W=cloneVoyage(V);playOut(W,'auto');return W;}
  function voyageHint(V){
    const a=policy(V,'plan');if(!a)return null;const it=a.item!=null?V.items[a.item]:null,v=a.vehicle!=null?V.vehicles[a.vehicle]:null;
    const text=a.type==='place'?`Load the ${itemName(it)} into the ${vName(v)}, column ${columnFor({crates:V.items},a.item,a.x)+1}${v.load.length?'':` (it tags the fairing for ${DEST_TO[it.dest]})`}.`
      :a.type==='depart'?`Launch the ${vName(v)} to ${DEST_TO[destOf(V,v)]} now.`
      :a.type==='buy'?`Build another hopper (${hopperPrice(V)} cr).`
      :a.type==='upgrade'?(a.kind==='stage'?`Refit the ${vName(v)} into a ${STAGES[v.stage+1].name.toLowerCase()} (${upgradePrice(V,v,'stage')} cr).`:`Upgrade the ${vName(v)}: ${UPGRADES[a.kind].label.toLowerCase()} (${upgradePrice(V,v,a.kind)} cr).`)
      :`Nothing more worth loading now: end leg ${V.leg}.`;
    return {...a,text};
  }
  function voyageTier(V){if(!V.delivered)return 'failed';if(V.delivered>=V.par)return 'perfect';if(V.delivered>=GOOD_SHARE*V.par)return 'good';return 'partial';}
  function unlockText(kind,spec,before){
    // Shape upgrades: goods that now fit the fairing; payload upgrades: goods that are now light enough.
    const ks=Object.keys(GOODS).filter(k=>{const g=GOODS[k],fitW=g.weight<=spec.maxWeight&&g.weight>before.maxWeight,fitS=fitsShape(g.w,g.h,spec.cap)&&!fitsShape(g.w,g.h,before.cap);
      return kind==='load'?fitW:kind==='stage'?fitW||fitS:fitS;});
    const names=ks.map(k=>GOODS[k].name.toLowerCase());
    return names.length?`${kind==='load'?'can lift':'fits'} ${names.length>2?names.slice(0,2).join(', ')+'…':names.join(' and ')}`:'';
  }
  // The hangar, grouped by rocket: its route (stages), the next refit and its next few stat upgrades, plus a card to
  // build a hopper. Each option says its price and what it changes in plain words.
  function shop(V){
    const groups=V.vehicles.map((v,vi)=>{
      const opts=[];
      for(const kind of ['stage','wide','tall','nose','load','fast','floor']){const pr=upgradePrice(V,v,kind);if(pr==null)continue;const b=after(v,kind);
        const detail=kind==='stage'?`fairing ${v.width}×${v.height}→${b.width}×${b.height} (${shapeArea(v)}→${shapeArea(b)} cells), payload ${v.maxWeight}→${b.maxWeight}, ${b.trip}-leg trip${b.reinforced&&!v.reinforced?', reinforced deck':''}`
          :kind==='wide'?`${v.width}→${b.width} wide, top row ${topRow(v)}→${topRow(b)}`:kind==='tall'?`${v.height}→${b.height} high`:kind==='nose'?`top row ${topRow(v)}→${topRow(b)} wide, ${shapeArea(v)}→${shapeArea(b)} cells`
          :kind==='load'?`payload ${v.maxWeight}→${b.maxWeight}`:kind==='fast'?`back from orbit in ${b.trip} leg${b.trip===1?'':'s'} instead of ${v.trip}`:'heavy crates can sit on anything';
        const unlock=['wide','tall','nose','load','stage'].includes(kind)?unlockText(kind,b,v):'';
        opts.push({type:'upgrade',vehicle:vi,kind,label:kind==='stage'?`Refit → ${STAGES[v.stage+1].name}`:UPGRADES[kind].label,price:pr,detail:detail+(unlock?` · ${unlock}`:''),reason:checkAct(V,{type:'upgrade',vehicle:vi,kind})});}
      const stage=opts.find(o=>o.kind==='stage'),stats=opts.filter(o=>o.kind!=='stage').sort((a,b)=>a.price-b.price);
      return {vehicle:vi,name:vName(v),stage:v.stage,route:STAGES.map((s,i)=>({id:s.id,name:s.name,icon:s.icon,state:i<v.stage?'past':i===v.stage?'now':'next',price:i===v.stage+1?stage&&stage.price:null})),
        transform:stage||null,upgrades:stats.slice(0,3),more:stats.slice(3)};
    });
    const pr=hopperPrice(V);
    return {groups,add:{type:'buy',label:'Build a hopper',price:pr,detail:pr==null?`Pad at its maximum of ${V.settings.maxFleet} rockets`:`${V.vehicles.length}/${V.settings.maxFleet} rockets · every new rocket starts as a hopper`,reason:checkAct(V,{type:'buy'})}};
  }
  // When a fairing on the pad has room left but a dock good is blocked only by payload, say so plainly.
  function weightNote(V,vi){
    const v=V.vehicles[vi];if(v.away)return '';const {pz,st}=view(V),s=palletStats(pz,st,vi);
    const loose={...pz,pallets:pz.pallets.map((p,i)=>i===vi?{...p,maxWeight:null}:p)};
    const blocked=V.dock.map(id=>V.items[id]).filter(it=>!bestSpot(V,pz,st,it.id,vi)&&bestSpot(V,loose,st,it.id,vi)).sort((a,b)=>b.value-a.value)[0];
    return blocked?`Payload ${s.weight}/${v.maxWeight}: raise the ${vName(v)}'s payload to launch the ${itemName(blocked)}.`:'';
  }
  // Orders grouped by id: who asked, what, how many, and how many reached them on time.
  function orders(V){
    const map=new Map();
    for(const it of V.items)if(it.order){const o=map.get(it.order.id)||{...it.order,kind:it.kind,name:it.name,items:[]};o.items.push(it);map.set(it.order.id,o);}
    return [...map.values()].map(o=>({...o,paid:o.items.filter(i=>i.bonusPaid).length,sent:o.items.filter(i=>i.status==='shipped'||i.status==='transit').length}));
  }
  const orderText=o=>{const plural=o.qty>1,n=plural?`${o.qty} ${GOODS[o.kind].sample?itemName({name:o.name})+'s':pluralName(o.kind)}`:`${GOODS[o.kind].sample?'a':'the'} ${itemName({name:o.name})}`;
    return `${o.by} needs ${n} by leg ${o.due}`;};
  const pluralName=k=>{const n=GOODS[k].name.toLowerCase();return /s$/.test(n)?n:n+'s';};
  function voyageNearMiss(V){
    const final=V.vehicles;
    const missedOrder=V.items.filter(it=>it.order&&!it.bonusPaid&&V.leg>=it.order.due).sort((a,b)=>b.order.bonus-a.order.bonus)[0];
    const unshipped=V.items.filter(it=>it.status!=='shipped').sort((a,b)=>b.value-a.value)[0];
    const cand=[];
    if(missedOrder)cand.push({value:missedOrder.order.bonus,text:`${missedOrder.order.by}'s ${itemName(missedOrder)} missed its leg-${missedOrder.order.due} deadline: launching it by then would have added +${missedOrder.order.bonus} cr.`});
    if(unshipped){
      const legs=(unshipped.scrappedLeg||V.leg)-unshipped.arrived+1,where=unshipped.status==='scrapped'?`was scrapped at leg ${unshipped.scrappedLeg}`:unshipped.status==='bed'?'was still in a fairing when the voyage ended':`sat on the dock for ${legs} leg${legs===1?'':'s'}`;
      let why;
      if(!final.some(v=>fitsShape(unshipped.w,unshipped.h,v.cap)))why=`: no fairing had room for a ${unshipped.w}×${unshipped.h} crate under its taper. Refitting a rocket or widening its fairing would have launched it`;
      else if(!final.some(v=>fitsSpec(unshipped,v)))why=`: no rocket could lift ${unshipped.weight}. A payload upgrade would have launched it`;
      else why=`: a rocket with room for it was on the pad (it needed one bound for ${DEST_TO[unshipped.dest]})`;
      cand.push({value:unshipped.value,text:`The ${itemName(unshipped)} (${unshipped.value} cr) ${where}${why}.`});
    }
    cand.sort((a,b)=>b.value-a.value);
    const head=cand[0]?cand[0].text:'';
    return V.delivered<V.par?`${head} Par was ${V.par} cr; you delivered ${V.delivered}.`.trim():head;
  }
  function voyageOutput(V){
    const shipped=V.items.filter(it=>it.status==='shipped'),front=shipped.filter(it=>it.dest!=='lab').length,lab=shipped.length-front,n=V.launches||0;
    return `Launched: ${n} rocket${n===1?'':'s'} · ${front} crate${front===1?'':'s'} to the front · ${lab} sample${lab===1?'':'s'} to the lab · ${V.delivered} cr over ${V.legs} legs${V.bonuses?` · ${V.bonuses} cr in order bonuses`:''}`;
  }

  const api={CATALOG,PUZZLES,DIFFICULTIES:PUZZLES,ROLLOUTS,generate,interlocks,emptyCells,create,clone,profile,landing,liftable,validate,apply,anchorFor,columnFor,
    palletStats,evaluate,tier,solve,greedy,greedyClears,randomPlay,randomRate,auto,hint,legalMoves,nearMiss,describe,output,dock,fairing,ceilings,colH,shapeArea,fitsShape,clampTaper,
    GOODS,TIERS,SOURCES,LTS,DEST,DEST_ICON,DEST_TO,STAGES,UPGRADES,HOPPER_PRICES,VOYAGES,MODES,PRESETS,DEFAULT_PRESET,LIMITS,normSettings,settingsText,GOOD_SHARE,schedule,createVoyage,cloneVoyage,view,destOf,act,checkAct,departCheck,upgradePrice,hopperPrice,restat,policy,planVoyage,autoVoyage,voyageHint,voyageTier,shop,weightNote,orders,orderText,voyageNearMiss,voyageOutput};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PalletStacking=api;
})(typeof globalThis==='object'?globalThis:this);
