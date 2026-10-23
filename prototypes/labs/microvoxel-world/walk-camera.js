(function(root){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),PITCH=80*Math.PI/180;
  function surface(world,x,z){
    const height=world.ground(x,z),g=height===null?null:world.geography(x,z);
    return {height,water:g?Math.max(0,(g.water??(g.riverDistance<2.3?Math.ceil(5/world.cell):g.height))-g.height)*world.cell:Infinity};
  }
  function canStep(world,x,z,nx,nz){
    const a=surface(world,x,z),b=surface(world,nx,nz),d=Math.hypot(nx-x,nz-z);
    if(a.height===null||b.height===null||b.water>1||Math.abs(b.height-a.height)>Math.max(world.cell+.01,d))return false;
    const radius=Math.max(.5,world.cell*2),gx=(world.ground(nx+radius,nz)??b.height)-(world.ground(nx-radius,nz)??b.height),
      gz=(world.ground(nx,nz+radius)??b.height)-(world.ground(nx,nz-radius)??b.height);
    return Math.hypot(gx,gz)<=2*radius+world.cell*.1;
  }
  function create({canvas,camera,getWorld,getPoint,setPoint,move,onChange,persist,pick,reducedMotion}){
    const $=id=>document.getElementById(id),keys=new Set(),pointers=new Map();
    let transition=null,mapSpan=camera.span,lastUnlock=-Infinity,changed=false,lastSave=0,touchYaw=0,touchPitch=0,hintUntil=0,mapTouch=null;
    const active=()=>camera.mode==='walk',editable=e=>e.target.closest?.('input,select,textarea,[contenteditable]')||document.querySelector('dialog[open]');
    const stop=()=>{keys.clear();pointers.clear();if(changed){persist();changed=false;}};
    function hint(text){$('walkHint').textContent=text;hintUntil=performance.now()+6500;$('walkHint').classList.remove('faded');}
    function ui(){
      document.body.classList.toggle('walking',active());$('walk').hidden=active();$('map').hidden=!active();
      canvas.setAttribute('aria-label',active()?'Walk view. Click to look around, WASD or arrows to walk, M for map. Touch: left stick moves, right drag looks.':'World map. Drag or arrows to pan. Double click terrain to walk.');
    }
    function switchMode(enter,instant=false){
      camera.mode=enter?'walk':'map';
      const p=getPoint(),g=getWorld().ground(p.x,p.z)??0;
      if(enter){camera.eyeY=g+1.6+(instant||reducedMotion()?0:5);camera.y=g;touchYaw=camera.yaw;touchPitch=camera.lookPitch;hint(matchMedia('(pointer: coarse)').matches?'Left side to walk · Right side to look · Map to leave':'Click to look around · WASD to walk · M for map');}
      else{camera.y=g;camera.span=reducedMotion()?mapSpan:8;}
      ui();onChange();persist();
    }
    function enter(point,instant=false){
      if(active()||transition)return false;
      const p=point||getPoint(),s=surface(getWorld(),p.x,p.z);
      if(s.height===null||s.water>1){hint('Choose dry ground or water less than 1 m deep.');return false;}
      stop();if(point)setPoint(point);mapSpan=camera.span;camera.yaw=instant&&Number.isFinite(camera.yaw)?camera.yaw:35*Math.PI/180;camera.lookPitch=-.08;
      if(instant||reducedMotion())switchMode(true,true);else transition={enter:true,t:0,switched:false};
      return true;
    }
    function leave(instant=false){
      if(!active()||transition)return;
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
        const n=Math.max(1,Math.hypot(right,forward)),speed=keys.has('Shift')?8:4;
        const dx=(right*Math.cos(camera.yaw)-forward*Math.sin(camera.yaw))/n*speed*dt,dz=(-right*Math.sin(camera.yaw)-forward*Math.cos(camera.yaw))/n*speed*dt;
        if(dx||dz){
          const p=getPoint(),w=getWorld();let mx=0,mz=0;
          if(canStep(w,p.x,p.z,p.x+dx,p.z+dz)){mx=dx;mz=dz;}
          else{if(canStep(w,p.x,p.z,p.x+dx,p.z))mx=dx;if(canStep(w,p.x+mx,p.z,p.x+mx,p.z+dz))mz=dz;}
          if(mx||mz){move(mx,mz);changed=true;}
        }
        const p=getPoint(),g=getWorld().ground(p.x,p.z)??0;camera.y=g;camera.eyeY=Math.max(g+1.2,camera.eyeY+(g+1.6-camera.eyeY)*(1-Math.exp(-dt*12)));
        if(changed&&now-lastSave>500){persist();lastSave=now;changed=false;}
      }
      if(active()){$('walkCompass').textContent=['N','NE','E','SE','S','SW','W','NW'][Math.round(((camera.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)/(Math.PI/4))%8]+' · '+Math.round(((camera.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)*180/Math.PI)+'°';}
      if(now>hintUntil)$('walkHint').classList.add('faded');
    }
    window.addEventListener('keydown',e=>{
      if(!active()||editable(e)||e.metaKey||e.ctrlKey||e.altKey)return;
      const k=e.key.length===1?e.key.toLowerCase():e.key;
      if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Shift','m','Escape'].includes(k)){
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
    return {enter,leave,update,stop,snapshot:()=>({active:active(),transitioning:!!transition,pointerLocked:document.pointerLockElement===canvas,...surface(getWorld(),getPoint().x,getPoint().z)})};
  }
  const api={create,canStep,surface};if(typeof module==='object')module.exports=api;root.MicroWalk=api;
})(globalThis);
