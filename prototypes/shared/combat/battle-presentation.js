/* ============ particles ============ */
var PX={cv:null,ctx:null,bl:null,blx:null,list:[],raf:null,dpr:1,W:0,H:0,canFilter:false};
function $(i){return document.getElementById(i)}
function rf(e){void e.offsetWidth}
function dens(){return +$('rDens').value/100}
function hexHSL(h){var r=parseInt(h.slice(1,3),16)/255,g=parseInt(h.slice(3,5),16)/255,
  b=parseInt(h.slice(5,7),16)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),H=0,S=0,L=(mx+mn)/2,d=mx-mn;
  if(d){S=L>.5?d/(2-mx-mn):d/(mx+mn);
    H=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);H*=60;}
  return {h:H,s:Math.round(S*100),l:Math.round(L*100)};}
function pxInit(){ PX.cv=$('pcv'); if(!PX.cv) return;
  PX.ctx=PX.cv.getContext('2d');
  PX.bl=document.createElement('canvas'); PX.blx=PX.bl.getContext('2d');
  try{var p=document.createElement('canvas').getContext('2d');p.filter='blur(2px)';
    PX.canFilter=(p.filter==='blur(2px)');}catch(e){}
  pxResize(); }
function pxResize(){ if(!PX.cv) return;
  var r=$('floats').getBoundingClientRect();
  PX.dpr=Math.min(3,window.devicePixelRatio||1); PX.W=r.width; PX.H=r.height;
  PX.cv.width=Math.round(r.width*PX.dpr); PX.cv.height=Math.round(r.height*PX.dpr);
  PX.ctx.setTransform(PX.dpr,0,0,PX.dpr,0,0);
  PX.bl.width=Math.max(1,Math.round(r.width*.5)); PX.bl.height=Math.max(1,Math.round(r.height*.5));
  PX.blx.setTransform(.5,0,0,.5,0,0); }
function pxAdd(o){ if(!PX.ctx) pxInit(); if(!PX.ctx) return;
  o.seed=Math.random()*6.28;
  if(o.color&&o.color.charAt(0)==='#'&&o.type!=='text'&&o.type!=='tag') o.hsl=hexHSL(o.color);
  o.age=0;o.vx=o.vx||0;o.vy=o.vy||0;o.g=o.g===undefined?.16:o.g;
  o.drag=o.drag===undefined?.995:o.drag;o.rot=o.rot||0;o.vr=o.vr||0;
  PX.list.push(o); if(!PX.raf){PX.lastTime=undefined;PX.raf=requestAnimationFrame(pxStep);} }
function pxClear(){ PX.lastTime=undefined;PX.list.length=0; if(PX.ctx) PX.ctx.clearRect(0,0,PX.W,PX.H);
  if(PX.raf){cancelAnimationFrame(PX.raf);PX.raf=null;} }
function pxCol(o){ if(!o.hsl) return o.color;
  var k=o.age/o.life;
  var h=(o.hsl.h+Math.sin(k*5.4+o.seed)*46+k*60+360)%360;
  return 'hsl('+h.toFixed(0)+','+Math.min(100,o.hsl.s+14)+'%,'+
    Math.min(78,o.hsl.l+Math.sin(k*8+o.seed)*8).toFixed(0)+'%)'; }
function pxStep(now){ var c=PX.ctx; if(!c){PX.raf=null;return;}
  now=typeof now==='number'?now:performance.now();
  var elapsed=PX.lastTime===undefined?16.7:Math.max(0,Math.min(100,now-PX.lastTime)),frame=elapsed/16.7;PX.lastTime=now;
  var bloom=+$('rBloom').value;
  c.clearRect(0,0,PX.W,PX.H); if(PX.blx) PX.blx.clearRect(0,0,PX.W,PX.H);
  var keep=[];
  for(var i=0;i<PX.list.length;i++){ var o=PX.list[i];
    o.age+=elapsed; if(o.delay&&o.age<o.delay){keep.push(o);continue;}
    var t=o.age-(o.delay||0); if(t>o.life) continue;
    o.vy+=o.g*frame;o.vx*=Math.pow(o.drag,frame);o.vy*=Math.pow(o.drag,frame);o.x+=o.vx*frame;o.y+=o.vy*frame;o.rot+=o.vr*frame;
    var k=t/o.life;
    var readable=o.type==='text'||o.type==='tag',fade=readable?.82:.66;
    o.a=Math.max(0,Math.min(1,k<.04?k/.04:k>fade?1-(k-fade)/(1-fade):1));
    o.col=pxCol(o); pxDraw(c,o,t,false);
    if(bloom&&PX.blx&&o.type!=='tag') pxDraw(PX.blx,o,t,true);
    keep.push(o); }
  PX.list=keep;
  if(bloom&&PX.blx&&PX.bl.width>1){ c.save();
    c.globalCompositeOperation='lighter'; c.globalAlpha=Math.min(1,bloom/15);
    if(PX.canFilter) c.filter='blur('+bloom+'px)';
    c.setTransform(PX.dpr,0,0,PX.dpr,0,0); c.drawImage(PX.bl,0,0,PX.W,PX.H);
    c.filter='none'; c.restore(); c.setTransform(PX.dpr,0,0,PX.dpr,0,0); }
  PX.raf=PX.list.length?requestAnimationFrame(pxStep):null; }
function pxDraw(c,o,t,bl){ c.save(); c.globalAlpha=o.a*(bl?.85:1);
  if(bl) c.globalCompositeOperation='lighter';
  c.translate(o.x,o.y); if(o.rot) c.rotate(o.rot);
  var col=o.col||o.color;
  if(o.type==='text'){ var pop=t<90?1+.2*(1-t/90):1; c.scale(pop,pop);
    c.font='800 '+o.size+'px ui-sans-serif,-apple-system,sans-serif';
    c.textAlign='center';c.textBaseline='middle';
    if(!bl){c.shadowColor='#000';c.shadowBlur=5;c.shadowOffsetY=2;c.strokeStyle='#071018';c.lineWidth=5;c.lineJoin='round';c.strokeText(o.text,0,0);}
    c.fillStyle=col;c.fillText(o.text,0,0);
  } else if(o.type==='tag'){
    c.font='750 '+o.size+'px ui-sans-serif,-apple-system,sans-serif';
    c.textAlign='center';c.textBaseline='middle';
    var w=c.measureText(o.text).width+18,h=o.size+12;
    c.shadowColor='rgba(0,0,0,.75)';c.shadowBlur=5;c.fillStyle='rgba(10,16,21,.82)';
    rnd(c,-w/2,-h/2,w,h,7);c.fill();
    c.shadowBlur=0;c.strokeStyle=col;c.lineWidth=1;rnd(c,-w/2,-h/2,w,h,7);c.stroke();
    c.fillStyle=col;c.fillText(o.text,0,.5);
  } else if(o.type==='shard'){ c.fillStyle=col;
    if(!bl){c.shadowColor=col;c.shadowBlur=7;} c.fillRect(-o.w/2,-o.h/2,o.w,o.h);
  } else if(o.type==='spark'){ c.strokeStyle=col;c.lineWidth=1.6;c.lineCap='round';
    if(!bl){c.shadowColor=col;c.shadowBlur=8;}
    c.beginPath();c.moveTo(0,0);c.lineTo(-o.vx*2.6,-o.vy*2.6);c.stroke();
  } else { c.fillStyle=col; if(!bl){c.shadowColor=col;c.shadowBlur=6;}
    c.beginPath();c.arc(0,0,o.r*(bl?1.5:1),0,6.2832);c.fill(); }
  c.restore(); }
function rnd(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);
  c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}

function floatPos(id){ var host=$('floats'); if(!host) return null;
  var el=$('sc-'+id)||$('r-'+id); if(!el) return null;
  var r=el.getBoundingClientRect(),h=host.getBoundingClientRect();
  if(!r.width) return null;
  return {x:r.left-h.left+r.width/2,y:r.top-h.top+r.height/2,H:h.height,W:h.width}; }
var fslot={};
function floater(id,txt,c,opt){ opt=opt||{};
  if(MODE==='none') return;
  var p=floatPos(id); if(!p) return;
  var now=Date.now();
  if(!fslot[id]||now-fslot[id].t>900) fslot[id]={n:0,t:now};
  var n=fslot[id].n++; fslot[id].t=now;
  var dir=p.y<p.H*.22?1:-1, col=(n%3)-1,row=Math.floor(n/3)%3;
  pxAdd({type:opt.tag?'tag':'text',text:String(txt),color:c,size:opt.tag?15:Math.max(32,opt.size||0),
    x:p.x+col*(opt.tag?28:42), y:p.y+dir*((opt.tag?52:24)+row*32)+(opt.offsetY||0),
    vx:col*.18, vy:dir*.65,
    g:0, drag:.98,
    rot:0, vr:0,
    life:1000, delay:opt.delay||0}); }
function burstAt(id,c,n,spread){
  if(MODE==='none') return;
  var p=floatPos(id); if(!p) return;
  n=Math.max(0,Math.round(n*dens())); if(!n) return;
  var pow=(spread||60)/60;
  for(var k=0;k<n;k++){ var a=(Math.PI*2*k/n)+(Math.random()-.5)*.7,sp=(2.2+Math.random()*3.4)*pow;
    pxAdd({type:'shard',color:c,w:2+Math.random()*4,h:2+Math.random()*5,
      x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,g:.19,drag:.965,
      rot:Math.random()*3,vr:Math.random()*.34-.17,life:420+Math.random()*300}); }
  for(var q=0;q<Math.round(n*.7);q++){ var a2=Math.random()*6.2832,s2=(1+Math.random()*2.2)*pow;
    pxAdd({type:'mote',color:c,r:1+Math.random()*1.8,x:p.x,y:p.y,
      vx:Math.cos(a2)*s2,vy:Math.sin(a2)*s2-.6,g:.06,drag:.98,life:520+Math.random()*420}); }
  for(var z=0;z<Math.round(n*.45);z++){ var a3=Math.random()*6.2832,s3=(4+Math.random()*4)*pow;
    pxAdd({type:'spark',color:c,x:p.x,y:p.y,vx:Math.cos(a3)*s3,vy:Math.sin(a3)*s3,
      g:.22,drag:.94,life:240+Math.random()*180}); } }

/* ============ state ============ */
var G=null, MODE='full', playing=false, busy=false, chain=[], sessionAutoTimer=null;
function at(ms,f){chain.push(setTimeout(f,ms))}
function clr(){chain.forEach(clearTimeout);chain=[];}
function tr(e,ms,tf){e.style.transition='all '+ms+'ms '+(tf||'ease')}
function fz(e){e.style.transition='none'}
function tempo(){return +$('rTempo').value/100}
function D(ms){ if(MODE==='none') return 0;
  return Math.round(ms*(MODE==='quick'?.45:1)/tempo()); }

