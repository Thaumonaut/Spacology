(function(root){
  'use strict';
  const node=typeof module==='object'&&module.exports;
  const K=node?require('../../shared/minigames/minigame-kit.js'):root.MiniGameKit;
  const A=node?require('../aether-attunement/aether-attunement-model.js'):root.AetherAttunement;
  const ELEMENTS=A.ELEMENTS,GLYPHS=A.GLYPHS;
  const OPPOSITE={order:'chaos',chaos:'order',growth:'decay',decay:'growth',energy:'void',void:'energy'};
  const FAMILIES=[['order','chaos'],['growth','decay'],['energy','void']];
  const DIRECTIONS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const COLS=8,ROWS=24,VISIBLE_ROWS=8,OPENING=36,BATCH_SIZE=36,RESERVES=4;
  const compatible=(a,b)=>ELEMENTS.includes(a)&&ELEMENTS.includes(b)&&(a===b||OPPOSITE[a]===b);
  const remaining=s=>s.cells.filter(v=>v!==null).length;

  function inspect(s,a,b){
    if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=s.cells.length||b>=s.cells.length||s.cells[a]===null||s.cells[b]===null)return {ok:false,reason:'Choose two occupied cells.'};
    if(a===b)return {ok:false,reason:'Choose a second element.'};
    const ar=Math.floor(a/s.cols),ac=a%s.cols,br=Math.floor(b/s.cols),bc=b%s.cols,dr=br-ar,dc=bc-ac;
    const paths=[];
    if(dr===0||dc===0||Math.abs(dr)===Math.abs(dc)){
      const sr=Math.sign(dr),sc=Math.sign(dc),steps=Math.max(Math.abs(dr),Math.abs(dc)),path=[];
      for(let k=1;k<steps;k++)path.push((ar+k*sr)*s.cols+ac+k*sc);
      paths.push({path,line:dr===0?'row':dc===0?'column':'diagonal'});
    }
    const from=Math.min(a,b),to=Math.max(a,b);
    if(dr!==0)paths.push({path:Array.from({length:to-from-1},(_,k)=>from+k+1),line:'wrap'});
    const clear=paths.find(({path})=>path.every(i=>s.cells[i]===null));
    if(!clear){const blocker=paths[0].path.find(i=>s.cells[i]!==null);return {ok:false,reason:paths[0].line==='wrap'?'Another element blocks the wrapped horizontal line.':'Another element blocks that sightline.',blocker};}
    if(!compatible(s.cells[a],s.cells[b]))return {ok:false,reason:'Match the same element or its opposite.',...clear};
    return {ok:true,...clear,kind:s.cells[a]===s.cells[b]?'equal':'opposite'};
  }

  function visible(s,a){
    const row=Math.floor(a/s.cols),col=a%s.cols,rows=s.cells.length/s.cols,out=[];
    for(const [dr,dc] of DIRECTIONS){
      for(let r=row+dr,c=col+dc;r>=0&&r<rows&&c>=0&&c<s.cols;r+=dr,c+=dc){
        const b=r*s.cols+c;
        if(s.cells[b]!==null){out.push(b);break;}
      }
    }
    for(const step of [-1,1])for(let b=a+step;b>=0&&b<s.cells.length;b+=step)if(s.cells[b]!==null){out.push(b);break;}
    return [...new Set(out)];
  }
  function pairs(s){
    const out=[];
    s.cells.forEach((v,a)=>{if(v!==null)for(const b of visible(s,a))if(b>a&&compatible(v,s.cells[b]))out.push([a,b]);});
    return out;
  }
  function sightlines(s,a){
    if(!Number.isInteger(a)||a<0||a>=s.cells.length||s.cells[a]===null)return [];
    return visible(s,a).map(target=>({target,...inspect(s,a,target)}));
  }
  function status(s){
    if(!remaining(s))return 'won';
    if(pairs(s).length)return 'playing';
    return s.used<RESERVES?'stuck':'lost';
  }
  function collapse(s,cells){
    const next=[],clearedRows=[],shifts=[];
    for(let first=0;first<cells.length;first+=s.cols){
      const row=cells.slice(first,first+s.cols);
      if(row.every(id=>id===null)&&s.cells.slice(first,first+s.cols).some(id=>id!==null)){
        clearedRows.push(first/s.cols);
      }else{
        const start=next.length;
        row.forEach((id,col)=>{if(id!==null&&start!==first)shifts.push({from:first+col,to:start+col});});
        next.push(...row);
      }
    }
    while(next.length<cells.length)next.push(null);
    return {cells:next,clearedRows,shifts};
  }
  function match(s,a,b){
    const check=inspect(s,a,b);
    if(!check.ok)return {...check,state:s};
    const cells=s.cells.slice();cells[a]=null;cells[b]=null;
    const result=collapse(s,cells);
    return {...check,clearedRows:result.clearedRows,shifts:result.shifts,state:{...s,cells:result.cells,moves:s.moves+1,lines:(s.lines||0)+result.clearedRows.length}};
  }
  function deal(p,s){
    if(!remaining(s))return {ok:false,reason:'The board is already clear.',state:s};
    if(s.used>=p.batches.length)return {ok:false,reason:'All four reserve batches have been used.',state:s};
    const first=s.cells.findLastIndex(v=>v!==null)+1,capacity=s.rows?s.rows*s.cols:null;
    if(capacity&&first+p.batches[s.used].length>capacity)return {ok:false,reason:'There is no room for that batch.',state:s};
    const cells=s.cells.slice(0,first).concat(p.batches[s.used]);
    while(cells.length%s.cols)cells.push(null);
    if(capacity)while(cells.length<capacity)cells.push(null);
    return {ok:true,first,state:{...s,cells,used:s.used+1,moves:s.moves+1}};
  }

  function makeBoard(random){
    const size=OPENING+BATCH_SIZE*RESERVES,cells=Array(COLS*ROWS).fill(null),witness=[],identities=[],timeline=[];
    let state={cols:COLS,cells:cells.map((_,i)=>i<size?i:null)},previous=new Set();
    while(remaining(state)){
      const edges=[];
      state.cells.forEach((id,a)=>{if(id===null)return;for(const b of visible(state,a))if(b>a){
        const dr=Math.floor(b/COLS)-Math.floor(a/COLS),dc=Math.abs(b%COLS-a%COLS),gap=dr===0||dc===0||dr===dc?Math.max(dr,dc)-1:b-a-1;
        edges.push({a,b,gap,ids:[id,state.cells[b]],key:[id,state.cells[b]].sort((x,y)=>x-y).join(':')});
      }});
      const unlocked=edges.filter(edge=>edge.gap>0&&!previous.has(edge.key)),long=edges.filter(edge=>edge.gap>0),pool=unlocked.length?unlocked:long.length?long:edges;
      const chosen=witness.length?random.pick(pool):edges.find(edge=>edge.a===OPENING-1&&edge.b===OPENING);
      timeline.push(edges);witness.push([chosen.a,chosen.b]);identities.push(chosen.ids);
      previous=new Set(edges.map(edge=>edge.key));
      const next=state.cells.slice();next[chosen.a]=null;next[chosen.b]=null;state={cols:COLS,cells:collapse(state,next).cells};
    }
    // Penalise incidental matches throughout the solution, not just on the opening.
    const owner=Array(size),neighbors=witness.map(()=>new Map());
    identities.forEach((pair,k)=>pair.forEach(i=>owner[i]=k));
    const connect=(a,b,weight)=>{const x=owner[a],y=owner[b];if(x===y)return;neighbors[x].set(y,(neighbors[x].get(y)||0)+weight);neighbors[y].set(x,(neighbors[y].get(x)||0)+weight);};
    timeline.forEach(edges=>edges.forEach(edge=>connect(...edge.ids,edge.gap?1:3)));
    const initial={cols:COLS,cells:cells.map((_,i)=>i<OPENING?i:null)};
    initial.cells.forEach((id,a)=>{if(id!==null)for(const b of visible(initial,a))if(b>a)connect(id,initial.cells[b],5000);});
    const links=neighbors.map(map=>[...map]);let colors,bestColors,bestCost=Infinity;
    const cost=(k,color)=>links[k].reduce((sum,[other,weight])=>sum+(colors[other]===color?weight:0),0);
    for(let attempt=0;attempt<8;attempt++){
      colors=witness.map(()=>random.int(FAMILIES.length));
      for(let pass=0;pass<12;pass++)for(const k of random.shuffle(witness.map((_,i)=>i))){
        const costs=FAMILIES.map((_,color)=>cost(k,color)),best=Math.min(...costs);
        colors[k]=random.pick(costs.flatMap((value,color)=>value===best?[color]:[]));
      }
      const counts=FAMILIES.map((_,color)=>identities.reduce((n,pair,k)=>n+(colors[k]===color?pair.filter(i=>i<OPENING).length:0),0));
      // Odd family totals require reserve material, regardless of opening move order.
      if(counts.every(n=>n%2===0)){
        const bridges=identities.flatMap((pair,k)=>pair.filter(i=>i<OPENING).length===1?[k]:[]),choices=[];
        for(const k of bridges)for(let color=0;color<FAMILIES.length;color++)if(color!==colors[k])choices.push({k,color,cost:cost(k,color)-cost(k,colors[k])});
        const best=Math.min(...choices.map(choice=>choice.cost)),choice=random.pick(choices.filter(choice=>choice.cost===best));
        colors[choice.k]=choice.color;
      }
      const score=colors.reduce((sum,color,k)=>sum+cost(k,color),0);
      if(score<bestCost){bestCost=score;bestColors=colors.slice();}
    }
    colors=bestColors;
    for(let k=0;k<witness.length;k++)for(const i of identities[k])cells[i]=random.pick(FAMILIES[colors[k]]);
    return {cells,witness};
  }
  function generate(seed){
    const full=makeBoard(K.rng(seed));
    return {version:3,seed:Number(seed)>>>0,cols:COLS,rows:ROWS,initial:full.cells.slice(0,OPENING),batches:Array.from({length:RESERVES},(_,k)=>full.cells.slice(OPENING+k*BATCH_SIZE,OPENING+(k+1)*BATCH_SIZE)),witness:full.witness};
  }
  function start(p){return {cols:p.cols,rows:p.rows,cells:p.initial.concat(Array(p.cols*p.rows-p.initial.length).fill(null)),used:0,moves:0,lines:0};}
  const api={ELEMENTS,GLYPHS,OPPOSITE,FAMILIES,COLS,ROWS,VISIBLE_ROWS,OPENING,BATCH_SIZE,RESERVES,compatible,remaining,inspect,visible,sightlines,pairs,status,match,deal,generate,start};
  if(node)module.exports=api;else root.ElementPairs=api;
})(typeof globalThis==='object'?globalThis:this);
