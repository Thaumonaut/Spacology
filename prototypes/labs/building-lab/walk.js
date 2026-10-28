(function(root){
  'use strict';
  const R=typeof module==='object'&&module.exports?require('./review.js'):root.BuildingReview;
  const BODY={...R.BODY,height:1.75,eye:1.6,speed:1.5};
  function direction(yaw,right,forward){
    const n=Math.max(1,Math.hypot(right,forward));
    return [(-right*Math.cos(yaw)+forward*Math.sin(yaw))/n,(forward*Math.cos(yaw)+right*Math.sin(yaw))/n];
  }
  function look(yaw,pitch,dx,dy,sensitivity=.004){return {yaw:yaw-dx*sensitivity,pitch:Math.max(-1.35,Math.min(1.35,pitch-dy*sensitivity))};}
  function create(plan,original,options={}){
    const building=options.openDoors===false?original:R.openDoors(original),b=building,[X,Y,Z]=b.dims,c=b.cell,body={...BODY};
    let position=null,nav=null;
    const at=(x,y,z)=>{const inBounds=x>=0&&x<X&&y>=0&&y<Y&&z>=0&&z<Z,v=inBounds?b.vol[x+X*(z+Z*y)]:0;
      if(v)return v;const ground=options.ground?.((x+.5)*c,(z+.5)*c);return ground!==null&&ground!==undefined?(y*c<ground?1:0):inBounds?0:1;};
    function stand(x,z,feet){
      const px=Math.floor(x/c),pz=Math.floor(z/c),level=Math.round(feet/c),step=Math.floor(body.maxStep/c),height=Math.ceil(body.height/c);
      const foot=[];
      for(let zz=Math.floor((z-body.radius)/c);zz<=Math.floor((z+body.radius)/c);zz++)for(let xx=Math.floor((x-body.radius)/c);xx<=Math.floor((x+body.radius)/c);xx++){
        const dx=Math.max(xx*c-x,0,x-(xx+1)*c),dz=Math.max(zz*c-z,0,z-(zz+1)*c);
        if(dx*dx+dz*dz<body.radius*body.radius)foot.push([xx,zz]);
      }
      for(let y=level+step;y>=level-step;y--){
        const supported=foot.filter(([xx,zz])=>at(xx,y-1,zz)&&!at(xx,y,zz)).length;
        if(!(at(px,y-1,pz)&&!at(px,y,pz))&&supported<Math.ceil(foot.length*.2))continue;
        let f=0;while(f+1<plan.floors.length&&y>=b.levels[f+1])f++;
        const [MX,,MZ]=b.origin,cv=plan.cell/c,gx=Math.floor((px-MX)/cv),gz=Math.floor((pz-MZ)/cv),stair=gx>=0&&gx<plan.plot.w&&gz>=0&&gz<plan.plot.d&&plan.floors[f].grid[gx+plan.plot.w*gz]===0;
        let clear=true;
        for(const [xx,zz] of foot){
          const sx=Math.floor((xx-MX)/cv),sz=Math.floor((zz-MZ)/cv),onStair=stair||sx>=0&&sx<plan.plot.w&&sz>=0&&sz<plan.plot.d&&plan.floors[f].grid[sx+plan.plot.w*sz]===0;
          for(let yy=y+step;yy<y+height;yy++){const m=at(xx,yy,zz);if(m&&!(onStair&&yy<y+step*2&&(m===b.M.stair_wood||m===b.M.plank))){clear=false;break;}}
          if(!clear)break;
        }
        if(clear)return y*c;
      }
      return null;
    }
    function enter(start='resident',floor=0){
      nav=nav||R.navigation(plan,b,body);let candidates=[],yaw=0;
      if(start==='floor'){
        const rooms=plan.floors[floor].rooms.filter(r=>r.cells&&r.type!=='stair').sort((a,b)=>(b.type==='hall')-(a.type==='hall'));
        for(const room of rooms){candidates=nav.nearest(floor+':'+room.id,(b.origin[0]+(room.box[0]+room.box[2]+1)*4)*c,(b.origin[2]+(room.box[1]+room.box[3]+1)*4)*c,Infinity);if(candidates.length)break;}
      }else{
        const F=plan.floors[0],front=F.openings.filter(o=>o.kind==='front'),entry=front.find(o=>start==='resident'?F.rooms[o.room].zone==='resident':['public','service'].includes(F.rooms[o.room].zone))||front[0];
        if(entry){const [dx,dz]={xm:[-1,0],xp:[1,0],zm:[0,-1],zp:[0,1]}[entry.side],depth=.85+(entry.recess?.depth||0)*plan.cell,
          x=b.origin[0]*c+(entry.cells.reduce((s,a)=>s+a[0],0)/entry.cells.length+.5)*plan.cell+dx*depth,
          z=b.origin[2]*c+(entry.cells.reduce((s,a)=>s+a[1],0)/entry.cells.length+.5)*plan.cell+dz*depth;
          candidates=nav.nearest(null,x,z,.8);yaw=Math.atan2(-dx,-dz);
        }
      }
      for(const i of candidates){const [x,y,z]=nav.nodes[i].point,standing=stand(x,z,y);if(standing!==null){position=[x,standing,z];return {position:position.slice(),yaw};}}
      position=null;return null;
    }
    function move(dx,dz){
      if(!position||!Number.isFinite(dx)||!Number.isFinite(dz)||!dx&&!dz)return false;
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(c/2))),sx=dx/steps,sz=dz/steps;let moved=false;
      const step=(x,z)=>{const y=stand(x,z,position[1]);if(y===null)return false;position=[x,y,z];moved=true;return true;};
      for(let k=0;k<steps;k++)if(!step(position[0]+sx,position[2]+sz)){
        if(sx)step(position[0]+sx,position[2]);if(sz)step(position[0],position[2]+sz);
      }
      return moved;
    }
    function place(p){if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))return false;const y=stand(p[0],p[2],p[1]);if(y===null)return false;position=[p[0],options.preservePosition?p[1]:y,p[2]];return true;}
    function snapshot(){
      if(!position)return {active:false,body};
      let floor=0;while(floor+1<plan.floors.length&&position[1]>=b.levels[floor+1]*c-.01)floor++;
      const x=Math.floor((position[0]/c-b.origin[0])/8),z=Math.floor((position[2]/c-b.origin[2])/8),k=x>=0&&x<plan.plot.w&&z>=0&&z<plan.plot.d?plan.floors[floor].grid[x+plan.plot.w*z]:-1;
      return {active:true,position:position.slice(),eye:[position[0],position[1]+body.eye,position[2]],floor,room:k>=0?plan.floors[floor].rooms[k].label:'Outside',body};
    }
    return {building,body,enter,place,move,stand,snapshot,leave:()=>{position=null;}};
  }
  const api={BODY,create,direction,look};if(typeof module==='object'&&module.exports)module.exports=api;else root.BuildingWalk=api;
})(typeof globalThis==='object'?globalThis:this);