function paintTreasure(){
  var el=$('treasureBattle');if(!el)return;
  el.hidden=!G.treasureInfo;
  if(!G.treasureInfo)return;
  var carrier=U('treasure');
  el.textContent=G.treasureStatus==='collected'?'✦ TREASURE SECURED · cache saved':G.treasureStatus==='escaped'?'✦ CARRIER ESCAPED':
    '✦ TREASURE · escapes in '+Math.max(0,Math.ceil(carrier.escapeAt-G.av))+' AV · '+(window.SPACOLOGY_SESSION.treasureOrder==='mission'?'mission first':'pursuing');
}
var CREW_PORTRAITS={Tarn:'../assets/crew/tarn-v1.webp',Ash:'../assets/crew/ash-v1.webp',Quill:'../assets/crew/quill-v1.webp',Maul:'../assets/crew/maul-v1.webp',Bosk:'../assets/crew/bosk-v1.webp',Coda:'../assets/cast/coda-v2.png',Morrow:'../assets/crew/morrow-v1.webp',Spore:'../assets/crew/spore-v1.webp'};
Object.keys(SpacologyExpedition.crew).forEach(function(name){
  var portrait=SpacologyExpedition.crew[name].portrait;
  if(portrait)CREW_PORTRAITS[name]=portrait;
});
Object.keys(SpacologyExpedition.summons||{}).forEach(function(name){
  var portrait=SpacologyExpedition.summons[name].portrait;
  if(portrait)CREW_PORTRAITS[name]=portrait;
});
function applyCrewPortrait(el,u){if(u.side==='ally'&&CREW_PORTRAITS[u.n]){el.classList.add('crew-portrait');el.style.setProperty('--card-art','url("'+CREW_PORTRAITS[u.n]+'")');if(!window.SPACOLOGY_SESSION)el.style.backgroundImage='linear-gradient(180deg,rgba(4,8,12,.18),rgba(4,8,12,.78)),url("'+CREW_PORTRAITS[u.n]+'")'}}
var ENEMY_PORTRAITS={Chaff:'../assets/enemies/chaff-v1.webp',Bruiser:'../assets/enemies/bruiser-v1.webp',Warden:'../assets/enemies/warden-v1.webp',Cleanser:'../assets/enemies/cleanser-v1.webp',Reflector:'../assets/enemies/reflector-v1.webp',Anchor:'../assets/enemies/anchor-v1.webp',Bulwark:'../assets/enemies/bulwark-v1.webp',Quickstep:'../assets/enemies/quickstep-v1.webp'};
var FACTION_PORTRAITS={ossuary:'../assets/factions/ossuary-cathedral-v1.png',mycelial:'../assets/factions/mycelial-ninefold-v1.png',glasswake:'../assets/factions/glasswake-serein-v1.png',tideworn:'../assets/factions/tideworn-bell-v1.png',tannhul:'../assets/factions/tannhul-rookback-v1.png',custodian:'../assets/factions/custodian-curator-v1.png',redaction:'../assets/factions/redaction-kindly-voice-v1.png'};
function applyEnemyPortrait(el,u){
  var name=u.archetypeName||u.n.replace(/^Prime /,'');
  var catalogue=window.SpacologyEnemyCatalogue;
  var typeArt=catalogue&&catalogue.ARCHETYPE_PORTRAITS[u.factionId]&&catalogue.ARCHETYPE_PORTRAITS[u.factionId][u.archetype];
  var art=u.portrait||typeArt||ENEMY_PORTRAITS[name]||FACTION_PORTRAITS[u.factionId];
  if(u.side==='foe'&&art){el.classList.add('enemy-portrait');el.style.setProperty('--card-art','url("'+art+'")');if(!window.SPACOLOGY_SESSION)el.style.backgroundImage='linear-gradient(180deg,rgba(4,8,12,.12),rgba(4,8,12,.8)),url("'+art+'")'}
}
function log(t,c){ var d=document.createElement('div'); if(c)d.className=c;
  d.innerHTML=t; $('log').appendChild(d); $('log').scrollTop=$('log').scrollHeight; }

/* ============ ribbons ============ */
function ribbons(){
  var fc=G.units.filter(function(u){
    return u.side==='foe'&&(u.alive||(!u.retired&&u.retiring))}).length;
  var fr=$('foes');
  // enemies always read as one line, however many there are
  fr.className='ribbon'+(fc>7?' tighter':fc>4?' tight':'');
  fr.style.gridTemplateColumns='repeat('+Math.max(1,fc)+',minmax(0,1fr))';
  [['foes','foe',null],['crewFront','ally','front'],['crewBack','ally','back']]
   .forEach(function(p){
    var host=$(p[0]); host.innerHTML='';
    if(p[0]==='crewBack')host.classList.toggle('summon-packed',G.units.filter(function(u){return u.side==='ally'&&u.row==='back'}).length>7);
    G.units.filter(function(u){
      return u.side===p[1] && (!p[2]||u.row===p[2])
        && (u.side==='ally' || u.alive || (!u.retired&&u.retiring)); }).forEach(function(u){
      var d=document.createElement('div'); d.className='rc holo'+(u.elite?' elite':'')+(u.treasure?' treasure-carrier':''); d.id='r-'+u.id;
      applyCrewPortrait(d,u);
      applyEnemyPortrait(d,u);
      d.innerHTML=(u.treasure?'<span class="treasure-badge" aria-label="Bonus treasure">✦</span>':'')+'<div class="rn">'+u.n+'</div>'+
        (u.side==='foe'?'<div class="wk" id="wk-'+u.id+'"></div>'
          :'<div class="re" style="color:'+EL[u.e]+'">'+u.e+'</div>')+
        '<div class="rb"><b></b><i></i></div>'+
        (u.side==='foe'?'<div class="sq" id="rq-'+u.id+'"><u></u></div>'+
          '<div class="rt" id="rt-'+u.id+'"></div>'+
          '<div class="fr" id="fr-'+u.id+'"></div>'+
          '<div class="sv" id="sv-'+u.id+'"></div>'
         :'<div class="rt" style="color:'+(u.hurt?'#E88888':'var(--ink3)')+'">'+
            (u.summon?'J3K SUPPORT':u.hurt?'recovering':(AIMODE==='profile'?u.p:(u.heal?'mender':'')))+'</div>'+
            '<div class="bar2" id="bar-'+u.id+'"><u></u></div>'+
            '<div class="en" id="en-'+u.id+'"><u></u></div>');
      if(window.SPACOLOGY_SESSION){
        var art=document.createElement('div');art.className='battle-art';art.setAttribute('aria-hidden','true');
        var footer=document.createElement('div');footer.className='card-footer';
        ['.rn','.rb','.sq','.bar2','.en'].forEach(function(selector){var node=d.querySelector(selector);if(node)footer.appendChild(node)});
        d.prepend(art);d.appendChild(footer);
      }
      if(u.side==='foe'){
        d.setAttribute('role','button');d.tabIndex=0;d.setAttribute('aria-label','Inspect '+u.n);
        d.onclick=function(){inspectEnemy(u.id)};
        d.onkeydown=function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();inspectEnemy(u.id);}};
      }
      host.appendChild(d); }); }); }
