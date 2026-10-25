(function(root){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),PITCH=80*Math.PI/180;
  function surface(world,x,z){
    const height=world.ground(x,z),g=height===null?null:world.geography(x,z);
    return {height,water:g?Math.max(0,(g.water??(g.riverDistance<2.3?Math.ceil(5/world.cell):g.height))-g.height)*world.cell:Infinity};
  }
  // Movement limits (defaults are the strict walking rules; the walk loop passes looser ones):
  // step: max rise the mover can mount in one move; drop: max ledge it can step off (Infinity = falls
  // are free); slope: gradient multiplier for the target's local slope (Infinity = don't check);
  // water: deepest water allowed at the target (Infinity = swim anywhere); lift: how far the mover's
  // feet currently ride above its own ground (jump height), so ledges are measured from the feet.
  function canStep(world,x,z,nx,nz,limits={}){
    const step=limits.step??world.cell+.01,slope=limits.slope??1,water=limits.water??1,drop=limits.drop??step*1.5,lift=limits.lift||0;
    const a=surface(world,x,z),b=surface(world,nx,nz),d=Math.hypot(nx-x,nz-z);
    if(a.height===null||b.height===null||b.water>water)return false;
    const rise=b.height-(a.height+lift);
    if(rise>Math.max(step,d)||rise<-Math.max(drop,d*2))return false;
    // Body capsule: trunks, boulders and ruin walls stop the move. It starts at step height so paving,
    // roots and rubble the feet could mount don't read as walls, and airborne feet clear low obstacles.
    if(limits.feet!==undefined&&world.blockingAt){
      const low=Math.max(b.height,limits.feet)+.55,high=limits.feet+1.7;
      if(world.blockingAt(nx,nz,low,high)||world.blockingAt((x+nx)/2,(z+nz)/2,low,high))return false;
    }
    // Downhill moves skip the gradient check — a steep descent becomes a slide or a fall, not a wall.
    if(!Number.isFinite(slope)||rise<0)return true;
    // The gradient is measured AHEAD of the target along the move direction: a ledge mounts onto flat
    // top even at a cliff edge, while a slope that keeps rising ahead stays blocked.
    const radius=Math.max(.5,world.cell*2),ux=d?(nx-x)/d:0,uz=d?(nz-z)/d:0;
    const ahead=(world.ground(nx+ux*radius,nz+uz*radius)??b.height)-b.height;
    return ahead<=radius*slope+world.cell*.1;
  }
  // Highest body-solid top in the column at (x,z) within [lo,hi] metres, or `lo` when there is none —
  // so a fall lands on trunk tops and walls instead of ending up inside them.
  function standTop(world,x,z,lo,hi){
    if(!world.blockingAt||lo>=hi||!world.blockingAt(x,z,lo,hi))return lo;
    for(let i=0;i<7;i++){const m=(lo+hi)/2;if(world.blockingAt(x,z,m,hi))lo=m;else hi=m;}
    return hi;
  }
  function create({canvas,camera,getWorld,getPoint,setPoint,move,onChange,persist,pick,reducedMotion}){
    const $=id=>document.getElementById(id),keys=new Set(),pointers=new Map();
    // footY: the walker's feet in metres (ground when grounded, higher while jumping/falling).
    // airY: feet above the ground under them; vy: vertical velocity for jumps and falls.
    let transition=null,mapSpan=camera.span,lastUnlock=-Infinity,changed=false,lastSave=0,touchYaw=0,touchPitch=0,hintUntil=0,mapTouch=null;
    let footY=null,airY=0,vy=0;
    const active=()=>camera.mode==='walk',editable=e=>e.target.closest?.('input,select,textarea,[contenteditable]')||document.querySelector('dialog[open]');
    const stop=()=>{keys.clear();pointers.clear();if(changed){persist();changed=false;}};
    function hint(text){$('walkHint').textContent=text;hintUntil=performance.now()+6500;$('walkHint').classList.remove('faded');}
    function ui(){
      document.body.classList.toggle('walking',active());$('walk').hidden=active();$('map').hidden=!active();
      canvas.setAttribute('aria-label',active()?'Walk view. Click to look around, WASD or arrows to walk, Space to jump, M for map. Touch: left stick moves, right drag looks.':'World map. Drag or arrows to pan. Double click terrain to walk.');
    }
    function switchMode(enter,instant=false){
      camera.mode=enter?'walk':'map';
      const p=getPoint(),g=getWorld().ground(p.x,p.z)??0;
      if(enter){camera.eyeY=g+1.6+(instant||reducedMotion()?0:5);camera.y=g;touchYaw=camera.yaw;touchPitch=camera.lookPitch;footY=g;airY=0;vy=0;hint(matchMedia('(pointer: coarse)').matches?'Left side to walk · Right side to look · Map to leave':'Click to look around · WASD to walk · Space to jump · M for map');}
      else{airY=0;vy=0;footY=null;camera.y=g;camera.span=reducedMotion()?mapSpan:8;}
      ui();onChange();persist();
    }
    function enter(point,instant=false){
      if(active()||transition)return false;
      const p=point||getPoint(),s=surface(getWorld(),p.x,p.z);
      if(s.height===null||s.water>1){hint('Choose dry ground or water less than 1 m deep.');return false;}
      // Never spawn inside something solid (a trunk, a wall): nudge to the nearest free capsule.
      let spot=p;
      if(getWorld().blockingAt){
        const free=(x,z)=>{const h=getWorld().ground(x,z);return h!==null&&!getWorld().blockingAt(x,z,h+.55,h+1.7);};
        if(!free(p.x,p.z)){spot=null;
          for(const r of [.5,.9,1.4,2]){for(let a=0;a<8;a++){const x=p.x+Math.cos(a*Math.PI/4)*r,z=p.z+Math.sin(a*Math.PI/4)*r;if(free(x,z)){spot={x,z};break;}}if(spot)break;}
          if(!spot){hint('No room to stand there — pick open ground.');return false;}}
      }
      stop();if(point||spot!==p)setPoint(spot);mapSpan=camera.span;
      const mapYaw=camera.yaw,mapPitch=camera.lookPitch;
      camera.yaw=instant&&Number.isFinite(camera.yaw)?camera.yaw:35*Math.PI/180;camera.lookPitch=-.08;
      if(instant||reducedMotion())switchMode(true,true);else transition={enter:true,t:0,switched:false,mapYaw,mapPitch};
      return true;
    }
    function leave(instant=false){
      if(transition){
        // A leave during the enter fade cancels it (before the switch) or snaps straight back to map.
        const t=transition;if(!t.enter)return;
        transition=null;$('walkFade').style.opacity='0';
        if(t.switched){switchMode(false);camera.span=mapSpan;}
        else{camera.yaw=t.mapYaw;camera.lookPitch=t.mapPitch;camera.span=mapSpan;}
        onChange();
        return;
      }
      if(!active())return;
      if(document.pointerLockElement===canvas)document.exitPointerLock();stop();
      if(instant||reducedMotion()){switchMode(false);camera.span=mapSpan;onChange();}
      else transition={enter:false,t:0,switched:false,eye:camera.eyeY};
    }
    function update(dt,now){
      if(transition){
        const t=transition;t.t+=dt;const u=Math.min(1,t.t/.8),first=Math.min(1,u*2),second=Math.max(0,u*2-1),ease=v=>v*v*(3-2*v);
        $('walkFade').style.opacity=String(Math.sin(u*Math.PI)**4);
        if(u<.5){if(t.enter)camera.span=mapSpan+(8-mapSpan)*ease(first);else camera.eyeY=t.eye+5*ease(first);}
        if(u>=.5&&!t.switched){switchMode(t.enter);t.switched=true;}
        if(u>=.5){if(t.enter){const p=getPoint();camera.eyeY=(getWorld().ground(p.x,p.z)??0)+1.6+5*(1-ease(second));}else camera.span=8+(mapSpan-8)*ease(second);}
        if(!active())onChange();if(u===1){transition=null;$('walkFade').style.opacity='0';onChange();}
      }else if(active()){
        if(document.querySelector('dialog[open]'))stop();
        camera.yaw+=(touchYaw-camera.yaw)*(1-Math.exp(-dt*18));camera.lookPitch=clamp(camera.lookPitch+(touchPitch-camera.lookPitch)*(1-Math.exp(-dt*18)),-PITCH,PITCH);
        const stick=[...pointers.values()].find(p=>p.stick),sx=stick?clamp((stick.x-stick.startX)/56,-1,1):0,sz=stick?clamp((stick.y-stick.startY)/56,-1,1):0;
        let right=Number(keys.has('d')||keys.has('ArrowRight'))-Number(keys.has('a')||keys.has('ArrowLeft'))+sx;
        let forward=Number(keys.has('w')||keys.has('ArrowUp'))-Number(keys.has('s')||keys.has('ArrowDown'))-sz;
        const w=getWorld(),at=getPoint(),cur=surface(w,at.x,at.z);
        if(cur.height===null){hint('Past the edge of the world — back to the map.');leave(true);return;}
        const swimming=Number.isFinite(cur.water)&&cur.water>1.2;
        let speed=keys.has('Shift')?8:4;if(swimming)speed*=.55;else if(airY>0)speed*=.9;
        const n=Math.max(1,Math.hypot(right,forward));
        const dx=(right*Math.cos(camera.yaw)-forward*Math.sin(camera.yaw))/n*speed*dt,dz=(-right*Math.sin(camera.yaw)-forward*Math.cos(camera.yaw))/n*speed*dt;
        if(dx||dz){
          // A 0.55 m step-up, 60° traversable slopes (looser while swimming), free drops and water,
          // plus the body capsule at foot height so solid objects block. Cell-sized sub-moves keep a
          // fast frame from tunneling through narrow walls.
          const lim={step:.55,slope:swimming?2.5:1.7,water:Infinity,drop:Infinity,lift:airY,
            feet:swimming?cur.height+cur.water-1.55:footY??cur.height},
            steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/w.cell));
          for(let k=0;k<steps;k++){
            const p=getPoint(),sx=dx/steps,sz=dz/steps;let mx=0,mz=0;
            if(canStep(w,p.x,p.z,p.x+sx,p.z+sz,lim)){mx=sx;mz=sz;}
            else{if(canStep(w,p.x,p.z,p.x+sx,p.z,lim))mx=sx;if(canStep(w,p.x+mx,p.z,p.x+mx,p.z+sz,lim))mz=sz;}
            // Round obstacles (trunks, boulders) hit head-on block both axes: steer around them at 45°, then 80°, choosing
            // the side the walker is already drifting toward (alternating by step otherwise), at a little under full speed.
            if(!mx&&!mz)for(const t of [.785,-.785,1.4,-1.4]){const a=t*(k%2?-1:1),c=Math.cos(a)*.85,sn=Math.sin(a)*.85,rx=sx*c-sz*sn,rz=sx*sn+sz*c;
              if(canStep(w,p.x,p.z,p.x+rx,p.z+rz,lim)){mx=rx;mz=rz;break;}}
            if(mx||mz){move(mx,mz);changed=true;}else break;
          }
        }
        const p=getPoint(),s=surface(w,p.x,p.z),g=s.height??(footY??0),swim=s.height!==null&&Number.isFinite(s.water)&&s.water>1.2;
        // Embedded in something solid (spawned in a trunk, or the world regenerated underfoot): sidle
        // out to the nearest free capsule.
        const feetNow=swim?g+s.water-1.55:footY??g;
        if(w.blockingAt&&w.blockingAt(p.x,p.z,Math.max(g,feetNow)+.55,feetNow+1.7)){
          for(const r of [.4,.8,1.4,2.2]){let out=false;
            for(let a=0;a<8;a++){const x=p.x+Math.cos(a*Math.PI/4)*r,z=p.z+Math.sin(a*Math.PI/4)*r,h=w.ground(x,z);
              if(h!==null&&!w.blockingAt(x,z,h+.55,h+1.7)){move(x-p.x,z-p.z);changed=true;out=true;break;}}
            if(out)break;}
        }
        if(swim){
          // Buoyant: the body hangs from the surface and eyes ride just above it; no jumping.
          airY=0;vy=0;footY=g;camera.y=g;
          camera.eyeY+=(g+s.water+.35-camera.eyeY)*(1-Math.exp(-dt*8));
        }else{
          // Falling: when the ground drops away the feet keep their height and gravity takes over.
          airY=Math.max(0,(footY??g)-g);
          if(keys.has(' ')&&airY<=0){vy=5.4;airY+=vy*dt;}
          else if(airY>0){vy-=16*dt;const next=airY+vy*dt;
            // Land on the highest solid top under the feet — trunk tops and walls are floors too.
            if(vy<0){const top=standTop(w,p.x,p.z,g,g+airY);if(g+next<=top){airY=Math.max(0,top-g);vy=0;}else airY=Math.max(0,next);}
            else airY=Math.max(0,next);
            if(airY<=0)vy=0;}
          footY=g+airY;camera.y=g;
          camera.eyeY=Math.max(g+1.2,camera.eyeY+(footY+1.6-camera.eyeY)*(1-Math.exp(-dt*12)));
        }
        if(changed&&now-lastSave>500){persist();lastSave=now;changed=false;}
      }
      if(active()){$('walkCompass').textContent=['N','NE','E','SE','S','SW','W','NW'][Math.round(((camera.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)/(Math.PI/4))%8]+' · '+Math.round(((camera.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)*180/Math.PI)+'°';}
      if(now>hintUntil)$('walkHint').classList.add('faded');
    }
    window.addEventListener('keydown',e=>{
      if(!active()||editable(e)||e.metaKey||e.ctrlKey||e.altKey)return;
      const k=e.key.length===1?e.key.toLowerCase():e.key;
      if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Shift','m','Escape',' '].includes(k)){
        e.preventDefault();e.stopImmediatePropagation();
        if(k==='m')leave();else if(k==='Escape'){if(document.pointerLockElement===canvas){document.exitPointerLock();lastUnlock=performance.now();}else if(performance.now()-lastUnlock>250)leave();}
        else keys.add(k);
      }
    },true);
    window.addEventListener('keyup',e=>{keys.delete(e.key.length===1?e.key.toLowerCase():e.key);});
    window.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
    document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas){lastUnlock=performance.now();stop();}});
    document.addEventListener('mousemove',e=>{if(active()&&document.pointerLockElement===canvas){camera.yaw-=e.movementX*.0025;camera.lookPitch=clamp(camera.lookPitch-e.movementY*.0025,-PITCH,PITCH);touchYaw=camera.yaw;touchPitch=camera.lookPitch;changed=true;}});
    canvas.addEventListener('pointerdown',e=>{
      if(!active()){if(e.pointerType==='touch')mapTouch={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()};return;}e.stopImmediatePropagation();canvas.focus();
      if(e.pointerType==='mouse')pointers.set(e.pointerId,{startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,stick:false});
      else{e.preventDefault();const r=canvas.getBoundingClientRect();pointers.set(e.pointerId,{startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,stick:e.clientX<r.left+r.width/2});canvas.setPointerCapture(e.pointerId);}
    },true);
    canvas.addEventListener('click',()=>{if(active()&&!transition&&!document.pointerLockElement)canvas.requestPointerLock?.()?.catch?.(e=>hint('Mouse capture unavailable · Drag to look · WASD to walk · M for map'));});
    canvas.addEventListener('pointermove',e=>{
      if(!active()){if(mapTouch&&Math.hypot(e.clientX-mapTouch.x,e.clientY-mapTouch.y)>12)mapTouch=null;return;}e.preventDefault();e.stopImmediatePropagation();const p=pointers.get(e.pointerId);if(!p||document.pointerLockElement===canvas)return;
      if(!p.stick){touchYaw-=(e.clientX-p.x)*.004;touchPitch=clamp(touchPitch-(e.clientY-p.y)*.004,-PITCH,PITCH);changed=true;}p.x=e.clientX;p.y=e.clientY;
      const stick=[...pointers.values()].find(p=>p.stick);$('walkStick').style.transform=stick?'translate('+clamp(stick.x-stick.startX,-56,56)+'px,'+clamp(stick.y-stick.startY,-56,56)+'px)':'';
    },true);
    let lastTap=null;
    for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,e=>{
      if(active()){pointers.delete(e.pointerId);$('walkStick').style.transform='';e.stopImmediatePropagation();if(!pointers.size&&changed){persist();changed=false;}}
      else if(type==='pointerup'&&e.pointerType==='touch'&&mapTouch?.id===e.pointerId&&performance.now()-mapTouch.t<320){
        if(lastTap&&performance.now()-lastTap.t<320&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<24){enter(pick(e.clientX,e.clientY));lastTap=null;}else lastTap={x:e.clientX,y:e.clientY,t:performance.now()};
      }
      mapTouch=null;
    },true);
    canvas.addEventListener('dblclick',e=>{if(!active()){e.preventDefault();enter(pick(e.clientX,e.clientY));}});
    canvas.addEventListener('wheel',e=>{if(active()){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,passive:false});
    $('walk').onclick=()=>enter();$('map').onclick=()=>leave();
    $('walkFov').oninput=()=>{camera.fov=clamp(Number($('walkFov').value),60,90);persist();};
    ui();
    return {enter,leave,update,stop,snapshot:()=>({active:active(),transitioning:!!transition,pointerLocked:document.pointerLockElement===canvas,airborne:airY>0,swimming:(()=>{const s=surface(getWorld(),getPoint().x,getPoint().z);return s.height!==null&&s.water>1.2;})(),...surface(getWorld(),getPoint().x,getPoint().z)})};
  }
  const api={create,canStep,surface};if(typeof module==='object')module.exports=api;root.MicroWalk=api;
})(globalThis);
