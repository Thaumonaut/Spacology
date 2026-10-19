(function(root){
  'use strict';
  const pieces={
    cell:{name:'Power cell',short:'P',shape:[[0,0],[1,0]],power:3,color:'#e7c18b',text:'Supplies 3 power to touching components. No combat effect alone.'},
    lens:{name:'Ranging lens',short:'L',shape:[[0,0],[1,0],[0,1]],color:'#a5e0c9',text:'Connect to a sequencer to widen every second direct action.'},
    sequencer:{name:'Sequencer',short:'S',shape:[[0,0],[1,0]],color:'#92b9e4',text:'Triggers the lens. Needs power and contact with the lens.'},
    bore:{name:'Bore assembly',short:'B',shape:[[0,0],[1,0],[2,0]],color:'#e6a48d',text:'Connect to a relay to recover Aether from breaks this wearer helps produce.'},
    relay:{name:'Charge relay',short:'C',shape:[[0,0],[0,1]],color:'#92b9e4',text:'Completes break, poison or healing mechanisms. One relay cannot run two mechanisms simultaneously.'},
    vessel:{name:'Culture vessel',short:'V',shape:[[0,0],[1,0],[1,1]],color:'#b8cf8b',text:'Connect to a relay to gain Aether from this wearer’s poison ticks.'},
    plate:{name:'Catch plate',short:'G',shape:[[0,0],[1,0],[0,1]],color:'#a5e0c9',text:'Connect to a spring to retaliate when this wearer absorbs a hit.'},
    spring:{name:'Return spring',short:'R',shape:[[0,0],[1,0]],color:'#e6a48d',text:'Completes the barrier retaliation mechanism.'},
    bell:{name:'Recovery bell',short:'H',shape:[[0,0],[1,0],[1,1]],color:'#b8cf8b',text:'Connect to a relay to advance an ally after substantial recovery.'}
  };
  const recipes=[
    {id:'volley',name:'Alternating volley',parts:['lens','sequencer'],draw:2,flag:'volley',text:'Every second direct action reaches one extra enemy. Area skills already cover all targets.',compatible:c=>!c.aoe},
    {id:'break',name:'Break recycler',parts:['bore','relay'],draw:2,flag:'breakRefund',text:'An allied break restores 1 Aether if the wearer contributed shield damage since the last reform.',compatible:c=>c.attack>0},
    {id:'dot',name:'Culture loop',parts:['vessel','relay'],draw:2,flag:'poisonRefund',text:'When the wearer’s poison ticks, restore 1 Aether, once per enemy turn.',compatible:c=>!!c.dot},
    {id:'counter',name:'Absorption return',parts:['plate','spring'],draw:2,flag:'barrierReturn',text:'An enemy hit absorbed by this wearer triggers 8 retaliation damage. Requires barriers from the team.',compatible:()=>true},
    {id:'heal',name:'Recovery relay',parts:['bell','relay'],draw:2,flag:'healAdvance',text:'Healing an ally from below 75% to at least 75% HP advances them by 15 AV.',compatible:c=>!!c.heal}
  ];
  const scenarios=[
    {id:'coverage',name:'Coverage or fuel?',engine:'hypercarry',owner:'Silen',encounter:1,blocked:[[3,0],[0,3]],stock:['cell','lens','sequencer','bore','relay','cell'],goal:'The swarm has four targets. Fit a powered lens + sequencer for Silen. Can you keep a second powered mechanism without wasting cells?'},
    {id:'reform',name:'A shield that comes back',engine:'break',owner:'Wren',encounter:3,blocked:[[0,0],[3,3]],stock:['cell','bore','relay','lens','sequencer','cell'],goal:'Reforming shields create repeated breaks, but skills need Aether. Assemble a break recycler. The extra power cell competes with useful components for space.'},
    {id:'exposure',name:'Make the incoming hit useful',engine:'counter',owner:'Reva',encounter:2,blocked:[[3,0],[3,1]],stock:['cell','plate','spring','lens','sequencer','cell'],goal:'Protect Reva with Ilka, then connect a plate + spring on Reva. Decide whether widening attacks is worth another power cell and less spare space.'},
    {id:'culture',name:'One relay, two possible jobs',engine:'dot',owner:'Nour',encounter:4,blocked:[[1,1],[2,2]],stock:['cell','vessel','relay','bell','lens','sequencer'],goal:'The charge relay can complete poison recovery or a healer’s recovery relay, but cannot serve both. Choose a wearer and a mechanism for area pressure.'}
  ];
  function cells(shape,rotation=0){let out=shape.map(([x,y])=>[x,y]);for(let i=0;i<((rotation%4)+4)%4;i++)out=out.map(([x,y])=>[-y,x]);const x=Math.min(...out.map(p=>p[0])),y=Math.min(...out.map(p=>p[1]));return out.map(p=>[p[0]-x,p[1]-y]);}
  function footprint(state,placement){return cells(pieces[state.inventory[placement.index]].shape,placement.rotation).map(([x,y])=>[x+placement.x,y+placement.y]);}
  function create(scenario=0){const s=scenarios[scenario];if(!s)throw new Error('Unknown puzzle');return {version:1,scenario,width:4,height:4,blocked:s.blocked.map(p=>p.slice()),inventory:s.stock.slice(),placements:[],owner:s.owner,priority:recipes.map(r=>r.id),enemyAdvance:s.engine==='counter'||s.engine==='dot'};}
  function validate(state,p){if(!Number.isInteger(p.index)||!pieces[state.inventory[p.index]]||![p.x,p.y,p.rotation].every(Number.isInteger))return 'Select a component and a board cell.';const occupied=state.placements.filter(q=>q.index!==p.index).flatMap(q=>footprint(state,q));for(const [x,y] of footprint(state,p)){if(x<0||y<0||x>=state.width||y>=state.height)return 'The piece extends beyond the board.';if(state.blocked.some(q=>q[0]===x&&q[1]===y))return 'That cell is blocked.';if(occupied.some(q=>q[0]===x&&q[1]===y))return 'Components cannot overlap.';}return null;}
  function place(state,p){const error=validate(state,p);if(error)return error;state.placements=state.placements.filter(q=>q.index!==p.index).concat({...p});return null;}
  function remove(state,index){state.placements=state.placements.filter(p=>p.index!==index);}
  function touches(state,a,b){return footprint(state,a).some(([x,y])=>footprint(state,b).some(([xx,yy])=>Math.abs(x-xx)+Math.abs(y-yy)===1));}
  function evaluate(state,character){
    const powered=new Set(state.placements.filter(p=>pieces[state.inventory[p.index]].power).map(p=>p.index));let changed=true;while(changed){changed=false;state.placements.forEach(p=>{if(!powered.has(p.index)&&state.placements.some(q=>powered.has(q.index)&&touches(state,p,q))){powered.add(p.index);changed=true;}});}
    // Separate connected islands have separate budgets; a remote cell cannot power another island.
    const component=new Map(),budgets=[];for(const p of state.placements){if(component.has(p.index))continue;const group=[p];component.set(p.index,budgets.length);for(let i=0;i<group.length;i++)state.placements.forEach(q=>{if(!component.has(q.index)&&touches(state,group[i],q)){component.set(q.index,budgets.length);group.push(q);}});budgets.push(group.reduce((sum,q)=>sum+(pieces[state.inventory[q.index]].power||0),0));}
    const used=new Set(),status=[],effects={},ordered=state.priority.map(id=>recipes.find(r=>r.id===id)).filter(Boolean);
    for(const r of ordered){const left=state.placements.filter(p=>state.inventory[p.index]===r.parts[0]),right=state.placements.filter(p=>state.inventory[p.index]===r.parts[1]);let reason='Missing component',pair=null;
      if(left.length&&right.length){reason='Parts must share an edge';for(const a of left)for(const b of right){if(!touches(state,a,b))continue;reason='Connect the mechanism to a power cell';if(!powered.has(a.index)||!powered.has(b.index))continue;reason='Wearer cannot use this mechanism';if(!r.compatible(character))continue;reason='A component is already used by a higher-priority mechanism';if(used.has(a.index)||used.has(b.index))continue;reason='Not enough power in this connected island';if(budgets[component.get(a.index)]<r.draw)continue;pair=[a,b];}}
      if(pair){pair.forEach(p=>used.add(p.index));budgets[component.get(pair[0].index)]-=r.draw;effects[r.flag]=true;status.push({id:r.id,active:true,reason:'Active',parts:pair.map(p=>p.index)});}else status.push({id:r.id,active:false,reason});
    }
    return {effects,status,powered:[...powered],usedCells:state.placements.reduce((s,p)=>s+footprint(state,p).length,0),supply:state.placements.reduce((s,p)=>s+(pieces[state.inventory[p.index]].power||0),0),draw:status.filter(s=>s.active).reduce((s,v)=>s+recipes.find(r=>r.id===v.id).draw,0)};
  }
  function solutions(state,recipe,character,limit=1000){
    // Enumerate placements for one mechanism and one power cell; no combat heuristics.
    const r=recipes.find(r=>r.id===recipe);if(!r||!r.compatible(character))return [];
    const ids=['cell',...r.parts].map(id=>state.inventory.indexOf(id));if(ids.some(i=>i<0))return [];
    const work={...state,placements:[],priority:[recipe,...state.priority.filter(id=>id!==recipe)]},out=[];
    function visit(depth){if(out.length>=limit)return;if(depth===ids.length){if(evaluate(work,character).effects[r.flag])out.push(work.placements.map(p=>({...p})));return;}
      const index=ids[depth],seen=new Set();for(let rotation=0;rotation<4;rotation++){const shape=JSON.stringify(cells(pieces[state.inventory[index]].shape,rotation).slice().sort());if(seen.has(shape))continue;seen.add(shape);for(let y=0;y<state.height;y++)for(let x=0;x<state.width;x++){const p={index,x,y,rotation};if(!validate(work,p)){work.placements.push(p);visit(depth+1);work.placements.pop();}}}}
    visit(0);return out;
  }
  const api={pieces,recipes,scenarios,cells,footprint,create,validate,place,remove,touches,evaluate,solutions};if(typeof module==='object'&&module.exports)module.exports=api;else root.EquipmentPuzzle=api;
})(typeof globalThis==='object'?globalThis:this);