var inspectionWasPlaying=false;
function inspectEnemy(id){
  var u=U(id);if(!u||u.side!=='foe')return;
  if(u.boss){openBattleDetails('<h2 id="enemyDetailTitle">'+u.n+' · Phase '+u.phase+'</h2><p>At 50% health, shield strength drops 40% and attack damage rises 35%. Existing Breaks and status effects persist. Every third attack deals 1.8× damage, announced one attack ahead.</p><p>Recovery comes from boss damage (80%) and defeating it (20%).</p><p>'+u.hp+' / '+u.max+' HP · '+u.dmg+' attack damage.</p>');return;}
  if(u.treasure){openBattleDetails('<h2 id="enemyDetailTitle">Treasure carrier</h2><p>'+u.factionName+' · '+u.archetypeName+'</p><p>Optional, non-attacking hoarder. Defeat it for bonus gold, rare equipment and a Tier II or III Treasure cache. It escapes after 240 AV or when this wave is cleared.</p><p>'+Math.max(0,Math.ceil(u.escapeAt-G.av))+' AV until escape · '+Math.max(0,u.hp)+' / '+u.max+' HP.</p><p>It awards no recovery points and never blocks a wave or mission completion. Pursue treasure focuses direct attacks; mission first leaves it to incidental AoE damage.</p>');return;}
  var summonInfo=SpacologyEnemySummoning.isSummoner(u)?'Spends its turn calling one weaker faction enemy, then attacks on the following turn. '+(SpacologyEnemySummoning.MAX_CALLS-(u.summonCalls||0))+' calls remaining. Break or defeat it to stop the call. A full enemy row makes it attack instead; the call is saved. Summons never summon others.':u.enemyMinion?'Called reinforcement: a weaker attacker with one shield layer. It cannot summon. It must be defeated to clear the wave, but grants no additional recovery points.':null;
  var traitInfo=SpacologyEnemyTraits.type(u);
  var behavior=(traitInfo?'<b>'+traitInfo.name+'</b> · '+traitInfo.description+'<br>Healers automatically cleanse an ally with a status effect; healing ultimates cleanse the crew. Poison, burn and bleed deal damage over time (DoT). Bombs explode after a delay. These timers advance after scheduled turns, not extra turns, ultimates or follow-up attacks. Status effects clear when crew are downed. <br>Intent: '+SpacologyEnemyTraits.labels(u,G.units):null)||summonInfo|| (u.haste?'Each damaging hit while shielded grants +'+Math.round(u.haste*100)+'% speed, up to +'+Math.round(u.haste*u.hasteCap*100)+'%. Breaking its shield clears this speed bonus.':
    u.cleanse?'Sheds '+u.cleanse+' Fracture stacks before each attack.':
    u.trait==='Fast'?'Short waits between attacks. Can act between slower crew members.':
    u.shMax>1?'Multiple shield layers reduce incoming damage until fully broken. Match its weaknesses to strip them faster.':'A regular attacker. Match its weaknesses to break its shield.');
  var taxonomy=u.factionName?'<p><b>'+u.factionName+'</b> · '+u.archetypeName+(u.specimenName?' · field name '+u.specimenName:'')+' · '+u.bodyPlan+'. '+u.material+' adapted with '+u.adaptation+'.</p><p><b>Null state:</b> '+u.nullStage+' — '+u.nullSymptom+'. <b>Faction rule:</b> '+u.factionRule+'.</p>':'';
  openBattleDetails('<h2 id="enemyDetailTitle">'+(u.typeName||u.n)+(u.elite?' · Elite':'')+'</h2>'+taxonomy+'<p>'+behavior+'</p><dl><dt>Health</dt><dd>'+Math.round(G.visualHP?.[u.id]??u.hp)+' / '+u.max+'</dd><dt>Attack damage</dt><dd>'+u.dmg+'</dd><dt>Speed</dt><dd>'+u.sp+'</dd><dt>Shield remaining</dt><dd>'+(u.broken?0:Math.max(0,(u.shL-1)*shieldCapacity(u)+u.shC))+' / '+u.shMax*shieldCapacity(u)+'</dd><dt>Weaknesses</dt><dd>'+u.weak.join(', ')+'</dd>'+(u.frac?'<dt>Fracture</dt><dd>'+u.frac+' stacks · +'+(u.frac*12)+'% damage taken</dd>':'')+(u.survey?'<dt>Marks</dt><dd>'+u.survey+'</dd>':'')+'</dl><p><b>Recovery:</b> reforms its full shield and attacks on the same turn. A break delays its next turn by '+Math.round((window.SPACOLOGY_SESSION?OPS_RECOVERY:BRK.delay)*100)+'% of its normal wait and increases damage taken by 35%. Four Assay crew deny two turns before recovery.</p><p>Battle paused; the current animation may finish.</p>');
}
$('enemyDetails').addEventListener('close',function(){if(inspectionWasPlaying&&G&&!G.over&&!playing)$('bPlay').click();inspectionWasPlaying=false;});
function openBattleDetails(html){
  var dialog=$('enemyDetails');if(dialog.open)return;
  inspectionWasPlaying=playing||!!sessionAutoTimer;
  cancelSessionAutostart();playing=false;$('bPlay').textContent='Play';$('hState').textContent='paused';
  $('enemyDetailBody').innerHTML=html;dialog.showModal();
}
function paintRecovery(){
  if(!G)return;
  var recovery=currentRecovery(),node=$('recoveryProgress');
  node.style.setProperty('--recovery-color',recovery.integrity>=0?'#8fe0c1':'#efbd68');
  $('recoveryPercent').textContent=Math.floor(recovery.percent)+'%';
  $('recoveryFill').style.width=recovery.percent+'%';
  $('recoveryDelta').textContent=signedIntegrity(projectedIntegrity(recovery))+' integrity';
  $('recoveryNext').textContent=recovery.next?recovery.next.points+' pts to '+signedIntegrity(recovery.next.delta)+' · '+recovery.next.minimum+'%':'All waves recovered';
  node.setAttribute('aria-label',Math.floor(recovery.percent)+'% recovered. '+signedIntegrity(projectedIntegrity(recovery))+' integrity if battle ends now. View scoring.');
}
$('recoveryProgress').onclick=function(){
  var score=currentRecovery();
  openBattleDetails('<h2 id="enemyDetailTitle">Recovery thresholds</h2><p>'+score.earned+' / '+score.total+(OPS_NODE&&OPS_NODE.format==='boss'?' boss recovery points. Damage contributes up to 80 points; defeating the boss awards the final 20. Healing cannot remove earned progress.':' enemy points recovered across <b>every wave</b>. Chaff: 1 point; other regular enemies: 2; elites: 4. Points count when an enemy is defeated, not damaged.')+'</p><dl>'+SpacologyRecovery.bands.map(function(b){return '<dt>'+b.minimum+'%'+(b.minimum===88?' · no loss':'')+'</dt><dd>'+signedIntegrity(b.delta)+(b.minimum===100?' / +5 with observation':'')+' integrity</dd>';}).join('')+'</dl><p><b>If battle ends now: '+signedIntegrity(projectedIntegrity(score))+' integrity.</b> At 88% you lose nothing, even if time expires. Full recovery is +2, or +5 when the observation is complete. Integrity stays between 0 and 100.</p>');
};
function paintDeadline(){
  var remaining=Math.max(0,G.limit*100-G.av),left=Math.ceil(remaining/100),urgent=left<=1;
  $('battleDeadline').classList.toggle('urgent',urgent);
  $('deadlineLabel').textContent=remaining===0?'EXTRACTION':urgent?'FINAL ROUND':'ROUND '+G.round+' / '+G.limit;
  var displayLeft=G.recoveryAV?Math.ceil(remaining/10)/10:left;
  $('deadlineRemaining').textContent=displayLeft;
  $('deadlineBudget').textContent='Advances: '+Math.round(G.advanceSaved||0)+' AV'+(G.recoveryAV?' · Recovery: −'+G.recoveryAV+' AV':'');
  $('deadlineRemaining').setAttribute('aria-label',displayLeft+' rounds remaining, including this round');
  $('deadlineBar').max=100;$('deadlineBar').value=remaining?Math.min(remaining,100-G.av%100):0;
}
$('battleDeadline').onclick=function(){
  openBattleDetails('<h2 id="enemyDetailTitle">Win before extraction</h2><p>Each round spans <b>100 Action Value (AV)</b> on this turn order. The round markers keep moving regardless of who acts. At the final marker the battle ends.</p><p><b>Speed</b> shortens the wait between turns. <b>Action advances</b> pull a crewmate ahead of the next marker, fitting more attacks into the same rounds. Ultimates and follow-ups resolve without spending another turn. Enemy delays give you safer attack windows; they do not add rounds.</p><p>With Recover enabled, a downed crew member returns at 50% health and the deadline moves 50 AV closer. Recovery does not advance anyone else’s turn. Last Stand is an alternative setting. Back-row crew remain untargetable.</p><p>Animation speed and pausing never spend rounds. '+(G.allyTurns||0)+' crew turns so far; '+(G.advances||0)+' advances have removed '+Math.round(G.advanceSaved||0)+' AV of waiting. This is combined crew waiting saved, not extra battle time.</p>');
};
function paintAll(){ paintTreasure();paintDeadline();paintRecovery();paintAether();G.units.forEach(function(u){ paintUnit(u) });
  $('hRound').textContent=G.round; $('hMax').textContent=G.limit;
  $('hMax').style.color=G.limit<MAXROUND?'#E88':'';
  var objective=document.querySelector('.session-objective');
  if(objective&&window.SPACOLOGY_SESSION){var goal=SpacologyExpedition.goal(window.SPACOLOGY_SESSION);var progress=goal.metric==='safeWins'?0:Math.min(goal.battleTarget,G[goal.metric]||0);objective.querySelector('b').textContent=goal.name.toUpperCase()+' · '+progress+' / '+goal.battleTarget;objective.querySelector('span').textContent=goal.battle;}
  if(objective&&OPS_NODE){var boss=G.units.find(function(u){return u.boss});objective.querySelector('b').textContent=OPS_NODE.name.toUpperCase()+(boss?' · PHASE '+boss.phase:'');objective.querySelector('span').textContent=boss?(boss.bossAttacks%3===2?'Heavy strike next attack · break or delay it.':boss.phase===2?'Weaker guard · +35% damage · heavy strike every third attack.':OPS_NODE.description):OPS_NODE.description;}
  updateEnemyCounter();
}
function updateEnemyCounter(){
  var enemyCounter=$('enemyCounter');if(!enemyCounter||!G)return;
  var alive=G.units.filter(function(u){return u.side==='foe'&&u.alive&&!u.treasure}).length;
  enemyCounter.textContent='WAVE '+Math.max(1,G.wave)+' / '+G.totalWaves+' · '+(alive+G.pool.length-G.spawned)+' REMAINING';
}
function paintUnit(u,silent){
  var rc=$('r-'+u.id); if(!rc) return;
  var shownHp=G.visualHP&&G.visualHP[u.id]!==undefined?G.visualHP[u.id]:u.hp;
  var shownBar=G.visualBar&&G.visualBar[u.id]!==undefined?G.visualBar[u.id]:u.bar;
  rc.classList.toggle('down',shownHp<=0);rc.classList.toggle('boss',!!u.boss);
  rc.title=u.n+' · '+Math.max(0,Math.round(shownHp))+' / '+u.max+' HP · '+(u.side==='ally'?u.e+' · '+Math.round(u.en)+' ultimate charge':(u.broken?'broken':u.shL+' shield layers'));
  var pct=Math.max(0,shownHp/u.max*100);
  var i=rc.querySelector('.rb i'), b=rc.querySelector('.rb b');
  if(i) i.style.width=pct+'%';
  if(b&&b.style.width==='') b.style.width=pct+'%';
  if(u.side==='foe'){
    var sq=$('rq-'+u.id);
    if(sq){ var uu=sq.querySelector('u');
      uu.style.background=EL[u.e];
      uu.style.width=(u.broken?0:(u.shC/shieldCapacity(u)*100))+'%';
      sq.style.opacity=u.broken?'.25':'1'; }
    rc.style.boxShadow=u.broken?'none':'0 0 0 '+(u.shL*2)+'px '+EL[u.e]+'44';
    var rt=$('rt-'+u.id);
    if(rt)rt.textContent=u.broken?'BREAK':SpacologyEnemyTraits.labels(u,G.units)||SpacologyEnemySummoning.label(u,G.units,FIELD)|| (u.hasteStacks?'+'+Math.round(u.haste*u.hasteStacks*100)+'% SPD':u.trait==='Fast'?'FAST':u.shL+' SHIELD');
  }
  if(u.side==='ally'){
    var status=rc.querySelector('.rt');if(status){status.textContent=SpacologyEnemyTraits.labels(u,G.units)||(u.summon?'J3K SUPPORT':u.hurt?'recovering':u.p||'');status.classList.toggle('ailment-label',!!Object.keys(u.ailments||{}).length);}
    var en=$('en-'+u.id);
    if(en){ en.querySelector('u').style.width=(u.en/EN.cost*100)+'%'; }
    var bb=$('bar-'+u.id);
    if(bb){ bb.querySelector('u').style.width=Math.min(100,shownBar/60*100)+'%';
      bb.style.opacity=shownBar>0?'1':'.25'; }
    var wasCharged=rc.classList.contains('charged');
    var nowCharged=u.en>=EN.cost && !!u.ult;
    rc.classList.toggle('charged', nowCharged);
    if(nowCharged && !wasCharged && MODE!=='none' && !silent)
      floater(u.id,'charged','#D4A45C',{tag:1});
  } else {
    var fr=$('fr-'+u.id);
    if(fr) fr.textContent=u.frac?('fracture \u00d7'+u.frac):'';
    var sv=$('sv-'+u.id);
    if(sv) sv.textContent=u.survey>0?'MARK ×'+u.survey:'';
    paintWeak(u);
  }
  var sc=$('sc-'+u.id);
  if(sc&&u.side==='foe'){ var fcr=FACE(u.id);
    if(fcr) fcr.style.boxShadow=ringStack(u,sc.offsetWidth||100); }
  if(sc){ var f=sc.querySelector('.fx');
    if(f){ f.style.transition='width 260ms cubic-bezier(.2,.8,.3,1)';
      f.style.width=pct+'%'; }
    // the trailing bar shows the size of the change: red for lost, green for gained
    var gh=sc.querySelector('.gh');
    if(gh){
      var prev=parseFloat(gh.style.width)||pct;
      gh.classList.remove('lost','gained');
      if(pct<prev-0.5) gh.classList.add('lost');
      else if(pct>prev+0.5){ gh.classList.add('gained');
        gh.style.transition='none'; gh.style.width=pct+'%'; }
      clearTimeout(sc._gt);
      sc._gt=setTimeout(function(){
        gh.style.transition='width 420ms cubic-bezier(.3,.6,.3,1)';
        gh.style.width=pct+'%';
        setTimeout(function(){gh.classList.remove('lost','gained')},460); }, D(520)); } }
}
function teamEls(){ var m={};
  G.units.forEach(function(u){ if(u.side==='ally'&&u.alive&&!u.summon) m[u.e]=1; }); return m; }
function paintWeak(u){
  if(u.side!=='foe') return;
  var mine=teamEls();
  [ $('wk-'+u.id), $('swk-'+u.id) ].forEach(function(host){
    if(!host) return;
    host.innerHTML=u.weak.map(function(e){
      return '<span class="'+(mine[e]?'':'no')+'" style="color:'+EL[e]+
        ';border-color:'+EL[e]+'">'+e.charAt(0).toUpperCase()+'</span>'; }).join('');
    host.style.opacity=u.broken?'.3':'1';
  });
}
function retireFoe(id){
  var u=U(id); if(!u||u.side!=='foe'||u.alive) return;
  // Release the dock slot at the killing impact. Stage cards and floating text
  // have their own lifetime, so the final damage can remain readable.
  u.retired=true; u.retiring=false;
  reflowFoes();
}
// anything that died without a death animation still has to leave
function sweepFoes(){
  var gone=G.units.filter(function(u){
    return u.side==='foe' && !u.alive && (!u.retired||u.retiring); });
  if(!gone.length) return;
  gone.forEach(function(u){ u.retired=true; u.retiring=false; });
  reflowFoes();
}
function reflowFoes(){
  var host=$('foes'); if(!host) return;
  var before={};
  host.querySelectorAll('.rc').forEach(function(e){
    before[e.id]=e.getBoundingClientRect().left; });
  ribbons();
  // ribbons() rebuilds both sides, so repaint both sides before the next frame.
  // Repainting only foes briefly reset ally energy bars to zero.
  G.units.forEach(function(u){ paintUnit(u,true); });
  if(MODE==='none') return;
  var moved=[];
  host.querySelectorAll('.rc').forEach(function(e){
    var was=before[e.id];
    if(was===undefined){
      e.style.transition='none'; e.style.opacity='0';
      e.style.transform='scale(.8) translateY(-8px)';
      moved.push({e:e,fresh:true}); return;
    }
    var dx=was-e.getBoundingClientRect().left;
    if(Math.abs(dx)<1) return;
    e.style.transition='none'; e.style.transform='translateX('+dx+'px)';
    moved.push({e:e,fresh:false});
  });
  if(!moved.length) return;
  void host.offsetHeight;
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    moved.forEach(function(mv){
      mv.e.style.transition='transform 380ms cubic-bezier(.2,.85,.3,1), opacity 320ms ease';
      mv.e.style.transform='none';
      if(mv.fresh) mv.e.style.opacity='';
    });
  }); });
}
function ghostSettle(u){
  var rc=$('r-'+u.id); if(rc){ var b=rc.querySelector('.rb b');
    if(b){ var pv=parseFloat(b.style.width);
      var nv=Math.max(0,u.hp/u.max*100);
      b.classList.remove('lost','gained');
      if(!isNaN(pv)){ if(nv<pv-0.5) b.classList.add('lost');
        else if(nv>pv+0.5) b.classList.add('gained'); }
      setTimeout(function(){b.classList.remove('lost','gained')},700); }
    if(b){ b.style.transition='width 420ms cubic-bezier(.3,.6,.3,1)';
      b.style.width=Math.max(0,u.hp/u.max*100)+'%'; } }
  var sc=$('sc-'+u.id); if(sc){ var g=sc.querySelector('.gh');
    if(g){ g.style.transition='width 420ms cubic-bezier(.3,.6,.3,1)';
      g.style.width=Math.max(0,u.hp/u.max*100)+'%'; } } }
function glint(el,ms){ if(!el||MODE==='none') return;
  if(el.classList&&el.classList.contains('sc')){
    var f=el.querySelector('.foil'); if(f) el=f; }
  el.classList.remove('lit'); rf(el); el.classList.add('lit');
  clearTimeout(el._g); el._g=setTimeout(function(){el.classList.remove('lit')},ms||620); }

