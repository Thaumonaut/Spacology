// Sensor placement (Research, night): Catdoku / Queens / Star Battle rules on a terrain map. Pure rules, no DOM.
// Fiction: the map is the battlefield of the voyage phase's upcoming elective fight (the harder optional battle). Each
// zone with its sensor reveals the enemy contact there, and the scout lowers that fight's difficulty (see scout()).
// An n×n grid is split into n terrain zones. Place exactly one sensor in every row, every column and every zone; no two
// sensors may touch, not even diagonally. Every generated map has exactly one answer and is solvable by the human-style
// deductions below without guessing (Easy/Normal and every big map, 9×9 to 15×15) or with one-cell "what if" checks at
// most (Expert).
// Solving reveals the enemy contact hiding in each zone of the elective fight. Contacts never change the logic.
// Cells are indexed i = y*n + x. Player marks: 0 empty, 1 sensor, 2 × (manual), 3 × (auto-marked by the assist),
// 4 × (deduced by the Guided/Relaxed assist levels; always re-derived from the other marks).
// Quality-of-life helpers also live here so they are testable: probes (trial sensors whose consequences are shown
// without committing), one-step hints, the mistake check, and per-row/column/zone status for the board edges.
// Loads as a classic script (window.SensorGrid) or with require() in Node.
(function(root){
  'use strict';
  const Kit=typeof module==='object'&&module.exports&&typeof require==='function'?require('../../shared/minigames/minigame-kit.js'):root.MiniGameKit;

  // level: the deepest deduction a puzzle may need. 0 = single-step rules (last open cell, a zone confined to one line,
  // a cell that would wipe out a zone/line); 1 = also k zones confined to k lines; 2 = also one-cell "what if" checks.
  // minZone: smallest zone allowed. A one-cell zone is a free sensor, a gentle way in on Easy only.
  // prefer: Hard/Expert spend their first draws looking for a map that really needs a level-1+ deduction (several zones
  // pinned to the same lines), so the difficulty is felt, not only sized. Most maps still need only level 0.
  const DIFFICULTIES=[
    {id:'easy',label:'Patrol · 5×5',size:5,target:40,level:0,minZone:1,prefer:0},
    {id:'normal',label:'Survey · 6×6',size:6,target:55,level:1,minZone:2,prefer:0},
    {id:'hard',label:'Deep scan · 7×7',size:7,target:75,level:1,minZone:2,prefer:1},
    {id:'expert',label:'Blackout · 8×8',size:8,target:90,level:2,minZone:2,prefer:1},
    // Big maps: built forced by construction (see forcedBuild), checked for level-1 reasoning at most (a one-cell
    // "what if" over 100+ cells is no fun by hand); pieces = share of zones that are basic shapes, the rest are fillers.
    {id:'sector',label:'Sector · 9×9',size:9,target:120,level:1,minZone:2,prefer:1,build:'forced',pieces:0.7},
    {id:'region',label:'Battlefield · 10×10',size:10,target:150,level:1,minZone:2,prefer:1,build:'forced',pieces:0.7},
    {id:'theatre',label:'Theatre · 11×11',size:11,target:180,level:1,minZone:2,prefer:1,build:'forced',pieces:0.7},
    {id:'front',label:'Front · 12×12',size:12,target:210,level:1,minZone:2,prefer:1,build:'forced',pieces:0.7},
    {id:'continent',label:'Continent · 15×15',size:15,target:300,level:1,minZone:2,prefer:1,build:'forced',pieces:0.7}
  ];
  const TERRAINS=[
    {id:'marsh',name:'Marsh',glyph:'≈'},
    {id:'ridge',name:'Ridge',glyph:'▲'},
    {id:'thicket',name:'Thicket',glyph:'♣'},
    {id:'ash',name:'Ash plain',glyph:'∴'},
    {id:'ice',name:'Ice shelf',glyph:'✻'},
    {id:'crater',name:'Crater',glyph:'◎'},
    {id:'reef',name:'Reef',glyph:'⌇'},
    {id:'spore',name:'Spore field',glyph:'✿'},
    // Only the big maps (9+ zones) use these; small maps draw from the first eight.
    {id:'dune',name:'Dune',glyph:'∽'},
    {id:'basalt',name:'Basalt',glyph:'⬡'},
    {id:'moss',name:'Moss bed',glyph:'❦'},
    {id:'ember',name:'Ember flat',glyph:'✦'},
    {id:'salt',name:'Salt pan',glyph:'◇'},
    {id:'kelp',name:'Kelp shallows',glyph:'⋮'},
    {id:'bloom',name:'Bloom',glyph:'❀'}
  ];
  // Enemy archetypes from docs/design/design-record.md; weight = how often a zone hides that archetype.
  const ARCHETYPES={
    chaff:{name:'Chaff',glyph:'Ch',weight:4,note:'Numerous and disposable'},
    bruiser:{name:'Bruiser',glyph:'Br',weight:3,note:'Slow and heavy'},
    warden:{name:'Warden',glyph:'Wa',weight:1,note:'Huge shields, soft body: bring Blight'},
    cleanser:{name:'Cleanser',glyph:'Cl',weight:1,note:'Sheds ailments: weak to non-DoT builds'},
    reflector:{name:'Reflector',glyph:'Re',weight:1,note:'Returns hits: favour heavy single hits'},
    anchor:{name:'Anchor',glyph:'An',weight:1,note:'Strengthens the rest: clear it fast'},
    bulwark:{name:'Bulwark',glyph:'Bu',weight:1,note:'Guards a neighbour: punishes single-target burst'},
    quickstep:{name:'Quickstep',glyph:'Qu',weight:1,note:'Acts twice as often: punishes setup teams'}
  };
  const EMPTY=0,SENSOR=1,X=2,AUTO=3,DEDUCED=4;
  // Assist levels: how much of the logic the game does for the player. Puzzle is the pure game (Perfect lives here);
  // Guided fills in the simple × deductions after every move; Relaxed also drops forced sensors in, chaining.
  const ASSIST_LEVELS=[
    {id:'puzzle',label:'Puzzle',note:'Pure logic: you do every step. Perfect is possible.'},
    {id:'guided',label:'Guided',note:'Obvious ×s fill in after each move (a zone stuck in one line clears the rest of it). You place every sensor.'},
    {id:'relaxed',label:'Relaxed',note:'Guided, plus open cells glow and forced sensors drop in by themselves, chaining like dominoes.'}
  ];
  const difficulty=id=>DIFFICULTIES.find(d=>d.id===id)||DIFFICULTIES[1];
  const colName=x=>String.fromCharCode(65+x);
  const label=(P,i)=>colName(i%P.n)+(Math.floor(i/P.n)+1);
  const plural=(k,word)=>`${k} ${word}${k===1?'':'s'}`;
  const andList=items=>items.length<2?items.join(''):items.slice(0,-1).join(', ')+' and '+items.at(-1);
  const orList=items=>items.length<2?items.join(''):items.slice(0,-1).join(', ')+' or '+items.at(-1);
  const terrainOf=(P,r)=>TERRAINS.find(t=>t.id===P.zones[r].terrain);
  const zoneName=(P,r)=>`the ${terrainOf(P,r).name.toLowerCase()} zone`;

  // ---------- Geometry, cached per puzzle object so puzzles stay plain JSON ----------
  const cache=new WeakMap();
  function geo(P){
    let G=cache.get(P);if(G)return G;
    const n=P.n,N=n*n,row=[],col=[],reg=P.region,rows=[],cols=[],zones=[];
    for(let k=0;k<n;k++){rows.push([]);cols.push([]);zones.push([]);}
    for(let i=0;i<N;i++){row.push(Math.floor(i/n));col.push(i%n);rows[row[i]].push(i);cols[col[i]].push(i);zones[reg[i]].push(i);}
    // attacks[c]: every other cell a sensor on c rules out (same row, column or zone, or touching).
    const hit=new Uint8Array(N*N),attacks=[];
    for(let c=0;c<N;c++){
      const list=[];
      for(let a=0;a<N;a++){if(a===c)continue;
        if(row[a]===row[c]||col[a]===col[c]||reg[a]===reg[c]||(Math.abs(row[a]-row[c])<=1&&Math.abs(col[a]-col[c])<=1)){hit[c*N+a]=1;list.push(a);}}
      attacks.push(list);
    }
    // Units in reasoning order: zones read first (they are what the player looks at), then rows, then columns.
    const units=[...zones.map((cells,k)=>({kind:'zone',k,cells})),...rows.map((cells,k)=>({kind:'row',k,cells})),...cols.map((cells,k)=>({kind:'col',k,cells}))];
    G={n,N,row,col,reg,rows,cols,zones,attacks,hit,units};cache.set(P,G);return G;
  }
  const unitName=(P,u)=>u.kind==='zone'?zoneName(P,u.k):u.kind==='row'?`row ${u.k+1}`:`column ${colName(u.k)}`;
  // Why two sensors clash: the first shared constraint, in the order a player would notice it.
  function clashWhy(G,a,b){
    if(Math.abs(G.row[a]-G.row[b])<=1&&Math.abs(G.col[a]-G.col[b])<=1)return 'touch';
    if(G.row[a]===G.row[b])return 'row';if(G.col[a]===G.col[b])return 'column';return 'zone';
  }

  // ---------- Exhaustive solver: counts solutions (row by row) to prove uniqueness ----------
  // cand (optional): cells a sound deduction has left possible. Every solution lies inside it, so the count and the
  // order solutions are found in are unchanged; it only prunes (this is what keeps 15×15 generation fast).
  // budget (optional): give up after that many search nodes and report count -1 (the generator then draws a new map).
  function countSolutions(P,limit=2,cand=null,budget=Infinity){
    const G=geo(P),n=G.n,colUsed=new Uint8Array(n),zoneUsed=new Uint8Array(n),pick=new Int16Array(n),all=[];let count=0,nodes=0;
    (function rec(r){
      if(count>=limit||count<0)return;
      if(++nodes>budget){count=-1;return;}
      if(r===n){count++;all.push(Array.from(pick,(c,y)=>y*n+c));return;}
      for(let c=0;c<n;c++){
        const z=G.reg[r*n+c];if((cand&&!cand[r*n+c])||colUsed[c]||zoneUsed[z]||(r>0&&Math.abs(pick[r-1]-c)<=1))continue;
        colUsed[c]=zoneUsed[z]=1;pick[r]=c;rec(r+1);colUsed[c]=zoneUsed[z]=0;
      }
    })(0);
    return {count,solution:all[0]||null,solutions:all};
  }

  // ---------- Logic solver: human deductions over a candidate set ----------
  // State: cand[i]=1 while a sensor at i is still possible (placed cells stay candidates), placed[i]=1 once fixed.
  const fresh=G=>({cand:new Uint8Array(G.N).fill(1),placed:new Uint8Array(G.N)});
  const clone=st=>({cand:st.cand.slice(),placed:st.placed.slice()});
  function place(G,st,c){st.placed[c]=1;st.cand[c]=1;for(const a of G.attacks[c])st.cand[a]=0;}
  const candsIn=(st,cells)=>cells.filter(c=>st.cand[c]);
  const hasPlaced=(st,cells)=>cells.some(c=>st.placed[c]);
  const placedCount=st=>st.placed.reduce((s,v)=>s+v,0);
  function applyStep(G,st,s){if(s.place!==undefined)place(G,st,s.place);else for(const c of s.cells)st.cand[c]=0;}

  // k zones whose open cells all sit in k lines own those lines (and the mirror: k lines whose open cells all sit in k
  // zones own those zones). k = 1 is the everyday "zone confined to one row" rule; k ≥ 2 is level 1.
  // Speed (15×15 has 2^15 zone sets): each zone/line is a bitmask of the lines/zones its open cells use, and the k-sets
  // are walked in the same lexicographic order as a plain enumeration but abandoned as soon as their union passes k.
  // k stops at half the open units: k zones pinned to k lines is the same fact as the other lines pinned to the other
  // zones, so a bigger set always has a smaller mirror that removes the same cells and is found first.
  const bits=m=>{let k=0;while(m){m&=m-1;k++;}return k;};
  function setStep(G,st,kMin,kMax){
    const openZones=G.zones.map((cells,k)=>k).filter(k=>!hasPlaced(st,G.zones[k]));
    for(const kind of ['row','col']){
      const lines=kind==='row'?G.rows:G.cols,of=kind==='row'?G.row:G.col;
      const openLines=lines.map((cells,k)=>k).filter(k=>!hasPlaced(st,lines[k]));
      const zMask=openZones.map(z=>{let m=0;for(const c of G.zones[z])if(st.cand[c])m|=1<<of[c];return m;});
      const lMask=openLines.map(l=>{let m=0;for(const c of lines[l])if(st.cand[c])m|=1<<G.reg[c];return m;});
      const top=Math.min(kMax,openZones.length-1,Math.max(1,Math.floor(Math.max(openZones.length,openLines.length)/2)));
      for(let k=kMin;k<=top;k++){
        // Every k-set with a k-line union is tried in order; the first that rules something out is the step.
        const tryZones=combo=>{
          const ls=new Set();for(const z of combo)for(const c of G.zones[z])if(st.cand[c])ls.add(of[c]);
          const inZ=new Set(combo),cells=[];for(const l of ls)for(const c of lines[l])if(st.cand[c]&&!st.placed[c]&&!inZ.has(G.reg[c]))cells.push(c);
          return cells.length?{kind:'zonesInLines',level:k>1?1:0,zones:combo,lineKind:kind,lines:[...ls].sort((a,b)=>a-b),cells:cells.sort((a,b)=>a-b)}:null;
        };
        const tryLines=combo=>{
          const zs=new Set();for(const l of combo)for(const c of lines[l])if(st.cand[c])zs.add(G.reg[c]);
          const inL=new Set(combo),cells=[];for(const z of zs)for(const c of G.zones[z])if(st.cand[c]&&!st.placed[c]&&!inL.has(of[c]))cells.push(c);
          return cells.length?{kind:'linesInZones',level:k>1?1:0,zones:[...zs].sort((a,b)=>a-b),lineKind:kind,lines:combo,cells:cells.sort((a,b)=>a-b)}:null;
        };
        const s=eachSet(openZones,zMask,k,tryZones)||eachSet(openLines,lMask,k,tryLines);if(s)return s;
      }
    }
    return null;
  }
  // Calls fn on every k-subset of list (lexicographic) whose masks' union has exactly k bits; returns fn's first hit.
  function eachSet(list,masks,k,fn){
    const acc=[];
    return (function rec(start,mask){
      if(bits(mask)>k)return null;
      if(acc.length===k)return bits(mask)===k?fn(acc.slice()):null;
      for(let i=start;i<=list.length-(k-acc.length);i++){acc.push(list[i]);const r=rec(i+1,mask|masks[i]);acc.pop();if(r)return r;}
      return null;
    })(0,0);
  }
  // Cells that would wipe out a unit: a sensor there rules out every open cell of some zone, row or column.
  function emptyStep(G,st){
    const open=G.units.filter(u=>!hasPlaced(st,u.cells)).map(u=>({u,cs:candsIn(st,u.cells)})).sort((a,b)=>a.cs.length-b.cs.length);
    for(const {u,cs} of open){
      const inU=new Set(u.cells),cells=[];
      for(let c=0;c<G.N;c++){if(!st.cand[c]||st.placed[c]||inU.has(c))continue;if(cs.every(x=>G.hit[c*G.N+x]))cells.push(c);}
      if(cells.length)return {kind:'empty',level:0,unit:u,cells};
    }
    return null;
  }
  // The next deduction from a state, easiest first. Returns {contradiction:unit}, a step, or null when stuck/solved.
  function nextStep(G,st,maxLevel){
    for(const u of G.units){
      if(hasPlaced(st,u.cells))continue;
      const cs=candsIn(st,u.cells);
      if(!cs.length)return {contradiction:u};
      if(cs.length===1)return {kind:'single',level:0,unit:u,place:cs[0],cells:[cs[0]]};
    }
    const s=setStep(G,st,1,1)||emptyStep(G,st);if(s)return s;
    if(maxLevel>=1){const t=setStep(G,st,2,G.n);if(t)return t;}
    if(maxLevel>=2){
      for(let c=0;c<G.N;c++){
        if(!st.cand[c]||st.placed[c])continue;
        const t=clone(st);place(G,t,c);const why=propagate(G,t,1);
        if(why)return {kind:'lookahead',level:2,cell:c,cells:[c],unit:why};
      }
    }
    return null;
  }
  // Runs deductions up to maxLevel until stuck or solved. Returns the unit left empty on a contradiction, else null.
  function propagate(G,st,maxLevel){
    for(let guard=0;guard<4*G.N;guard++){
      if(placedCount(st)===G.n)return null;
      const s=nextStep(G,st,maxLevel);if(!s)return null;if(s.contradiction)return s.contradiction;applyStep(G,st,s);
    }
    return null;
  }
  function logicSolve(P,maxLevel){
    const G=geo(P),st=fresh(G),steps=[];let top=0;
    for(let guard=0;guard<4*G.N&&placedCount(st)<G.n;guard++){
      const s=nextStep(G,st,maxLevel);if(!s||s.contradiction)break;
      steps.push(s);top=Math.max(top,s.level);applyStep(G,st,s);
    }
    const sensors=[];for(let i=0;i<G.N;i++)if(st.placed[i])sensors.push(i);
    return {solved:sensors.length===G.n,sensors,steps,level:top,cand:st.cand};
  }

  // ---------- Generator ----------
  // A random non-touching permutation (one sensor per row and column, neighbouring rows ≥ 2 columns apart).
  function permutation(rng,n){
    const pick=[],used=new Uint8Array(n);
    return (function rec(r){
      if(r===n)return true;
      for(const c of rng.shuffle([...Array(n).keys()])){
        if(used[c]||(r>0&&Math.abs(pick[r-1]-c)<=1))continue;
        used[c]=1;pick[r]=c;if(rec(r+1))return true;used[c]=0;
      }
      return false;
    })(0)?pick:null;
  }
  // Grow one zone from each sensor. Each zone has a growth speed (slow zones stay small: they are the way in) and a
  // shape: 'line' zones run along their seed's row or column for long thin strips, 'blob' zones stay compact.
  // A zone stops growing at cap cells while any other zone can still grow, so no zone swallows the map.
  function grow(rng,n,pick){
    const N=n*n,owner=new Int8Array(N).fill(-1),styles=[],size=new Array(n).fill(1),cap=Math.round(2.1*n);
    for(let r=0;r<n;r++){owner[r*n+pick[r]]=r;
      styles.push({shape:rng.pick(['line','line','blob','blob','free']),axis:rng.pick(['row','col']),speed:rng.pick([.35,1,1,2,3]),seed:r*n+pick[r]});}
    const nb=i=>{const x=i%n,y=Math.floor(i/n),out=[];if(x>0)out.push(i-1);if(x<n-1)out.push(i+1);if(y>0)out.push(i-n);if(y<n-1)out.push(i+n);return out;};
    let left=N-n;
    while(left>0){
      const fronts=[];
      for(let r=0;r<n;r++){
        const f=new Set();for(let i=0;i<N;i++)if(owner[i]===r)for(const j of nb(i))if(owner[j]<0)f.add(j);
        if(f.size)fronts.push({r,cells:[...f]});
      }
      if(fronts.some(f=>size[f.r]<cap))for(let k=fronts.length-1;k>=0;k--)if(size[fronts[k].r]>=cap)fronts.splice(k,1);
      let total=0;for(const f of fronts)total+=styles[f.r].speed;
      let roll=rng.next()*total,F=fronts[fronts.length-1];for(const f of fronts){roll-=styles[f.r].speed;if(roll<=0){F=f;break;}}
      const S=styles[F.r],sx=S.seed%n,sy=Math.floor(S.seed/n);
      let best=-1,bestScore=-Infinity;
      for(const c of F.cells){
        const same=nb(c).filter(j=>owner[j]===F.r).length,x=c%n,y=Math.floor(c/n);
        let score=rng.next()*1.5;
        if(S.shape==='blob')score+=same*1.2;
        else if(S.shape==='line')score+=(S.axis==='row'?(y===sy?3:0):(x===sx?3:0))-same*.8;
        if(score>bestScore){bestScore=score;best=c;}
      }
      owner[best]=F.r;size[F.r]++;left--;
    }
    return Array.from(owner);
  }
  function weighted(rng){
    const types=Object.keys(ARCHETYPES),total=types.reduce((s,t)=>s+ARCHETYPES[t].weight,0);
    let roll=rng.next()*total;for(const t of types){roll-=ARCHETYPES[t].weight;if(roll<0)return t;}return types[0];
  }
  // Breaks a second solution: one of its sensors not shared with the answer moves into a neighbouring zone, which then
  // holds two of that solution's sensors. The cell's old zone must stay connected and at least minZone cells.
  function repair(rng,n,region,answer,alt,minZone){
    const ans=new Set(answer),size=new Array(n).fill(0);region.forEach(z=>size[z]++);
    const nb=i=>{const x=i%n,y=Math.floor(i/n),out=[];if(x>0)out.push(i-1);if(x<n-1)out.push(i+1);if(y>0)out.push(i-n);if(y<n-1)out.push(i+n);return out;};
    for(const c of rng.shuffle(alt.filter(c=>!ans.has(c)))){
      const from=region[c];if(size[from]<=minZone)continue;
      const to=rng.shuffle(nb(c).map(j=>region[j]).filter(z=>z!==from));if(!to.length)continue;
      const seed=answer.find(a=>region[a]===from),seen=new Set([seed]),queue=[seed];
      while(queue.length){const i=queue.pop();for(const j of nb(i))if(j!==c&&region[j]===from&&!seen.has(j)){seen.add(j);queue.push(j);}}
      if(seen.size!==size[from]-1)continue;
      region[c]=to[0];return true;
    }
    return false;
  }
  function nbOf(n,i){const x=i%n,y=Math.floor(i/n),out=[];if(x>0)out.push(i-1);if(x<n-1)out.push(i+1);if(y>0)out.push(i-n);if(y<n-1)out.push(i+n);return out;}
  // Sprawl of a zone: its border length against the border of a square of the same area (1 = a tidy square, a winding
  // one-cell corridor of 60 cells is about 4). Big maps reject a zone that weaves between the others: it leaves
  // nothing to reason about when you place sensors by hand.
  function zoneShapes(n,region){
    const A=new Array(n).fill(0),Pm=new Array(n).fill(0);
    for(let i=0;i<n*n;i++){const z=region[i];A[z]++;const x=i%n,y=(i-x)/n;
      if(x===0||region[i-1]!==z)Pm[z]++;if(x===n-1||region[i+1]!==z)Pm[z]++;if(y===0||region[i-n]!==z)Pm[z]++;if(y===n-1||region[i+n]!==z)Pm[z]++;}
    return A.map((a,z)=>({area:a,sprawl:Pm[z]/(4*Math.sqrt(a))}));
  }
  const SPRAWL_MAX=2.4,REPAIR_BUDGET=60000; // big maps: no zone sprawls past SPRAWL_MAX+0.2; search budget for the repair check
  // ---------- Shape-built maps: small readable pieces plus a few big blocks ----------
  // The puzzles that are fun by hand break into small puzzles: a straight 3-cell strip pins its row, an L or a T
  // touches two lines, a 2×2 block forces its neighbours. So most zones are stamped from a set of simple pieces, each
  // placed over its sensor, and the rest are big compact blocks that fill the space left over. The logic solver keeps
  // only maps it can finish (which also proves the answer is the only one).
  const PIECES=(()=>{
    const base={
      I2:[[0,0],[1,0]],I3:[[0,0],[1,0],[2,0]],I4:[[0,0],[1,0],[2,0],[3,0]],I5:[[0,0],[1,0],[2,0],[3,0],[4,0]],
      V3:[[0,0],[1,0],[0,1]],L4:[[0,0],[0,1],[0,2],[1,2]],L5:[[0,0],[0,1],[0,2],[0,3],[1,3]],V5:[[0,0],[1,0],[2,0],[0,1],[0,2]],
      T4:[[0,0],[1,0],[2,0],[1,1]],T5:[[0,0],[1,0],[2,0],[1,1],[1,2]],U5:[[0,0],[2,0],[0,1],[1,1],[2,1]],
      O4:[[0,0],[1,0],[0,1],[1,1]],R6:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],R9:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]],
      I6:[[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]],L6:[[0,0],[0,1],[0,2],[0,3],[1,3],[2,3]],X5:[[1,0],[0,1],[1,1],[2,1],[1,2]],S4:[[1,0],[2,0],[0,1],[1,1]],P5:[[0,0],[1,0],[0,1],[1,1],[0,2]]
    };
    const out={};
    for(const [k,cells] of Object.entries(base)){
      const seen=new Set(),forms=[];
      let cur=cells;
      for(let m=0;m<2;m++){
        for(let r=0;r<4;r++){
          const mx=Math.min(...cur.map(c=>c[0])),my=Math.min(...cur.map(c=>c[1]));
          const norm=cur.map(([x,y])=>[x-mx,y-my]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]),key=JSON.stringify(norm);
          if(!seen.has(key)){seen.add(key);forms.push(norm);}
          cur=cur.map(([x,y])=>[-y,x]);
        }
        cur=cells.map(([x,y])=>[-x,y]);
      }
      out[k]=forms;
    }
    return out;
  })();
  // How often each piece is drawn: straight strips, corners, L, T and U first, then the rest.
  const PIECE_BAG=['I3','I3','I4','I4','I2','I5','V3','V3','L4','L4','L5','V5','T4','T4','T5','U5','U5','O4','X5','S4','P5'];
  // Bigger maps add the odd medium piece (a 2×3 block, a big L); the basic shapes stay the majority.
  const BIG_BAG=PIECE_BAG.concat(['R6','L6']);
  // forcedBuild: a shape-built map that is solvable by construction (no search, no repair).
  // 1. The answer's sensors get a solving order. dies[c] = the first sensor in that order whose row, column or ring rules
  //    cell c out.
  // 2. Zones are made in that order. A zone may only hold cells ruled out before its turn (dies[c] < its rank), so when
  //    its turn comes its sensor is the one cell left: every zone is forced by the ones before it, and solving one small
  //    piece hands you the next. Early zones get basic pieces (strip, corner, L, T, U, square…) placed over their
  //    sensor; the last third are fillers, which may take almost any cell, and grow as compact blocks over the rest.
  // 3. The first zone has nothing ruled out yet, so it would have to be a single cell. Instead it gets a 2-cell piece and
  //    the logic solver (one pass, no search) confirms the map still opens; if it does not, the build is redrawn.
  // Every cell can be placed: a non-answer cell sees two different sensors (its row's and its column's), so it is ruled
  // out before the last zone's turn, and the fillers sit at the end of the order.
  function forcedBuild(rng,n,pick,D){
    const N=n*n,ans=new Int16Array(N).fill(-1),rank=new Array(n),dies=new Int16Array(N).fill(n);
    for(let r=0;r<n;r++)ans[r*n+pick[r]]=r;
    // Fillers go last in the order and are spread over the map (farthest-point picks), so wherever space is left there
    // is a filler next to it that may take it. Pieces take the earlier places in a random order.
    const fillFrom=Math.round(n*D.pieces),fills=[rng.int(n)];
    while(fills.length<n-fillFrom){let far=-1,fd=-1;
      for(let z=0;z<n;z++){if(fills.includes(z))continue;
        const d=Math.min(...fills.map(f=>Math.hypot(pick[z]-pick[f],z-f)))+rng.next()*0.8;if(d>fd){fd=d;far=z;}}
      fills.push(far);}
    rng.shuffle([...Array(n).keys()].filter(z=>!fills.includes(z))).concat(rng.shuffle(fills)).forEach((z,k)=>{rank[z]=k;});
    for(let r=0;r<n;r++){const a=r*n+pick[r],ax=pick[r];
      for(let c=0;c<N;c++){if(c===a)continue;const x=c%n,y=(c-x)/n;
        if(y===r||x===ax||(Math.abs(y-r)<=1&&Math.abs(x-ax)<=1))dies[c]=Math.min(dies[c],rank[r]);}}
    const owner=new Int16Array(N).fill(-1),size=new Array(n).fill(0),order=[...Array(n).keys()].sort((a,b)=>rank[a]-rank[b]);
    const bag=n>=11?BIG_BAG:PIECE_BAG;
    for(const z of order){
      const sx=pick[z],s=z*n+sx;owner[s]=z;size[z]=1;
      if(rank[z]>=fillFrom)continue;
      const first=rank[z]===0;
      // Two passes: first a placement whose cells are all ruled out before this zone's turn (forced by construction);
      // failing that, one that bends the rule for up to two cells (the logic check after the build decides). Real
      // shapes of 3+ cells are preferred over dominoes.
      for(const slack of first?[2]:[0,2]){
        let done=false;
        for(let t=0;t<40&&!done;t++){
          const shape=first?rng.pick(['I2','I3','V3']):rng.pick(bag),form=rng.pick(PIECES[shape]),[ax,ay]=rng.pick(form),cells=[];
          if(!first&&form.length<3&&t<30)continue;
          let ok=true,bent=0;
          for(const [x,y] of form){const X=sx+x-ax,Y=z+y-ay;if(X<0||Y<0||X>=n||Y>=n){ok=false;break;}
            const c=Y*n+X;if(c===s)continue;if(owner[c]>=0||ans[c]>=0){ok=false;break;}
            if(!(dies[c]<rank[z])&&++bent>slack){ok=false;break;}cells.push(c);}
          if(!ok)continue;
          for(const c of cells){owner[c]=z;size[z]++;}done=true;
        }
        if(done)break;
      }
      // No piece fits the cells ruled out so far (common for the earliest zones): take one neighbouring cell anyway,
      // so there are no single squares; the logic check after the build decides whether the map still opens.
      if(size[z]<2){const c=rng.shuffle(nbOf(n,s)).find(j=>owner[j]<0&&ans[j]<0);if(c!==undefined){owner[c]=z;size[z]++;}}
    }
    // Fill: every open cell joins a neighbouring zone allowed to hold it. Zones under two cells go first, then fillers
    // smallest first, then pieces only as a last resort; each picks the cell that touches it on the most sides.
    const filler=z=>rank[z]>=fillFrom;
    for(let guard=0;guard<N;guard++){
      let best=null;
      for(let c=0;c<N;c++){if(owner[c]>=0)continue;
        for(const j of nbOf(n,c)){const z=owner[j];if(z<0||!(dies[c]<rank[z]))continue;
          const same=nbOf(n,c).filter(k=>owner[k]===z).length;
          const prio=(size[z]<2?100:0)+(filler(z)?40-size[z]:-30)+same*3+rng.next();
          if(!best||prio>best.prio)best={c,z,prio};}}
      if(!best){
        // A few cells are only ruled out late (by two fillers' lines) and no zone allowed to hold them touches them.
        // Give one to its latest-placed neighbouring zone; the logic check after the build confirms the map still
        // solves (it almost always does: other deductions rule the cell out).
        for(let c=0;c<N&&!best;c++){if(owner[c]>=0)continue;
          const zs=nbOf(n,c).map(j=>owner[j]).filter(z=>z>=0);if(zs.length)best={c,z:zs.sort((a,b)=>rank[b]-rank[a])[0]};}
        if(!best)break;
      }
      owner[best.c]=best.z;size[best.z]++;
    }
    if(owner.some(z=>z<0))return null;
    return Array.from(owner);
  }
  // Deterministic from seed + difficulty. Draws a map, repairs extra solutions away, and keeps it once it is unique,
  // solvable at the promised logic level and has no zone below the minimum size.
  function generate(seed,diffId){
    const D=difficulty(diffId),n=D.size,rng=Kit.rng(Kit.hashSeed(`sensor-grid|${seed}|${D.id}`));
    for(let attempt=0;attempt<5000;attempt++){
      const pick=permutation(rng,n);if(!pick)continue;
      if(D.build==='forced'){
        const answer=pick.map((x,y)=>y*n+x),region=forcedBuild(rng,n,pick,D);if(!region)continue;
        const size=new Array(n).fill(0);region.forEach(z=>size[z]++);if(Math.min(...size)<D.minZone)continue;
        const sh=zoneShapes(n,region);if(Math.max(...sh.map(s=>s.sprawl))>SPRAWL_MAX+0.2)continue;
        let L=logicSolve({n,region},D.level);
        for(let fix=0;fix<n&&!L.solved;fix++){
          const c=countSolutions({n,region},2,L.cand,REPAIR_BUDGET);if(c.count<=1)break;
          const alt=c.solutions.find(s=>s.some((v,k)=>v!==answer[k]));if(!alt||!repair(rng,n,region,answer,alt,D.minZone))break;
          L=logicSolve({n,region},D.level);
        }
        if(!L.solved)continue;
        return finishMap(rng,seed,D,region,answer);
      }
      const answer=pick.map((x,y)=>y*n+x),region=grow(rng,n,pick);
      const size=new Array(n).fill(0);region.forEach(z=>size[z]++);if(Math.min(...size)<D.minZone)continue;
      let unique=false;
      for(let fix=0;fix<4*n;fix++){
        const c=countSolutions({n,region},2);if(c.count===1){unique=true;break;}
        const alt=c.solutions.find(s=>s.some((v,k)=>v!==answer[k]));if(!repair(rng,n,region,answer,alt,D.minZone))break;
      }
      if(!unique)continue;
      const L=logicSolve({n,region},D.level);if(!L.solved||(L.level<D.prefer&&attempt<40))continue;
      return finishMap(rng,seed,D,region,answer);
    }
    throw new Error('sensor-grid: no puzzle for seed '+seed);
  }
  // Renumber zones in reading order of their first cell, so a zone's number (and its swatch's place in the list) says
  // nothing about which row holds its sensor; then dress the zones with terrains and hidden contacts.
  function finishMap(rng,seed,D,region,answer){
    const n=D.size,order=[];for(const z of region)if(!order.includes(z))order.push(z);
    const renum=region.map(z=>order.indexOf(z)),terrains=rng.shuffle(n<=8?TERRAINS.slice(0,8):TERRAINS).slice(0,n);
    return {seed:Number(seed)>>>0,difficulty:D.id,n,level:D.level,region:renum,
      zones:terrains.map(t=>({terrain:t.id,contact:weighted(rng)})),solution:answer};
  }

  // ---------- Player moves ----------
  const empty=P=>new Array(P.n*P.n).fill(EMPTY);
  // Tap cycle, as in Queens: empty → × → sensor → empty. × comes first because ruling cells out is by far the most
  // frequent action in this genre (a solve is mostly ×s and only n sensors), so the common action costs one tap and a
  // sensor costs two. An auto-× behaves like a manual × (its next tap places a sensor).
  const cycle=m=>m===EMPTY?X:m===SENSOR?EMPTY:SENSOR;
  // Recomputes the assist's auto-×s: every empty cell a sensor rules out. Manual ×s are never touched.
  function withAuto(P,marks,on){
    const G=geo(P),out=marks.map(m=>m===AUTO?EMPTY:m);
    if(on)for(let i=0;i<G.N;i++)if(out[i]===SENSOR)for(const a of G.attacks[i])if(out[a]===EMPTY)out[a]=AUTO;
    return out;
  }
  // move: {cell, mark} | {cell, cycle:true} | {cells:[...], mark}; optional assist:true refreshes auto-×s.
  // Returns {marks} (a new array) or {error}; the input marks are never changed.
  function apply(P,marks,move){
    const N=P.n*P.n,okCell=c=>Number.isInteger(c)&&c>=0&&c<N;
    if(!move||typeof move!=='object')return {error:'No move given.'};
    const cells=Array.isArray(move.cells)?move.cells:[move.cell];
    if(!cells.length||!cells.every(okCell))return {error:'That is not a cell on this map.'};
    if(move.cycle&&cells.length!==1)return {error:'Only one cell can be cycled at a time.'};
    if(!move.cycle&&![EMPTY,SENSOR,X].includes(move.mark))return {error:'Unknown mark.'};
    let out=marks.slice();
    for(const c of cells)out[c]=move.cycle?cycle(marks[c]):move.mark;
    if(move.assist)out=withAuto(P,out,true);
    return {marks:out};
  }

  // ---------- Board analysis ----------
  // pairs: every two sensors that break a rule, with why ('touch' | 'row' | 'column' | 'zone'). zoneOk[r]: the zone
  // holds exactly one sensor and it clashes with nothing. solved: n sensors and no clashes (unique, so the answer).
  function analyze(P,marks){
    const G=geo(P),sensors=[];for(let i=0;i<G.N;i++)if(marks[i]===SENSOR)sensors.push(i);
    const pairs=[],bad=new Set();
    for(let a=0;a<sensors.length;a++)for(let b=a+1;b<sensors.length;b++){const s=sensors[a],t=sensors[b];
      if(G.hit[s*G.N+t]){pairs.push({cells:[s,t],why:clashWhy(G,s,t)});bad.add(s);bad.add(t);}}
    const zoneCount=new Array(G.n).fill(0),rowCount=new Array(G.n).fill(0),colCount=new Array(G.n).fill(0);
    for(const s of sensors){zoneCount[G.reg[s]]++;rowCount[G.row[s]]++;colCount[G.col[s]]++;}
    const okIn=(count,of)=>count.map((k,r)=>k===1&&!sensors.some(s=>of[s]===r&&bad.has(s)));
    // open: cells per zone/row/column still showing nothing (no sensor, no ×, no auto-×), the "remaining" counts.
    const open={zone:new Array(G.n).fill(0),row:new Array(G.n).fill(0),col:new Array(G.n).fill(0)};
    for(let i=0;i<G.N;i++)if(marks[i]===EMPTY){open.zone[G.reg[i]]++;open.row[G.row[i]]++;open.col[G.col[i]]++;}
    return {sensors,pairs,bad,zoneCount,rowCount,colCount,zoneOk:okIn(zoneCount,G.reg),rowOk:okIn(rowCount,G.row),colOk:okIn(colCount,G.col),
      open,solved:sensors.length===G.n&&!pairs.length};
  }
  const clashText=(P,pair)=>{const [a,b]=pair.cells.map(c=>label(P,c));
    return pair.why==='touch'?`${a} and ${b} touch`:pair.why==='row'?`${a} and ${b} share row ${Math.floor(pair.cells[0]/P.n)+1}`
      :pair.why==='column'?`${a} and ${b} share column ${colName(pair.cells[0]%P.n)}`:`${a} and ${b} are both in ${zoneName(P,P.region[pair.cells[0]])}`;};

  // ---------- Hints ----------
  function stepReason(P,s){
    const G=geo(P),cellList=cs=>andList(cs.map(c=>label(P,c)));
    const lineName=(kind,l)=>kind==='row'?`row ${l+1}`:`column ${colName(l)}`;
    const linesName=(kind,ls)=>ls.length===1?lineName(kind,ls[0]):(kind==='row'?'rows ':'columns ')+andList(ls.map(l=>kind==='row'?String(l+1):colName(l)));
    const zonesName=zs=>zs.length===1?zoneName(P,zs[0]):'the '+andList(zs.map(z=>terrainOf(P,z).name.toLowerCase()))+' zones';
    if(s.kind==='single'){
      const u=s.unit,where=label(P,s.place);
      if(u.cells.length===1)return `${cap(zoneName(P,u.k))} is a single cell, so its sensor goes on ${where}.`;
      return u.kind==='zone'?`Every other cell of ${zoneName(P,u.k)} is ruled out, so its sensor goes on ${where}.`
        :`Every other cell in ${unitName(P,u)} is ruled out, so its sensor goes on ${where}.`;
    }
    if(s.kind==='zonesInLines'){
      const L=linesName(s.lineKind,s.lines);
      if(s.zones.length===1){
        const z=s.zones[0],whole=G.zones[z].every(c=>(s.lineKind==='row'?G.row[c]:G.col[c])===s.lines[0]);
        return whole?`${cap(zoneName(P,z))} sits entirely in ${L}, so nothing else in ${L} can hold a sensor.`
          :`${cap(zoneName(P,z))} can only use cells in ${L}, so nothing else in ${L} can hold a sensor.`;
      }
      return `${cap(zonesName(s.zones))} fit only in ${L}, so those ${s.zones.length} ${s.lineKind==='row'?'rows':'columns'} belong to them: nothing else there can hold a sensor.`;
    }
    if(s.kind==='linesInZones'){
      const L=linesName(s.lineKind,s.lines);
      if(s.lines.length===1)return `Every open cell in ${L} belongs to ${zoneName(P,s.zones[0])}, so that zone’s sensor is in ${L}: the rest of the zone stays empty.`;
      return `${cap(L)} can only take sensors from ${zonesName(s.zones)}, so those zones’ sensors are all in ${L}: the rest of those zones stays empty.`;
    }
    if(s.kind==='empty')return `A sensor on ${orList(s.cells.map(c=>label(P,c)))} would rule out every open cell of ${unitName(P,s.unit)}, so ${s.cells.length===1?'it stays':'they stay'} empty.`;
    if(s.kind==='lookahead')return `Try a sensor on ${label(P,s.cell)}: the moves it forces leave ${unitName(P,s.unit)} with no open cell, so ${label(P,s.cell)} stays empty.`;
    return `Only one layout works, and it uses ${cellList(s.cells)}.`;
  }
  const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
  // State the logic solver sees from the player's marks: their sensors placed, their ×s (and auto-×s) ruled out.
  function stateFrom(P,G,marks){
    const st=fresh(G);for(let i=0;i<G.N;i++)if(marks[i]===X||marks[i]===AUTO||marks[i]===DEDUCED)st.cand[i]=0;
    for(let i=0;i<G.N;i++)if(marks[i]===SENSOR)place(G,st,i);
    return st;
  }
  // Returns null when solved, else {kind, cells, mark, reason}. kind 'fix' repairs a mistake first (a wrong sensor
  // becomes ×; a × on an answer cell is cleared); 'step' is the easiest deduction from the player's own marks, applied
  // as a sensor or as ×s; 'solution' is a safety net that generated maps never reach.
  function hint(P,marks){
    const G=geo(P),sol=new Set(P.solution),A=analyze(P,marks);
    if(A.solved)return null;
    const wrong=A.sensors.filter(i=>!sol.has(i)).sort((a,b)=>A.bad.has(b)-A.bad.has(a));
    if(wrong.length){
      const c=wrong[0],pair=A.pairs.find(p=>p.cells.includes(c));
      return {kind:'fix',cells:[c],mark:X,reason:pair?`${clashText(P,pair)}: the sensor on ${label(P,c)} is the wrong one, so it becomes ×.`
        :`The sensor on ${label(P,c)} cannot be part of the answer: it becomes ×.`};
    }
    const blocked=P.solution.find(i=>marks[i]===X);
    if(blocked!==undefined)return {kind:'fix',cells:[blocked],mark:EMPTY,reason:`The × on ${label(P,blocked)} rules out the cell ${zoneName(P,G.reg[blocked])} needs: it is cleared.`};
    const st=stateFrom(P,G,marks),s=nextStep(G,st,2);
    if(s&&!s.contradiction){
      const focus=stepFocus(G,s);
      if(s.place!==undefined)return {kind:'step',rule:s.kind,level:s.level,cells:[s.place],all:[s.place],mark:SENSOR,focus,reason:stepReason(P,s)};
      // An × deduction can rule out many cells at once; the hint applies only the HINT_CAP most informative ones (those
      // in the zone, row or column with the fewest open cells left, so the next sensor comes closest) and says how many
      // more the same rule covers. Asking again continues the same reasoning.
      const pick=mostInformative(G,st,s.cells).slice(0,HINT_CAP).sort((a,b)=>a-b),more=s.cells.length-pick.length;
      const marked=andList(pick.map(c=>label(P,c)));
      return {kind:'step',rule:s.kind,level:s.level,cells:pick,all:s.cells.slice(),mark:X,focus,
        reason:`${stepReason(P,s)} ${more?`Marked ${marked} × (${more} more ${more===1?'cell follows':'cells follow'} from the same rule).`:`Marked ${marked} ×.`}`};
    }
    const c=P.solution.find(i=>marks[i]!==SENSOR);
    return {kind:'solution',cells:[c],all:[c],mark:SENSOR,focus:[c],reason:stepReason(P,{kind:'solution',cells:[c]})};
  }
  const HINT_CAP=3;
  // Open cells first that sit in the most constrained unit (fewest candidates); ties in reading order.
  function mostInformative(G,st,cells){
    const left=c=>Math.min(...[G.zones[G.reg[c]],G.rows[G.row[c]],G.cols[G.col[c]]].filter(u=>!hasPlaced(st,u)).map(u=>candsIn(st,u).length),99);
    return cells.map(c=>({c,k:left(c)})).sort((a,b)=>a.k-b.k||a.c-b.c).map(o=>o.c);
  }
  // The cells a hint is about, for the UI to light up softly: the zone(s) and line(s) the reasoning reads.
  function stepFocus(G,s){
    const out=new Set(s.cells),unitCells=u=>u.kind==='zone'?G.zones[u.k]:u.kind==='row'?G.rows[u.k]:G.cols[u.k];
    if(s.unit)for(const c of unitCells(s.unit))out.add(c);
    if(s.zones)for(const z of s.zones)for(const c of G.zones[z])out.add(c);
    if(s.lines)for(const l of s.lines)for(const c of (s.lineKind==='row'?G.rows:G.cols)[l])out.add(c);
    if(s.cell!==undefined)out.add(s.cell);
    return [...out].sort((a,b)=>a-b);
  }

  // ---------- Probes ("what if" sensors) and the mistake check ----------
  const lineWord=(G,why,a)=>why==='row'?`row ${G.row[a]+1}`:`column ${colName(G.col[a])}`;
  // probe: what a set of trial sensors would do to the committed board, without changing it. Reads the player's own
  // sensors and ×s (manual and auto). Returns {probes, shaded: open cells the probes would rule out, clashes: a probe
  // breaking a rule with a sensor or another probe, dead: zones/rows/columns left with no possible cell, forced: units
  // the probes squeeze to a single cell, ok}. Direct consequences only (no chains), the step a person does in their head.
  function probe(P,marks,probes){
    const G=geo(P),N=G.N,list=[...new Set(probes||[])].filter(c=>Number.isInteger(c)&&c>=0&&c<N&&marks[c]!==SENSOR).sort((a,b)=>a-b);
    const base=stateFrom(P,G,marks),st=clone(base),isProbe=new Set(list);
    for(const p of list){st.placed[p]=1;for(const a of G.attacks[p])if(!isProbe.has(a))st.cand[a]=0;}
    for(const p of list)st.cand[p]=1;
    const shaded=[];for(let c=0;c<N;c++)if(base.cand[c]&&!base.placed[c]&&!isProbe.has(c)&&!st.cand[c]&&marks[c]===EMPTY)shaded.push(c);
    const sensors=[];for(let i=0;i<N;i++)if(marks[i]===SENSOR)sensors.push(i);
    const clashes=[];
    list.forEach((p,k)=>{
      for(const s of sensors)if(G.hit[p*N+s]){const why=clashWhy(G,p,s),L=label(P,p),T=label(P,s);
        clashes.push({cells:[p,s],why,reason:why==='touch'?`Probe at ${L} touches the sensor on ${T}.`:why==='zone'?`Probe at ${L} is in ${zoneName(P,G.reg[p])} with the sensor on ${T}.`
          :`Probe at ${L} shares ${lineWord(G,why,p)} with the sensor on ${T}.`});}
      for(const q of list.slice(k+1))if(G.hit[p*N+q]){const why=clashWhy(G,p,q),L=label(P,p),T=label(P,q);
        clashes.push({cells:[p,q],why,reason:why==='touch'?`Probes at ${L} and ${T} touch.`:why==='zone'?`Probes at ${L} and ${T} are both in ${zoneName(P,G.reg[p])}.`
          :`Probes at ${L} and ${T} share ${lineWord(G,why,p)}.`});}
    });
    const dead=[],forced=[];
    if(list.length)for(const u of G.units){
      if(hasPlaced(st,u.cells))continue;
      const now=candsIn(st,u.cells),before=candsIn(base,u.cells);
      const by=list.filter(p=>u.cells.some(c=>base.cand[c]&&G.hit[p*N+c]));
      const who=by.length===1?`Probe at ${label(P,by[0])} leaves`:`Probes at ${andList(by.map(c=>label(P,c)))} leave`;
      if(!now.length)dead.push({unit:{kind:u.kind,k:u.k},cells:u.cells.slice(),by,
        reason:by.length?`${who} ${unitName(P,u)} with nowhere to go.`:`Your marks already leave ${unitName(P,u)} with nowhere to go.`});
      else if(now.length===1&&before.length>1)forced.push({unit:{kind:u.kind,k:u.k},cell:now[0],by,reason:`Then ${label(P,now[0])} is the only cell left for ${unitName(P,u)}.`});
    }
    return {probes:list,shaded,clashes,dead,forced,ok:!clashes.length&&!dead.length};
  }
  // Commit: every probe becomes a real sensor in one move (auto-×s refreshed when the assist is on).
  function commitProbes(P,marks,probes,assist){
    const cells=[...new Set(probes||[])].filter(c=>marks[c]!==SENSOR);
    if(!cells.length)return {marks:assist?withAuto(P,marks,true):marks.slice()};
    return apply(P,marks,{cells,mark:SENSOR,assist:!!assist});
  }
  // Mistake check: the sensors that are not part of the unique answer. Only sensors are judged, never ×s.
  function check(P,marks){
    const sol=new Set(P.solution),wrong=[],right=[];
    marks.forEach((m,i)=>{if(m===SENSOR)(sol.has(i)?right:wrong).push(i);});
    return {wrong,right};
  }

  // ---------- Assist levels: simple deductions applied automatically ----------
  // The "simple" deductions: a unit with one open cell left (only when drop is on: Relaxed), and k zones confined to k
  // lines / k lines confined to k zones (k = 1 is the everyday "straight line" rule). Not the wipe-out or what-if rules.
  function simpleStep(G,st,drop){
    for(const u of G.units){
      if(hasPlaced(st,u.cells))continue;
      const cs=candsIn(st,u.cells);
      if(!cs.length)return {contradiction:u};
      if(drop&&cs.length===1)return {kind:'single',level:0,unit:u,place:cs[0],cells:[cs[0]]};
    }
    return setStep(G,st,1,G.n);
  }
  // True when nothing the player marked contradicts the unique answer (sensors on answer cells, manual ×s off them).
  const consistent=(P,marks)=>{const sol=new Set(P.solution);return marks.every((m,i)=>m===SENSOR?sol.has(i):m===X?!sol.has(i):true);};
  // settle: re-derives the assist's deduced ×s (and, with drop, forced sensors) from the player's SENSORS (and the auto-×s
  // they imply). The player's own ×s are kept on the board but never fed into the logic: a × is often a passing state
  // of the tap cycle (empty → × → sensor), and a wrong one would make the deductions unsound. Returns
  // {marks, steps:[{type:'x'|'drop', cells (every cell this step changed, in order), cell (drop), reason}], paused}.
  // Steps are ordered so the UI can play them as a cascade. Paused (no steps, deduced ×s cleared) while the board holds
  // a wrong sensor: deductions from it would cross out answer cells, so the assist waits until it is fixed.
  // Always terminates: every step fixes a sensor or rules out at least one cell.
  function settle(P,marks,opt){
    const G=geo(P),drop=!!(opt&&opt.drop),assist=!(opt&&opt.assist===false);
    let out=withAuto(P,marks.map(m=>m===DEDUCED?EMPTY:m),assist);
    const sol=new Set(P.solution);
    if(out.some((m,i)=>m===SENSOR&&!sol.has(i)))return {marks:out,steps:[],paused:true};
    const st=stateFrom(P,G,out.map(m=>m===X?EMPTY:m)),steps=[];
    // Cells the logic has ruled out but the board still shows empty: an auto-× if a sensor rules them out (assist on),
    // else a deduced ×.
    const sync=()=>{
      const next=withAuto(P,out.map(m=>m===DEDUCED?EMPTY:m),assist),changed=[];
      for(let c=0;c<G.N;c++){if(next[c]===EMPTY&&!st.cand[c])next[c]=DEDUCED;if(next[c]!==out[c])changed.push(c);}
      out=next;return changed;
    };
    sync();
    for(let guard=0;guard<2*G.N&&placedCount(st)<G.n;guard++){
      const s=simpleStep(G,st,drop);if(!s||s.contradiction)break;
      if(s.place!==undefined){
        place(G,st,s.place);out[s.place]=SENSOR;const rest=sync();
        steps.push({type:'drop',cell:s.place,cells:[s.place,...rest.filter(c=>c!==s.place)],reason:stepReason(P,s)});
      }else{
        applyStep(G,st,s);const changed=sync();
        if(changed.length)steps.push({type:'x',cells:changed,reason:stepReason(P,s)});
      }
    }
    return {marks:out,steps,paused:false};
  }
  // Cells that could still hold a sensor given the player's marks (the Relaxed glow).
  function candidates(P,marks){
    const G=geo(P),st=stateFrom(P,G,marks),out=[];
    for(let c=0;c<G.N;c++)if(st.cand[c]&&!st.placed[c]&&marks[c]===EMPTY)out.push(c);
    return out;
  }
  // The Relaxed probe chain: after the probes, the forced sensors that would drop in (ghosts) and, if the chain runs
  // into a dead end, the unit left with nowhere to go. Hypothetical only; the board is never changed.
  function probeChain(P,marks,probes){
    const G=geo(P),list=[...new Set(probes||[])].filter(c=>marks[c]!==SENSOR),st=stateFrom(P,G,marks),ghosts=[];
    for(const p of list)place(G,st,p);
    for(let guard=0;guard<2*G.N&&placedCount(st)<G.n;guard++){
      const s=simpleStep(G,st,true);if(!s)break;
      if(s.contradiction){
        const via=ghosts.length?`the sensors it forces (${andList(ghosts.map(c=>label(P,c)))}) leave`:'it leaves';
        return {ghosts,dead:{unit:{kind:s.contradiction.kind,k:s.contradiction.k},reason:`Following the chain, ${via} ${unitName(P,s.contradiction)} with nowhere to go.`}};
      }
      if(s.place!==undefined){if(!list.includes(s.place))ghosts.push(s.place);place(G,st,s.place);}else applyStep(G,st,s);
    }
    return {ghosts,dead:null};
  }

  // ---------- Fallback, scoring, near-miss ----------
  // Skip: the automatic sweep places half the sensors (rounded down) and so reveals half the zones. Zones where the
  // player already has the right sensor go first; the rest are drawn deterministically per puzzle.
  function autoFallback(P,marks){
    const G=geo(P),half=Math.floor(G.n/2),r=Kit.rng(Kit.hashSeed(`sensor-grid-auto|${P.seed}|${P.difficulty}`));
    const mine=P.solution.filter(c=>marks&&marks[c]===SENSOR).map(c=>G.reg[c]);
    const rest=r.shuffle(G.zones.map((z,k)=>k).filter(k=>!mine.includes(k)));
    const zones=[...mine,...rest].slice(0,half).sort((a,b)=>a-b);
    const out=empty(P);for(const z of zones)out[P.solution.find(c=>G.reg[c]===z)]=SENSOR;
    return {zones,marks:out};
  }
  // summary: {solved, auto, hints, errors, checks, ms, targetMs, revealed, total}. perfect = solved, no hints, no clash
  // ever created and no mistake check used; partial = solved with 2+ hints or over twice the target time; failed =
  // unsolved. A mistake check costs Perfect and 6 points, like a clash. Probes and the auto-× assist are free.
  // assist: 'guided' or 'relaxed' (the most assisted level used during the solve): any solve is Good, scored gently;
  // Perfect, Partial and the full point range are kept for the Puzzle level.
  function score(s){
    const total=s.total||1,ratio=(s.revealed||0)/total;
    if(s.auto)return {tier:'auto',score:Math.round(40*ratio)};
    if(!s.solved)return {tier:'failed',score:0};
    const hints=s.hints||0,errors=s.errors||0,checks=s.checks||0,slow=s.targetMs>0&&s.ms>2*s.targetMs;
    const over=s.targetMs>0?Math.max(0,s.ms-s.targetMs)/s.targetMs:0;
    if(s.assist==='guided'||s.assist==='relaxed')
      return {tier:'good',score:Math.max(50,Math.round((s.assist==='guided'?85:75)-4*hints-2*errors-2*checks-Math.min(10,10*over))),slow,assist:s.assist};
    const tier=hints>=2||slow?'partial':hints===0&&errors===0&&checks===0?'perfect':'good';
    return {tier,score:Math.max(50,Math.round(100-12*hints-6*errors-6*checks-Math.min(20,20*over))),slow};
  }
  function roster(P,zones){
    const counts={};for(const z of zones){const t=P.zones[z].contact;counts[t]=(counts[t]||0)+1;}
    return Object.keys(ARCHETYPES).filter(t=>counts[t]).map(t=>(counts[t]>1?counts[t]+'× ':'')+ARCHETYPES[t].name.toLowerCase()).join(', ');
  }
  // ---------- The scout report: what the elective fight loses ----------
  // reduction: difficulty steps taken off the elective fight. The most a scout can take grows with the map (a bigger
  // battlefield hides more), scaled by the share of zones revealed and by how cleanly it was solved. Any revealed zone is
  // worth at least 1. A full scout (every zone, solved by the player) also strips one of the fight's affixes.
  const SCOUT_TIER={perfect:1,good:0.75,partial:0.5,auto:0.5,failed:0};
  const scoutMax=n=>Math.ceil(n/3);
  function scout(P,zones,tier){
    const total=P.n||P.zones.length,revealed=new Set(zones||[]).size,share=revealed/total,w=SCOUT_TIER[tier]||0;
    const reduction=revealed&&w?Math.max(1,Math.round(scoutMax(total)*w*share)):0;
    const full=revealed===total,affixStripped=full&&tier!=='auto'&&tier!=='failed'&&w>0;
    const lineup=roster(P,[...new Set(zones||[])].sort((a,b)=>a-b));
    const output=!revealed?'Elective fight not scouted.'
      :`Elective fight scouted: ${revealed} of ${total} zones · ${full?'enemy lineup revealed':'partial lineup'} (${lineup}) · difficulty −${reduction}${affixStripped?' · full scout: one of its affixes stripped':''}.`;
    return {revealed,total,full,reduction,affixStripped,lineup,output};
  }
  const clock=ms=>{const s=Math.round(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
  // One concrete sentence about the better move. info: {tier, hintLog:[{reason}], firstError:{pair, step:{reason}},
  // checks, ms, targetMs, revealed:[zones], nextStep:{reason}}
  function nearMiss(P,info){
    const t=info.tier,hints=info.hintLog||[];
    if(t==='auto'){
      const missing=P.zones.map((z,k)=>k).filter(k=>!(info.revealed||[]).includes(k)),full=scout(P,P.zones.map((z,k)=>k),'perfect');
      const head=`Solving would have scouted ${plural(missing.length,'more zone')} of the elective fight (${roster(P,missing)}), for difficulty −${full.reduction} and one of its affixes stripped.`;
      return info.nextStep?`${head} The next step was there: ${info.nextStep.reason}`:head;
    }
    if(t==='partial'&&hints.length>=2){const k=hints.length-1;return `${k===1?'One fewer hint':k+' fewer hints'} would have made this Good. The first hint: ${hints[0].reason}`;}
    if(t==='partial')return `Finishing ${Math.ceil((info.ms-2*info.targetMs)/1000)}s sooner (inside ${clock(2*info.targetMs)}) would have made this ${hints.length||info.firstError?'Good':'Perfect'}.`;
    if(t==='good'&&(info.assist==='guided'||info.assist==='relaxed'))
      return `Solved with the ${info.assist==='guided'?'Guided':'Relaxed'} assist. Perfect is kept for the Puzzle level, where you do every deduction yourself.`;
    if(t==='good'&&hints.length)return `Spotting this yourself would have made it Perfect: ${hints[0].reason}`;
    if(t==='good'&&info.firstError){
      const e=info.firstError,head=`The one slip: ${clashText(P,e.pair)}.`;
      return e.step&&e.step.kind!=='fix'?`${head} The step available then: ${e.step.reason}`:`${head} Without it this was Perfect.`;
    }
    if(t==='good'&&info.checks)return `Solving without the mistake check would have made this Perfect.${info.checks>1?` (${info.checks} checks used.)`:''}`;
    return '';
  }

  const api={DIFFICULTIES,TERRAINS,ARCHETYPES,ASSIST_LEVELS,EMPTY,SENSOR,X,AUTO,DEDUCED,difficulty,label,colName,zoneName,terrainOf,geo,
    countSolutions,logicSolve,nextStep,stepReason,generate,empty,cycle,withAuto,apply,analyze,clashText,hint,HINT_CAP,probe,commitProbes,check,
    consistent,settle,candidates,probeChain,
    autoFallback,score,roster,nearMiss,SCOUT_TIER,scoutMax,scout};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.SensorGrid=api;
})(typeof globalThis==='object'?globalThis:this);
