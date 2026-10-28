(function(root){
  'use strict';
  const W=typeof module==='object'?require('../building-lab/walk.js'):root.BuildingWalk,G=typeof module==='object'?require('./city-geometry.js'):root.CityGeometry,C=typeof module==='object'?require('./city-model.js'):root.CityModel;
  function world(model,p){return [model[0]*p[0]+model[8]*p[2]+model[12],p[1]+model[13],model[2]*p[0]+model[10]*p[2]+model[14]];}
  function local(parcel,dx,dz){return [dx*parcel.right[0]+dz*parcel.right[1],dx*parcel.inward[0]+dz*parcel.inward[1]];}
  function create(parcel,data,city=null){
    const {plan,building}=data,model=G.model(parcel,{...building,cityFront:plan.plot.front*plan.cell}),heights=new Map(),neighbors=city?.parcels.filter(p=>Math.hypot(p.origin[0]-parcel.origin[0],p.origin[1]-parcel.origin[1])<40)||[],plants=city?.green?.plants.filter(p=>p.kind==='tree')||[];
    function ground(x,z){const key=Math.floor(x/building.cell)+','+Math.floor(z/building.cell);if(heights.has(key))return heights.get(key);
      const cv=plan.cell/building.cell,[gx,gz]=[Math.floor((x/building.cell-building.origin[0])/cv),Math.floor((z/building.cell-building.origin[2])/cv)],inside=gx>=0&&gx<plan.plot.w&&gz>=0&&gz<plan.plot.d&&plan.plot.masks[0][gx+plan.plot.w*gz];let h=null;
      if(!inside){const [wx,,wz]=world(model,[x,0,z]);h=Math.abs(wx)>=city.extent||Math.abs(wz)>=city.extent||neighbors.some(p=>p.id!==parcel.id&&C.contains(p.polygon,[wx,wz],-W.BODY.radius))||plants.some(p=>Math.hypot(wx-p.x,wz-p.z)<.45)?Infinity:G.walkHeight(city,wx,wz,neighbors)-model[13];}heights.set(key,h);return h;
    }
    const walk=W.create(plan,building,city?{openDoors:false,preservePosition:true,ground}:{}),doors=data.doors;
    function setDoorOpen(open){if(doors)for(let i=0;i<doors.indices.length;i++)building.vol[doors.indices[i]]=open?0:doors.materials[i];}
    if(city)setDoorOpen(false);
    return {
      enter(){const start=walk.enter('resident',0);if(!start)return null;const [x,z]=W.direction(start.yaw,0,1),dx=x*parcel.right[0]+z*parcel.inward[0],dz=x*parcel.right[1]+z*parcel.inward[1];return {yaw:Math.atan2(dx,dz)};},
      move(dx,dz){return walk.move(...local(parcel,dx,dz));},
      place(eye){const [x,z]=local(parcel,eye[0]-model[12],eye[2]-model[14]);return walk.place([x,eye[1]-W.BODY.eye-model[13],z]);},
      setDoorOpen,
      canCloseDoor(){const p=walk.snapshot().position;if(!p)return true;return !(doors?.boxes||[]).some(([x0,y0,z0,x1,y1,z1])=>{const c=building.cell,dx=Math.max(x0*c-p[0],0,p[0]-x1*c),dz=Math.max(z0*c-p[2],0,p[2]-z1*c);return p[1]<y1*c&&p[1]+W.BODY.height>y0*c&&Math.hypot(dx,dz)<W.BODY.radius+.05;});},
      snapshot(){const s=walk.snapshot();return s.active?{...s,position:world(model,s.position),eye:world(model,s.eye)}:s;},
      leave:walk.leave,
      bytes:walk.building.vol.byteLength
    };
  }
  const api={create,world,local};if(typeof module==='object'&&module.exports)module.exports=api;else root.CityWalk=api;
})(typeof globalThis==='object'?globalThis:this);