/* ============ turn track ============ */
function track(){
  var el=$('track');
  var before={};
  el.querySelectorAll('.tk').forEach(function(e){
    before[e.dataset.k]=e.getBoundingClientRect().top; });

  var q=timelineEntries();
  var seen={};
  el.innerHTML='';
  var ready=G.units.filter(function(u){
    return u.side==='ally'&&u.alive&&u.ult&&u.en>=EN.cost; });
  if(ready.length){
    var rd=document.createElement('div');
    rd.className='tk ultready';
    rd.dataset.k='ULT';
    rd.innerHTML='<div class="tn">'+(ready.length>1?ready.length+' READY':ready[0].n)+
      '</div><div class="tw">any time</div>';
    el.appendChild(rd);
  }
  var nextBoundary=(Math.floor(G.av/100)+1)*100-G.av;
  var beforeBoundary=q.filter(function(sl){return !sl.roundMarker&&!sl.treasureEscape&&sl.wait<nextBoundary}).length;
  $('timelineEdge').textContent=G.av>=G.limit*100?'Extraction reached':beforeBoundary+' queued actions before '+(G.round>=G.limit?'extraction':'round '+(G.round+1));
  q.forEach(function(sl,i){
    if(sl.treasureEscape){var marker=document.createElement('div');marker.className='tk round-marker treasure-marker';marker.dataset.k='TREASURE-ESCAPE';marker.innerHTML='<div class="tn">TREASURE ESCAPES</div><div class="tw">'+Math.ceil(sl.wait)+'</div>';el.appendChild(marker);return;}
    if(sl.roundMarker){
      var marker=document.createElement('div');marker.className='tk round-marker'+(sl.extraction?' extraction':'');marker.dataset.k='ROUND-'+sl.round;marker.dataset.wait=sl.wait;
      marker.innerHTML='<div class="tn">'+(sl.extraction?'EXTRACTION':'ROUND '+sl.round)+'</div><div class="tw">'+Math.ceil(sl.wait)+'</div>';el.appendChild(marker);return;
    }
    if(sl.bloom){
      var bd=document.createElement('div');
      bd.className='tk bloomtok'+(bloomReady()?' hot':'');
      bd.dataset.k='BLOOM';
      bd.innerHTML='<div class="tn">BLOOM</div><div class="tw">'+
        (bloomReady()?'ready':Math.round(sl.wait))+'</div>';
      el.appendChild(bd); return;
    }
    var u=sl.u;
    seen[u.id]=(seen[u.id]||0)+1;
    var key=u.id+'#'+seen[u.id];
    var d=document.createElement('div');
    d.className='tk'+(i===0?' now':'')+(u.broken?' brk':'')+(u.lastAdvanceAt===G.av?' advanced':'')+(sl.bonus?' bonus-turn':'');
    d.dataset.k=key;d.dataset.wait=sl.wait;if(sl.bonus)d.dataset.bonusTurn='true';
    d.innerHTML='<div class="tn" style="color:'+
      (u.side==='foe'?EL[u.e]:'var(--ink)')+'">'+u.n+'</div>'+
      '<div class="tw">'+(sl.bonus?'EXTRA':(u.lastAdvanceAt===G.av?'↑ ':'')+Math.ceil(sl.wait))+'</div>';
    var intent=seen[u.id]===1?SpacologyEnemyTraits.labels(u,G.units):'';
    if(intent){var tell=document.createElement('div');tell.className='intent';tell.textContent=intent;d.appendChild(tell);d.title=u.n+' · '+intent;}
    el.appendChild(d);
  });

  // FLIP vertically. Note: the transition has to be set inline on the way back,
  // because an inline transition:none overrides any stylesheet rule.
  var GLIDE='transform 440ms cubic-bezier(.2,.85,.3,1), opacity 260ms ease, '+
            'background 200ms ease, border-color 200ms ease';
  var moves=[];
  el.querySelectorAll('.tk').forEach(function(e){
    var was=before[e.dataset.k];
    if(was===undefined){
      e.style.transition='none';
      e.style.opacity='0';
      e.style.transform='translateX(16px)';
      moves.push({e:e,fresh:true});
      return;
    }
    var dy=was-e.getBoundingClientRect().top;
    if(Math.abs(dy)<1) return;
    e.style.transition='none';
    e.style.transform='translateY('+dy+'px)';
    if(dy<0) e.classList.add('slid');
    moves.push({e:e,fresh:false});
  });

  if(!moves.length) return;
  // force the start positions to be committed before switching the transition on
  void el.offsetHeight;
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      moves.forEach(function(mv){
        mv.e.style.transition=GLIDE;
        mv.e.style.transform='none';
        if(mv.fresh) mv.e.style.opacity='';
      });
      setTimeout(function(){
        moves.forEach(function(mv){ mv.e.classList.remove('slid'); });
      },600);
    });
  });
}
/* ============ stage ============ */
function clearStage(){
  var st=$('stage');
  st.querySelectorAll('.sc,.mk,.ai').forEach(function(e){e.remove()});
}
function makeStageCard(st,id,g,role,pad){
  var u=U(id); if(!u||!g||!u.n) return null;
  var d=document.createElement('div');
  d.className='sc'+(role==='actor'?' act':'')+(role==='helper'?' help':'')+(u.elite?' elite':'');
  d.id='sc-'+id; d.dataset.role=role;
  d.style.left=g.x+'px'; d.style.top=g.y+'px';
  d.style.width=g.w+'px'; d.style.height=g.h+'px';
  applyCrewPortrait(d,u);
  applyEnemyPortrait(d,u);

  var foil=document.createElement('div');
  foil.className='foil holo'; foil.id='fc-'+id;
  d.appendChild(foil);
  var face=d;
  var tiny=g.w<68;
  if(tiny) d.className+=' tinycard';
  face.insertAdjacentHTML('beforeend','<div class="sn">'+u.n+'</div>'+
    (u.side==='foe'?'<div class="wk" id="swk-'+id+'"></div>'
      :(tiny?'':'<div class="se" style="color:'+EL[u.e]+'">'+u.e+'</div>'))+
    '<div class="sb"><div class="gh"></div><div class="fx"></div></div>');

  if(window.SPACOLOGY_SESSION){
    var art=document.createElement('div');art.className='battle-art';art.setAttribute('aria-hidden','true');
    var footer=document.createElement('div');footer.className='card-footer';
    ['.sn','.se','.wk','.sb'].forEach(function(selector){var node=face.querySelector(selector);if(node)footer.appendChild(node)});
    face.prepend(art);face.appendChild(footer);
  }
  if(u.side==='foe') applyRings(face,u,g);

  var m=document.createElement('div'); m.className='mk'; m.id='mk-'+id;
  m.style.top=(g.h+pad+3)+'px';
  d.appendChild(m);
  st.appendChild(d);

  var was=(G.hp0&&G.hp0[id]!==undefined)?G.hp0[id]:u.hp;
  var pct=Math.max(0,was/u.max*100);
  var fx=face.querySelector('.fx'), gh=face.querySelector('.gh');
  fx.style.transition='none'; fx.style.width=pct+'%';
  gh.style.transition='none'; gh.style.width=pct+'%';
  if(u.side==='foe') paintWeak(u);

  var rb=$('r-'+id);
  if(rb){
    var rr=rb.getBoundingClientRect(), dr=face.getBoundingClientRect();
    if(dr.width&&rr.width){
      var dx=(rr.left+rr.width/2)-(dr.left+dr.width/2);
      var dy=(rr.top+rr.height/2)-(dr.top+dr.height/2);
      var sc=Math.max(.28,rr.width/dr.width);
      d.dataset.off='translate('+Math.round(dx)+'px,'+Math.round(dy)+
        'px) scale('+sc.toFixed(3)+')';
    }
  }
  d.style.opacity='0';
  d.style.transition='none';
  d.style.transform=d.dataset.off||'none';
  return d;
}
function buildStage(actorId,targetIds,support,helperIds){
  clearStage();
  var st=$('stage'), W=st.clientWidth||340, H=214, geo={};
  var tg=targetIds||[], hp=helperIds||[];
  var actor=U(actorId);
  var pad=3+(SHLAYERS-1)*4+3;
  var allySupport = support && actor && actor.side==='ally';

  // rows belong to sides, never to roles, so nobody lands on the wrong half
  var FOE_Y=pad+12, ALLY_Y=H-74;
  var lanes={foe:[],ally:[]};
  [actorId].concat(hp).concat(tg).forEach(function(id){
    var u=U(id); if(!u) return;
    if(lanes[u.side].indexOf(id)<0) lanes[u.side].push(id);
  });

  function layout(ids,y,h,maxW){
    var n=ids.length; if(!n) return;
    // the rings live outside the card, so their width comes out of the lane
    var step=n>6?2:n>3?3:4;
    var rp=2+(SHLAYERS-1)*step+2;
    var gap=n>6?5:n>3?8:12;
    var lane=W-12-rp*2-(n-1)*gap;
    var cw=Math.max(30,Math.min(maxW,lane/n));
    var tot=n*cw+(n-1)*gap;
    var x0=Math.max(rp+2,(W-tot)/2);
    ids.forEach(function(id,k){
      geo[id]={x:x0+k*(cw+gap),y:y,w:cw,h:h,step:step,rp:rp}; });
  }

  if(allySupport){
    // the only time anyone sits in the middle: an ally helping allies
    geo[actorId]={x:W/2-58,y:Math.round(H*0.24),w:116,h:60};
    layout(lanes.ally.filter(function(id){return id!==actorId}),H-76,58,100);
    layout(lanes.foe,FOE_Y,58,100);
  } else {
    layout(lanes.foe,FOE_Y,actor&&actor.side==='foe'?62:58,112);
    layout(lanes.ally,ALLY_Y,actor&&actor.side==='ally'?62:58,112);
  }

  // The acting card is the battlefield's focal point. Its fixed portrait-sized
  // geometry keeps actions readable without making the docks reflow.
  if(actor){
    var actorW=Math.min(actor.elite?184:164,Math.max(132,W*.42));
    var actorH=actor.elite?198:184;
    geo[actorId]={x:(W-actorW)/2,y:(H-actorH)/2,w:actorW,h:actorH,step:4,rp:8};
  }
  hp.slice(0,2).forEach(function(id,index){
    var helperW=Math.min(92,Math.max(68,W*.2)),helperH=116;
    geo[id]={x:index===0?8:W-helperW-8,y:(H-helperH)/2,w:helperW,h:helperH,step:3,rp:6};
  });

  [actorId].concat(hp).concat(tg).forEach(function(id){
    if(!geo[id]) return;
    var role = id===actorId?'actor':(hp.indexOf(id)>=0?'helper':'target');
    if(!$('sc-'+id)) makeStageCard(st,id,geo[id],role,pad);
    var rc=$('r-'+id);
    if(rc){ rc.classList.toggle('acting',id===actorId);
      rc.classList.toggle('answering',role==='helper');
      rc.classList.toggle('vacated',role==='target'); }
  });
}

function cardTF(id,tf,ms,ease){
  var d=$('sc-'+id); if(!d) return;
  d.style.transition=(ms?('transform '+ms+'ms '+(ease||'ease')+',opacity '+ms+'ms ease'):'none');
  d.style.transform=tf||'none';
}
function FACE(id){ return $('sc-'+id); }
function FOIL(id){ return $('fc-'+id); }
function flipTo(id){
  var d=$('sc-'+id), rb=$('r-'+id), fc=FACE(id);
  if(!d||!rb||!fc) return 'none';
  var tf=d.style.transform, tn=d.style.transition;
  d.style.transition='none'; d.style.transform='none';
  var dr=fc.getBoundingClientRect(), rr=rb.getBoundingClientRect();
  d.style.transform=tf; d.style.transition=tn;
  if(!dr.width||!rr.width) return 'none';
  var dx=(rr.left+rr.width/2)-(dr.left+dr.width/2);
  var dy=(rr.top+rr.height/2)-(dr.top+dr.height/2);
  var sc=Math.max(.28,rr.width/dr.width);
  return 'translate('+Math.round(dx)+'px,'+Math.round(dy)+'px) scale('+sc.toFixed(3)+')';
}
// slide the actor aside and bring a responder in beside it
function makeRoom(actorId,ids,ms){
  var st=$('stage'), W=st.clientWidth||340, H=214;
  var row=[actorId].concat(ids);
  var n=row.length;
  var step=n>3?3:4, rp=2+(SHLAYERS-1)*step+2;
  var gap=n>3?8:12;
  var lane=W-12-rp*2-(n-1)*gap;
  var cw=Math.max(30,Math.min(112,lane/n));
  var tot=n*cw+(n-1)*gap;
  var x0=Math.max(rp+2,(W-tot)/2);
  var y=H-70;
  row.forEach(function(id,k){
    var g={x:x0+k*(cw+gap),y:y,w:cw,h:62,step:step,rp:rp};
    var card=$('sc-'+id);
    if(card){
      card.style.transition='left '+ms+'ms cubic-bezier(.2,.85,.3,1), width '+ms+
        'ms cubic-bezier(.2,.85,.3,1), transform '+ms+'ms ease, opacity '+ms+'ms ease';
      card.style.left=g.x+'px'; card.style.width=g.w+'px';
    } else {
      makeStageCard(st,id,g,'helper',rp);
      var rc=$('r-'+id); if(rc) rc.classList.add('answering');
      stageIn(id,ms);
    }
  });
}
function stageIn(id,ms){ var d=$('sc-'+id); if(!d) return;
  cardTF(id,'none',ms,'cubic-bezier(.16,.9,.3,1)');
  d.style.opacity='1'; glint(FACE(id),ms+240); }
