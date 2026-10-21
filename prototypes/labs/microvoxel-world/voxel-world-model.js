(function(root){
  'use strict';
  const CELL=.25,CHUNK=32,HEIGHT=96,EXTENT=128,REVISION='micro-catchment-1';
  const MAT=Object.freeze({air:0,basalt:1,soil:2,grass:3,sand:4,bark:5,leaf:6,water:7,ore:8,flower:9});
  const COLORS=Object.freeze(['#000000','#717d91','#72614e','#85a96b','#c1b993','#665145','#426c57','#488f9b','#d6a85e','#e6baac']);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function hash(x,z,seed=0){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^(seed|0);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
  function noise(x,z,seed){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);const a=hash(ix,iz,seed),b=hash(ix+1,iz,seed),c=hash(ix,iz+1,seed),d=hash(ix+1,iz+1,seed);return (a+(b-a)*sx)*(1-sz)+(c+(d-c)*sx)*sz;}
  const riverX=z=>78+9*Math.sin(z*.046)+3*Math.sin(z*.11);
  const MAX_CHUNK=16777215,CHUNK_METRES=CELL*CHUNK;
  function movePosition(position,dx=0,dz=0){
    if(![position.cx,position.cz].every(n=>Number.isInteger(n)&&Math.abs(n)<=MAX_CHUNK)||![position.x,position.z,dx,dz].every(Number.isFinite))throw new Error('Valid chunk/local coordinates required');
    const result={};
    for(const [axis,delta] of [['x',dx],['z',dz]]){
      const local=position[axis]+delta,shift=Math.floor(local/CHUNK_METRES),chunk=position['c'+axis]+shift;
      result['c'+axis]=clamp(chunk,-MAX_CHUNK,MAX_CHUNK);
      result[axis]=chunk< -MAX_CHUNK?0:chunk>MAX_CHUNK?CHUNK_METRES-1/1024:local-shift*CHUNK_METRES;
    }
    return result;
  }
  const positionAt=(x,z)=>movePosition({cx:0,cz:0,x:0,z:0},x,z);
  function createWorld(seed=2718,cellMetres=CELL,extent=EXTENT){
    if(![CELL,CELL/2].includes(cellMetres))throw new Error('Cell size must be 0.25 or 0.125 metres');
    if(![EXTENT,EXTENT*2,'infinite'].includes(extent))throw new Error('World extent must be 128, 256 or infinite');
    const infinite=extent==='infinite',revision=infinite?'micro-wilds-1':REVISION;
    const density=CELL/cellMetres,chunkCells=CHUNK*density,heightCells=HEIGHT*density;
    seed=Number(seed)>>>0;
    const id=`${infinite?'wilds':'catchment'}:${revision}:${seed}`,trees=new Map();
    function geography(x,z){
      if(infinite){
        const warp=(noise(x*.006,z*.006,seed+101)-.5)*50;
        const riverDistance=Math.abs(noise((x+warp)*.012,z*.012,seed+103)-.5)*180;
        const ridge=1-Math.abs(noise(x*.009,z*.009,seed+107)-.5)*2;
        const fault=Math.abs(noise(x*.04,z*.04,seed+109)-.5)*20;
        const bank=clamp((riverDistance-2.3)/8,0,1);
        const h=5+(2+noise(x*.032,z*.032,seed)*3+noise(x*.13,z*.13,seed+1)*.8+ridge**4*6)*bank;
        return {height:clamp(Math.floor(h/cellMetres),1,heightCells-28*density),riverDistance,ridge,fault,clearing:0,exposed:ridge>.82||fault<1.4,wet:riverDistance<12};
      }
      const riverDistance=Math.abs(x-riverX(z));
      const ridge=Math.exp(-(((x-29)/14)**2))*(.65+.35*Math.sin(z*.025+.4));
      const fault=Math.abs(x-(39+3*Math.sin(z*.075)));
      let h=7+noise(x*.032,z*.032,seed)*3+noise(x*.13,z*.13,seed+1)*.8+ridge*7;
      const clearing=1-clamp((Math.hypot(x-49,z-58)-8)/7,0,1);
      h=h*(1-clearing)+8*clearing;
      const bank=clamp((riverDistance-2.3)/8,0,1);
      h=5+(h-5)*bank;
      const exposed=ridge>.45||fault<1.4&&x<45;
      return {height:clamp(Math.floor(h/cellMetres),1,heightCells-28*density),riverDistance,ridge,fault,clearing,exposed,wet:riverDistance<12};
    }
    function ground(x,z){if(!infinite&&(x<0||z<0||x>=extent||z>=extent))return null;return geography((Math.floor(x/cellMetres)+.5)*cellMetres,(Math.floor(z/cellMetres)+.5)*cellMetres).height*cellMetres;}
    function tree(gx,gz){
      const grid=Math.ceil(extent/5);
      if(!infinite&&(gx<0||gz<0||gx>=grid||gz>=grid))return null;
      const key=`${gx}:${gz}`;if(trees.has(key))return trees.get(key);
      const x=(gx+.2+.6*hash(gx,gz,seed+9))*5,z=(gz+.2+.6*hash(gx,gz,seed+11))*5;
      const g=geography(x,z);
      const edge=gx<Math.ceil(EXTENT/5)&&gz<Math.ceil(EXTENT/5)?EXTENT:extent;
      const value=(!infinite&&(x<1||z<1||x>edge-1||z>edge-1||x>extent-1||z>extent-1))||g.clearing>.1||g.riverDistance<11||g.exposed||hash(gx,gz,seed+23)<.28?null:{x,z,base:g.height,height:(12+Math.floor(hash(gx,gz,seed+4)*9))*density,radius:(5+Math.floor(hash(gx,gz,seed+5)*3))*density};
      if(value)Object.freeze(value);if(trees.size>=2048)trees.delete(trees.keys().next().value);trees.set(key,value);return value;
    }
    // Root geology and identity survive render/cache changes.
    let rootSite=null,score=Infinity;
    if(infinite){
      for(let z=-128;z<=128;z+=2)for(let x=-128;x<=128;x+=2){const g=geography(x,z);if(g.exposed&&g.riverDistance>12&&[.0625,.125].every(offset=>geography(x+offset,z+offset).exposed)){const s=Math.hypot(x,z);if(s<score){score=s;rootSite={x,z};}}}
      if(!rootSite)throw new Error('No dry basalt root in the starting survey');
    }else for(let z=40;z<77;z+=.5)for(let x=34;x<44;x+=.5){const g=geography(x,z);if(g.exposed&&g.fault<1){const s=Math.hypot(x-42,z-58);if(s<score){score=s;rootSite={x,z};}}}
    const deposit=Object.freeze({id:`${id}:ore:root`,kind:'Ferrite',x:rootSite.x,z:rootSite.z,y:ground(rootSite.x,rootSite.z),rule:infinite?'Dry exposed basalt in the seeded ridge and fracture fields':'Exposed basalt along the western fault above the river catchment',geology:infinite?'Ridge/fracture-exposed basalt':'Fault-exposed basalt',surveyed:true});
    function column(vx,vz){
      const values=new Uint8Array(heightCells);
      const x=(vx+.5)*cellMetres,z=(vz+.5)*cellMetres;
      if(!infinite&&(x<0||z<0||x>=extent||z>=extent))return values;
      const g=geography(x,z),h=g.height;
      values.fill(MAT.basalt,0,Math.max(0,h-4*density));
      values.fill(g.exposed?MAT.basalt:MAT.soil,Math.max(0,h-4*density),h);
      values[h-1]=g.exposed?MAT.basalt:g.riverDistance<9?MAT.sand:MAT.grass;
      if(Math.hypot(x-deposit.x,z-deposit.z)<1.15&&g.exposed)values.fill(MAT.ore,h-3*density,h);
      if(h<24*density&&g.riverDistance<7)values.fill(MAT.water,h,24*density);
      const gx=Math.floor(x/5),gz=Math.floor(z/5);
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        const t=tree(gx+dx,gz+dz);if(!t)continue;
        const dist=Math.hypot((x-t.x)/cellMetres,(z-t.z)/cellMetres),top=t.base+t.height;
        if(dist<.72*density)values.fill(MAT.bark,t.base,top);
        if(dist<t.radius){
          const rise=Math.sqrt(t.radius*t.radius-dist*dist);
          const low=Math.max(t.base+5*density,Math.floor(top-rise*.55)),high=Math.min(heightCells,Math.ceil(top+rise*.65));
          for(let y=low;y<high;y++)if(!values[y])values[y]=MAT.leaf;
        }
      }
      if(!g.exposed&&!g.wet&&g.clearing<.5&&hash(Math.floor(vx/density),Math.floor(vz/density),seed+52)>.994&&values[h]===0)values.fill(MAT.flower,h,h+density);
      return values;
    }
    function generateChunk(cx,cz){
      if(![cx,cz].every(n=>Number.isInteger(n)&&(!infinite||Math.abs(n)<=MAX_CHUNK)))throw new Error('Chunk coordinates exceed the supported range');
      const offsets=new Uint16Array(chunkCells*chunkCells+1),ends=[],materials=[];
      for(let z=0;z<chunkCells;z++)for(let x=0;x<chunkCells;x++){
        const i=z*chunkCells+x,v=column(cx*chunkCells+x,cz*chunkCells+z);offsets[i]=ends.length;
        for(let y=0;y<heightCells;){const material=v[y];let end=y+1;while(end<heightCells&&v[end]===material)end++;ends.push(end);materials.push(material);y=end;}
      }
      if(ends.length>65535)throw new Error('Column runs exceed the chunk offset format');
      offsets[chunkCells*chunkCells]=ends.length;
      const chunk={cx,cz,size:chunkCells,height:heightCells,cell:cellMetres,offsets,ends:Uint8Array.from(ends),materials:Uint8Array.from(materials)};
      chunk.bytes=chunk.offsets.byteLength+chunk.ends.byteLength+chunk.materials.byteLength;
      return chunk;
    }
    return Object.freeze({id,dataId:`${id}:cell:${cellMetres}:extent:${extent}`,seed,revision,extent,infinite,cell:cellMetres,chunkCells,heightCells,chunkMetres:chunkCells*cellMetres,heightMetres:heightCells*cellMetres,deposit,geography,ground,column,tree,generateChunk,vegetationEntries:()=>trees.size});
  }
  function voxel(chunk,x,y,z){
    const {size:CHUNK,height:HEIGHT}=chunk;
    if(x<0||z<0||y<0||x>=CHUNK||z>=CHUNK||y>=HEIGHT)return MAT.air;
    const i=z*CHUNK+x;
    for(let r=chunk.offsets[i];r<chunk.offsets[i+1];r++)if(y<chunk.ends[r])return chunk.materials[r];
    return MAT.air;
  }
  function meshChunk(world,chunk,step=1){
    const {size:CHUNK,height:HEIGHT}=chunk;
    if(chunk.cell!==world.cell)throw new Error('Chunk resolution does not match the world');
    if(![1,2,4,8].includes(step))throw new Error('Render step must be 1, 2, 4 or 8');
    const nx=CHUNK/step,ny=HEIGHT/step,dims=[nx,ny,nx],halo=nx+2;
    const dense=new Uint8Array(halo*halo*(ny+2));
    const at=(x,y,z)=>dense[(z+1)*halo*(ny+2)+(y+1)*halo+x+1];
    for(let z=-1;z<=nx;z++)for(let x=-1;x<=nx;x++){
      const local=x>=0&&z>=0&&x<nx&&z<nx;
      const col=local?null:world.column(chunk.cx*CHUNK+x*step,chunk.cz*CHUNK+z*step);
      for(let y=0;y<ny;y++){
        let material=0;
        // Preserve the top occupied material when reducing a vertical block (grass must not become soil).
        for(let dy=step-1;dy>=0&&!material;dy--)material=local?voxel(chunk,x*step,y*step+dy,z*step):col[y*step+dy];
        dense[(z+1)*halo*(ny+2)+(y+1)*halo+x+1]=material;
      }
    }
    const mask=new Int16Array(Math.max(nx*ny,nx*nx));
    let output=new ArrayBuffer(16384),view=new DataView(output),used=0,quads=0,exposedFaces=0;
    for(let d=0;d<3;d++){
      const u=(d+1)%3,v=(d+2)%3,p=[0,0,0],q=[0,0,0];q[d]=1;
      for(p[d]=-1;p[d]<dims[d];p[d]++){
        let n=0;
        for(p[v]=0;p[v]<dims[v];p[v]++)for(p[u]=0;p[u]<dims[u];p[u]++){
          const a=at(...p),b=at(p[0]+q[0],p[1]+q[1],p[2]+q[2]);
          // The neighbouring solid owns its face; never duplicate it in this chunk.
          const value=a&&!b&&p[d]>=0?a:!a&&b&&p[d]<dims[d]-1?-b:0;
          mask[n++]=value;if(value)exposedFaces++;
        }
        for(let j=0;j<dims[v];j++)for(let i=0;i<dims[u];){
          n=j*dims[u]+i;const c=mask[n];if(!c){i++;continue;}
          let w=1;while(i+w<dims[u]&&mask[n+w]===c)w++;
          let h=1;outer:while(j+h<dims[v]){for(let k=0;k<w;k++)if(mask[n+k+h*dims[u]]!==c)break outer;h++;}
          const pos=[0,0,0],du=[0,0,0],dv=[0,0,0];pos[d]=p[d]+1;pos[u]=i;pos[v]=j;du[u]=w;dv[v]=h;
          const normal=d*2+(c>0?1:0),m=Math.abs(c),corners=[pos,pos.map((t,k)=>t+du[k]),pos.map((t,k)=>t+du[k]+dv[k]),pos.map((t,k)=>t+dv[k])];
          if(used+48>output.byteLength){const larger=new ArrayBuffer(output.byteLength*2);new Uint8Array(larger).set(new Uint8Array(output));output=larger;view=new DataView(output);}
          for(const k of c>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]){for(let a=0;a<3;a++)view.setUint16(used+a*2,corners[k][a],true);view.setUint8(used+6,normal);view.setUint8(used+7,m);used+=8;}
          quads++;for(let b=0;b<h;b++)for(let a=0;a<w;a++)mask[n+a+b*dims[u]]=0;i+=w;
        }
      }
    }
    const buffer=output.slice(0,used);
    return {buffer,count:quads*6,quads,exposedFaces,step,temporaryDenseBytes:dense.byteLength,scratchBytes:dense.byteLength+mask.byteLength+output.byteLength+used};
  }
  class BudgetCache{
    constructor(maxEntries=144,maxBytes=32*1024*1024,dispose=()=>{}){this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.dispose=dispose;this.items=new Map();this.bytes=0;}
    get(key){const v=this.items.get(key);if(v){this.items.delete(key);this.items.set(key,v);}return v;}
    set(key,value,retain=[]){this.delete(key);if(value.bytes>this.maxBytes){this.dispose(value);return false;}for(const k of retain)this.get(k);this.items.set(key,value);this.bytes+=value.bytes;while(this.items.size>this.maxEntries||this.bytes>this.maxBytes)this.delete(this.items.keys().next().value);return true;}
    delete(key){const v=this.items.get(key);if(v){this.bytes-=v.bytes;this.items.delete(key);this.dispose(v);}}
    clear(){for(const key of this.items.keys())this.delete(key);}
  }
  const api={CELL,CHUNK,HEIGHT,EXTENT,REVISION,MAX_CHUNK,MAT,COLORS,hash,riverX,movePosition,positionAt,createWorld,voxel,meshChunk,BudgetCache};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MicroWorld=api;
})(typeof globalThis==='object'?globalThis:this);
