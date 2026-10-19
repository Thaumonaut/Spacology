// Pipes (rotating pipe puzzle, Logistics day game) model: pure rules, deterministic from (seed, difficulty).
// The board is an n×n grid. Fixed endpoints: extractors (sources) and plants (sinks), each with one fixed outlet.
// Every other tile is a pipe piece the player turns 90° per tap (end cap, straight, elbow, tee) or a bridge (two
// separate straight channels, one hopping over the other; it never turns). At harder levels a few cells are empty
// slots, filled from a small tray of connectors (the blueprints research provided).
// One rule set: the board is solved when no pipe end is left open (no leaks), every slot is filled, every pipe
// carries flow, each product reaches its own plant, and two products never meet in one pipe (contamination).
// A solved board is automatically a forest: the piece degrees fix the edge count, and k products need k networks.
// Generation plants a forest (one tree per product, bridges where one line hops another), lifts the slot pieces
// into the tray and scrambles every rotation; an exhaustive solver (edge propagation + search) counts solutions.
// Loads as a classic script (window.Pipes) or with require() in Node.
(function(root){
  'use strict';
  const Kit=root.MiniGameKit||(typeof require==='function'?require('../../shared/minigames/minigame-kit.js'):null);
  const BIT=[1,2,4,8],DX=[0,1,0,-1],DY=[-1,0,1,0],DIR_NAME=['north','east','south','west'],opp=d=>(d+2)&3;
  const rotM=(m,r)=>{r=((r%4)+4)%4;for(let k=0;k<r;k++)m=((m<<1)|(m>>3))&15;return m;};
  const pop=m=>(m&1)+((m>>1)&1)+((m>>2)&1)+((m>>3)&1);
  const PIECES={
    end:{base:1,label:'end cap',period:4},
    straight:{base:5,label:'straight',period:2},
    elbow:{base:3,label:'elbow',period:4},
    tee:{base:7,label:'tee',period:4},
    cross:{base:15,label:'bridge',period:1}
  };
  const TRAY_ORDER=['elbow','tee','straight','end'];
  const pieceOfMask=m=>{const k=pop(m);return k===1?'end':k===3?'tee':k===4?'cross':(m===5||m===10)?'straight':'elbow';};
  const rotFor=(piece,mask)=>{for(let r=0;r<4;r++)if(rotM(PIECES[piece].base,r)===mask)return r;return -1;};
  const orients=piece=>{const out=[];for(let r=0;r<PIECES[piece].period;r++)out.push(rotM(PIECES[piece].base,r));return out;};
  const TYPES={
    ore:{id:'ore',label:'Ore',source:'ore extractor',sink:'refinery',sinkLabel:'Refinery',color:'#e8a15a'},
    crystal:{id:'crystal',label:'Crystal',source:'crystal extractor',sink:'synthesiser',sinkLabel:'Synthesiser',color:'#c194f5'},
    water:{id:'water',label:'Water',source:'water pump',sink:'power hub',sinkLabel:'Power hub',color:'#5fb8f0'}
  };
  // Targets about 30, 45, 75 and 120 s. Expert has a rotation budget, so it can fail. 8×8 is the largest board that
  // keeps 44px tiles on a 390px phone.
  const DIFFICULTIES=[
    {id:'easy',label:'Easy · 5×5',size:5,nets:[['ore',1]],bridges:[0,0],slots:0,target:30,unique:true},
    {id:'normal',label:'Normal · 6×6',size:6,nets:[['ore',1],['water',1]],bridges:[0,0],slots:0,target:45,unique:true},
    {id:'hard',label:'Hard · 7×7',size:7,nets:[['ore',2],['crystal',1]],bridges:[1,2],slots:2,target:75,unique:false},
    {id:'expert',label:'Expert · 8×8',size:8,nets:[['ore',2],['crystal',1],['water',1]],bridges:[1,3],slots:3,target:120,unique:false,budget:true}
  ];
  const ASSIST_LEVELS=[
    {id:'puzzle',label:'Puzzle',note:'You turn every tile. Perfect is possible.'},
    {id:'guided',label:'Guided',note:'Tiles that can only fit one way get a subtle mark. You still turn them.'},
    {id:'relaxed',label:'Relaxed',note:'Forced tiles snap into place and lock by themselves, cascading. Shown as Solved · Relaxed, never Perfect.'}
  ];
  const difficulty=id=>DIFFICULTIES.find(d=>d.id===id)||DIFFICULTIES[0];
  const label=(P,i)=>String.fromCharCode(65+i%P.n)+(Math.floor(i/P.n)+1);
  const nbr=(n,i,d)=>{const x=i%n+DX[d],y=Math.floor(i/n)+DY[d];return x<0||y<0||x>=n||y>=n?-1:y*n+x;};
  const node=(P,i,d)=>P.cells[i].kind==='bridge'?i*2+(d&1):i*2; // a bridge has two channels: N–S (0) and E–W (1)
  const plural=(k,w,ws)=>`${k} ${k===1?w:(ws||w+'s')}`;
  const pieceName=(P,i,st)=>{const c=P.cells[i];if(c.kind==='slot')return st&&st.placed[i]?PIECES[st.placed[i]].label:'empty slot';
    if(c.kind==='source')return TYPES[c.type].source;if(c.kind==='sink')return TYPES[c.type].sink;return PIECES[c.piece].label;};
  const rotatable=(P,st,i)=>{const c=P.cells[i];return c.kind==='pipe'||(c.kind==='slot'&&!!st.placed[i]);};

  // ---- state -------------------------------------------------------------------------------------------------
  function initial(P){return {rot:P.start.slice(),placed:P.cells.map(()=>null),locked:P.cells.map(()=>false),taps:0};}
  const clone=st=>({rot:st.rot.slice(),placed:st.placed.slice(),locked:st.locked.slice(),taps:st.taps});
  function maskAt(P,st,i){const c=P.cells[i];
    if(c.kind==='source'||c.kind==='sink')return c.mask;if(c.kind==='bridge')return 15;
    if(c.kind==='pipe')return rotM(PIECES[c.piece].base,st.rot[i]);
    return st.placed[i]?rotM(PIECES[st.placed[i]].base,st.rot[i]):0;}
  const masksOf=(P,st)=>P.cells.map((c,i)=>maskAt(P,st,i));
  function trayLeft(P,st){const left={...P.tray};st.placed.forEach(p=>{if(p)left[p]--;});return left;}

  // Every move returns {ok, state, reason}. An invalid move returns ok:false and the very same state object.
  function rotate(P,st,i,dir){
    dir=dir===-1?-1:1;
    if(!(i>=0&&i<P.cells.length))return {ok:false,state:st,reason:'No such tile.'};
    const c=P.cells[i];
    if(c.kind==='source'||c.kind==='sink')return {ok:false,state:st,reason:`The ${pieceName(P,i)} at ${label(P,i)} is fixed.`};
    if(c.kind==='bridge')return {ok:false,state:st,reason:`The bridge at ${label(P,i)} looks the same every way round.`};
    if(c.kind==='slot'&&!st.placed[i])return {ok:false,state:st,reason:`${label(P,i)} is an empty slot: place a connector from the tray.`};
    if(st.locked[i])return {ok:false,state:st,reason:`${label(P,i)} is locked. Long-press (or use Lock) to unlock it.`};
    if(P.budget&&st.taps>=P.budget)return {ok:false,state:st,reason:'Out of rotations.'};
    const s=clone(st);s.rot[i]=(s.rot[i]+dir+4)%4;s.taps++;return {ok:true,state:s};
  }
  function toggleLock(P,st,i){
    if(!(i>=0&&i<P.cells.length)||!rotatable(P,st,i))return {ok:false,state:st,reason:'Only pipes can be locked.'};
    const s=clone(st);s.locked[i]=!s.locked[i];return {ok:true,state:s};
  }
  // Placing picks the orientation that best fits the neighbours (most matched ends, fewest leaks): quality of life.
  function bestRot(P,st,i,piece){
    let best=0,bestScore=-1e9;
    for(let r=0;r<PIECES[piece].period;r++){const m=rotM(PIECES[piece].base,r);let sc=0;
      for(let d=0;d<4;d++){const j=nbr(P.n,i,d),open=!!(m&BIT[d]),there=j>=0&&!!(maskAt(P,st,j)&BIT[opp(d)]);
        if(open&&there)sc+=3;else if(open)sc-=j<0?4:1;else if(there)sc-=2;}
      if(sc>bestScore){bestScore=sc;best=r;}}
    return best;
  }
  function place(P,st,i,piece){
    if(!(i>=0&&i<P.cells.length)||P.cells[i].kind!=='slot')return {ok:false,state:st,reason:'Connectors only go in the empty slots.'};
    if(st.placed[i])return {ok:false,state:st,reason:`${label(P,i)} already holds a ${PIECES[st.placed[i]].label}. Lift it first.`};
    if(!PIECES[piece]||!(trayLeft(P,st)[piece]>0))return {ok:false,state:st,reason:`No ${PIECES[piece]?PIECES[piece].label+'s':'such pieces'} left in the tray.`};
    const s=clone(st);s.placed[i]=piece;s.rot[i]=bestRot(P,st,i,piece);s.locked[i]=false;return {ok:true,state:s};
  }
  function lift(P,st,i){
    if(!(i>=0&&i<P.cells.length)||P.cells[i].kind!=='slot'||!st.placed[i])return {ok:false,state:st,reason:'Nothing to lift there.'};
    if(st.locked[i])return {ok:false,state:st,reason:`${label(P,i)} is locked.`};
    const s=clone(st);s.placed[i]=null;s.rot[i]=0;return {ok:true,state:s};
  }

  // ---- analysis: flow, leaks, contamination ------------------------------------------------------------------
  // Flow spreads breadth-first from every extractor at once; each channel takes the product that reaches it first.
  // Where two products touch, that joint is contaminated. A plant is fed when its own product reaches it and its
  // network holds no other product. A network is sealed when it is fed, holds all its extractors and leaks nowhere.
  function analyzeMasks(P,masks,slotsFilled){
    const n=P.n,N=n*n,leaks=[],contam=[],claimed=new Array(2*N).fill(null),depth=new Array(2*N).fill(-1),entry=new Array(2*N).fill(-1);
    const par=new Int32Array(2*N).map((_,k)=>k),find=a=>{while(par[a]!==a){par[a]=par[par[a]];a=par[a];}return a;};
    for(let i=0;i<N;i++){const m=masks[i];if(!m)continue;
      for(let d=0;d<4;d++){if(!(m&BIT[d]))continue;const j=nbr(n,i,d);
        if(j<0||!(masks[j]&BIT[opp(d)]))leaks.push({cell:i,dir:d});
        else if(d<2){const a=find(node(P,i,d)),b=find(node(P,j,opp(d)));if(a!==b)par[a]=b;}}}
    const q=[];
    P.nets.forEach(net=>net.sources.forEach(s=>{const u=s*2;claimed[u]=net.type;depth[u]=0;q.push(u);}));
    const seen=new Set();
    for(let h=0;h<q.length;h++){const u=q[h],i=u>>1,m=masks[i];
      for(let d=0;d<4;d++){if(!(m&BIT[d])||node(P,i,d)!==u)continue;const j=nbr(n,i,d);if(j<0||!(masks[j]&BIT[opp(d)]))continue;
        const v=node(P,j,opp(d));
        if(claimed[v]===null){claimed[v]=claimed[u];depth[v]=depth[u]+1;entry[v]=opp(d);if(P.cells[j].kind!=='sink')q.push(v);}
        else if(claimed[v]!==claimed[u]){const key=Math.min(i,j)+':'+Math.max(i,j);if(!seen.has(key)){seen.add(key);contam.push({a:i,b:j,dir:d});}}}}
    const compTypes=new Map(),compLeaks=new Map();
    const addT=(i,t)=>{const r=find(i*2);if(!compTypes.has(r))compTypes.set(r,new Set());compTypes.get(r).add(t);};
    P.nets.forEach(net=>{addT(net.sink,net.type);net.sources.forEach(s=>addT(s,net.type));});
    leaks.forEach(l=>{const r=find(node(P,l.cell,l.dir));compLeaks.set(r,(compLeaks.get(r)||0)+1);});
    // A plant reached by a foreign product is contamination too (marked at the joint where it entered).
    P.nets.forEach(net=>{const u=net.sink*2;if(claimed[u]!==null&&claimed[u]!==net.type){const j=nbr(n,net.sink,entry[u]);
      const key=Math.min(j,net.sink)+':'+Math.max(j,net.sink);if(!seen.has(key)){seen.add(key);contam.push({a:j,b:net.sink,dir:opp(entry[u])});}}});
    const nets=P.nets.map(net=>{const r=find(net.sink*2),types=compTypes.get(r),mixed=types.size>1;
      const fed=claimed[net.sink*2]===net.type&&!mixed,joined=net.sources.filter(s=>find(s*2)===r).length;
      return {type:net.type,sink:net.sink,sources:net.sources,fed,mixed,joined,leaks:compLeaks.get(r)||0,sealed:fed&&joined===net.sources.length&&!compLeaks.get(r)};});
    let dry=0;for(let i=0;i<N;i++){if(!masks[i])continue;const chans=P.cells[i].kind==='bridge'?[i*2,i*2+1]:[i*2];chans.forEach(u=>{if(claimed[u]===null)dry++;});}
    const fed=nets.filter(x=>x.fed).length;
    const solved=slotsFilled&&!leaks.length&&!contam.length&&!dry&&nets.every(x=>x.sealed);
    return {masks,leaks,contam,claimed,depth,entry,nets,fed,dry,solved,find};
  }
  const analyze=(P,st)=>analyzeMasks(P,masksOf(P,st),P.cells.every((c,i)=>c.kind!=='slot'||!!st.placed[i]));

  // ---- exhaustive solver ---------------------------------------------------------------------------------------
  // Domains hold candidate codes (mask | pieceIndex<<4). Edge propagation: a side every candidate opens (or none
  // does) forces the neighbour's facing side. Partial networks that close up must be complete and single-product.
  // fixed: optional {cell: code} assumptions (for hints that respect the player's locks).
  const PIDX=['end','straight','elbow','tee','cross'];
  function domains(P,fixed){
    const n=P.n,trayPieces=TRAY_ORDER.filter(p=>P.tray[p]>0);
    return P.cells.map((c,i)=>{
      if(fixed&&fixed[i]!==undefined)return [fixed[i]];
      let list;
      if(c.kind==='source'||c.kind==='sink')list=[c.mask|(0<<4)];
      else if(c.kind==='bridge')list=[15|(4<<4)];
      else if(c.kind==='pipe')list=orients(c.piece).map(m=>m|(PIDX.indexOf(c.piece)<<4));
      else list=trayPieces.flatMap(p=>orients(p).map(m=>m|(PIDX.indexOf(p)<<4)));
      return list.filter(code=>{for(let d=0;d<4;d++)if((code&BIT[d])&&nbr(n,i,d)<0)return false;return true;});
    });
  }
  function propagate(P,dom,queue){
    const n=P.n,N=n*n,inQ=new Uint8Array(N);queue.forEach(i=>inQ[i]=1);
    while(queue.length){const i=queue.pop();inQ[i]=0;const D=dom[i];if(!D.length)return false;
      let all=15,any=0;for(const c of D){all&=c;any|=c;}
      for(let d=0;d<4;d++){const j=nbr(n,i,d);if(j<0)continue;const b=BIT[d],ob=BIT[opp(d)];
        let want=null;if(all&b)want=ob;else if(!(any&b))want=0;if(want===null)continue;
        const Dj=dom[j],keep=Dj.filter(c=>(c&ob)===want);
        if(keep.length!==Dj.length){if(!keep.length)return false;dom[j]=keep;if(!inQ[j]){inQ[j]=1;queue.push(j);}}}}
    return true;
  }
  function trayCheck(P,dom){
    if(!P.slots.length)return true;
    for(let guard=0;guard<20;guard++){const used={},could={};let changed=false;
      for(const s of P.slots){const D=dom[s];if(D.length===1){const p=PIDX[D[0]>>4];used[p]=(used[p]||0)+1;}
        for(const p of new Set(D.map(c=>PIDX[c>>4])))could[p]=(could[p]||0)+1;}
      for(const p of TRAY_ORDER){if((used[p]||0)>(P.tray[p]||0))return false;if((could[p]||0)<(P.tray[p]||0))return false;}
      const q=[];
      for(const s of P.slots){const D=dom[s];if(D.length<2)continue;const keep=D.filter(c=>{const p=PIDX[c>>4];return (used[p]||0)<(P.tray[p]||0);});
        if(keep.length!==D.length){if(!keep.length)return false;dom[s]=keep;q.push(s);changed=true;}}
      if(!changed)return true;if(!propagate(P,dom,q))return false;}
    return true;
  }
  const typeIdx=P=>{const t=new Map();P.nets.forEach((net,k)=>{t.set(net.sink,k);net.sources.forEach(s=>t.set(s,k));});return t;};
  // Closed or mixed partial networks, over decided cells only.
  function componentsOk(P,dom,tIdx){
    const n=P.n,N=n*n,par=new Int32Array(2*N).map((_,k)=>k),find=a=>{while(par[a]!==a){par[a]=par[par[a]];a=par[a];}return a;};
    const open=new Uint8Array(2*N);
    for(let i=0;i<N;i++){if(dom[i].length!==1)continue;const m=dom[i][0]&15;
      for(let d=0;d<4;d++){if(!(m&BIT[d]))continue;const j=nbr(n,i,d);
        if(dom[j].length!==1){open[node(P,i,d)]=1;continue;}
        if(d<2){const a=find(node(P,i,d)),b=find(node(P,j,opp(d)));if(a!==b)par[a]=b;}}}
    const info=new Map(),get=r=>{let x=info.get(r);if(!x){x={net:-1,mixed:false,open:false,has:0,cells:0};info.set(r,x);}return x;};
    for(let u=0;u<2*N;u++){const i=u>>1;if(dom[i].length!==1||!(dom[i][0]&15))continue;if((u&1)&&P.cells[i].kind!=='bridge')continue;
      const x=get(find(u));x.cells++;if(open[u])x.open=true;
      if(tIdx.has(i)&&!(u&1)){const k=tIdx.get(i);if(x.net>=0&&x.net!==k)x.mixed=true;x.net=k;x.has++;}}
    for(const x of info.values()){if(x.mixed)return false;
      if(!x.open){if(x.net<0)return false;const net=P.nets[x.net];if(x.has!==net.sources.length+1)return false;}}
    return true;
  }
  function solve(P,opts){
    opts=opts||{};const limit=opts.limit||2,tIdx=typeIdx(P),out=[];let nodes=0;const maxNodes=opts.maxNodes||200000;
    const dom0=domains(P,opts.fixed);
    if(dom0.some(D=>!D.length)||!propagate(P,dom0,dom0.map((_,i)=>i))||!trayCheck(P,dom0))return {count:0,solutions:[],nodes:0,complete:true};
    let aborted=false;
    (function rec(dom){
      if(out.length>=limit||aborted)return;if(++nodes>maxNodes){aborted=true;return;}
      if(!componentsOk(P,dom,tIdx))return;
      let best=-1,bs=99;for(let i=0;i<dom.length;i++){const L=dom[i].length;if(L>1&&L<bs){bs=L;best=i;if(L===2)break;}}
      if(best<0){const masks=dom.map(D=>D[0]&15);if(analyzeMasks(P,masks,true).solved)out.push(dom.map(D=>D[0]));return;}
      for(const c of dom[best]){const d2=dom.slice();d2[best]=[c];if(propagate(P,d2,[best])&&trayCheck(P,d2))rec(d2);if(out.length>=limit||aborted)return;}
    })(dom0);
    return {count:out.length,solutions:out,nodes,complete:!aborted};
  }
  const countSolutions=(P,limit)=>solve(P,{limit:limit||2}).count;
  // A solution code list back into a state (rotations for pipes, pieces for slots), keeping current turns minimal.
  function stateFrom(P,codes,base){
    const s=base?clone(base):initial(P);
    P.cells.forEach((c,i)=>{const m=codes[i]&15;
      if(c.kind==='pipe')s.rot[i]=rotNear(c.piece,s.rot[i],m);
      else if(c.kind==='slot'){const p=PIDX[codes[i]>>4];s.rot[i]=rotNear(p,s.placed[i]===p?s.rot[i]:0,m);s.placed[i]=p;}});
    return s;
  }
  // The rotation reached from cur with the fewest clockwise taps that shows mask m.
  function rotNear(piece,cur,m){for(let k=0;k<4;k++){const r=(cur+k)%4;if(rotM(PIECES[piece].base,r)===m)return r;}return cur;}
  const tapsTo=(piece,cur,m)=>{for(let k=0;k<4;k++)if(rotM(PIECES[piece].base,(cur+k)%4)===m)return k;return 0;};

  // ---- generation ------------------------------------------------------------------------------------------------
  function plant(P0,cfg,R){
    const n=cfg.size,N=n*n;
    // segs[i]: list of {net, mask}. Endpoints are marked so paths and the fill never pass through them.
    const segs=Array.from({length:N},()=>[]),endp=new Array(N).fill(null);
    const nets=cfg.nets.map(([type,k])=>({type,sources:[],sink:-1,k}));
    const all=R.shuffle([...Array(N).keys()]);
    const far=(a,b)=>Math.abs(a%n-b%n)+Math.abs(Math.floor(a/n)-Math.floor(b/n));
    const okSpot=i=>{for(let d=0;d<4;d++){const j=nbr(n,i,d);if(j>=0&&endp[j])return false;}return !endp[i];};
    for(const net of nets){
      net.sink=all.find(okSpot);if(net.sink===undefined)return null;
      endp[net.sink]={kind:'sink',net};
      for(let s=0;s<net.k;s++){const c=all.find(i=>okSpot(i)&&far(i,net.sink)>=Math.max(3,Math.floor(n/2)));if(c===undefined)return null;endp[c]={kind:'source',net};net.sources.push(c);}
    }
    const w=Array.from({length:N},()=>1+R.next()*4),hop=cfg.bridges[1]?0.3+R.next():99;
    const netOf=i=>segs[i].length===1?segs[i][0].net:null;
    const deg=i=>segs[i].length===1?pop(segs[i][0].mask):9;
    const link=(a,b,d,net)=>{
      const add=(i,bit)=>{let s=segs[i].find(x=>x.net===net);if(!s){s={net,mask:0};segs[i].push(s);}s.mask|=bit;};
      add(a,BIT[d]);add(b,BIT[opp(d)]);
    };
    let bridges=0;
    for(const net of nets){
      for(const src of net.sources){
        // Dijkstra from the extractor to the network (the plant first, then any joinable pipe of the network).
        const isTarget=i=>net.sources.indexOf(src)===0||!net.sinkLinked?i===net.sink:(netOf(i)===net&&!endp[i]&&deg(i)<3);
        const dist=new Array(N).fill(Infinity),prev=new Array(N).fill(-1),via=new Array(N).fill(-1),done=new Uint8Array(N);
        dist[src]=0;let hit=-1;
        for(;;){let u=-1,bd=Infinity;for(let i=0;i<N;i++)if(!done[i]&&dist[i]<bd){bd=dist[i];u=i;}
          if(u<0)break;done[u]=1;if(u!==src&&isTarget(u)){hit=u;break;}
          if(u!==src&&(endp[u]||segs[u].length))continue; // only free cells (and the source) expand
          for(let d=0;d<4;d++){const v=nbr(n,u,d);if(v<0||done[v])continue;
            const step=(t,cost,through)=>{if(dist[u]+cost<dist[t]){dist[t]=dist[u]+cost;prev[t]=u;via[t]=through;}};
            if(isTarget(v))step(v,w[v],-1);
            else if(!endp[v]&&!segs[v].length)step(v,w[v],-1);
            else if(hop<99&&!endp[v]&&segs[v].length===1&&segs[v][0].net!==net&&segs[v][0].mask===((d&1)?5:10)){
              const t=nbr(n,v,d);if(t>=0&&!done[t]&&(isTarget(t)||(!endp[t]&&!segs[t].length)))step(t,w[t]+hop,v);}}}
        if(hit<0)return null;
        for(let t=hit;t!==src;t=prev[t]){const u=prev[t];
          const d=[0,1,2,3].find(k=>nbr(n,u,k)===t||(via[t]>=0&&nbr(n,u,k)===via[t]));
          if(via[t]>=0){const v=via[t];link(u,v,d,net);link(v,t,d,net);bridges++;}else link(u,t,d,net);}
        net.sinkLinked=true;
      }
    }
    if(bridges<cfg.bridges[0]||bridges>cfg.bridges[1])return null;
    // Fill: every free cell joins a neighbouring pipe (not an endpoint or bridge, at most a tee), favouring line ends.
    for(;;){const free=[];for(let i=0;i<N;i++)if(!endp[i]&&!segs[i].length)free.push(i);if(!free.length)break;
      const pairs=[];
      for(const f of free)for(let d=0;d<4;d++){const t=nbr(n,f,d);if(t<0||endp[t]||segs[t].length!==1)continue;const k=deg(t);if(k>=3)continue;
        pairs.push({f,t,d,wt:k===1?3:1});}
      if(!pairs.length)return null;
      let tot=pairs.reduce((a,p)=>a+p.wt,0),r=R.next()*tot,pick=pairs[0];for(const p of pairs){r-=p.wt;if(r<=0){pick=p;break;}}
      link(pick.f,pick.t,pick.d,segs[pick.t][0].net);
    }
    return {segs,endp,nets,bridges};
  }
  function build(seed,cfg,R){
    const n=cfg.size,N=n*n;
    let pl=null;for(let k=0;k<400&&!pl;k++)pl=plant(null,cfg,R);
    if(!pl)throw new Error('pipes: could not plant a layout for '+cfg.id+' seed '+seed);
    const {segs,endp,nets}=pl;
    const cells=[],solMask=[];
    for(let i=0;i<N;i++){
      if(endp[i]){const m=segs[i][0].mask;cells.push({kind:endp[i].kind,type:endp[i].net.type,mask:m,piece:'end'});solMask.push(m);continue;}
      if(segs[i].length===2){cells.push({kind:'bridge',piece:'cross',nets:segs[i].map(s=>s.net.type)});solMask.push(15);continue;}
      const m=segs[i][0].mask;cells.push({kind:'pipe',piece:pieceOfMask(m),net:segs[i][0].net.type});solMask.push(m);
    }
    // Slots: pipes with two or three ends, not touching each other or an endpoint, lifted into the tray.
    const tray={elbow:0,tee:0,straight:0,end:0},slots=[];
    if(cfg.slots){const cand=R.shuffle([...Array(N).keys()].filter(i=>cells[i].kind==='pipe'&&cells[i].piece!=='end'));
      for(const i of cand){if(slots.length>=cfg.slots)break;
        let ok=true;for(let d=0;d<4;d++){const j=nbr(n,i,d);if(j>=0&&(slots.includes(j)||endp[j]))ok=false;}
        if(!ok)continue;if(slots.filter(s=>cells[s].piece===cells[i].piece).length>=2)continue;
        slots.push(i);}
      slots.sort((a,b)=>a-b);
      for(const i of slots){tray[cells[i].piece]++;cells[i]={kind:'slot',solPiece:cells[i].piece,net:cells[i].net};}}
    const solRot=cells.map((c,i)=>c.kind==='pipe'?rotFor(c.piece,solMask[i]):c.kind==='slot'?rotFor(c.solPiece,solMask[i]):null);
    // Scramble every pipe; at least half the rotatable tiles start turned away from the answer.
    const rotIdx=cells.map((c,i)=>c.kind==='pipe'?i:-1).filter(i=>i>=0);
    let start;
    for(let k=0;k<50;k++){start=cells.map(c=>c.kind==='pipe'?R.int(4):c.kind==='slot'?0:null);
      const off=rotIdx.filter(i=>rotM(PIECES[cells[i].piece].base,start[i])!==solMask[i]).length;if(off>=Math.ceil(rotIdx.length*0.55))break;}
    const P={id:'pipes',seed,difficulty:cfg.id,n,cells,start,slots,tray,nets:nets.map(x=>({type:x.type,sink:x.sink,sources:x.sources.slice().sort((a,b)=>a-b)})),
      solution:{mask:solMask,rot:solRot,piece:cells.map(c=>c.kind==='slot'?c.solPiece:null)},bridges:pl.bridges};
    const minTaps=rotIdx.reduce((a,i)=>a+tapsTo(cells[i].piece,start[i],solMask[i]),0)+slots.reduce((a,i)=>a+0,0);
    P.minTaps=minTaps;P.par=minTaps+Math.max(2,Math.ceil(minTaps*0.2))+slots.length;P.budget=cfg.budget?Math.ceil(P.par*1.3):null;
    return P;
  }
  // Planted solution as a state (pieces in their slots, every tile at its answer turn).
  function solvedState(P,base){const s=base?clone(base):initial(P);
    P.cells.forEach((c,i)=>{if(c.kind==='pipe')s.rot[i]=rotNear(c.piece,s.rot[i],P.solution.mask[i]);
      else if(c.kind==='slot'){s.placed[i]=P.solution.piece[i];s.rot[i]=P.solution.rot[i];}});return s;}
  const cache=new Map();
  function generate(seed,diffId){
    const cfg=difficulty(diffId),key=(seed>>>0)+':'+cfg.id;if(cache.has(key))return JSON.parse(cache.get(key));
    const R=Kit.rng(Kit.hashSeed('pipes:'+cfg.id+':'+(seed>>>0)));
    let P=null,attempts=0;
    // Unique at Easy and Normal (retry until the counter proves one answer); Hard and Expert take the first unique
    // layout within a few tries, else accept several answers (any one that follows the rules counts).
    const tries=cfg.unique?120:6;
    for(;attempts<tries;){attempts++;const Q=build(seed>>>0,cfg,R),r=solve(Q,{limit:2,maxNodes:60000});
      if(!r.count)continue; // cannot happen (the planted answer is valid), kept as a guard
      Q.solutionCount=r.complete?r.count:2;Q.unique=r.complete&&r.count===1;
      if(!P||(Q.unique&&!P.unique))P=Q;if(P.unique)break;}
    P.attempts=attempts;
    if(cache.size>400)cache.clear();cache.set(key,JSON.stringify(P));
    return P;
  }

  // ---- local deductions: forced tiles ----------------------------------------------------------------------------
  // A tile is forced when the sides already settled around it (board edge, fixed endpoints, bridges, locked tiles,
  // and with chain:true the tiles forced before it) leave exactly one way for it to fit.
  function forced(P,st,opts){
    opts=opts||{};const n=P.n,N=n*n,known=new Array(N).fill(null),src=new Array(N).fill(null),out=[];
    for(let i=0;i<N;i++){const c=P.cells[i];
      if(c.kind==='source'||c.kind==='sink'||c.kind==='bridge'){known[i]=maskAt(P,st,i);src[i]=c.kind;}
      else if(st.locked[i]&&rotatable(P,st,i)){known[i]=maskAt(P,st,i);src[i]='locked';}}
    for(let wave=1;;wave++){const found=[];
      for(let i=0;i<N;i++){if(known[i]!==null||!rotatable(P,st,i))continue;const piece=P.cells[i].kind==='pipe'?P.cells[i].piece:st.placed[i];
        const sides=[];for(let d=0;d<4;d++){const j=nbr(n,i,d);if(j<0)sides.push({d,open:false,by:'edge'});else if(known[j]!==null)sides.push({d,open:!!(known[j]&BIT[opp(d)]),by:src[j],cell:j});}
        if(!sides.length)continue;
        const fits=orients(piece).filter(m=>sides.every(s=>!!(m&BIT[s.d])===s.open));
        if(fits.length===1){const used=sides.filter(s=>orients(piece).some(m=>!!(m&BIT[s.d])!==s.open));found.push({cell:i,piece,mask:fits[0],wave,sides:used.length?used:sides});}}
      if(!found.length)break;
      for(const f of found){f.reason=forcedReason(P,f);out.push(f);known[f.cell]=f.mask;src[f.cell]='deduced';}
      if(!opts.chain)break;
    }
    return out;
  }
  function forcedReason(P,f){
    const L=label(P,f.cell),pn=PIECES[f.piece].label,edges=f.sides.filter(s=>s.by==='edge'),others=f.sides.filter(s=>s.by!=='edge');
    const facing=[0,1,2,3].filter(d=>f.mask&BIT[d]).map(d=>DIR_NAME[d]);
    if(!others.length){
      if(f.piece==='elbow')return `The elbow at ${L} sits in a corner, so it can only turn inward.`;
      if(f.piece==='straight')return `The straight at ${L} lies on the edge, so it must run along it.`;
      if(f.piece==='tee')return `The tee at ${L} is on the edge, so its stem must point inward.`;
      return `The board edge leaves the ${pn} at ${L} only one way to fit.`;
    }
    const what=s=>{const c=P.cells[s.cell],there=label(P,s.cell),side=s.open?'opens toward it':'is closed toward it';
      if(s.by==='source'||s.by==='sink')return `the ${pieceName(P,s.cell)} at ${there} ${s.open?'feeds into it':'faces away'}`;
      if(s.by==='bridge')return `the bridge at ${there} ${side}`;
      return `the ${s.by==='locked'?'locked':'settled'} ${c.kind==='slot'?'connector':PIECES[c.piece].label} at ${there} ${side}`;};
    const parts=(edges.length?['the board edge']:[]).concat(others.map(what));
    const list=parts.length>1?parts.slice(0,-1).join(', ')+' and '+parts.at(-1):parts[0];
    const head=f.piece==='end'?`The end cap at ${L} can only face ${facing[0]}`:`The ${pn} at ${L} has only one way to fit (open ${facing.join(' and ')})`;
    return `${head}: ${list}.`;
  }
  // Relaxed: forced tiles snap into place and lock, cascading outward from the tile the player just acted on (up to
  // RELAX_DEPTH steps away). Local on purpose: from the edges inward the chain would otherwise solve most boards
  // before the first tap. Without `from` it settles the whole board (used by tests and the analysis). Returns the
  // steps in order, for the cascade animation.
  const RELAX_DEPTH=3;
  function settle(P,st,opts){
    opts=opts||{};const n=P.n,steps=[],from=opts.from,depth=opts.depth??RELAX_DEPTH,dist=new Map();
    if(from!=null){dist.set(from,0);for(let d=0;d<4;d++){const j=nbr(n,from,d);if(j>=0)dist.set(j,1);}}
    let s=st;
    for(let wave=1;wave<=P.cells.length;wave++){
      const f=forced(P,s,{chain:false}).filter(x=>!s.locked[x.cell]&&(from==null||(dist.has(x.cell)&&dist.get(x.cell)<=depth)));
      if(!f.length)break;s=clone(s);
      for(const x of f){s.rot[x.cell]=rotNear(x.piece,s.rot[x.cell],x.mask);s.locked[x.cell]=true;steps.push({cell:x.cell,wave,reason:x.reason});
        if(from!=null){const k=dist.get(x.cell)+1;for(let d=0;d<4;d++){const j=nbr(n,x.cell,d);if(j>=0&&!(dist.get(j)<=k))dist.set(j,k);}}}
    }
    return {state:s,steps};
  }

  // ---- hints ----------------------------------------------------------------------------------------------------
  const codeOf=(P,st,i)=>{const c=P.cells[i],m=maskAt(P,st,i);const p=c.kind==='slot'?st.placed[i]:c.piece;return m|(PIDX.indexOf(p)<<4);};
  // One step: a wrong lock first (unlock and fix it), then a forced tile that is not yet right (closest to the
  // settled tiles first), then any tile that differs from a working layout consistent with the player's locks.
  function hint(P,st){
    const a=analyze(P,st);if(a.solved)return null;
    const fixed={};P.cells.forEach((c,i)=>{if(st.locked[i]&&rotatable(P,st,i))fixed[i]=codeOf(P,st,i);});
    const plantedCodes=P.cells.map((c,i)=>P.solution.mask[i]|(PIDX.indexOf(c.kind==='slot'?P.solution.piece[i]:c.piece)<<4));
    let target=null;const r=solve(P,{limit:1,fixed,maxNodes:80000});
    if(r.count)target=r.solutions[0];
    else if(!r.complete)target=plantedCodes; // search gave up: fall back to the planted answer
    else{const bad=Object.keys(fixed).map(Number).find(i=>fixed[i]!==plantedCodes[i]);
      if(bad===undefined)return null;
      const need=PIDX[plantedCodes[bad]>>4];
      if(P.cells[bad].kind==='slot'&&st.placed[bad]!==need&&!(trayLeft(P,st)[need]>0))
        return {cell:bad,kind:'lift',reason:`The locked ${PIECES[st.placed[bad]].label} in ${label(P,bad)} cannot be part of any working layout: it went back to the tray.`};
      return makeHint(P,st,bad,plantedCodes[bad],'unlock',`The locked ${pieceName(P,bad,st)} at ${label(P,bad)} cannot be part of any working layout, so it was unlocked and set right.`);}
    const f=forced(P,st,{chain:true}).filter(x=>!st.locked[x.cell]&&x.mask!==maskAt(P,st,x.cell));
    if(f.length){f.sort((x,y)=>x.wave-y.wave||x.cell-y.cell);const x=f[0];return makeHint(P,st,x.cell,target[x.cell],'rotate',x.reason);}
    // Slots: the right connector in each slot (a wrong one goes back to the tray first).
    for(const s of P.slots){const want=PIDX[target[s]>>4];
      if(st.placed[s]&&st.placed[s]!==want)return {cell:s,kind:'lift',reason:`The ${PIECES[st.placed[s]].label} in ${label(P,s)} belongs elsewhere: it went back to the tray.`};}
    for(const s of P.slots){const want=PIDX[target[s]>>4];
      if(!st.placed[s]){if(!(trayLeft(P,st)[want]>0))continue;
        return makeHint(P,st,s,target[s],'place',`The slot at ${label(P,s)} takes the ${PIECES[want].label}: it is the only tray piece that seals the ends around it.`);}}
    const wrong=P.cells.map((c,i)=>i).filter(i=>rotatable(P,st,i)&&!st.locked[i]&&maskAt(P,st,i)!==(target[i]&15));
    if(!wrong.length)return null;
    // Prefer a wrong tile touching a leak or a contamination joint: that is the one breaking the flow.
    const touch=new Set([...a.leaks.map(l=>l.cell),...a.contam.flatMap(c=>[c.a,c.b])]);
    const i=wrong.find(k=>touch.has(k))??wrong[0];
    return makeHint(P,st,i,target[i],'rotate',`Following the open ends through, the ${pieceName(P,i,st)} at ${label(P,i)} must open ${[0,1,2,3].filter(d=>target[i]&BIT[d]).map(d=>DIR_NAME[d]).join(' and ')} for every line to close.`);
  }
  function makeHint(P,st,cell,code,kind,reason){
    const piece=P.cells[cell].kind==='slot'?PIDX[code>>4]:P.cells[cell].piece;return {cell,kind,piece,mask:code&15,reason};}
  // Applying a hint sets that tile right and locks it. Hint turns never count as rotations.
  function applyHint(P,st,h){
    if(!h)return st;const s=clone(st),i=h.cell;
    if(h.kind==='lift'){s.placed[i]=null;s.rot[i]=0;s.locked[i]=false;return s;}
    if(P.cells[i].kind==='slot'){if(s.placed[i]!==h.piece){s.placed[i]=h.piece;s.rot[i]=0;}}
    s.rot[i]=rotNear(h.piece,s.rot[i],h.mask);s.locked[i]=true;return s;
  }

  // ---- results ---------------------------------------------------------------------------------------------------
  const line=(net,a)=>{const T=TYPES[net.type],k=net.sources.length;return `${T.label.toLowerCase()}${k>1?` (${k} ${T.source}s)`:''} → ${T.sink}`;};
  function output(P,a,auto){
    const on=a.nets.filter(x=>x.fed),off=a.nets.filter(x=>!x.fed);
    if(!on.length)return 'Base offline: nothing reaches a plant tonight.';
    const head=auto?'Base online at reduced output (automatic layout)':a.solved?'Base online':'Base partly online';
    return `${head}: ${on.map(x=>line(x,a)).join(', ')}${off.length?`. Offline: ${off.map(x=>line(x,a)).join(', ')}`:''}.`;
  }
  // info: {hints, assist:'puzzle'|'guided'|'relaxed', auto, outOfTaps}
  function score(P,st,info){
    info=info||{};const a=analyze(P,st),total=P.nets.length;
    if(info.auto)return {tier:'auto',score:35,fed:total,total};
    if(a.solved){
      const over=Math.max(0,st.taps-P.par),hints=info.hints||0,assist=info.assist||'puzzle';
      if(!hints&&!over&&assist==='puzzle')return {tier:'perfect',score:100,fed:total,total};
      const sc=Math.max(50,95-8*hints-Math.min(20,over)-(assist==='guided'?10:assist==='relaxed'?20:0));
      return {tier:'good',score:sc,fed:total,total};
    }
    if(a.fed>0)return {tier:'partial',score:Math.round(10+35*a.fed/total),fed:a.fed,total};
    return {tier:'failed',score:0,fed:0,total};
  }
  function autoFallback(P){const st=solvedState(P);return {state:st,score:35,output:output(P,analyze(P,st),true)};}
  // One concrete sentence: the tile whose orientation broke the flow, or what stood between this and Perfect.
  function nearMiss(P,st,info){
    info=info||{};const t=info.tier;
    if(t==='auto'){const h=hint(P,initial(P));return `Solving it yourself runs every line at full output.${h?' The first step was there: '+h.reason:''}`;}
    if(t==='perfect')return '';
    if(t==='good'){
      if(info.assist==='relaxed'||info.assist==='guided')return `Solved with the ${info.assist==='relaxed'?'Relaxed':'Guided'} assist. Perfect is kept for the Puzzle level, where you settle every tile yourself.`;
      if(info.hints&&info.firstHint)return `Spotting this yourself would have made it Perfect: ${info.firstHint}`;
      const over=st.taps-P.par;
      if(over>0)return `${plural(over,'rotation')} over par (${P.par}). ${info.mostTurned!=null?`The most-turned tile was ${label(P,info.mostTurned)} (${plural(info.mostTurnedCount,'turn')}). `:''}Within par this was Perfect.`;
      return '';
    }
    // Partial or failed: the single tile change that feeds the most plants, else the leaking tile on a dry line.
    const a=analyze(P,st),base=a.fed;let best=null;
    P.cells.forEach((c,i)=>{if(!(c.kind==='pipe'||c.kind==='slot'))return;
      const pieces=c.kind==='pipe'?[c.piece]:st.placed[i]?[st.placed[i]]:TRAY_ORDER.filter(p=>trayLeft(P,st)[p]>0);
      for(const p of pieces)for(const m of orients(p)){if(c.kind!=='slot'&&m===maskAt(P,st,i))continue;
        const s=clone(st);if(c.kind==='slot')s.placed[i]=p;s.rot[i]=rotFor(p,m);const b=analyze(P,s);
        const gain=b.fed-base+(b.solved?0.5:0)-(b.leaks.length-a.leaks.length)*0.01;
        if(b.fed>base&&(!best||gain>best.gain))best={i,p,m,gain,nets:b.nets.filter((x,k)=>x.fed&&!a.nets[k].fed)};}});
    if(best){const where=label(P,best.i),open=[0,1,2,3].filter(d=>best.m&BIT[d]).map(d=>DIR_NAME[d]).join(' and ');
      const what=P.cells[best.i].kind==='slot'&&!st.placed[best.i]?`A ${PIECES[best.p].label} in the slot at ${where}`:`Turning the ${PIECES[best.p].label} at ${where} to open ${open}`;
      return `${what} would have fed the ${best.nets.map(x=>TYPES[x.type].sink).join(' and ')}.`;}
    const unfed=a.nets.find(x=>!x.fed);
    if(!unfed){const lk=a.leaks[0];
      if(lk)return `Every plant was fed, but the ${pieceName(P,lk.cell,st)} at ${label(P,lk.cell)} was still open ${DIR_NAME[lk.dir]}: sealing every end would have finished the base.`;
      if(a.dry)return `Every plant was fed, but ${plural(a.dry,'pipe')} still carried nothing: every pipe has to join a line.`;
      const sl=P.slots.find(i=>!st.placed[i]);if(sl!==undefined)return `The slot at ${label(P,sl)} was still empty.`;}
    const lk=unfed&&a.leaks.find(l=>a.claimed[node(P,l.cell,l.dir)]===unfed.type);
    if(lk)return `The ${pieceName(P,lk.cell,st)} at ${label(P,lk.cell)} broke the ${TYPES[unfed.type].label.toLowerCase()} flow: it leaks ${DIR_NAME[lk.dir]} before reaching the ${TYPES[unfed.type].sink}.`;
    if(a.contam.length){const c=a.contam[0];return `${label(P,c.a)} and ${label(P,c.b)} mixed two products, which spoiled the line.`;}
    return '';
  }

  const api={BIT,DX,DY,DIR_NAME,PIECES,TYPES,TRAY_ORDER,DIFFICULTIES,ASSIST_LEVELS,difficulty,label,nbr,rotM,orients,pieceName,rotatable,
    initial,maskAt,masksOf,trayLeft,rotate,toggleLock,place,lift,bestRot,analyze,analyzeMasks,solve,countSolutions,stateFrom,solvedState,
    generate,forced,settle,RELAX_DEPTH,_build:(seed,cfg)=>build(seed,{...difficulty(cfg.id),...cfg},Kit.rng(seed)),hint,applyHint,output,score,autoFallback,nearMiss,tapsTo,rotNear};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.Pipes=api;
})(typeof globalThis==='object'?globalThis:this);