function stageOut(id,ms){ var d=$('sc-'+id); if(!d||d.dataset.dead) return;
  cardTF(id,flipTo(id),ms,'cubic-bezier(.55,0,.9,.25)');
  d.style.opacity='0'; }
function clearRibbonMarks(){ G.units.forEach(function(u){
  var rc=$('r-'+u.id);
  if(rc) rc.classList.remove('acting','vacated','answering','targeted'); }); }

function hitVisual(id,power,color){
  var d=$('sc-'+id), fc=d;
  if(d&&fc){
    var away = (U(id)&&U(id).side==='foe') ? -1 : 1;
    cardTF(id,'translateY('+(away*(10+24*power))+'px) scale('+(1+.14*power)+')',0);
    fc.style.transition='none';
    fc.style.background=color; fc.style.color='#0F161C';
    setTimeout(function(){ if(d.dataset.dead) return;
      cardTF(id,'translateY('+(-away*6)+'px)',150,'cubic-bezier(.33,.9,.4,1)');
      fc.style.transition='background 180ms,color 180ms';
      fc.style.background=''; fc.style.color='';
      setTimeout(function(){ if(d.dataset.dead) return;
        cardTF(id,'none',140); },150);
    },D(90));
  } else { var rc=$('r-'+id); if(rc){ fz(rc);
    rc.style.transform='translateY('+(4+7*power)+'px)'; rc.style.background=color;
    setTimeout(function(){ tr(rc,240); rc.style.transform=''; rc.style.background=''; },D(90)); } }
  glint(FACE(id)||$('r-'+id),520); }
// The shield is drawn as concentric box-shadows on the card face itself, so it
// tracks the card exactly whatever the card's size or transform.
function ringStack(u,w,layers){
  if(!u||u.side!=='foe') return 'none';
  var n=(layers===undefined?u.shL:layers), max=u.shMax||1;
  if(n<=0) return 'none';
  var col=EL[u.e], thick=(w&&w<62)?1:2, step=(w&&w<70)?3:4, out=[], at=0;
  for(var q=0;q<n;q++){
    at+=thick;
    out.push('0 0 0 '+at+'px '+hexA(col,.30+.30*((n-q)/max)));
    at+=step;
    if(q<n-1) out.push('0 0 0 '+at+'px transparent');
  }
  out.push('0 0 '+(6+4*n)+'px '+hexA(col,.42));
  return out.join(',');
}
function hexA(hex,a){
  var h=hex.replace('#','');
  var r=parseInt(h.slice(0,2),16),g2=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
  return 'rgba('+r+','+g2+','+b+','+a.toFixed(2)+')';
}
function applyRings(face,u,g){
  if(!face) return;
  face.style.boxShadow=ringStack(u,g?g.w:100);
}
function popRings(id,from,to){
  var u=U(id), face=FACE(id);
  if(!face||!u) return;
  face.style.transition='box-shadow 300ms cubic-bezier(.16,.85,.3,1)';
  face.style.boxShadow=ringStack(u,null,to);
}
function markText(id,txt,c){ var m=$('mk-'+id);
  if(m){ m.textContent=txt; m.style.color=c; tr(m,220); m.style.opacity='.95'; } }

function paintAether(){
  var el=$('aetherMeter');el.hidden=!G.aether;if(!G.aether)return;
  var shown=G.visualAether==null?G.aether.current:G.visualAether;
  $('aetherCount').textContent=shown+' / '+G.aether.max;
  $('aetherPips').innerHTML=Array.from({length:G.aether.max},function(_,i){return '<i class="'+(i<shown?'filled':'')+'"></i>'}).join('');
  // A preview only: rngFree keeps it from drawing on the fight's random numbers.
  var owner=SpacologyAether.priority(livingCrew(),window.SPACOLOGY_SESSION||{},aetherSkillUseful);
  var healthBudget=rngFree(function(){return burstHealthBudget(owner,liveFoes())});
  var saving=owner&&healthBudget!==0&&G.allyTurns>=G.aether.reserveAfter;
  el.title=saving?'Saving up to '+(healthBudget===null?SpacologyAether.budget(G.aether,owner,window.SPACOLOGY_SESSION):healthBudget)+' Aether for '+owner.n:'Shared Aether · teammates can spend';
  el.setAttribute('aria-label','Shared Aether: '+shown+' of '+G.aether.max+'. '+el.title+'. View rules');
}
$('aetherMeter').onclick=function(){openBattleDetails('<h2 id="enemyDetailTitle">Shared Aether</h2><p>Basics generate 1 charge (Hanae and Coda generate 2); most skills spend 1–3. The whole crew shares this pool. Ultimates use each character’s separate ultimate charge.</p><p>Hanae’s skill spends 1 and restores 5 (+4 net). Arunima can spend the available pool: 300% attack at 3 charges, plus 100 percentage points per extra charge. Roonie’s skill spends 1 and restores 3 (+2 net), and his ultimate restores 6. Hanae’s ultimate restores 4, and Veska’s skill returns up to 3 from Refrains. Silen spends 2 for a 200% attack, then takes immediate extra turns costing 2, 3, 4 Aether and so on: 225%, 250%, 275% and onward. Each is a separate action that earns ultimate charge. Kills carry the growing attack to another enemy, including the next wave. Refills can extend the sequence when enough Aether is available for the next hit. He stops when the next hit is unaffordable or the encounter is cleared. Ivara supplies focused damage and extra storage. Daven returns charge from a blocked hit. Inspect their cards in Ops for exact kits. Coda, Aurel and Nour retain their initial Aether traits.</p><p>Capacity is 6 base + 1 per living deployed Weaver. Ivara and Aurel each add another 2 through their passives. Six Weavers with Ivara hold 14 charges. Reserves and summons do not count. Losing a Weaver reduces the cap and discards excess charges.</p><p>Main DPS spend aggressively; sub-DPS usually build Aether with basics, spending near a full pool or for a kill, break window or urgent support. Auto saves for a burst Weaver, uses basics for easy finishes, and spends only enough burst charges to clear weakened enemies. Urgent recovery, net-positive refills and a discount or ultimate-charge setup can go first. Burst users wait at most one turn to build a full attack, and spend sooner near the deadline, during a break window or to finish an enemy. After the burst, teammates get a spending window. Manual priorities and Build charges still apply.</p><p>Named refill effects apply once per cast, capped by the pool. Other ultimate hits and follow-ups do not generate Aether. Waves preserve the pool; each encounter starts with 3.</p>')};

