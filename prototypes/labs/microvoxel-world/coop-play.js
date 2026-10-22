(function(root){
  'use strict';
  // Co-op supply-line client: hosts the session (solo or online) or joins one, renders the seat's view and drives crew by phase.
  const C=root.CoopSession,N=root.CoopNet,ROLE_NAME={explore:'Exploration',research:'Research',logistics:'Logistics'},SPEED=2.4;
  function create(lab){
    const $=id=>document.getElementById(id);
    let mode='off',session=null,transport=null,view=null,chosen='explore',crewState={tour:null,id:'',i:0,dwell:0},status='';
    const net=new URLSearchParams(location.search).get('coopNet')==='local'?'local':'peerjs';
    const config=()=>{const w=lab.world();return {seed:w.seed,cell:w.cell,extent:w.extent};};
    function publish(){
      if(!session)return;view=session.viewFor('host');
      if(transport)for(const id of players)transport.send(id,{t:'view',view:session.viewFor(id)});
      render();lab.changed();
    }
    const players=new Set();
    function onHostMessage(m){
      const id=m.from;
      if(m.t==='hello'){players.add(id);session.join(id);transport.send(id,{t:'config',config:config()});}
      else if(m.t==='claim'){const e=session.claim(id,m.role);if(e)transport.send(id,{t:'error',error:e});}
      else if(m.t==='intent'){const e=session.intent(id,m.intent);if(e)transport.send(id,{t:'error',error:e});}
      else if(m.t==='ready'){const e=session.ready(id,m.ready);if(e)transport.send(id,{t:'error',error:e});}
      else if(m.t==='bye'){players.delete(id);session.leave(id);}
      publish();
    }
    function onGuestMessage(m){
      if(m.t==='config'){const c=m.config,w=lab.world();if(c.seed!==w.seed||c.cell!==w.cell||c.extent!==w.extent)lab.regenerate(c.seed,c.cell,c.extent);transport.send('host',{t:'claim',role:chosen});}
      else if(m.t==='view'){view=m.view;if(view.role)chosen=view.role;render();lab.changed();}
      else if(m.t==='error')setStatus(m.error);
      else if(m.t==='closed'){setStatus('The host closed the room.');stop(false);}
    }
    function setStatus(s){status=s;$('coopStatus').textContent=s;}
    async function start(kind,code){
      stop(false);setStatus(kind==='join'?'Joining room…':kind==='host'?'Opening room…':'');
      if(kind!=='join'){session=C.createSession(lab.world(),root.HexAtlas.createAtlas(lab.world()));session.claim('host',chosen);}
      if(kind==='solo'){mode='solo';publish();lab.focus(chosen);return;}
      const room=kind==='host'?N.code():N.normalise(code);if(!room){setStatus('Enter a room code.');session=null;return;}
      transport=N.createTransport(net,room,kind==='host');
      try{await transport.ready;}catch(e){setStatus(e.message+' Solo play is still available.');transport=null;session=null;mode='off';render();return;}
      mode=kind==='host'?'host':'guest';
      if(mode==='host'){transport.on(onHostMessage);setStatus('Room open. Share the code with teammates.');publish();}
      else{transport.on(onGuestMessage);transport.send('host',{t:'hello'});setStatus('Connected.');}
      $('coopRoom').textContent='ROOM '+room;lab.focus(chosen);render();
    }
    function stop(user=true){
      if(transport){if(mode==='guest')transport.send('host',{t:'bye'});transport.close();}
      transport=null;session=null;view=null;players.clear();mode='off';$('coopRoom').textContent='';if(user)setStatus('');render();lab.changed();
    }
    function send(t,payload){
      if(mode==='guest'){transport.send('host',{t,...payload});return;}
      if(!session)return;const e=t==='claim'?session.claim('host',payload.role):t==='intent'?session.intent('host',payload.intent):session.ready('host',payload.ready);
      if(e)setStatus(e);else setStatus('');publish();
    }
    const act=intent=>send('intent',{intent});
    function claim(role){chosen=role;for(const b of document.querySelectorAll('[data-role]'))b.setAttribute('aria-pressed',String(b.dataset.role===role));if(mode!=='off'){send('claim',{role});lab.focus(role);}}
    const entry=key=>view?.hexes.find(h=>h.key===key);
    const TYPE={ramp:'switchback ramp',cutting:'cutting',bridge:'bridge'};
    function actions(key){
      const h=entry(key);if(!view||!h||view.ready)return [];const {role,phase}=view;
      if(role==='logistics'&&phase!=='dusk'&&['barrier-known','crossing'].includes(h.state))return h.options.map(o=>h.crossing?.type===o.type?{label:`Cancel ${TYPE[o.type]}`,intent:{kind:'cross',key,type:o.type}}
        :{label:o.price===null?`Cutting needs sound rock`:`Build ${TYPE[o.type]} (${o.price} pts)`,disabled:o.price===null||!!view.crossing?.progress,intent:{kind:'cross',key,type:o.type}});
      const a=action(key);return a?[a]:[];
    }
    function action(key){
      const h=entry(key);if(!view||!h||view.ready)return null;const {role,phase}=view,t=k=>({label:k,intent:{kind:'toggle',key}});
      if(role==='explore'&&phase==='night'&&h.state==='barrier')return t('Scout edge (cost 1)');
      if(role==='explore'&&phase==='night'&&['frontier','hinted','planned'].includes(h.state))return t(h.state==='planned'?'Remove from survey':`Plan survey (cost ${h.barrier?1:Math.ceil(h.cost)})`);
      if(role==='research'&&phase==='day'&&h.state==='rock-sample')return t('Study rock sample');
      if(role==='research'&&phase==='night'&&['signs','hinted'].includes(h.state))return t(h.state==='hinted'?'Remove hint':'Mark as hint for Exploration');
      if(role==='research'&&phase==='day'&&['needs-sample','studying'].includes(h.state))return t(h.state==='studying'?'Stop studying':'Study sample');
      if(role==='logistics'&&phase==='day'&&['usable','planned'].includes(h.state)){const p=view.profiles.find(p=>p.key===key);return t(h.state==='planned'?'Cancel extractor':`Claim + extractor (${p?.lineYield??'?'}/day)`);}
      return null;
    }
    function describe(key){
      const h=entry(key);if(!h)return 'Not in your role’s knowledge yet.';
      const p=view.role==='logistics'?view.profiles.find(p=>p.key===key):null,known=view.role==='research'?(view.identified.find(i=>i.key===key)):null;
      const res=p?` · ${p.name}, yield ${p.yield}${p.route!=null?`, route cost ${p.route}`:''}`:known?` · ${known.name}, yield ${known.yield}`:h.resource&&h.state!=='frontier'&&h.state!=='planned'?` · ${h.resource}`:'';
      if(h.barrier&&!h.crossed){const rate=h.rating?`rock ${h.rating}`:view.role==='explore'?'rock unknown':'rock unrated';
        return `HEX ${h.q}, ${h.r} · ${h.biome} · impassable ${h.terrain}${h.span?`, span ${h.span} m`:''} · ${rate}${h.crossing?` · ${TYPE[h.crossing.type]} ${h.crossing.progress}/${h.crossing.price} pts`:''}`;}
      return `HEX ${h.q}, ${h.r} · ${h.biome}${h.crossed?` · ${TYPE[h.crossed]} built`:''} · travel cost ${h.crossed?C.TRAVEL[h.crossed]:h.cost}${res}`;
    }
    function brief(){
      const v=view,phase=v.phase,role=v.role;
      if(!role)return 'Choose a free role.';
      if(phase==='dusk')return 'Dusk: hand-offs delivered. Read the report, then Ready for night.';
      if(role==='explore')return phase==='night'?`Tap frontier hexes to plan tomorrow’s survey; hatched cliffs and gorges can only be scouted (1 supply each). Planned cost ${v.planCost} · supplies ${v.supplies}${v.planCost>v.supplies?' (Logistics’ packing decides at dawn how far crew get)':''}.`
        :`Crew are surveying ${v.crew.survey.length} hex${v.crew.survey.length===1?'':'es'}${v.dawn?.dropped?` (${v.dawn.dropped} dropped: not enough supplies)`:''}. Lead samples go to Research at dusk.`;
      if(role==='research')return phase==='night'?`Mark up to 2 frontier hexes with geology signs as hints (${v.hints.length}/2). Exploration sees them at dawn.`
        :`Study up to 2 samples (${v.study.length}/2) · ${v.samples.length} waiting · ${v.hexes.filter(h=>h.state==='rock-sample').length} rock · ${v.identified.length} identified. Results go to Logistics at dusk.`;
      return phase==='night'?`Pack supplies for tomorrow’s survey: ${v.packed} packed. Packing 8 costs 1 of tomorrow’s 3 build points.${crossingText(v)}`
        :`${v.points} build points (extractor costs 2). Tap an identified resource to claim it and route it to camp. ${v.profiles.filter(p=>!p.connected).length} unconnected.${crossingText(v)}`;
    }
    const crossingText=v=>v.crossing?` Building ${TYPE[v.crossing.type]}: ${v.crossing.progress}/${v.crossing.price} pts; spare points go to it.`:v.barriers.length?` ${new Set(v.barriers.map(b=>b.key)).size} scouted barrier(s) can be crossed.`:'';
    function render(){
      const on=mode!=='off'&&!!view;$('coopStart').hidden=mode!=='off';$('coopGame').hidden=!on;
      if(!on)return;
      $('coopPhase').textContent=`DAY ${view.day} · ${view.phase.toUpperCase()} · TARGET ${view.target}`;
      $('coopBrief').textContent=brief();
      $('coopSeats').textContent=C.ROLES.map(r=>`${ROLE_NAME[r]}: ${view.seats[r]}`).join(' · ')+(view.waiting.length?` · waiting for ${view.waiting.map(r=>ROLE_NAME[r]).join(', ')}`:'');
      $('coopPack').hidden=!(view.role==='logistics'&&view.phase==='night');
      for(const b of document.querySelectorAll('[data-pack]'))b.setAttribute('aria-pressed',String(Number(b.dataset.pack)===view.packed));
      $('coopReady').textContent=view.ready?'Unready':'Ready';$('coopReady').disabled=!view.role;
      const r=view.report;$('coopReport').textContent=r?`Day ${r.day}: delivered ${r.delivered} / ${r.target} · ${r.met?'target met':`short by ${r.shortfall}`} · ${r.lines.map(l=>`${l.name} ${l.yield}`).join(', ')}${r.scouted?` · ${r.scouted} edge(s) scouted`:''}${r.rated?` · ${r.rated} rock rated`:''}${r.crossing?` · ${TYPE[r.crossing.type]} ${r.crossing.done?'complete':`${r.crossing.progress}/${r.crossing.price}`}`:''}`:'';
      $('coopReport').hidden=!r;
    }
    function update(dt,crew,atlas){
      if(!view)return false;const camp=atlas.camp,targets=[];
      const centre=k=>{const [q,r]=k.split(',').map(Number);return atlas.center(q,r);};
      const survey=view.phase==='day'?view.crew.survey:[];
      // Crew walk hex-by-hex along passable routes; an unfinished barrier is approached only to its edge.
      const walk=path=>{if(!path)return [];const pts=path.map(centre),n=pts.length-1,end=entry(path[n]);if(n>0&&(end?end.barrier&&!end.crossed:view.role!=='explore'))pts[n]={x:(pts[n].x+pts[n-1].x)/2,z:(pts[n].z+pts[n-1].z)/2};return pts;};
      const id=view.day+':'+survey.join('|');
      if(survey.length&&crewState.id!==id){crewState={id,i:0,dwell:0,tour:survey.flatMap(k=>{const p=walk(view.crew.paths?.[k]);if(!p.length)p.push(centre(k));p[p.length-1].dwell=1.2;return [...p,...p.slice(0,-1).reverse()];}).concat([camp])};}
      if(survey.length){const t=crewState.tour[crewState.i];targets[0]=crewState.dwell>0?null:t;}else{crewState.id='';targets[0]={x:camp.x-1,z:camp.z};}
      const site=view.phase==='day'?walk(view.crew.buildPath||view.crew.crossingPath):[];targets[1]=site.length?site[site.length-1]:{x:camp.x+1,z:camp.z};
      crew.forEach((a,n)=>{
        a.task=null;a.carrying=null;a.walking=false;
        if(n===0&&crewState.dwell>0){crewState.dwell-=dt;if(crewState.dwell<=0)crewState.i=(crewState.i+1)%crewState.tour.length;}
        const t=targets[n];if(t){const dx=t.x-a.x,dz=t.z-a.z,d=Math.hypot(dx,dz),s=SPEED*dt;if(d>.05){a.walking=true;a.yaw=Math.atan2(dx,dz);if(d<=s){a.x=t.x;a.z=t.z;}else{a.x+=dx/d*s;a.z+=dz/d*s;}}else if(n===0&&survey.length){if(t.dwell)crewState.dwell=t.dwell;else crewState.i=(crewState.i+1)%crewState.tour.length;}}
        a.y=lab.world().ground(a.x,a.z)??0;
      });
      return true;
    }
    $('coopSolo').onclick=()=>start('solo');$('coopHost').onclick=()=>start('host');$('coopJoin').onclick=()=>start('join',$('coopCode').value);
    const panel=$('coop'),fold=$('coopFold');
    function setFolded(f){panel.classList.toggle('folded',f);fold.setAttribute('aria-expanded',String(!f));fold.setAttribute('aria-label',(f?'Expand':'Collapse')+' co-op panel');fold.textContent=f?'+':'–';}
    fold.onclick=()=>setFolded(!panel.classList.contains('folded'));
    setFolded(innerHeight<760||innerWidth<700);
    $('coopReady').onclick=()=>view&&send('ready',{ready:!view.ready});$('coopLeave').onclick=()=>stop();
    for(const b of document.querySelectorAll('[data-role]'))b.onclick=()=>claim(b.dataset.role);
    for(const b of document.querySelectorAll('[data-pack]'))b.onclick=()=>act({kind:'pack',supplies:Number(b.dataset.pack)});
    const api={get active(){return mode!=='off'&&!!view;},hexes:()=>view?.hexes??[],action,actions,describe,act,update,stop,start,claim,
      snapshot:()=>({mode,role:view?.role??null,day:view?.day??null,phase:view?.phase??null,ready:view?.ready??false,folded:panel.classList.contains('folded'),view:view&&JSON.parse(JSON.stringify(view)),session:session?.snapshot()??null,room:$('coopRoom').textContent,status}),
      ready:flag=>send('ready',{ready:flag})};
    render();return api;
  }
  root.CoopPlay={create};
})(globalThis);
