// Aether attunement (Research, night): the boss study. Pure rules, no DOM.
// Research tests elements on tissue samples of the upcoming boss. Each sample is a Flood-It board of element-coloured
// cells; the reaction grows from the 2×2 core at the centre. Each move applies a reagent from the rack: the whole
// reacted region takes that element and absorbs every orthogonally adjacent cell group of it. Elements not on the
// rack are inert in this sample; a connected pocket of them is absorbed by "resonance" once every open neighbour of
// the pocket has reacted. (Null-scars, cells of -1, never absorb; the rules support them, the generator places none.)
//
// A round is one boss with 2-4 buffs. Each sample targets one buff and carries an objective:
//  - End on X: the sample only stabilises if X closes the reaction (the last move is X). X is the boss's weakness, so
//    a clean End-on sample reveals it. Grabbing X early is the trap: one X move absorbs every touching X group, and
//    once no X is left the sample can no longer close on it.
//  - Lead with Y: the reaction only takes if Y opens it (the first move is Y).
//  - Lead with Y · End on X: both (Expert's last sample).
// Objectives never make a move illegal: you can always finish the board, but a broken objective only weakens the
// buff. Par is the exact minimum among lines that satisfy the objective. Clean with the objective met within par+2
// removes the buff; otherwise it is weakened. Never twice and Spare Y were tried and cut (see generateSample).
//
// Boards are authored patterns built backwards from a planned solution.
//  1. Motifs. Each sample picks one or two motifs from MOTIFS (rings, diamonds, frames, spiral, stripes, chevrons,
//     checker, plaid, mosaic; crossed with quadrants, or overlaid with veins, circles, crosses or triangles) and a
//     symmetry fold. Motif labels are evaluated on folded coordinates, so the board is exactly mirrored or rotated.
//  2. Waves. Every label gets one random cost; pieces settle in shortest-path order from the core and the distance
//     levels are cut into waves 1..K of similar area, so playing the wave colours attunes the board. A costly piece
//     next to the core lands in a late wave: a shaped decoy that joins for free later.
//  3. Clean-up. Small fragments and lone cells take their earliest neighbouring wave; foreign pockets are whole
//     small motif shapes.
//  4. Objective gates (fitObjective). The objective par must be in range; the free optimal line (the one hints would
//     give without the objective) must break the objective, so the objective changes the par line; a careful greedy
//     player (most cells among moves that keep the objective possible) and a plain greedy one must both miss par; every par move but the last
//     absorbs a big chunk; every par move but the last offers at least two reagents.
//
// Solver notes. Rules are lifted to a graph of rack-colour components. Lower bound h = max(farthest component
// distance, rack colours left) is admissible. Objectives are clauses checked per move (End on X also prunes states
// with no X left to close on), so IDA* finds the exact objective par. Among optimal lines the par line (and every
// hint) is the one whose smallest move is largest.
// Loads as a classic script (window.AetherAttunement) or with require() in Node.
(function(root){
  'use strict';
  const Kit=(typeof module==='object'&&module.exports&&typeof require==='function')?require('./minigame-kit.js'):root.MiniGameKit;
  const ELEMENTS=['order','chaos','growth','void','decay','energy'];
  const GLYPHS={order:'■',chaos:'✕',growth:'▲',void:'●',decay:'◣',energy:'ϟ'};
  const SLACK=2; // clean with the objective met within par+SLACK still removes the buff
  // Hero bosses from docs/design/enemy-catalogue.md, each with four buffs a clean sample can strip (flavour only).
  const BOSSES=[
    {id:'cathedral',name:'The Cathedral That Walks',origin:'Ossuary Reef',role:'Warden',buffs:[
      ['Reforming shields','Its shell layers regrow after every break.'],['Nested sanctums','A second guard sits inside the first.'],
      ['Calcified guard','Direct hits glance off fresh bone.'],['Null armour','Redacted plates ignore the first element to hit them.']]},
    {id:'ninefold',name:'The Ninefold Mother',origin:'Mycelial Choir',role:'Anchor',buffs:[
      ['Shared pulse','Strengthens every body that shares her cycle.'],['Spore chorus','Heals her nine bodies a little each turn.'],
      ['Rooted','Cannot be moved or knocked back.'],['Second wind','Rises once at half Instability.']]},
    {id:'serein',name:'Serein-of-Seven-Facets',origin:'Glasswake',role:'Reflector',buffs:[
      ['Mirror facets','Returns a share of every hit.'],['Remembered light','Copies the last element used on it.'],
      ['Null armour','Redacted plates ignore the first element to hit them.'],['Second wind','Rises once at half Instability.']]},
    {id:'bell',name:'The Bell Below',origin:'Tideworn',role:'Cleanser',buffs:[
      ['Tidal cleanse','Sheds ailments every turn.'],['False fourth note','Silences the crew’s next skill.'],
      ['Flooded chambers','Back-row attacks fall short.'],['Second wind','Rises once at half Instability.']]},
    {id:'rookback',name:'Old Rookback',origin:'Tannhul Herds',role:'Bruiser',buffs:[
      ['Herd bond','Calves take its hits for it.'],['Thick hide','Shrugs off the first heavy blow.'],
      ['Stampede','Its charge hits the whole front row.'],['Second wind','Rises once at half Instability.']]},
    {id:'curator',name:'CURATOR // LAST INSTRUCTION',origin:'Custodian Array',role:'Anchor',buffs:[
      ['Archive lock','Restores itself to the last saved state.'],['Reforming shields','Vault plates regrow after every break.'],
      ['Catalogue relay','Strengthens every unit it has catalogued.'],['Null armour','Redacted plates ignore the first element to hit them.']]},
    {id:'kindly',name:'The Kindly Voice',origin:'The Redaction',role:'Interlocutor',buffs:[
      ['Rule erasure','Removes one combat rule each round.'],['Null armour','Redacted plates ignore the first element to hit them.'],
      ['Soft-spoken','The crew cannot target it until it speaks.'],['Second wind','Rises once at half Instability.']]}
  ];
  // samples: the objective kind of each sample in the round (one buff each); buffs: how many the boss shows.
  // folds: symmetries allowed; cheap/spread: share of cheap motif labels and the cost range of the rest; minPiece:
  // fragments smaller than this take a neighbour's colour; pockets/pocketMax: foreign motif shapes; minGain: smallest
  // move on the par line (but the closing move) as a share of the board.
  const ALL_FOLDS=['D4','C4','D2','C2','MX'];
  const DIFFICULTIES=[
    {id:'calm',label:'Calm · 8×8, 4 reagents, 1 sample',target:45,size:8,crew:4,buffs:2,samples:['endOn'],parRange:[4,5],pair:.6,folds:['MX','C2','D2'],cheap:.6,spread:1.5,minPiece:3,pockets:1,pocketMax:6,minGain:.08},
    {id:'steady',label:'Steady · 10×10, 4 reagents, 2 samples',target:120,size:10,crew:4,buffs:3,samples:['endOn','endOn'],parRange:[4,5],pair:.7,folds:['MX','C2','D2','C4'],cheap:.55,spread:2,minPiece:3,pockets:1,pocketMax:8,minGain:.07},
    {id:'tense',label:'Tense · 12×12, 5 reagents, 2 samples',target:150,size:12,crew:5,buffs:3,samples:['endOn','leadWith'],parRange:[5,6],pair:.75,folds:ALL_FOLDS,cheap:.5,spread:2.5,minPiece:4,pockets:2,pocketMax:8,minGain:.06},
    {id:'expert',label:'Expert · 14×14, 5 reagents, 3 samples',target:270,size:14,crew:5,buffs:4,samples:['endOn','leadWith','leadEnd'],parRange:[5,6],pair:.8,folds:ALL_FOLDS,cheap:.45,spread:3,minPiece:4,pockets:2,pocketMax:10,minGain:.05}
  ];
  const ASSIST_LEVELS=[
    {id:'puzzle',label:'Puzzle',note:'Every move is yours. Perfect is possible.'},
    {id:'guided',label:'Guided',note:'Cells any reagent could reach next are outlined. Perfect is still possible.'},
    {id:'relaxed',label:'Relaxed',note:'When only one reagent keeps the objective possible, it is applied for you (never the closing move). Tops out at Good.'}
  ];
  const EXACT_BUDGET=250000,LINE_BUDGET=40000,BEAM_WIDTH=160;
  const ABORT={};
  const name=c=>ELEMENTS[c],title=c=>ELEMENTS[c][0].toUpperCase()+ELEMENTS[c].slice(1);
  const diff=id=>DIFFICULTIES.find(d=>d.id===id)||DIFFICULTIES[0];
  const nbOf=(s,i)=>{const x=i%s,y=(i/s)|0,out=[];if(x>0)out.push(i-1);if(x<s-1)out.push(i+1);if(y>0)out.push(i-s);if(y<s-1)out.push(i+s);return out;};

  // ---------- topology: crew components, foreign pockets, adjacency ----------
  const topoCache=new WeakMap();
  function topology(P){
    if(topoCache.has(P))return topoCache.get(P);
    const s=P.size,n=s*s,cells=P.cells,crew=new Set(P.palette),cellComp=new Int32Array(n).fill(-1),cellPocket=new Int32Array(n).fill(-1);
    const colour=[],members=[],pockets=[];
    const nb=i=>nbOf(s,i);
    for(let i=0;i<n;i++){
      if(cells[i]<0||cellComp[i]>=0||cellPocket[i]>=0)continue;
      const isCrew=crew.has(cells[i]),id=isCrew?colour.length:pockets.length,list=[i],seen=isCrew?cellComp:cellPocket;seen[i]=id;
      // crew components join same colour; pockets join any foreign colour (a pocket closes as one piece)
      for(let k=0;k<list.length;k++)for(const j of nb(list[k])){const c=cells[j];if(c<0||seen[j]>=0)continue;if(isCrew?c===cells[i]:!crew.has(c)){seen[j]=id;list.push(j);}}
      if(isCrew){colour.push(cells[i]);members.push(list);}else pockets.push({cells:list,adj:[]});
    }
    const adj=colour.map(()=>new Set());
    for(let i=0;i<n;i++){const a=cellComp[i];if(a<0)continue;for(const j of nb(i)){const b=cellComp[j];if(b>=0&&b!==a)adj[a].add(b);const p=cellPocket[j];if(p>=0&&!pockets[p].adj.includes(a))pockets[p].adj.push(a);}}
    const T={n:colour.length,colour,members,size:members.map(m=>m.length),adj:adj.map(x=>[...x].sort((a,b)=>a-b)),pockets,cellComp,cellPocket,palette:P.palette.slice(),nb,
      dist:new Int16Array(colour.length),queue:new Int32Array(colour.length)};
    topoCache.set(P,T);return T;
  }

  // ---------- component-level search primitives (abs = Uint8Array over crew components) ----------
  function step(T,abs,c){ // the move "pick colour c": returns {abs,gain} or null when nothing would be absorbed
    let out=null,gain=0;
    for(let a=0;a<T.n;a++)if(abs[a])for(const b of T.adj[a])if(T.colour[b]===c&&!abs[b]&&!(out&&out[b])){if(!out)out=Uint8Array.from(abs);out[b]=1;gain+=T.size[b];}
    return out&&{abs:out,gain};
  }
  function closedCells(T,abs){let k=0;for(const p of T.pockets)if(p.adj.length&&p.adj.every(a=>abs[a]))k+=p.cells.length;return k;}
  function visibleGain(T,from,k){return k.gain+closedCells(T,k.abs)-closedCells(T,from);} // crew cells + resonance
  function lower(T,abs){ // admissible: max(farthest component distance, distinct crew colours left)
    const {dist,queue}=T;let head=0,tail=0,far=0,seen=0,cols=0;
    for(let i=0;i<T.n;i++){if(abs[i]){dist[i]=0;queue[tail++]=i;}else{dist[i]=-1;const bit=1<<T.colour[i];if(!(seen&bit)){seen|=bit;cols++;}}}
    while(head<tail){const a=queue[head++],d=dist[a]+1;for(const b of T.adj[a])if(dist[b]<0){dist[b]=d;if(d>far)far=d;queue[tail++]=b;}}
    return far>cols?far:cols;
  }
  function key(abs){let s='';for(let i=0;i<abs.length;i+=16){let v=0;for(let j=0;j<16&&i+j<abs.length;j++)if(abs[i+j])v|=1<<j;s+=String.fromCharCode(v);}return s;}
  function exactPlan(T,abs0,budget){
    let bound=lower(T,abs0),count=0;const path=[];
    if(bound===0)return [];
    for(;;){
      let next=Infinity;const seen=new Map();
      const dfs=(abs,g)=>{
        const h=lower(T,abs);if(h===0)return true;
        if(g+h>bound){if(g+h<next)next=g+h;return false;}
        if(++count>budget)throw ABORT;
        const kids=[];for(const c of T.palette){const k=step(T,abs,c);if(k)kids.push([c,k]);}
        kids.sort((x,y)=>y[1].gain-x[1].gain);
        for(const [c,k] of kids){const id=key(k.abs),prev=seen.get(id);if(prev!==undefined&&prev<=g+1)continue;seen.set(id,g+1);path.push(c);if(dfs(k.abs,g+1))return true;path.pop();}
        return false;
      };
      if(dfs(abs0,0))return path.slice();
      if(next===Infinity)return null;bound=next;
    }
  }
  // among all lines of exactly `len` moves that finish, the one whose smallest visible move is largest (ties: larger
  // earlier moves). Returns {plan,gains} or null if the enumeration budget runs out.
  function widestLine(T,abs0,len,budget){
    let best=null,count=0;const path=[],gains=[];
    const better=g=>{if(!best)return true;const a=Math.min(...g),b=Math.min(...best.gains);if(a!==b)return a>b;for(let i=0;i<g.length;i++)if(g[i]!==best.gains[i])return g[i]>best.gains[i];return false;};
    const dfs=(abs,g,floor)=>{
      const h=lower(T,abs);if(h===0){if(better(gains))best={plan:path.slice(),gains:gains.slice()};return;}
      if(g+h>len)return;if(++count>budget)throw ABORT;
      if(best&&floor<Math.min(...best.gains))return; // cannot beat the best smallest move any more
      for(const c of T.palette){const k=step(T,abs,c);if(!k)continue;const v=visibleGain(T,abs,k);path.push(c);gains.push(v);dfs(k.abs,g+1,Math.min(floor,v));path.pop();gains.pop();}
    };
    try{dfs(abs0,0,Infinity);}catch(e){if(e!==ABORT)throw e;return null;}
    return best;
  }
  function beamPlan(T,abs0,width){
    if(lower(T,abs0)===0)return [];
    let layer=[{abs:abs0,plan:[],cells:0}];
    for(let depth=0;depth<400&&layer.length;depth++){
      const next=[],seen=new Set();
      for(const s of layer)for(const c of T.palette){
        const k=step(T,s.abs,c);if(!k)continue;const id=key(k.abs);if(seen.has(id))continue;seen.add(id);
        const h=lower(T,k.abs),plan=s.plan.concat(c);if(h===0)return plan;
        const cells=s.cells+k.gain;next.push({abs:k.abs,plan,cells,score:h*100000-cells});
      }
      next.sort((a,b)=>a.score-b.score);layer=next.slice(0,width);
    }
    return null;
  }
  function greedyPlan(T,abs0){ // most cells now; ties to the earlier palette element
    const plan=[];let abs=abs0;
    while(lower(T,abs)>0){let best=null,bc=-1;for(const c of T.palette){const k=step(T,abs,c);if(k&&k.gain>(best?best.gain:0)){best=k;bc=c;}}abs=best.abs;plan.push(bc);}
    return plan;
  }
  // best plan from abs: exact length, then the widest line of that length. Falls back to beam only if the exact
  // search runs out of budget (never on generated boards from the start; possible only far off the par line).
  function planFrom(T,abs){
    let p=null;try{p=exactPlan(T,abs,EXACT_BUDGET);}catch(e){if(e!==ABORT)throw e;}
    if(p){const w=p.length?widestLine(T,abs,p.length,LINE_BUDGET):null;return {plan:w?w.plan:p,exact:true};}
    return {plan:beamPlan(T,abs,BEAM_WIDTH)||greedyPlan(T,abs),exact:false};
  }
  function absFor(P){const T=topology(P),abs=new Uint8Array(T.n);abs[T.cellComp[P.origin]]=1;return abs;}

  // ---------- objectives in the search ----------
  // An objective {kind, lead?, end?} becomes clauses [{kind:'leadWith'|'endOn', element}]. ctx: {k: moves played}.
  const clausesOf=obj=>{if(!obj)return [];const out=[];if(obj.lead!=null)out.push({kind:'leadWith',element:obj.lead});if(obj.end!=null)out.push({kind:'endOn',element:obj.end});return out;};
  const allIn=abs=>{for(let i=0;i<abs.length;i++)if(!abs[i])return false;return true;};
  const hasOpen=(T,abs,c)=>{for(let i=0;i<T.n;i++)if(!abs[i]&&T.colour[i]===c)return true;return false;};
  // may the solver play c (move number ctx.k+1) reaching next? End on X also refuses moves that leave no X to close on.
  function allowed(T,cl,k,c,next){
    for(const q of cl){
      if(q.kind==='endOn'){if(allIn(next)?c!==q.element:!hasOpen(T,next,q.element))return false;}
      else if(q.kind==='leadWith'){if(k===0&&c!==q.element)return false;}
    }
    return true;
  }
  const leads=cl=>cl.some(q=>q.kind==='leadWith');
  const ctxKey=(cl,k)=>leads(cl)?(k>0?'|1':'|0'):'';
  function kidsOf(T,abs,cl,k){const kids=[];for(const c of T.palette){const s=step(T,abs,c);if(s&&allowed(T,cl,k,c,s.abs))kids.push([c,s]);}return kids;}
  function satisfies(cl,moves){
    for(const q of cl){
      if(q.kind==='endOn'&&!(moves.length&&moves[moves.length-1]===q.element))return false;
      if(q.kind==='leadWith'&&!(moves.length&&moves[0]===q.element))return false;
    }
    return true;
  }
  // a state can still meet the objective only if its moves so far have not already broken it
  const openOK=(cl,moves)=>cl.every(q=>q.kind!=='leadWith'||!moves.length||moves[0]===q.element);
  // exact shortest line from (abs, k moves played) that satisfies cl, or null if none exists. Throws ABORT.
  function exactObj(T,abs0,cl,k0,budget){
    if(allIn(abs0))return [];
    let bound=lower(T,abs0),count=0;const path=[];
    for(;;){
      let next=Infinity;const seen=new Map();
      const dfs=(abs,g)=>{
        if(allIn(abs))return true;
        const h=lower(T,abs);if(g+h>bound){if(g+h<next)next=g+h;return false;}
        if(++count>budget)throw ABORT;
        const kids=kidsOf(T,abs,cl,k0+g);kids.sort((x,y)=>y[1].gain-x[1].gain);
        for(const [c,s] of kids){const id=key(s.abs)+ctxKey(cl,k0+g+1),prev=seen.get(id);if(prev!==undefined&&prev<=g+1)continue;seen.set(id,g+1);path.push(c);if(dfs(s.abs,g+1))return true;path.pop();}
        return false;
      };
      if(dfs(abs0,0))return path.slice();
      if(next===Infinity)return null;bound=next;
    }
  }
  // among the lines of exactly len moves that satisfy cl, the one whose smallest visible move is largest
  function widestObj(T,abs0,cl,k0,len,budget){
    let best=null,count=0;const path=[],gains=[];
    const better=g=>{if(!best)return true;const a=Math.min(...g),b=Math.min(...best.gains);if(a!==b)return a>b;for(let i=0;i<g.length;i++)if(g[i]!==best.gains[i])return g[i]>best.gains[i];return false;};
    const dfs=(abs,g,floor)=>{
      if(allIn(abs)){if(better(gains))best={plan:path.slice(),gains:gains.slice()};return;}
      if(g+lower(T,abs)>len)return;if(++count>budget)throw ABORT;
      if(best&&floor<Math.min(...best.gains))return;
      for(const [c,s] of kidsOf(T,abs,cl,k0+g)){const v=visibleGain(T,abs,s);path.push(c);gains.push(v);dfs(s.abs,g+1,Math.min(floor,v));path.pop();gains.pop();}
    };
    try{dfs(abs0,0,Infinity);}catch(e){if(e!==ABORT)throw e;return null;}
    return best;
  }
  // can cl still be met from here in any number of moves? true / false / null (budget ran out: unknown)
  function feasibleObj(T,abs0,cl,k0,budget){
    if(!cl.length)return true;
    let count=0;const seen=new Set();
    const dfs=(abs,k)=>{
      if(allIn(abs))return true;
      const id=key(abs)+ctxKey(cl,k);if(seen.has(id))return false;seen.add(id);
      if(++count>budget)throw ABORT;
      const kids=kidsOf(T,abs,cl,k);kids.sort((x,y)=>y[1].gain-x[1].gain);
      for(const [c,s] of kids)if(dfs(s.abs,k+1))return true;
      return false;
    };
    try{return dfs(abs0,k0);}catch(e){if(e!==ABORT)throw e;return null;}
  }
  // greedy most-cells play. careful: only moves after which cl can still be met (the careful greedy player);
  // otherwise free (ignores the objective). Returns {plan, met}.
  function greedyObj(T,abs0,cl,careful){
    const plan=[];let abs=abs0,safe=careful;
    while(!allIn(abs)){
      let best=null,bc=-1;
      for(const c of T.palette){const s=step(T,abs,c);if(!s||s.gain<=(best?best.gain:0))continue;
        if(safe&&(!allowed(T,cl,plan.length,c,s.abs)||feasibleObj(T,s.abs,cl,plan.length+1,20000)===false))continue;
        best=s;bc=c;}
      if(!best){safe=false;continue;} // nothing keeps the objective: play on freely
      abs=best.abs;plan.push(bc);
    }
    return {plan,met:satisfies(cl,plan)};
  }

  // ---------- state ----------
  // state: {abs:[0|1 per component], colour, moves:[element index]}
  function initial(P){return {abs:Array.from(absFor(P)),colour:P.cells[P.origin],moves:[]};}
  function attuned(P,state){ // Uint8Array per cell: 1 reacted, 0 not
    const T=topology(P),n=P.size*P.size,out=new Uint8Array(n);
    const closed=T.pockets.map(p=>p.adj.length>0&&p.adj.every(a=>state.abs[a]));
    for(let i=0;i<n;i++){const c=T.cellComp[i];if(c>=0)out[i]=state.abs[c]?1:0;else{const p=T.cellPocket[i];if(p>=0&&closed[p])out[i]=1;}}
    return out;
  }
  const done=(P,state)=>state.abs.every(Boolean);
  const absorbable=P=>P.cells.filter(c=>c>=0).length;
  // apply never mutates its input; an invalid move returns {ok:false,reason} and the caller keeps the old state.
  // Objectives never refuse a move: breaking one is allowed and only weakens the buff.
  function apply(P,state,c){
    if(done(P,state))return {ok:false,reason:'The sample is already clean.'};
    if(!P.palette.includes(c))return {ok:false,reason:ELEMENTS[c]?`${title(c)} is not on the rack for this sample: its tissue only reacts by resonance.`:'Unknown element.'};
    const T=topology(P),k=step(T,Uint8Array.from(state.abs),c);
    if(!k)return {ok:false,reason:`No ${name(c)} tissue touches the reaction.`};
    const before=attuned(P,state),next={abs:Array.from(k.abs),colour:c,moves:state.moves.concat(c)};
    const after=attuned(P,next),absorbed=[],resonance=[];
    for(let i=0;i<after.length;i++)if(after[i]&&!before[i])(T.cellComp[i]>=0?absorbed:resonance).push(i);
    return {ok:true,state:next,absorbed,resonance,done:done(P,next)};
  }
  const preview=apply;
  function simulate(P,plan){let s=initial(P);for(const c of plan){const r=apply(P,s,c);if(!r.ok)return null;s=r.state;}return s;}
  const clauses=P=>clausesOf(P.objective);

  // ---------- the objective, live ----------
  function objectiveText(obj){
    const parts=[];if(obj.lead!=null)parts.push(`Lead with ${title(obj.lead)}`);if(obj.end!=null)parts.push(`End on ${title(obj.end)}`);
    return parts.join(' · ');
  }
  // best line from a state: under the objective while it can still be met, otherwise the fewest moves to clean.
  // {plan, met: the plan meets the objective, exact}
  function solve(P,state){
    const T=topology(P),cl=clauses(P),abs=Uint8Array.from(state.abs),k=state.moves.length;
    if(done(P,state))return {plan:[],met:satisfies(cl,state.moves),exact:true};
    if(openOK(cl,state.moves)){
      let p=null,aborted=false;try{p=exactObj(T,abs,cl,k,EXACT_BUDGET);}catch(e){if(e!==ABORT)throw e;aborted=true;}
      if(p){const w=widestObj(T,abs,cl,k,p.length,LINE_BUDGET);return {plan:w?w.plan:p,met:true,exact:true};}
      if(aborted){const g=greedyObj(T,abs,cl,true);if(g.met)return {plan:g.plan,met:true,exact:false};}
    }
    const free=planFrom(T,abs);return {plan:free.plan,met:false,exact:free.exact};
  }
  // chip: 'par' (par still reachable under the objective), 'over' (objective possible, par is not), 'lost' (the
  // objective can no longer be met), then 'met' / 'broken' once the sample is clean.
  function objectiveStatus(P,state){
    const cl=clauses(P),moves=state.moves.length;
    if(done(P,state)){const met=satisfies(cl,state.moves);return {state:met?'met':'broken',met,moves,best:moves};}
    const s=solve(P,state);
    if(!s.met)return {state:'lost',met:false,moves,best:null};
    const best=moves+s.plan.length;
    return {state:best<=P.par?'par':'over',met:true,moves,best};
  }
  // would c break the objective for good? (finishes on the wrong element, opens with the wrong one, or leaves no line)
  function breaks(P,state,c){
    const r=apply(P,state,c);if(!r.ok)return false;
    const cl=clauses(P);if(!openOK(cl,state.moves))return false; // already broken: nothing more to lose
    if(r.done)return !satisfies(cl,r.state.moves);
    if(!openOK(cl,r.state.moves))return true;
    return feasibleObj(topology(P),Uint8Array.from(r.state.abs),cl,r.state.moves.length,EXACT_BUDGET)===false;
  }
  // a compass phrase for a set of cells, using the board's motif: "the east rings", "the central frames"
  const NOUN={rings:'rings',diamonds:'diamonds',frames:'frames',spiral:'spiral',stripes:'stripes',chevrons:'chevrons',checker:'checks',plaid:'plaid',mosaic:'mosaic'};
  function where(P,cells){
    if(!cells.length)return 'the sample';
    const s=P.size,m=(s-1)/2;let x=0,y=0;for(const i of cells){x+=i%s-m;y+=((i/s)|0)-m;}x/=cells.length;y/=cells.length;
    const noun=NOUN[P.motifs[0]]||'tissue',r=Math.hypot(x,y);
    if(r<s*.12)return `the central ${noun}`;
    const dirs=['east','south-east','south','south-west','west','north-west','north','north-east'],a=Math.atan2(y,x);
    return `the ${dirs[((Math.round(a/(Math.PI/4))%8)+8)%8]} ${noun}`;
  }
  const openCells=(P,state)=>{const a=attuned(P,state),out=[];for(let i=0;i<a.length;i++)if(!a[i]&&P.cells[i]>=0)out.push(i);return out;};
  // why c breaks the objective from state, in the objective's own words ('' if it does not)
  function breakReason(P,state,c){
    if(!breaks(P,state,c))return '';
    const obj=P.objective,r=apply(P,state,c),T=topology(P);
    if(obj.lead!=null&&!state.moves.length&&c!==obj.lead)return `Lead with ${title(obj.lead)}: the reaction only takes if ${title(obj.lead)} opens it`;
    if(obj.end!=null){
      const X=title(obj.end);
      if(r.done)return `${title(c)} would close the reaction, not ${X}: the sample only stabilises on ${X}`;
      if(!hasOpen(T,Uint8Array.from(r.state.abs),obj.end))return `Hold ${X} for last: taking it now leaves ${where(P,openCells(P,r.state))} with no ${X} to close on`;
      return `After ${title(c)} no line closes on ${X}: every ${X} group left would be swallowed before the end`;
    }
    return 'that breaks the objective';
  }
  // hint: the next move of the par line while the player is on it, otherwise the first move of the best line.
  // text speaks the objective.
  const samePrefix=(a,b)=>a.every((x,i)=>x===b[i]);
  function hint(P,state){
    if(done(P,state))return null;
    const k=state.moves.length,onLine=k<P.plan.length&&samePrefix(state.moves,P.plan);
    const s=solve(P,state),colour=onLine?P.plan[k]:s.plan[0],obj=P.objective,r=apply(P,state,colour);
    const gain=r.absorbed.length+r.resonance.length,left=onLine?P.plan.length-k:s.plan.length;
    let why;
    if(!s.met)why=`The objective can no longer be met here: ${title(colour)} (+${gain}) is the fastest way to a clean sample (${left} move${left===1?'':'s'}).`;
    else if(obj.lead!=null&&k===0)why=`Lead with ${title(obj.lead)}: the reaction only takes if ${title(obj.lead)} opens it.`;
    else if(obj.end!=null&&r.done)why=`${title(obj.end)} closes the reaction: this finishes the sample on the boss’s weakness.`;
    else{
      const tempt=obj.end!=null&&colour!==obj.end&&apply(P,state,obj.end).ok?breakReason(P,state,obj.end):'';
      why=`${title(colour)} (+${gain}) keeps a ${left}-move finish${obj.end!=null?` that closes on ${title(obj.end)}`:''}.`;
      if(tempt)why=`${tempt}. ${why}`;
      else if(obj.end!=null&&colour!==obj.end&&apply(P,state,obj.end).ok)why=`Hold ${title(obj.end)} for last: it closes the reaction. ${why}`;
    }
    return {colour,text:why};
  }
  // the fallback: greedy most-cells play that ignores the objective
  function auto(P){const plan=greedyObj(topology(P),absFor(P),[],false).plan,state=simulate(P,plan);return {state,plan,moves:plan.length};}

  // ---------- scoring ----------
  // one sample: removed (clean, objective met, within par+SLACK) or weakened (objective broken, or over the limit)
  function sampleResult(P,state,opts){
    const o=opts||{},moves=state.moves.length,met=!o.auto&&satisfies(clauses(P),state.moves),inLimit=moves<=P.limit;
    const removed=done(P,state)&&met&&inLimit;
    return {buff:P.buff,objective:objectiveText(P.objective),moves,par:P.par,limit:P.limit,met,auto:!!o.auto,
      outcome:removed?'removed':'weakened',atPar:removed&&moves<=P.par,weakness:removed&&P.objective.end!=null?P.objective.end:null};
  }
  // the round: perfect (all removed at par, no hints, not Relaxed), good (all removed), partial (some), failed (none)
  function roundTier(results,opts){
    const o=opts||{},removed=results.filter(r=>r.outcome==='removed').length;
    if(removed===results.length&&results.every(r=>r.atPar)&&!o.hints&&o.assist!=='relaxed')return 'perfect';
    if(removed===results.length)return 'good';
    return removed>0?'partial':'failed';
  }
  function roundOutput(R,results){
    const removed=results.filter(r=>r.outcome==='removed').map(r=>R.buffs[r.buff].name),weak=results.filter(r=>r.outcome==='weakened').map(r=>R.buffs[r.buff].name);
    const found=results.find(r=>r.weakness!=null);
    return `Boss buffs removed: ${removed.length?removed.join(', '):'none'}${weak.length?` · Weakened: ${weak.join(', ')}`:''} · Weakness found: ${found?title(found.weakness):'none'}`;
  }
  // nearMiss: the single concrete improvement for a finished sample, in the objective's words.
  // Walk the player's line; the first move that broke the objective, or after which the best finish got no closer.
  function nearMiss(P,state){
    const res=sampleResult(P,state),X=P.objective.end!=null?title(P.objective.end):null;
    if(res.atPar)return `Nothing left on the table: ${res.moves} moves is par, the proven minimum that meets “${res.objective}”.`;
    let s=initial(P);
    for(let k=0;k<state.moves.length;k++){
      const played=state.moves[k],here=solve(P,s),nx=apply(P,s,played).state;
      if(!here.met)break;
      const best=here.plan[0],total=k+here.plan.length,why=breakReason(P,s,played);
      const bestGain=(r=>r.absorbed.length+r.resonance.length)(apply(P,s,best));
      if(why)return `Move ${k+1}: ${why}. ${title(best)} (+${bestGain}) instead would have finished clean in ${total} moves${total<=P.par?' (par)':''}${X?`, closing on ${X}`:''}.`;
      const after=solve(P,nx);
      if(after.met&&k+1+after.plan.length>total&&best!==played)
        return `Move ${k+1}: ${title(best)} (+${bestGain}) instead of ${title(played)} would have finished in ${total} moves${total<=P.par?' (par)':''}${X?`, still closing on ${X}`:''}${here.plan.includes(played)?` — the ${title(played)} you took would have joined later with its own wave`:''}.`;
      s=nx;
    }
    if(!res.met)return `The objective “${res.objective}” was broken, so the buff is only weakened.`;
    return `Par was ${P.par}: ${res.moves-P.par} fewer moves would have removed the buff at par.`;
  }
  // ---------- motifs ----------
  // A fold maps a cell's centred coordinates onto one representative of its symmetry orbit, so any motif evaluated
  // on folded coordinates is exactly symmetric. Coordinates are half-integers (even board sizes), so no cell sits on an axis.
  const FOLDS={
    D4:{name:'eightfold',map:(a,b)=>{a=Math.abs(a);b=Math.abs(b);return a>=b?[a,b]:[b,a];}},
    C4:{name:'pinwheel',map:(a,b)=>{for(let k=0;k<3&&!(a>0&&b>0);k++)[a,b]=[-b,a];return [a,b];}},
    D2:{name:'mirrored',map:(a,b)=>[Math.abs(a),Math.abs(b)]},
    C2:{name:'half-turn',map:(a,b)=>b<0?[-a,-b]:[a,b]},
    MX:{name:'mirrored',map:(a,b)=>[Math.abs(a),b]}
  };
  const fl=Math.floor;
  // kind: base (partitions the board), split (only as the second motif, crossed with a base), overlay (shapes laid
  // over the base). make(r,s) returns a label function of folded coordinates (overlays return null outside the shape).
  const MOTIFS=[
    {id:'rings',name:'Rings',kind:'base',folds:ALL_FOLDS,make:(r,s)=>{const w=s/2/r.pick([2.4,2.8,3.2]);return (a,b)=>fl(Math.hypot(a,b)/w);}},
    {id:'diamonds',name:'Diamonds',kind:'base',folds:ALL_FOLDS,make:(r,s)=>{const w=s/r.pick([3.2,3.8,4.4]);return (a,b)=>fl((Math.abs(a)+Math.abs(b))/w);}},
    {id:'frames',name:'Frames',kind:'base',folds:ALL_FOLDS,make:(r,s)=>{const w=s/2/r.pick([2.5,3,3.5]);return (a,b)=>fl(Math.max(Math.abs(a),Math.abs(b))/w);}},
    {id:'spiral',name:'Spiral',kind:'base',folds:['C4','C2'],make:(r,s)=>{const m=r.pick([1,2]),pitch=s/r.pick([3,4]);return (a,b)=>fl(Math.atan2(b,a)/(Math.PI/2)*m+Math.hypot(a,b)/pitch);}},
    {id:'stripes',name:'Stripes',kind:'base',folds:['D2','MX','C2'],make:r=>{const [u,v]=r.pick([[1,0],[0,1],[1,1],[1,-1]]),w=r.pick([1.5,2,2.5])*(u&&v?1.4:1);return (a,b)=>fl((a*u+b*v)/w);}},
    {id:'chevrons',name:'Chevrons',kind:'base',folds:['MX','D2'],make:r=>{const w=r.pick([1.5,2,2.5]),k=r.pick([.6,1]);return (a,b)=>fl((Math.abs(a)*k+b)/w);}},
    {id:'checker',name:'Checker',kind:'base',folds:['D4','C4','D2','C2','MX'],make:r=>{const w=r.pick([2,3]);return (a,b)=>fl(a/w)*101+fl(b/w);}},
    {id:'plaid',name:'Plaid',kind:'base',folds:['D2','C2','MX'],make:r=>{const w1=r.pick([2,3]),w2=w1===2?3:2;return (a,b)=>fl(a/w1)*101+fl(b/w2);}},
    {id:'mosaic',name:'Mosaic',kind:'base',folds:['D4','C4','D2'],make:(r,s)=>{const pts=Array.from({length:r.range(3,5)},()=>[r.next()*s/2,r.next()*s/2]);
      return (a,b)=>{let best=0,bd=Infinity;pts.forEach((p,i)=>{const d=(a-p[0])**2+(b-p[1])**2;if(d<bd){bd=d;best=i;}});return best;};}},
    {id:'quadrants',name:'Quadrants',kind:'split',folds:['C2'],make:()=>(a,b)=>a>0?1:0},
    {id:'veins',name:'Veins',kind:'overlay',folds:['C4','C2','D2','MX'],make:(r,s)=>{
      const vs=Array.from({length:r.range(1,2)},()=>({off:(r.next()-.3)*s*.4,amp:1+r.next()*s/7,f:(1+r.next()*1.5)*Math.PI/s,ph:r.next()*6.3}));
      return (a,b)=>{for(let i=0;i<vs.length;i++){const v=vs[i];if(Math.abs(b-(v.off+v.amp*Math.sin(a*v.f+v.ph)))<.8)return i;}return null;};}},
    {id:'circles',name:'Circles',kind:'overlay',folds:['D4','C4','D2','C2','MX'],make:(r,s)=>{const R=s*(.12+r.next()*.07),d=s*(.18+r.next()*.14),e=s*(.08+r.next()*.2);return (a,b)=>Math.hypot(a-d,b-e)<R?0:null;}},
    {id:'crosses',name:'Crosses',kind:'overlay',folds:['D4','C4','D2','C2','MX'],make:(r,s)=>{const d=s*(.2+r.next()*.12),e=s*(.15+r.next()*.15),w=r.pick([.6,1.1]),l=s*(.13+r.next()*.07);
      return (a,b)=>(Math.abs(a-d)<w&&Math.abs(b-e)<l)||(Math.abs(b-e)<w&&Math.abs(a-d)<l)?0:null;}},
    {id:'triangles',name:'Triangles',kind:'overlay',folds:['C4','D2','MX','C2'],make:(r,s)=>{const c=s*(.1+r.next()*.1),h=s*(.22+r.next()*.1),d=s*r.next()*.2,k=.7+r.next()*.4;
      return (a,b)=>b>c&&b<c+h&&Math.abs(a-d)<(c+h-b)*k?0:null;}}
  ];
  const MOTIF_IDS=MOTIFS.map(m=>m.id);
  function pickMotifs(r,D){
    for(;;){
      const first=r.pick(MOTIFS.filter(m=>m.kind==='base')),second=r.chance(D.pair)?r.pick(MOTIFS.filter(m=>m!==first)):null;
      const folds=first.folds.filter(f=>D.folds.includes(f)&&(!second||second.folds.includes(f)));
      if(folds.length)return {first,second,fold:r.pick(folds)};
    }
  }
  // the board's pieces: connected cells sharing a motif label; the 2×2 core around the origin is its own piece
  function motifLayout(r,D,combo){
    const s=D.size,n=s*s,{first,second,fold}=combo,fA=first.make(r,s),fB=second&&second.make(r,s),map=FOLDS[fold].map,label=new Array(n);
    for(let i=0;i<n;i++){
      const cx=i%s-(s-1)/2,cy=((i/s)|0)-(s-1)/2;
      if(Math.abs(cx)<1&&Math.abs(cy)<1){label[i]='core';continue;}
      const [a,b]=map(cx,cy),p=fA(a,b);
      if(!fB)label[i]=String(p);
      else if(second.kind==='overlay'){const o=fB(a,b);label[i]=o==null?String(p):'o'+o;}
      else label[i]=p+'|'+fB(a,b);
    }
    const piece=new Int32Array(n).fill(-1),pieces=[];
    for(let i=0;i<n;i++){if(piece[i]>=0)continue;const id=pieces.length,list=[i];piece[i]=id;
      for(let k=0;k<list.length;k++)for(const j of nbOf(s,list[k]))if(piece[j]<0&&label[j]===label[i]){piece[j]=id;list.push(j);}
      pieces.push({label:label[i],cells:list,adj:new Set()});}
    for(let i=0;i<n;i++)for(const j of nbOf(s,i))if(piece[i]!==piece[j])pieces[piece[i]].adj.add(piece[j]);
    const ids=[first.id].concat(second?[second.id]:[]),name=[first.name].concat(second?[second.name]:[]).join(' × ');
    return {label,piece,pieces,motifs:ids,motif:name,symmetry:fold,core:piece[(s>>1)*s+(s>>1)]};
  }

  // ---------- generation ----------
  // cell-level run of a colour sequence: true if every rack cell ends reacted (pockets then close on their own)
  function runs(cells,s,crew,origin,seq){
    const n=s*s,inR=new Uint8Array(n),q=[origin];inR[origin]=1;const c0=cells[origin];
    for(let h=0;h<q.length;h++)for(const j of nbOf(s,q[h]))if(!inR[j]&&cells[j]===c0){inR[j]=1;q.push(j);}
    for(const c of seq)for(let h=0;h<q.length;h++)for(const j of nbOf(s,q[h]))if(!inR[j]&&cells[j]===c){inR[j]=1;q.push(j);}
    for(let i=0;i<n;i++)if(!inR[i]&&crew.has(cells[i]))return false;
    return true;
  }
  function colourSequence(r,palette,K){
    for(let t=0;t<200;t++){
      const moves=r.shuffle(palette.concat(Array.from({length:K-palette.length},()=>r.pick(palette)))),seq=[r.pick(palette)].concat(moves);
      if(seq.every((c,i)=>i===0||c!==seq[i-1]))return seq;
    }
    return null;
  }
  const REJECT={};const rej=k=>{REJECT[k]=(REJECT[k]||0)+1;return k;}; // rejected builds return a reason; REJECT tallies them
  // a board with its free (objective-less) par. must: an element the rack has to include (the boss's weakness).
  function tryBuild(r,D,seed,combo,must){
    const s=D.size,n=s*s;let order=r.shuffle([0,1,2,3,4,5]);
    if(must!=null&&order.indexOf(must)>=D.crew){order=order.filter(c=>c!==must);order.splice(r.int(D.crew),0,must);}
    const palette=order.slice(0,D.crew).sort((a,b)=>a-b),foreign=order.slice(D.crew).sort((a,b)=>a-b),crewSet=new Set(palette);
    const K=r.range(D.parRange[0]+1,D.parRange[1]+1),seq=colourSequence(r,palette,K);if(!seq)return rej('colours');
    const L=motifLayout(r,D,combo),{pieces,core}=L,np=pieces.length,origin=(s>>1)*s+(s>>1);
    const costOf=new Map();for(const p of pieces)if(!costOf.has(p.label))costOf.set(p.label,r.chance(D.cheap)?.5+r.next()*.5:1+r.next()*D.spread);
    const dist=new Float64Array(np).fill(Infinity),settled=new Uint8Array(np);dist[core]=0;
    for(;;){
      let b=-1;for(let i=0;i<np;i++)if(!settled[i]&&dist[i]<Infinity&&(b<0||dist[i]<dist[b]))b=i;
      if(b<0)break;settled[b]=1;
      for(const j of pieces[b].adj){const d=dist[b]+costOf.get(pieces[j].label);if(d<dist[j])dist[j]=d;}
    }
    const levels=[...new Set(Array.from(dist).filter((d,i)=>i!==core))].sort((a,b)=>a-b);
    if(levels.length<K)return rej('levels');
    const area=levels.map(v=>pieces.reduce((t,p,i)=>t+(i!==core&&dist[i]===v?p.cells.length:0),0)),cum=[];
    area.reduce((t,a)=>{cum.push(t+a);return t+a;},0);
    const cuts=[];
    for(let k=1,prev=-1;k<K;k++){
      const target=(n-4)*k/K*(.88+r.next()*.24);let best=-1;
      for(let j=prev+1;j<levels.length-(K-k);j++)if(best<0||Math.abs(cum[j]-target)<Math.abs(cum[best]-target))best=j;
      cuts.push(best);prev=best;
    }
    const wave=pieces.map((p,i)=>{if(i===core)return 0;const j=levels.indexOf(dist[i]);return 1+cuts.filter(c=>j>c).length;});
    const final=wave.map((w,i)=>i!==core&&pieces[i].cells.length<D.minPiece?Math.min(...[...pieces[i].adj].map(j=>wave[j])):w);
    const cw=new Int8Array(n);pieces.forEach((p,i)=>{for(const c of p.cells)cw[c]=final[i];});
    for(let round=0;round<3;round++){
      const lone=[];for(let i=0;i<n;i++)if(nbOf(s,i).every(j=>seq[cw[j]]!==seq[cw[i]]))lone.push([i,Math.min(...nbOf(s,i).map(j=>cw[j]))]);
      if(!lone.length)break;if(round===2)return rej('lone');for(const [i,w] of lone)cw[i]=w;
    }
    {const area=new Array(K+1).fill(0);for(let i=0;i<n;i++)area[cw[i]]++;if(area.slice(1).some(a=>a<Math.max(3,D.minGain*n)))return rej('thin');}
    const cells=Array.from(cw,w=>seq[w]);
    if(!runs(cells,s,crewSet,origin,seq.slice(1)))return rej('runs');
    const ok=()=>runs(cells,s,crewSet,origin,seq.slice(1));
    const pocketLabels=[...new Set(pieces.map(p=>p.label))].filter(l=>l!=='core'&&pieces.every(p=>p.label!==l||(p.cells.length>=2&&p.cells.length<=D.pocketMax&&!p.adj.has(core))));
    for(const l of r.shuffle(pocketLabels).slice(0,D.pockets)){
      const list=pieces.filter(p=>p.label===l).flatMap(p=>p.cells),old=list.map(i=>cells[i]),f=r.pick(foreign);
      list.forEach(i=>cells[i]=f);if(!ok()||lonely(cells,s))list.forEach((i,k)=>cells[i]=old[k]);
    }
    if(must!=null&&!cells.includes(must))return rej('no-weakness');
    const P={game:'aether-attunement',seed,difficulty:D.id,size:s,cells,palette,foreign,origin,motif:L.motif,motifs:L.motifs,symmetry:L.symmetry};
    const T=topology(P);
    if(T.pockets.some(p=>!p.adj.length))return rej('pocket');
    let free;try{free=exactPlan(T,absFor(P),EXACT_BUDGET);if(!free)return rej('unsolvable');}catch(e){if(e!==ABORT)throw e;return rej('budget');}
    if(free.length<D.parRange[0]-1||free.length>D.parRange[1])return rej('free-par');
    const fl=widestLine(T,absFor(P),free.length,LINE_BUDGET*4);if(!fl)return rej('budget');
    Object.assign(P,{freePar:free.length,freePlan:fl.plan});
    return P;
  }
  // the objective gates; returns the sample with its objective par line, or a rejection reason
  function fitObjective(P,D,obj){
    const T=topology(P),abs=absFor(P),cl=clausesOf(obj),n=P.size*P.size;
    if(obj.end!=null&&!P.palette.includes(obj.end)||obj.lead!=null&&!P.palette.includes(obj.lead))return 'rack';
    let p;try{p=exactObj(T,abs,cl,0,EXACT_BUDGET);}catch(e){if(e!==ABORT)throw e;return 'budget';}
    if(!p)return 'impossible';
    if(p.length<D.parRange[0]||p.length>D.parRange[1])return 'par'+p.length;
    if(satisfies(cl,P.freePlan))return 'same-line'; // the objective must change the par line
    const line=widestObj(T,abs,cl,0,p.length,LINE_BUDGET*4);if(!line)return 'budget';
    const floor=Math.max(3,Math.round(D.minGain*n));
    if(Math.min(...line.gains.slice(0,-1))<floor||line.gains[line.gains.length-1]<3)return 'gain';
    // every move before the last is a real choice: two or more reagents touch the reaction (the other may be the trap)
    {let a=abs;for(let k=0;k<p.length-1;k++){if(T.palette.filter(c=>step(T,a,c)).length<2)return 'forced';a=step(T,a,line.plan[k]).abs;}}
    const careful=greedyObj(T,abs,cl,true);
    if(careful.met&&careful.plan.length<=p.length)return 'greedy'; // a careful greedy player must not reach par
    const plain=greedyObj(T,abs,[],false);plain.met=satisfies(cl,plain.plan); // ignores the objective while playing
    if(plain.met&&plain.plan.length<=p.length)return 'greedy'; // nor may plain greedy play stumble onto it at par
    return {objective:obj,par:p.length,limit:p.length+SLACK,plan:line.plan,gains:line.gains,
      greedy:{moves:careful.plan.length,met:careful.met},plainGreedy:{moves:plain.plan.length,met:plain.met},solver:'exact'};
  }
  // isolated cells: same-colour groups of exactly one cell
  function lonely(cells,s){let k=0;for(let i=0;i<s*s;i++)if(cells[i]>=0&&nbOf(s,i).every(j=>cells[j]!==cells[i]))k++;return k;}
  const singles=P=>lonely(P.cells,P.size)/(P.size*P.size);
  // Objective kinds kept: endOn, leadWith, and leadEnd (both). Cut, from measurement: Never twice (par is about the
  // rack size, so every optimal line already uses each element once: it changed the par line on 0 of 160 boards and
  // careful greedy reached par on 145); Spare Y (every rack-colour group must be applied to join, so a board with any
  // Y tissue could never be cleaned without Y).
  function candidates(r,P,kind,weakness){
    const others=r.shuffle(P.palette.filter(c=>c!==weakness));
    if(kind==='endOn')return (weakness!=null?[weakness]:r.shuffle(P.palette)).map(x=>({kind,end:x}));
    if(kind==='leadWith')return others.map(y=>({kind,lead:y}));
    return weakness==null?[]:others.map(y=>({kind,lead:y,end:weakness}));
  }
  function generateSample(seed,D,index,kind,weakness){
    const mr=Kit.rng(Kit.hashSeed(`aether-attunement:${seed}:${D.id}:${index}:motif`));
    for(let round=0;round<60;round++){
      const combo=pickMotifs(mr,D);let shapeless=0;
      for(let attempt=0;attempt<120&&shapeless<12;attempt++){
        const r=Kit.rng(Kit.hashSeed(`aether-attunement:${seed}:${D.id}:${index}:${round}:${attempt}`));
        const P=tryBuild(r,D,seed,combo,kind==='leadWith'?null:weakness);
        if(typeof P!=='object'){shapeless=P==='levels'||P==='thin'?shapeless+1:0;continue;}
        shapeless=0;
        for(const obj of candidates(r,P,kind,weakness)){
          const f=fitObjective(P,D,obj);
          if(typeof f==='object'){Object.assign(P,f,{index,attempt:round*120+attempt});return P;}
          rej(kind+':'+f);
        }
      }
    }
    throw new Error(`No ${D.id} ${kind} sample ${index} for seed ${seed}`);
  }
  // a round: one boss, D.buffs buffs shown, one sample per entry of D.samples, each targeting buff k
  function generate(seed,difficulty){
    const D=diff(difficulty),r=Kit.rng(Kit.hashSeed(`aether-attunement:${seed}:${D.id}:boss`));
    const boss=r.pick(BOSSES),buffs=r.shuffle(boss.buffs).slice(0,D.buffs).map(([name,text])=>({name,text}));
    const samples=[];let weakness=null;
    D.samples.forEach((kind,k)=>{const P=generateSample(seed,D,k,kind,weakness);P.buff=k;if(weakness==null&&P.objective.end!=null)weakness=P.objective.end;samples.push(P);});
    return {game:'aether-attunement',seed,difficulty:D.id,boss:{id:boss.id,name:boss.name,origin:boss.origin,role:boss.role},buffs,samples,weakness};
  }

  const api={ELEMENTS,GLYPHS,BOSSES,SLACK,DIFFICULTIES,ASSIST_LEVELS,EXACT_BUDGET,
    generate,generateSample,singles,MOTIFS,MOTIF_IDS,FOLDS,topology,initial,apply,preview,attuned,done,absorbable,simulate,
    clauses,clausesOf,satisfies,objectiveText,objectiveStatus,breaks,breakReason,solve,hint,auto,
    sampleResult,roundTier,roundOutput,nearMiss,where,title,
    _internal:{REJECT,step,lower,exactPlan,widestLine,beamPlan,greedyPlan,absFor,planFrom,visibleGain,runs,
      exactObj,widestObj,feasibleObj,greedyObj,allowed,tryBuild,fitObjective,pickMotifs}};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.AetherAttunement=api;
})(typeof globalThis==='object'?globalThis:this);