function presentImpact(h){
  var target=U(h.tgt),source=U(h.src);if(!target||!source||h.skipped)return;
  if(G.visualHP)G.visualHP[h.tgt]=h.revival?0:h.hpAfter;
  if(G.visualBar)G.visualBar[h.tgt]=h.barAfter;
  var color=EL[source.e]||'#fff';
  hitVisual(h.tgt,Math.min(1,.35+h.dmg/40),color);
  floater(h.tgt,h.guarded?'PROTECTED':h.sheltered?'SHELTERED':h.dmg,color,{size:22,tag:!!(h.guarded||h.sheltered)});
  if(h.absorbed)floater(h.tgt,'barrier −'+h.absorbed,'#7FA8C9',{tag:1,delay:100});
  if(h.revival){
    log(target.n+' recovered to '+h.revival.hp+' HP · −'+h.revival.costAV+' AV from the deadline','brk');
    at(D(70),function(){if(G.visualHP)G.visualHP[h.tgt]=h.hpAfter;paintUnit(target,true);floater(h.tgt,'+'+h.revival.hp,'#70d5b2',{offsetY:44});floater(h.tgt,'RECOVERED · −'+h.revival.costAV+' AV','#e9b45e',{tag:1});paintDeadline();});
  }
  if(h.lastStand){floater(h.tgt,'LAST STAND · 1 HP','#e9b45e',{tag:1,delay:160});log('<b>'+target.n+' — LAST STAND</b> · protected until their next turn','brk');}
  if(h.drain){if(G.visualHP)G.visualHP[h.src]=source.hp;floater(h.src,'+'+h.drain,HEALC,{delay:100});paintUnit(source);}
  burstAt(h.tgt,color,5,44);paintUnit(target);logHit(h);
  if(h.killed){
    var rc=$('r-'+h.tgt);if(rc)rc.classList.add('down');
    floater(h.tgt,'DOWN','#fff',{tag:1,delay:180});
    log(target.n+' is down','kill');if(h.cost){floater(h.tgt,'−'+h.cost+' rounds','#E88888',{tag:1,delay:250});log('Time limit drops to '+G.limit+' rounds','brk');}
    if(target.side==='foe')retireFoe(h.tgt);
  }
}
/* ============ play one action with animation ============ */
function playAction(done){
  if(G.over) return done&&done();
  var ev=resolveAction();
  // hold the newly fallen on the board until their death has actually played
  G.units.forEach(function(u){
    if(u.side==='foe'&&!u.alive&&!u.retired&&G.hp0&&G.hp0[u.id]>0) u.retiring=true; });
  if(ev.end){ finish(ev.end); return done&&done(); }
  G.visualHP=Object.assign({},G.hp0||{});G.visualBar={};
  G.visualAether=ev.hits&&ev.hits.some(function(h){return h.pulse})?ev.aether.before:null;
  (ev.timeline||[]).forEach(function(h){if(G.visualBar[h.tgt]===undefined)G.visualBar[h.tgt]=h.barBefore;if(G.visualHP[h.tgt]===undefined)G.visualHP[h.tgt]=h.hpBefore;});
  if(ev.summoned||ev.enemySummoned||ev.traitSpawned){ribbons();track();}
  G.units.forEach(function(u){paintUnit(u,true)});
  G.actions++;paintDeadline();paintAether();
  if(ev.aether)log(ev.actor.n+' · '+ev.aether.kind+' · '+(ev.aether.delta>=0?'+':'')+ev.aether.delta+' Aether ('+ev.aether.after+'/'+G.aether.max+') · '+ev.aether.reason+(ev.aether.generated?' · spent '+(ev.aether.spent||0)+', restored '+ev.aether.generated:''),'chain');
  G.maxChain=Math.max(G.maxChain||0,ev.chains?ev.chains.length:0);
  if(ev.roundStart) log('Round '+ev.roundStart,'rnd');
  if(ev.reinforced&&ev.reinforced.length)log('<b>Wave '+G.wave+' / '+G.totalWaves+'</b> enters the field','rnd');
  ev.notes.forEach(function(n){ log('&nbsp;&nbsp;'+n); });

  // the Bloom has no actor, so it has to be handled before anything reads one
  if(ev.bloom){
    var btag=$('ptag');
    clearStage(); clearRibbonMarks();
    btag.textContent='bloom';
    $('cap').textContent='THE BLOOM';
    log('<b>THE BLOOM</b> \u2014 Fracture stacks detonate on enemies with Fracture','chain');
    var bt=D(160);
    ev.burn.forEach(function(b){
      at(bt,function(){
        var bu=U(b.id); if(!bu) return;
        hitVisual(b.id,Math.min(1,.55+b.dmg/120),'#D9B87A');
        floater(b.id,b.dmg,'#D9B87A',{size:24});
        floater(b.id,b.stacks+' stacks','#A89070',{tag:1,delay:80});
        burstAt(b.id,'#D9B87A',12,84);
        if(G.visualHP)G.visualHP[b.id]=bu.hp;paintUnit(bu);
        if(b.killed){ markText(b.id,'consumed','#D9B87A');
          retireFoe(b.id); }
      });
      bt+=D(170);
    });
    at(bt+D(140),function(){
      btag.textContent='next';G.visualHP=null;G.visualBar=null;G.visualAether=null; paintAll(); sweepFoes(); track(); });
    setTimeout(function(){ busy=false; if(done) done(); }, bt+D(560));
    return;
  }

  var act=ev.actor, c=act?EL[act.e]:'#D9B87A';
  if(ev.interrupt){
    var trk=$('track');
    if(trk&&MODE!=='none'){
      trk.style.transition='none'; trk.style.transform='translateX(-10px)';
      trk.style.filter='brightness(.55) saturate(.5)';
      setTimeout(function(){ trk.style.transition='transform 420ms cubic-bezier(.2,.85,.3,1),'+
        ' filter 420ms ease'; trk.style.transform=''; trk.style.filter=''; },260);
    }
    log('<b>'+act.n+' cuts in</b> \u2014 '+ev.why,'chain');
  }
  var isUlt = !!ev.ult;
  var isSupport = !!ev.heal || !!ev.kindle || !!ev.mends || !!ev.supportAction || !!ev.summoned || (isUlt&&ev.ult.kind==='mend');
  var big = isUlt || isSupport || !!ev.broke || (ev.broke2&&ev.broke2.length) ||
            ev.hits.some(function(h){return h.killed});
  var targets=[];
  if(ev.heal) targets=[ev.heal.tgt];
  else if(ev.kindle) targets=[ev.kindle.tgt];
  else if(isUlt&&ev.ult.kind==='mend') targets=[];
  else if(isUlt||ev.aoe){
    var seen={};
    ev.hits.forEach(function(h){ if(U(h.tgt).side!==act.side&&!seen[h.tgt]){
      seen[h.tgt]=1; targets.push(h.tgt); } });
    targets=targets.slice(0,FIELD);
    if(!isUlt&&!ev.broke2) targets=[];
  }
  else if(big&&ev.hits.length) targets=[ev.hits[0].tgt];
  if(!targets.length&&ev.hits.length){
    var direct={};
    ev.hits.forEach(function(h){if(U(h.tgt)&&U(h.tgt).side!==act.side&&!direct[h.tgt]){direct[h.tgt]=1;targets.push(h.tgt);}});
    targets=targets.slice(0,FIELD);
  }
  if(isSupport) c=HEALC;

  if(MODE==='none'){
    G.visualHP=null;G.visualBar=null;G.visualAether=null;
    if(ev.heal){ var hu=U(ev.heal.tgt);
      log('&nbsp;&nbsp;'+act.n+' heals '+hu.n+' <b>+'+ev.heal.amt+'</b>'+
        (ev.heal.clutch?' <span style="color:#4FD97F">clutch</span>':'')); }
    ev.hits.forEach(function(h){ logHit(h,ev.why) });
    ev.chains.forEach(function(h){ logHit(h) });
    sweepFoes();
    if(ev.suppressed) log('&nbsp;&nbsp;'+act.n+' remains broken — turn denied by Assay','brk');
    if(ev.advanced) log('&nbsp;&nbsp;'+ev.advanced.name+' cuts forward','chain');
    if(ev.broke) log('<b>BREAK</b> '+U(ev.broke).n,'brk');
    G.units.forEach(paintUnit); paintAll(); track();
    applyReset(); track();
    return done&&done();
  }

  var helpers=[];
  ev.chains.forEach(function(h){
    if(h.src!==act.id && U(h.src) && U(h.src).side==='ally' && helpers.indexOf(h.src)<0)
      helpers.push(h.src); });
  helpers = (ev.chains.length<=CHAINSTAGE) ? helpers.slice(0,2) : [];
  var pendingHelpers = helpers; helpers = [];

  clearRibbonMarks();
  // Only actors enter the centre stage. Recipients remain in their dock so
  // position stays readable while their hit/heal reaction animates in place.
  buildStage(act.id,[],isSupport,helpers);
  targets.forEach(function(id){var rc=$('r-'+id);if(rc)rc.classList.add('targeted');});
  $('cap').textContent = ev.bonusTurn ? act.n+' · EXTRA TURN '+(ev.bonusIndex+1)+' · '+Math.round(SpacologyAether.chainMultiplier(ev.bonusIndex)*100)+'% · −'+ev.aether.spent+' AETHER'
    : ev.enemySummoned ? act.n+' · SUMMON · '+ev.enemySummoned.name
    : ev.summoned ? act.n+' · J3K LOTTERY · '+ev.summoned.name
    : ev.ult ? act.n+' \u00b7 '+ev.ult.name.toUpperCase()
    : ev.interrupt ? act.n+' \u00b7 '+ev.ult.name.toUpperCase()+' \u00b7 out of turn'
    : ev.aether ? act.n+' · '+ev.aether.kind.toUpperCase()+' · '+(ev.aether.delta>=0?'+':'')+ev.aether.delta+' AETHER'
    : ev.recovered ? act.n+' · REFORM & ATTACK'
    : ev.suppressed ? 'suppressed'
    : ev.kindle ? 'kindle \u00b7 '+act.n
    : ev.heal ? 'mend \u00b7 '+act.n
    : ev.why ? act.n+' \u00b7 '+ev.why
    : (act.side==='ally'?'attack':'enemy turn')+' \u00b7 '+act.e;

  var t=0,impactGap=Math.max(45,D(100));
  var tag=$('ptag');
  at(t,function(){ tag.textContent='in'; stageIn(act.id,D(180)); });
  t+=D(180);
  at(t,function(){ tag.textContent='read'; });
  t+=D(150);
  if(targets.length){
    at(t,function(){ tag.textContent='target'; });
    t+=D(180);
  }

  if(ev.recovered){
    at(t,function(){tag.textContent='reform';floater(act.id,'reform → attack',EL[act.e],{tag:1});paintUnit(act);});
    t+=D(300);
  }
  if(ev.suppressed){
    at(t,function(){ tag.textContent='suppressed';
      log('&nbsp;&nbsp;'+act.n+' remains broken — turn denied by Assay','brk');
      floater(act.id,'suppressed','#C97F9E',{tag:1});
      floater(act.id,'held by Assay',EL[act.e],{tag:1,delay:220});
      paintUnit(act);
      var d=$('sc-'+act.id);
      if(d){ cardTF(act.id,'translateY(10px) scale(.94)',D(320));
        d.style.filter='saturate(.3) brightness(.7)'; } });
    t+=D(560);
  } else if(ev.enemySummoned){
    at(t,function(){tag.textContent='summon';floater(ev.enemySummoned.id,'REINFORCEMENT','#e9b45e',{tag:1});glint($('r-'+ev.enemySummoned.id),500);paintAll();track();});
    t+=D(340);
  } else if(ev.kindle){
    at(t,function(){ tag.textContent='kindle';
      var d=$('sc-'+act.id);
      if(d){ cardTF(act.id,'scale(1.05)',D(280),'cubic-bezier(.2,.9,.3,1)');
        d.style.boxShadow='0 0 24px #D4A45C'; } });
    t+=D(280);
    at(t,function(){ tag.textContent='transfer';
      var d=$('sc-'+act.id);
      if(d){ cardTF(act.id,'none',D(220)); d.style.boxShadow='0 0 8px #D4A45C'; }
      floater(ev.kindle.tgt,'charge +34','#D4A45C',{size:18});
      floater(ev.kindle.tgt,'kindled','#D4A45C',{tag:1,delay:90});
      if(ev.kindle.full) floater(ev.kindle.tgt,'charged','#D4A45C',{tag:1,delay:190});
      floater(ev.kindle.tgt,'advance','#D4A45C',{tag:1,delay:260});
      burstAt(ev.kindle.tgt,'#D4A45C',7,48);
      log('&nbsp;&nbsp;'+act.n+' kindles '+ev.kindle.name+
        (ev.kindle.full?' &mdash; <b>ready</b>':''),'chain');
      paintUnit(U(ev.kindle.tgt)); track(); });
    t+=D(560);
  } else if(ev.heal){
    at(t,function(){ tag.textContent='mend';
      var d=$('sc-'+act.id);
      if(d){ cardTF(act.id,'scale(1.06)',D(300),'cubic-bezier(.2,.9,.3,1)');
        d.style.boxShadow='0 0 26px '+HEALC; } });
    t+=D(300);
    at(t,function(){ tag.textContent='restore';
      var hu=U(ev.heal.tgt), d=$('sc-'+act.id);
      if(d){ cardTF(act.id,'none',D(240)); d.style.boxShadow='0 0 8px '+HEALC; }
      log('&nbsp;&nbsp;'+act.n+' heals '+hu.n+' <b>+'+ev.heal.amt+'</b>'+
        (ev.heal.clutch?' <span style="color:#4FD97F">clutch</span>':''),
        ev.heal.clutch?'chain':null);
      floater(ev.heal.tgt,'+'+ev.heal.amt,HEALC,{size:20});
      if(ev.heal.clutch) floater(ev.heal.tgt,'just in time',HEALC,{tag:1,delay:110});
      if(ev.heal.bar) floater(ev.heal.tgt,'barrier +'+ev.heal.bar,'#7FA8C9',
        {tag:1,delay:170});
      burstAt(ev.heal.tgt,HEALC,6,46);
      var te=$('sc-'+ev.heal.tgt)||$('r-'+ev.heal.tgt);
      if(te){ glint(FACE(ev.heal.tgt)||te,600); fz(te);
        te.style.boxShadow='0 0 20px '+HEALC;
        setTimeout(function(){tr(te,420);te.style.boxShadow='';},D(300)); }
      // heal reads as ghost leading, fill catching up
      var sc=FACE(ev.heal.tgt), rc=$('r-'+ev.heal.tgt), pct=hu.hp/hu.max*100;
      [[sc,'.gh','.fx'],[rc,'.rb b','.rb i']].forEach(function(pr){
        if(!pr[0]) return;
        var g=pr[0].querySelector(pr[1]), f=pr[0].querySelector(pr[2]);
        if(g){ g.style.transition='width 90ms'; g.style.width=pct+'%'; }
        if(f){ f.style.transition='width 460ms cubic-bezier(.3,.6,.3,1)'; f.style.width=pct+'%'; }
      });
      if(G.visualHP)G.visualHP[hu.id]=hu.hp;paintUnit(hu); });
    t+=D(620);
  } else {
    at(t,function(){ tag.textContent=isUlt?'ultimate':'charge';
      var d=$('sc-'+act.id);
      if(d){ cardTF(act.id,'translateY('+(act.side==='ally'?18:-18)+'px) scale('+
          (isUlt?1.12:(big?1.05:.94))+')',D(isUlt?900:(big?420:260)),
          'cubic-bezier(.35,0,.65,1)');
        d.style.boxShadow='0 0 '+(isUlt?54:(big?30:16))+'px '+c; }
      if(isUlt){ floater(act.id,ev.ult.name,c,{tag:1});
        if(ev.interrupt) floater(act.id,'out of turn','#D4A45C',{tag:1,delay:150});
        burstAt(act.id,c,8,52);
        log('<b>'+act.n+' &mdash; '+ev.ult.name+'</b>','chain'); } });
    t+=D(isUlt?900:(big?420:260));

    at(t,function(){ tag.textContent='strike';
      var d=$('sc-'+act.id);
      if(d){ d.style.boxShadow='none'; glint(FACE(act.id),540);
        cardTF(act.id,'translateY('+(act.side==='ally'?-40:40)+'px) scale(1.04)',
          D(90),'cubic-bezier(.75,0,.9,.2)'); }
      track(); });
    t+=D(110);

    at(t,function(){
      tag.textContent='impact';
      if(ev.shield){
        popRings(ev.shield.id,ev.shield.from,ev.shield.to);
        if(ev.shield.from>ev.shield.to)
          floater(ev.shield.id,'shield damage \u2212'+(ev.shield.from-ev.shield.to),
            EL[U(ev.shield.id).e],{tag:1});
        if(ev.shield.match) floater(ev.shield.id,'weakness',EL[act.e],{tag:1,delay:70});
        var pf=FACE(ev.shield.id);
        if(pf){ pf.style.transition='box-shadow 260ms cubic-bezier(.16,.85,.3,1)';
          pf.style.boxShadow=ringStack(U(ev.shield.id),null,ev.shield.to); }
      }
      (ev.timeline||ev.hits.concat(ev.chains)).forEach(function(h,hi){
        at(hi*impactGap,function(){
          tag.textContent=h.pulse?(ev.bonusTurn?'extra turn':'strike')+' · '+Math.round(h.multiplier*100)+'%':h.src===act.id?'impact':'follow-up';
          if(h.pulse){G.visualAether=h.aetherAfter;paintAether();glint(FACE(act.id),160);}
          var source=U(h.src);if(source&&h.src!==act.id){glint($('r-'+h.src),500);floater(h.src,source.n,EL[source.e],{tag:1});}
          presentImpact(h);
        });
      });
      if(ev.shreds) ev.shreds.forEach(function(sh){
        popRings(sh.id,sh.from,sh.to);
        floater(sh.id,'shield damage \u2212'+(sh.from-sh.to),EL[U(sh.id).e],{tag:1,delay:90}); });
      if(ev.fracs) ev.fracs.forEach(function(fid,fi){
        floater(fid,'fracture','#C97F9E',{tag:1,delay:150+fi*60});
        paintUnit(U(fid)); });
      if(ev.consumed&&ev.hits[0]) floater(ev.hits[0].tgt,'fractures spent','#C97F9E',{tag:1,delay:120});
      if(G.bon&&G.bon.overstrike&&ev.broke)
        floater(ev.broke,'overstrike',TAGCOL.Ordnance,{tag:1,delay:200});
      if(G.bon&&G.bon.dissect&&ev.broke)
        floater(ev.broke,'dissected',TAGCOL.Assay,{tag:1,delay:260});
      if(ev.surveyed){ floater(ev.surveyed,'marked','#8FB878',{tag:1,delay:100});
        paintUnit(U(ev.surveyed)); }
      if(ev.surveyedAll) G.units.filter(function(x){return x.side==='foe'})
        .forEach(function(x,xi){ floater(x.id,'marked','#8FB878',{tag:1,delay:120+xi*70});
          paintUnit(x); });
      if(ev.followed&&ev.hits[0]) floater(ev.hits[0].tgt,'follow-up',c,{tag:1,delay:120});
      if(ev.advanced){ floater(ev.advanced.id,'advance','#D4A45C',{tag:1,delay:180});
        log('&nbsp;&nbsp;'+(ev.advanced.by?ev.advanced.by+' pulls ':'')+
          ev.advanced.name+' forward in line','chain');
        track();
        var ra=$('r-'+ev.advanced.id);
        if(ra){ glint(ra,520); fz(ra); ra.style.transform='translateY(-7px)';
          setTimeout(function(){tr(ra,240);ra.style.transform='';},200); } }
      if(ev.reflect) floater(ev.reflect.tgt,'returned','#8FB878',{tag:1,delay:180});
      if(ev.lashed) floater(act.id,'\u2191'+ev.lashed+' stored',c,{tag:1,delay:60});
      if(ev.mends) ev.mends.forEach(function(md,mi){
        if(md.amt) floater(md.tgt,'+'+md.amt,HEALC,{size:17,delay:mi*70});
        if(md.bar) floater(md.tgt,'barrier','#7FA8C9',{tag:1,delay:mi*70+90});
        if(md.ch) floater(md.tgt,'charge +'+md.ch,'#D4A45C',{tag:1,delay:mi*70+150});
        if(G.visualHP)G.visualHP[md.tgt]=U(md.tgt).hp;if(G.visualBar)G.visualBar[md.tgt]=U(md.tgt).bar;paintUnit(U(md.tgt)); });
      if(ev.broke2) ev.broke2.forEach(function(bid,bi){
        setTimeout(function(){ var bu=U(bid);
          floater(bid,'break',EL[bu.e],{tag:1});
          burstAt(bid,EL[bu.e],11,74); markText(bid,'broken',EL[bu.e]);
          log('<b>BREAK</b> &mdash; '+bu.n,'brk'); paintUnit(bu); track(); }, bi*D(110)); });
      cardTF(act.id,'none',D(220),'cubic-bezier(.2,.8,.4,1)');
    });
    t+=Math.max(0,(ev.timeline||ev.hits).length-1)*impactGap+D(110);

    if(ev.broke){
      at(t,function(){ tag.textContent='break';
        var bu=U(ev.broke), bc=EL[bu.e];if(G.visualHP&&G.visualHP[bu.id]<=0)return;
        log('<b>BREAK</b> &mdash; '+bu.n+' delayed and exposed','brk');
        floater(ev.broke,'break',bc,{tag:1});
        burstAt(ev.broke,bc,13,80);
        markText(ev.broke,'broken',bc);
        paintUnit(bu); track(); });
      t+=D(340);
    }

  }

  at(t,function(){ tag.textContent='resolve';
    G.visualHP=null;G.visualBar=null;G.visualAether=null;
    cardTF(act.id,'none',D(200));
    ev.hits.concat(ev.chains).forEach(function(h){ ghostSettle(U(h.tgt)); });
    paintAll(); track(); });
  t+=D(180);
  at(t,function(){ tag.textContent='out';
    stageOut(act.id,D(180));
    pendingHelpers.forEach(function(id){stageOut(id,D(180))});
    targets.forEach(function(id){stageOut(id,D(180))}); });
  t+=D(200);
  at(t,function(){ tag.textContent='next';
    applyReset(); sweepFoes(); track(); });
  t+=D(260);
  at(t,function(){ tag.textContent='idle'; clearRibbonMarks();
    clearStage(); done&&done(); });
}
function logHit(h,why){
  var s=U(h.src), t=U(h.tgt);
  log('&nbsp;&nbsp;'+s.n+' &rarr; '+t.n+' <b>'+h.dmg+'</b>'+
    (why?' <span style="color:var(--ink3)">&mdash; '+why+'</span>':'')+
    (h.vuln?' <span style="color:#fff">vuln</span>':'')+
    (h.chain?' <span style="color:var(--energy)">chain</span>':''),
    h.chain?'chain':null);
}

