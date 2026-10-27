(function(root){
  'use strict';
  const C=typeof module==='object'?require('./city-model.js'):root.CityModel,G=typeof module==='object'?require('./city-geometry.js'):root.CityGeometry,P=typeof module==='object'?require('../building-lab/plan.js'):root.BuildingPlan;
  function safe(city,block,x,z,r){
    return C.contains(block.buildable,[x,z],r)&&!C.contains(block.alleyPolygon,[x,z],-r-.2)&&!city.parcels.filter(p=>p.block===block.id).some(p=>C.contains(p.polygon,[x,z],-r-.6));
  }
  function generate(city){
    const cells=[],keys=new Set(),plants=[];
    for(const block of city.blocks){
      const xs=block.buildable.map(p=>p[0]),zs=block.buildable.map(p=>p[1]),candidates=[];
      for(let z=Math.floor(Math.min(...zs)*2);z<Math.ceil(Math.max(...zs)*2);z++)for(let x=Math.floor(Math.min(...xs)*2);x<Math.ceil(Math.max(...xs)*2);x++){
        const px=(x+.5)/2,pz=(z+.5)/2;if(!safe(city,block,px,pz,.35))continue;
        cells.push([px,pz]);keys.add(x+','+z);candidates.push({x:px,z:pz,rank:P.hash(`park:${city.seed}:${x}:${z}`)});
      }
      candidates.sort((a,b)=>a.rank-b.rank);
      for(const kind of ['tree','bush','bush']){
        const r=kind==='tree'?1.1:.5,c=candidates.find(c=>safe(city,block,c.x,c.z,r)&&!plants.some(p=>Math.hypot(p.x-c.x,p.z-c.z)<p.radius+r+.5));if(!c)continue;
        plants.push({id:plants.length,block:block.id,x:c.x,z:c.z,y:G.roadHeight(city,c.x,c.z),radius:r,height:kind==='tree'?4+(c.rank%3)*.3:.8,kind,seed:c.rank});
      }
    }
    return {cells,keys,plants,parkArea:cells.length*.25,plazaArea:C.area(city.landmarks.plaza.polygon),canopyArea:plants.reduce((s,p)=>s+Math.PI*p.radius*p.radius,0)};
  }
  // Microvoxel World's surface-net construction, specialised to small padded organic occupancy volumes.
  function softMesh(vol,[X,Y,Z]){
    const at=(x,y,z)=>x<0||y<0||z<0||x>=X||y>=Y||z>=Z?0:vol[x+X*(z+Z*y)],nx=X-1,ny=Y-1,nz=Z-1,ids=new Int32Array(nx*ny*nz).fill(-1),positions=[],normals=[],materials=[],idx=[],edges=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]],corners=Array.from({length:8},(_,k)=>[k&1,k>>1&1,k>>2]);
    const id=(x,y,z)=>x<0||y<0||z<0||x>=nx||y>=ny||z>=nz?-1:ids[x+nx*(z+nz*y)];
    for(let y=0;y<ny;y++)for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
      const v=corners.map(([a,b,c])=>at(x+a,y+b,z+c));if(v.every(Boolean)||!v.some(Boolean))continue;
      const pos=[0,0,0];let count=0;for(const [a,b] of edges)if(!v[a]!==!v[b]){for(let j=0;j<3;j++)pos[j]+=(corners[a][j]+corners[b][j])/2;count++;}
      const n=[0,0,0];for(let c=-1;c<=2;c++)for(let b=-1;b<=2;b++)for(let a=-1;a<=2;a++)if(at(x+a,y+b,z+c)){n[0]-=a<1?-1:1;n[1]-=b<1?-1:1;n[2]-=c<1?-1:1;}
      const len=Math.hypot(...n)||1;ids[x+nx*(z+nz*y)]=positions.length;positions.push([x+pos[0]/count,y+pos[1]/count,z+pos[2]/count]);normals.push(n.map(v=>v/len));materials.push(v.find(Boolean));
    }
    for(let d=0;d<3;d++)for(let y=1;y<ny;y++)for(let z=1;z<nz;z++)for(let x=1;x<nx;x++){
      const a=at(x,y,z),b=d===0?at(x+1,y,z):d===1?at(x,y+1,z):at(x,y,z+1);if(!a===!b)continue;
      const q=d===0?[[x,y-1,z-1],[x,y,z-1],[x,y,z],[x,y-1,z]]:d===1?[[x-1,y,z-1],[x-1,y,z],[x,y,z],[x,y,z-1]]:[[x-1,y-1,z],[x,y-1,z],[x,y,z],[x-1,y,z]],v=q.map(p=>id(...p));if(v.some(i=>i<0))continue;
      for(const k of a?[0,1,2,0,2,3]:[0,2,1,0,3,2])idx.push(v[k]);
    }
    return {positions,normals,materials,idx};
  }
  function mesh(city,M){
    const verts=[],normals=[],idx=[],step=.25,E=city.extent;
    for(const p of city.green.plants){
      const X=Math.ceil(p.radius*2/step)+4,Z=X,Y=Math.ceil(p.height/step)+4,vol=new Uint8Array(X*Y*Z),cx=(X-1)/2;
      for(let y=0;y<Y;y++)for(let z=0;z<Z;z++)for(let x=0;x<X;x++){
        const dx=(x-cx)*step,dz=(z-cx)*step,h=(y-2)*step,r=p.radius,leaf=p.kind==='tree'?Math.hypot(dx/r,dz/r,(h-p.height*.7)/(p.height*.3))<1:Math.hypot(dx/r,dz/r,(h-p.height*.4)/(p.height*.6))<1;
        vol[x+X*(z+Z*y)]=leaf?M[p.seed%2?'leaf':'leaf_dark']:p.kind==='tree'&&h>=0&&h<p.height*.65&&Math.hypot(dx,dz)<.19?M.timber_brown:0;
      }
      const soft=softMesh(vol,[X,Y,Z]),base=verts.length/4;
      for(let i=0;i<soft.positions.length;i++){const [x,y,z]=soft.positions[i];verts.push(Math.round((p.x+(x-cx)*step+E)*16),Math.round((p.y+(y-2)*step+32)*16),Math.round((p.z+(z-cx)*step+E)*16),2|(soft.materials[i]<<8));normals.push(...soft.normals[i]);}
      for(const i of soft.idx)idx.push(base+i);
    }
    const model=[1,0,0,0,0,1,0,0,0,0,1,0,-E,-32,-E,1];return {id:'vegetation',verts:Uint16Array.from(verts),idx:Uint32Array.from(idx),normals:Float32Array.from(normals),quads:idx.length/6,model};
  }
  const api={generate,safe,mesh,softMesh};if(typeof module==='object'&&module.exports)module.exports=api;else root.CityGreen=api;
})(typeof globalThis==='object'?globalThis:this);
