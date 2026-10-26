(function(){
  'use strict';
  // View ▸ Anime looks: toggles for the A/B look flags (?ground=paint, ?flowers=anime, ?far=lobes, ?grass=lush) and the
  // Flower style menu (?flowerStyle). The
  // generator, stream and renderer read these once at load (some change what each node is built from), so a toggle
  // reloads the page with the flag set or cleared, keeping the current spot, heading and Walk mode.
  const buttons=[...document.querySelectorAll('.look-flags [data-flag]')];
  const params=new URLSearchParams(location.search);
  for(const b of buttons)b.setAttribute('aria-pressed',String(params.get(b.dataset.flag)===b.dataset.value));
  function reload(flag,value,on){
    const next=new URLSearchParams(location.search);
    if(on)next.set(flag,value);else next.delete(flag);
    // Where you are now, so the reload lands on the same view.
    const s=window.MicroWorldLab?.snapshot?.();
    if(s?.position){next.set('cx',s.position.cx);next.set('cz',s.position.cz);next.set('lx',s.position.x.toFixed(2));next.set('lz',s.position.z.toFixed(2));}
    if(Number.isFinite(s?.camera?.yaw))next.set('yaw',s.camera.yaw.toFixed(4));
    if(s?.walk)s.walk.active?next.set('walk','1'):next.delete('walk');
    location.replace(location.pathname+'?'+next.toString()+location.hash);
  }
  for(const b of buttons)b.addEventListener('click',()=>reload(b.dataset.flag,b.dataset.value,b.getAttribute('aria-pressed')!=='true'));
  // Flower style: a value for ?flowerStyle (mixed is the default, so it clears the parameter). Choosing a style also
  // turns Anime flowers on, since the style only applies to them.
  const style=document.getElementById('flowerStyle');
  if(style){
    style.value=params.get('flowerStyle')||'mixed';
    style.addEventListener('change',()=>{
      const v=style.value;history.replaceState(null,'',location.pathname+'?'+(()=>{const q=new URLSearchParams(location.search);v==='mixed'?q.delete('flowerStyle'):q.set('flowerStyle',v);return q;})().toString()+location.hash);
      reload('flowers','anime',true);
    });
  }
})();