function finish(msg){
  if(G.over)return;
  settleTreasure(true);
  if(window.SPACOLOGY_SESSION){SpacologyPreferences.clearCheckpoint();if($('sessionMenu'))$('sessionMenu').disabled=true;}
  G.over=true;G.visualHP=null;G.visualBar=null;G.visualAether=null; playing=false; clr();sweepFoes();paintDeadline();paintRecovery();clearRibbonMarks();clearStage();
  $('bPlay').textContent='Play'; $('hState').textContent=msg;
  log('<b>'+msg+'</b> in '+G.round+' rounds','rnd');
  var names=Object.keys(G.dealt);
  var tot=names.reduce(function(a,n){return a+G.dealt[n]},0)||1;
  var mean=1/names.length;
  var spread=Math.sqrt(names.reduce(function(a,n){
    return a+Math.pow(G.dealt[n]/tot-mean,2)},0)/names.length)/mean;
  var bars=names.map(function(n){
    return '<div style="height:'+Math.max(2,Math.round(G.dealt[n]/tot*100))+'%"></div>'}).join('');
  $('stats').innerHTML='<b>'+msg+'</b> in '+G.round+' rounds &middot; '+
    G.actions+' actions<br>'+
    G.breaks+' breaks &middot; '+G.chains+' chains &middot; longest <b>'+G.longest+
    '</b> &middot; suppressed <b>'+
      (G.foeTurns?Math.round(G.supp/G.foeTurns*100):0)+'%</b><br>'+
    'blooms <b>'+(G.blooms||0)+'</b> &middot; returned <b>'+(G.ammoDmg||0)+
      '</b> &middot; ultimates <b>'+G.ults+'</b> &middot; follow-ups <b>'+G.follows+
      '</b> &middot; longest chain <b>'+(G.maxChain||0)+
      '</b> &middot; biggest hit <b>'+G.biggest+'</b><br>'+
    'deaths <b>'+G.deaths+'</b> &middot; heals <b>'+G.heals+
      '</b> &middot; absorbed <b>'+(G.barSoak||0)+'</b> &middot; '+
    'drains <b>'+G.drains+'</b> &middot; lowest crew HP <b>'+G.lowest+'</b><br>'+
    'evenness <b>'+Math.max(0,Math.round((1-spread)*100))+'%</b> &middot; '+
    names.map(function(n){return n+' '+Math.round(G.dealt[n]/tot*100)+'%'}).join(' &middot; ')+
    '<div class="spark">'+bars+'</div>';
  if(window.SPACOLOGY_SESSION){
    var won=msg==='Crew wins';
    var observation=SpacologyExpedition.observed(window.SPACOLOGY_SESSION,G,won);
    var recovery=SpacologyRecovery.score(G.pool,G.units,observation);
    var pity=window.SPACOLOGY_SESSION.rarePity||0;
    var bonusCrystal=won&&(Math.random()<.22||pity>=3)?1:0;
    var crystals=won?1+bonusCrystal:0;
    var rarePool=[{type:'gear',name:'Bore Bit'},{type:'gear',name:'Recoil Spring'},
      {type:'gear',name:'Ballast Plate'},{type:'ship',name:'Survey Prism'},
      {type:'ship',name:'Brace Matrix'}];
    var rareItem=won&&Math.random()<.1?rarePool[Math.floor(Math.random()*rarePool.length)]:null;
    var modifierEffects=SpacologyExpedition.effects(window.SPACOLOGY_SESSION);
    var baseGold=(won?Math.round((OPS_NODE?SpacologyVoyage.profile(window.SPACOLOGY_SESSION).gold:28+window.SPACOLOGY_SESSION.round*6)*modifierEffects.reward):10)+modifierEffects.flatGold;
    var surveyBonus=won&&observation&&G.ship&&G.ship.survey?Math.ceil(baseGold*(G.ship.survey===true?.2:G.ship.survey)):0;
    var analysis=battleAnalysis();
    var result={nodeId:OPS_NODE&&OPS_NODE.id,treasure:G.treasureReward||null,treasureStatus:G.treasureStatus||null,analysis:analysis,revives:G.revives||0,recoveryAV:G.recoveryAV||0,reason:won?'victory':msg==='Out of time'?'timeout':'defeat',timeLimit:G.limit,elapsedAV:G.av,timeRemaining:Math.max(0,G.limit-G.av/100),round:window.SPACOLOGY_SESSION.round,won:won,difficulty:window.SPACOLOGY_SESSION.difficulty,
      recovery:recovery,integrity:Math.max(0,Math.min(100,window.SPACOLOGY_SESSION.integrity+recovery.integrity))-window.SPACOLOGY_SESSION.integrity,
      gold:baseGold+surveyBonus,fieldXP:SpacologyField.battleXP(window.SPACOLOGY_SESSION,won),
      observation:observation,rounds:G.round,breaks:G.breaks,chains:G.chains,
      actions:G.actions,enemyAttacks:G.foeAttacks,enemyRecoveries:G.recoveries,deaths:G.deaths,ultimates:G.ults,totalDamage:Math.round(tot),crystals:crystals,item:rareItem,
      rarePity:bonusCrystal?0:pity+(won?1:0)};
    localStorage.setItem(SpacologyStore.result,JSON.stringify(result));
    $('summaryTitle').textContent=won?'Fieldwork recovered':msg==='Out of time'?'Time expired':'Partial recovery';
    $('summaryCopy').textContent=won?'The crew secured the encounter and returned its field record.':msg==='Out of time'?'The '+G.limit+'-round deadline expired before every wave was cleared. Partial data and recovery gold were retained.':'Extraction preserved the data gathered before the crew fell back.';
    $('summaryCopy').textContent+=' '+recovery.earned+' / '+recovery.total+' points recovered ('+Math.floor(recovery.percent)+'%). '+recovery.band+'.';
    if(result.revives)$('summaryCopy').textContent+=' '+result.revives+' crew recoveries cost '+result.recoveryAV+' AV.';
    if(result.fieldXP)$('summaryCopy').textContent+=' +'+result.fieldXP+' field XP toward your next field level.';
    $('summaryGold').textContent='+'+(result.gold+(G.treasureReward?G.treasureReward.gold:0))+'g';
    $('summaryIntegrity').textContent=(result.integrity>=0?'+':'')+result.integrity+'%';
    $('summaryObservation').textContent=observation?'COMPLETE':'PARTIAL';
    $('summaryActions').textContent=G.actions;$('summaryBreaks').textContent=G.breaks;
    $('summaryChains').textContent=G.chains;$('summaryUltimates').textContent=G.ults;
    $('summaryDamage').textContent=Math.round(tot);$('summaryRounds').textContent=(Math.round(G.av)/100).toFixed(2)+' / '+G.limit;
    var recovered=[];if(rareItem)recovered.push(rareItem.name);if(crystals)recovered.push('Bloom crystal ×'+crystals);if(surveyBonus)recovered.push('Survey bonus +'+surveyBonus+'g');
    $('summaryTempo').textContent=analysis.crewTurns+' crew turns · '+analysis.advances+' advances · '+analysis.savedAV+' AV of crew waiting saved. '+analysis.notes.join(' ');
    if(G.treasureReward)recovered.push('TREASURE: '+G.treasureReward.item+' + unopened Tier '+G.treasureReward.cache.tier+' cache');
    else if(G.treasureStatus==='escaped')recovered.push('Treasure carrier escaped');
    $('summaryDrop').textContent=recovered.length?'RARE RECOVERY · '+recovered.join(' · '):'No rare recovery this encounter.';
    $('summaryReturn').textContent=won?'RECOVER TO OPS':'RETURN WITH PARTIAL DATA';
    $('sessionSummary').classList.add('show');
  }
}

/* ============ controls ============ */
function step(){ if(busy||G.over) return; busy=true;
  playAction(function(){ busy=false;saveCombatCheckpoint();if(playing)setTimeout(function(){if(playing&&!SpacologyMenu.isOpen())step();},SpacologyMenu.preferences().reducedMotion?100:0); }); }
function cancelSessionAutostart(){if(sessionAutoTimer){clearTimeout(sessionAutoTimer);sessionAutoTimer=null;}}
$('bStep').onclick=function(){cancelSessionAutostart(); playing=false; $('bPlay').textContent='Play'; $('hState').textContent='step'; step(); };
$('bPlay').onclick=function(){if(SpacologyMenu.isOpen())return;cancelSessionAutostart(); if(playing){ playing=false; this.textContent='Play'; $('hState').textContent='paused'; return; }
  playing=true; this.textContent='Pause'; $('hState').textContent='running'; step(); };
