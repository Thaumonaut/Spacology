(function(root){
  'use strict';
  // CastleVox sparse-brick contract: R16UI coarse cells, 4³ fine bricks in a 1024-wide R8UI atlas.
  function fromVolume(b,model,{deduplicate=true,crop=true}={}){
    const [X,Y,Z]=b.dims,n=b.dims.map(v=>Math.ceil(v/4)),coarse=new Uint16Array(n[0]*n[1]*n[2]),mixed=[],words=[],lookup=new Map(),brick=new Uint8Array(64),view=new Uint32Array(brick.buffer),lo=[X,Y,Z],hi=[0,0,0];let mixedCells=0;
    for(let z=0;z<n[2];z++)for(let y=0;y<n[1];y++)for(let x=0;x<n[0];x++){
      let same=true,first=0;
      for(let fz=0;fz<4;fz++)for(let fy=0;fy<4;fy++)for(let fx=0;fx<4;fx++){
        const xx=x*4+fx,yy=y*4+fy,zz=z*4+fz,i=fx+4*(fy+4*fz),v=xx<X&&yy<Y&&zz<Z?b.vol[xx+X*(zz+Z*yy)]:0;brick[i]=v;if(i===0)first=v;else if(v!==first)same=false;
        if(v){lo[0]=Math.min(lo[0],xx);lo[1]=Math.min(lo[1],yy);lo[2]=Math.min(lo[2],zz);hi[0]=Math.max(hi[0],xx+1);hi[1]=Math.max(hi[1],yy+1);hi[2]=Math.max(hi[2],zz+1);}
      }
      const i=x+n[0]*(y+n[1]*z);
      if(same)coarse[i]=first;
      else{mixedCells++;let index=-1,hash=2166136261,bucket;
        if(deduplicate){for(const v of view)hash=Math.imul(hash^v,16777619);bucket=lookup.get(hash);if(bucket)for(const candidate of bucket){let equal=true;for(let k=0;k<16;k++)if(view[k]!==words[candidate][k]){equal=false;break;}if(equal){index=candidate;break;}}}
        if(index<0){if(mixed.length>=65280)throw new Error('Sparse brick budget exceeded');index=mixed.length;const copy=brick.slice();mixed.push(copy);if(deduplicate){words.push(new Uint32Array(copy.buffer));if(bucket)bucket.push(index);else lookup.set(hash,[index]);}}
        coarse[i]=256+index;}
    }
    const brickRows=Math.max(1,Math.ceil(mixed.length/64))*4,bricks=new Uint8Array(1024*brickRows),pal=new Uint8Array(256*4);
    for(let k=0;k<mixed.length;k++)for(let z=0;z<4;z++)for(let y=0;y<4;y++)for(let x=0;x<4;x++)bricks[(Math.floor(k/64)*4+y)*1024+(k%64)*16+z*4+x]=mixed[k][x+4*(y+4*z)];
    for(let i=1;i<256;i++){pal.set(b.palette.subarray(i*4,i*4+3),(i-1)*4);pal[(i-1)*4+3]=i===b.M.lantern_glow?128:i===b.M.shoji?64:0;}
    const frame={x:model[12],z:model[14],rot:Math.atan2(model[2],model[0])};
    const offset=crop&&hi.some(v=>v)?lo.map(v=>Math.floor(v/4)):n.map(()=>0),size=crop?(hi.some(v=>v)?hi.map((v,i)=>Math.ceil(v/4)-offset[i]):[1,1,1]):n,trimmed=new Uint16Array(size[0]*size[1]*size[2]);
    for(let z=0;z<size[2];z++)for(let y=0;y<size[1];y++){const start=offset[0]+n[0]*(y+offset[1]+n[1]*(z+offset[2]));trimmed.set(coarse.subarray(start,start+size[0]),size[0]*(y+size[1]*z));}
    return {coarse:trimmed,bricks,pal,n:size,offset:offset.map(v=>v*4),o:[offset[0]*b.cell*4,model[13]+offset[1]*b.cell*4,offset[2]*b.cell*4],cvs:b.cell*4,sub:4,brickRows,nb:mixed.length,mixedCells,frame,lo,hi,bytes:trimmed.byteLength+bricks.byteLength+pal.byteLength};
  }
  function sample(v,x,y,z){const o=v.offset||[0,0,0];x-=o[0];y-=o[1];z-=o[2];if(x<0||y<0||z<0||x>=v.n[0]*4||y>=v.n[1]*4||z>=v.n[2]*4)return 0;const c=v.coarse[Math.floor(x/4)+v.n[0]*(Math.floor(y/4)+v.n[1]*Math.floor(z/4))];if(c<256)return c;const b=c-256;return v.bricks[(Math.floor(b/64)*4+y%4)*1024+(b%64)*16+(z%4)*4+x%4];}
  const api={fromVolume,sample};if(typeof module==='object'&&module.exports)module.exports=api;else root.CitySparse=api;
})(typeof globalThis==='object'?globalThis:this);
