(function(root){
  'use strict';
  function eye(s){return s.walkEye||[s.target[0]+Math.cos(s.pitch)*Math.sin(s.yaw)*s.dist,s.target[1]+Math.sin(s.pitch)*s.dist,s.target[2]-Math.cos(s.pitch)*Math.cos(s.yaw)*s.dist];}
  function key(t){return t.mode==='low'?'low:'+t.voxelSize:t.mode==='exterior'?'exterior:'+(t.near?'near':'mid'):t.mode;}
  // Keep these thresholds/order exactly in sync with rust/src/stream.rs.
  // Stream budget: 16 all-around + 24 view-facing + 24 retained turn-buffer
  // exteriors, pinned included; at most 6 carry the close-protection flag.
  // These are target-count bounds, not a byte estimate: the renderer still enforces
  // 128 MiB before upload. Comparison modes detailed/full intentionally keep all
  // exteriors, never interiors. Overflow stays recognizable facade, not a box.
  // Distances are to the parcel prism, expanded max(2m, declared envelope) in
  // XZ for roofs/overhangs, plus 2m above the estimated roof:
  // close 14/20m acquire/retain in EVERY direction; local buffer 36/48m;
  // forward 96/120m at >48/>32px with 25/40deg angular margin (min65/80deg).
  // Held exteriors have a 112m all-around turn buffer and 24m ranking hysteresis
  // (32m for near); 32m forward bias affects far candidates only, never close/local
  // jobs. It exceeds mid retention so a saturated budget can follow a large turn.
  // No direction: conservative all-around 64/80m. Facades acquire >12px,
  // retain >8px (including exteriors stepping down); no frustum-based unload.
  const BASE_EXTERIORS=16,VIEW_EXTERIORS=24,HELD_EXTERIORS=24,MAX_NEAR=6;
  function footprint(p,position){
    const ax=p.right[0]*p.width,az=p.right[1]*p.width,bx=p.inward[0]*p.depth,bz=p.inward[1]*p.depth;
    const x=position[0]-p.origin[0],z=position[2]-p.origin[1],det=ax*bz-az*bx;
    const u=det?(x*bz-z*bx)/det:-1,v=det?(ax*z-az*x)/det:-1;
    function edge(dx,dz,ex,ez){const length=ex*ex+ez*ez,t=length?Math.max(0,Math.min(1,(dx*ex+dz*ez)/length)):0;return Math.hypot(dx-t*ex,dz-t*ez);}
    const horizontal=u>=0&&u<=1&&v>=0&&v<=1?0:Math.min(edge(x,z,ax,az),edge(x,z,bx,bz),edge(x-ax,z-az,bx,bz),edge(x-bx,z-bz,ax,az));
    const margin=Math.max(2,p.envelope?.front||0,p.envelope?.rear||0,p.envelope?.side||0);
    const radius=Math.max(Math.hypot((ax+bx)/2,(az+bz)/2),Math.hypot((ax-bx)/2,(az-bz)/2))+margin;
    const height=(Number(p.options.storeys)||3)*3+3,dy=Math.max(0,p.padY-position[1],position[1]-p.padY-height-2);
    return {distance:Math.hypot(Math.max(0,horizontal-margin),dy),radius,height,x:p.origin[0]+ax/2+bx/2-position[0],z:p.origin[1]+az/2+bz/2-position[2]};
  }
  function targets(city,position,previous=new Map(),mode='stream',pinned=null,view={}){
    const fov=view.fov||70*Math.PI/180,projection=(view.height||720)/(2*Math.tan(fov/2));
    const length=view.forward?Math.hypot(...view.forward):0,forward=length?[view.forward[0]/length,view.forward[1]/length]:null;
    const viewCos=Math.cos(Math.min(Math.PI/2,Math.atan(Math.tan(fov/2)*(view.aspect||1))+10*Math.PI/180));
    const angleCos=[false,true].map(held=>Math.cos(Math.min((held?100:85)*Math.PI/180,Math.max((held?80:65)*Math.PI/180,fov/2+(held?40:25)*Math.PI/180))));
    const desired=new Map(),ranked=city.parcels.map(p=>{
      const old=previous.get(p.id),held=old?.mode==='exterior',g=footprint(p,position),d=g.distance;
      const horizontal=Math.hypot(g.x,g.z);
      // Bounding-circle angular expansion includes partially visible/side buildings.
      const ahead=!forward||horizontal===0||(g.x*forward[0]+g.z*forward[1]+g.radius)/horizontal>=angleCos[held?1:0];
      const visible=!!forward&&(horizontal===0||(g.x*forward[0]+g.z*forward[1]+g.radius)/horizontal>=viewCos);
      const close=d<(old?.near?20:14),local=d<(held?48:36),pixelsPerMetre=projection/Math.max(1,d),projected=Math.max(g.radius*2,g.height)*pixelsPerMetre;
      const eligible=close||local||(forward?(held&&d<112||ahead&&d<(held?120:96)&&projected>(held?32:48)):d<(held?80:64));
      return {p,old,distance:d,pixelsPerMetre,projected,close,eligible,visible,group:close?0:local?1:2,rank:d-(held?(old.near?32:24):0)-(ahead&&forward&&!close&&!local?32:0)};
    });
    ranked.sort((a,b)=>(b.p.id===pinned)-(a.p.id===pinned)||a.group-b.group||a.rank-b.rank||a.p.id-b.p.id);
    const selected=new Set();
    if(mode==='stream'){
      function take(limit,accept){let count=0;for(const r of ranked)if(count<limit&&!selected.has(r.p.id)&&(r.eligible||r.p.id===pinned)&&accept(r)){selected.add(r.p.id);count++;}}
      take(BASE_EXTERIORS,()=>true);
      take(VIEW_EXTERIORS,r=>r.visible);
      take(HELD_EXTERIORS,r=>r.old?.mode==='exterior'&&r.distance<112);
      ranked.sort((a,b)=>Number(selected.has(b.p.id))-Number(selected.has(a.p.id)));
    }
    let nearCount=0;
    for(const {p,old,distance:d,pixelsPerMetre,projected,close,eligible} of ranked){
      let tier='low',near=false;
      if(p.id===pinned){tier='exterior';near=true;nearCount++;}
      else if(mode==='detailed'||mode==='full'){tier='exterior';near=nearCount++<MAX_NEAR;}
      else if(mode==='stream'&&selected.has(p.id)){tier='exterior';near=close&&nearCount<MAX_NEAR;if(near)nearCount++;}
      if(tier==='low'&&mode!=='exterior'&&projected>(old?.mode==='facade'||old?.mode==='exterior'?8:12))tier='facade';
      let voxelSize=pixelsPerMetre>1?.5:pixelsPerMetre>.5?1:2;
      if(old?.mode==='low'){
        if(old.voxelSize===.5&&pixelsPerMetre>.85)voxelSize=.5;
        else if(old.voxelSize===1&&pixelsPerMetre<1.15&&pixelsPerMetre>.425)voxelSize=1;
        else if(old.voxelSize===2&&pixelsPerMetre<.575)voxelSize=2;
      }
      desired.set(p.id,{mode:tier,near,voxelSize,distance:d,projected});
    }
    return desired;
  }
  function prefetch(position,summaries,current=null,inside=false){
    if(!position)return null;if(inside&&current!==null)return current;
    const ranked=Object.entries(summaries).filter(([,s])=>s.entry).map(([id,s])=>({id:Number(id),distance:Math.hypot(position[0]-s.entry[0],position[2]-s.entry[1])})).sort((a,b)=>a.distance-b.distance||a.id-b.id),held=ranked.find(p=>p.id===current),nearest=ranked[0];
    if(held&&held.distance<18&&(!nearest||nearest.id===current||nearest.distance+2>=held.distance))return current;
    return nearest?.distance<12?nearest.id:null;
  }
  const api={eye,key,targets,prefetch};if(typeof module==='object'&&module.exports)module.exports=api;else root.CityStream=api;
})(typeof globalThis!=='undefined'?globalThis:this);