$('fab').onclick=function(){ $('bPlay').click(); };
$('bReset').onclick=function(){cancelSessionAutostart(); build(G.team,G.planet); };
function pick(id,fn){ $(id).onclick=function(e){
  var b=e.target.closest('button'); if(!b) return;
  this.querySelectorAll('button').forEach(function(x){x.classList.remove('on')});
  b.classList.add('on'); fn(b.dataset.v); }; }
pick('sTeam',function(v){ build(v,G.planet); });
pick('sPlanet',function(v){ build(G.team,v); });
pick('sMode',function(v){ MODE=v; });
pick('sCarry',function(v){ CARRY=(v==='on'); build(G.team,G.planet); });
pick('sAI',function(v){ AIMODE=v; aiNote(); build(G.team,G.planet); });
pick('sRetarget',function(v){ RETARGET=v; chainNote(); });
pick('sField',function(v){ FIELD=+v; if(POOL<FIELD){POOL=FIELD;$('rPool').value=FIELD;
  $('vPool').textContent=FIELD;} build(G.team,G.planet); });
$('rPool').oninput=function(){ POOL=Math.max(FIELD,+this.value);
  $('vPool').textContent=POOL; build(G.team,G.planet); };
$('vPool').textContent=$('rPool').value;
function chainNote(){
  var d={same:'Follow-ups stay on the original target. Chains end when it dies.',
    redirect:'Follow-ups move on only when the target dies.',
    random:'Every follow-up picks a live enemy at random \u2014 single-target units '+
      'behave like an area attack.',
    spread:'Every follow-up picks a different enemy than the last.'};
  $('chainNote').innerHTML='<span style="color:var(--ink3)">'+d[RETARGET]+
    ' Cascades longer than '+CHAINSTAGE+' stay in the ribbon and strike fast.</span>';
}
$('rCap').oninput=function(){CHAINCAP=+this.value;$('vCap').textContent=this.value;};
$('rStage').oninput=function(){CHAINSTAGE=+this.value;$('vStage').textContent=this.value;
  chainNote();};
$('vCap').textContent=$('rCap').value; $('vStage').textContent=$('rStage').value;
function aiNote(){
  if(AIMODE==='naive'){ $('aiNote').innerHTML=
    '<span style="color:var(--ink3)">Everyone attacks the weakest enemy. The control case.</span>';
    return; }
  if(AIMODE==='uniform'){ $('aiNote').innerHTML=
    '<span style="color:var(--ink3)">All four weigh the same factors identically &mdash; '+
    'strong play, but nobody has a personality.</span>'; return; }
  var t=TEAMS[G?G.team:'wide'];
  $('aiNote').innerHTML=t.crew.map(function(c){
    return '<b>'+c.n+'</b> '+(PROFILES[c.p]||{}).label; }).join(' &middot; ');
}
$('bNext').onclick=function(){
  if(G&&G.downed) G.downed.forEach(function(n){ INJURED[n]=true; });
  build(G.team,G.planet); };
$('bHeal').onclick=function(){ INJURED={}; build(G.team,G.planet); };
function injNote(){
  var names=Object.keys(INJURED);
  $('injNote').innerHTML = names.length
    ? 'Recovering: <b>'+names.join(', ')+'</b> &mdash; '+
      Math.round((1-INJURY)*100)+'% less damage this fight. '+
      '<span style="color:var(--ink3)">Press Clear injuries to rest the crew.</span>'
    : '<span style="color:var(--ink3)">Crew is healthy. A death costs '+DEATHCOST+
      ' rounds off the limit and leaves that unit recovering next fight.</span>';
}
[['rTempo','vTempo','%'],['rDens','vDens','%'],['rBloom','vBloom','px']].forEach(function(p){
  $(p[0]).oninput=function(){$(p[1]).textContent=this.value+p[2]};
  $(p[1]).textContent=$(p[0]).value+p[2]; });

function loadSpacologySession(){
  if(new URLSearchParams(location.search).get('spacology')!=='1') return false;
  var state=null;
  try{state=JSON.parse(localStorage.getItem(SpacologyStore.run));}catch(e){}
  if(!state||!state.field||!state.support) return false;
  if(state.end==='retreated'||state.round>state.maxRounds||(SpacologyVoyage.active(state)&&(!state.voyageStarted||SpacologyVoyage.current(state)?.kind!=='battle'))){location.replace('spacology-v0.1.0.html?return=1'+SpacologyStore.suffix);return true;}
  var formationChanges=SpacologyFormation.normalize(state);
  if(formationChanges.length)localStorage.setItem(SpacologyStore.run,JSON.stringify(state));
  if(!state.field.some(Boolean)||SpacologyCrew.slots(state)>6){location.replace('spacology-v0.1.0.html?return=1'+SpacologyStore.suffix);return true;}
  SpacologyTreasure.normalize(state);localStorage.setItem(SpacologyStore.run,JSON.stringify(state));
  state.difficulty=SpacologyVoyageSettings.normalize(state).difficulty;
  var rules=SpacologyExpedition;
  window.SPACOLOGY_SESSION=state;
  document.body.classList.add('session-mode');
  var encounter=voyageEncounter(state),difficulty=encounter.difficulty;
  applyVoyageEncounter(encounter);
  $('rPool').value=POOL;$('vPool').textContent=POOL;
  var encounterFaction=window.SpacologyEnemyCatalogue&&window.SpacologyEnemyCatalogue.FACTIONS[OPS_FACTION];
  $('sessionTitle').textContent=(OPS_PLANET?OPS_PLANET.name+' · ':'')+(OPS_NODE?OPS_NODE.name:rules.route[Math.min(5,state.round-1)]);
  $('sessionCrew').textContent=state.field.filter(Boolean).join(', ')+' on field · '+state.support.filter(Boolean).join(', ')+' off field';
  $('sessionRound').textContent=(OPS_NODE?'NODE ':'ROUND ')+state.round+' / '+state.maxRounds;
  $('sessionPressure').textContent=difficulty.label+' · '+(encounterFaction?encounterFaction.name+' · ':'')+rules.activeModifiers(state).length+' modifiers';
  var routeHost=document.querySelector('.session-route');if(routeHost)routeHost.innerHTML=rules.route.map(function(name,i){return '<div class="session-node '+(i+1<state.round?'done':i+1===state.round?'current':'')+'"><i>'+(i+1<state.round?'✓':i+1)+'</i><b>'+(i===5?'EXTRACT':'SURVEY')+'</b></div>'}).join('');
  if(OPS_NODE&&routeHost)routeHost.innerHTML=SpacologyVoyage.route(state).filter(function(n){return n.sector===OPS_NODE.sector}).map(function(n){return '<div class="session-node '+(n.index<state.round?'done':n.index===state.round?'current':'')+'"><i>'+(n.index<state.round?'✓':n.index)+'</i><b>'+n.format.toUpperCase()+'</b></div>'}).join('');
  $('sessionIntegrity').textContent=state.integrity+'%';
  $('sessionGold').textContent=state.gold;
  $('sessionReturn').onclick=function(){if(G.over)location.href='spacology-v0.1.0.html?return=1'+SpacologyStore.suffix;else SpacologyMenu.openPause();};
  $('summaryReturn').onclick=function(){location.href='spacology-v0.1.0.html?return=1'+SpacologyStore.suffix};
  build('ops','spread');
  var treasureStatus=document.createElement('span');treasureStatus.id='treasureBattle';treasureStatus.setAttribute('role','status');document.querySelector('.battle-sidebar').appendChild(treasureStatus);paintTreasure();
  var controls=$('sessionControls'),play=$('bPlay'),logToggle=$('sessionLogToggle'),record=$('battleRecord');
  controls.insertBefore(play,logToggle);controls.appendChild($('sessionReturn'));
  var menuButton=document.createElement('button');menuButton.id='sessionMenu';menuButton.textContent='MENU';menuButton.setAttribute('aria-label','Open pause menu');controls.appendChild(menuButton);
  menuButton.onclick=function(){SpacologyMenu.openPause();};
  logToggle.onclick=function(){var open=record.classList.toggle('open');this.setAttribute('aria-expanded',open?'true':'false');this.textContent=open?'CLOSE LOG':'COMBAT LOG';};
  installBattleMenu(state);
  var restored=restoreCombatCheckpoint(state);
  saveCombatCheckpoint();
  if(SpacologyMenu.preferences().autoBattle&&!restored&&!document.hidden)sessionAutoTimer=setTimeout(function(){sessionAutoTimer=null;if(G&&!G.over&&!playing&&!SpacologyMenu.isOpen())$('bPlay').click();},350);
  return true;
}

var menuResumePlayback=false;
function saveCombatCheckpoint(){
  if(!window.SPACOLOGY_SESSION||!G||G.over||busy)return;
  try{SpacologyPreferences.writeCheckpoint(window.SPACOLOGY_SESSION,G);}catch(e){/* Pause explicitly reports a failed save before allowing navigation. */}
}
function restoreCombatCheckpoint(state){
  var saved=SpacologyPreferences.readCheckpoint(state);if(!saved)return false;
  G=saved.combat;G.visualHP=null;G.visualBar=null;G.visualAether=null;playing=false;busy=false;
  if(G.treasureInfo&&state.treasureClaims.includes(G.treasureInfo.id)){
    G.treasureStatus='collected';G.treasureReward=SpacologyTreasure.rollReward(G.treasureInfo);
    var carrier=G.units.find(function(u){return u.treasure});if(carrier){carrier.hp=0;carrier.alive=false;carrier.retired=true;}
  }
  ribbons();paintAll();track();reflowFoes();clearStage();
  $('bPlay').textContent='Play';$('hState').textContent='saved battle';
  log('Saved battle restored. Press Play when ready.','rnd');return true;
}
async function pauseSessionForMenu(){
  menuResumePlayback=playing||!!sessionAutoTimer;
  cancelSessionAutostart();playing=false;$('bPlay').textContent='Play';$('hState').textContent='paused';
  while(busy)await new Promise(function(resolve){setTimeout(resolve,30)});
  if(!G.over)SpacologyPreferences.writeCheckpoint(window.SPACOLOGY_SESSION,G);
}
function installBattleMenu(state){
  SpacologyMenu.init({mode:'battle',state:function(){try{return JSON.parse(localStorage.getItem(SpacologyStore.run))||state}catch(_){return state}},canPause:function(){return !!G&&!G.over},pause:pauseSessionForMenu,
    resume:function(){if(menuResumePlayback&&!G.over&&!playing)$('bPlay').click();menuResumePlayback=false;},
    home:function(){if(!G.over)SpacologyPreferences.writeCheckpoint(state,G);location.href='spacology-v0.1.0.html?menu=1'+SpacologyStore.suffix;},
    retreat:function(){
      if(G.over){location.href='spacology-v0.1.0.html?return=1'+SpacologyStore.suffix;return;}
      var latest=JSON.parse(localStorage.getItem(SpacologyStore.run))||state;
      if(latest.treasureSeed!==state.treasureSeed)return;
      cancelSessionAutostart();playing=false;G.over=true;clr();latest.end='retreated';latest.pack=null;
      localStorage.setItem(SpacologyStore.run,JSON.stringify(latest));localStorage.removeItem(SpacologyStore.result);SpacologyPreferences.clearCheckpoint();
      location.href='spacology-v0.1.0.html?return=1'+SpacologyStore.suffix;
    },
    applyPreferences:function(p){
      MODE=p.reducedMotion?'none':'full';$('rTempo').value=p.speed*100;$('vTempo').textContent=p.speed*100+'%';
      $('rDens').value=p.effects==='full'?100:p.effects==='low'?30:0;$('vDens').textContent=$('rDens').value+'%';
      $('rBloom').value=p.effects==='full'?8:p.effects==='low'?3:0;$('vBloom').textContent=$('rBloom').value+'px';
      if(p.effects==='off'||p.reducedMotion)pxClear();
    }
  });
  document.addEventListener('keydown',function(e){if(e.code!=='Space'||e.repeat||SpacologyMenu.isOpen()||document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA','BUTTON','A'].includes(e.target.tagName))return;e.preventDefault();if(!G.over)$('bPlay').click();});
  document.addEventListener('visibilitychange',function(){if(document.hidden&&SpacologyMenu.preferences().pauseOnHide&&!G.over&&!SpacologyMenu.isOpen())SpacologyMenu.openPause();});
}

pxInit();
if(!loadSpacologySession()) build('bloom','spread');
window.addEventListener('resize',pxResize);
if('serviceWorker'in navigator)navigator.serviceWorker.register('../sw.js');
