'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const P=require('../prototypes/labs/building-lab/plan.js'),V=require('../prototypes/labs/building-lab/voxels.js'),R=require('../prototypes/labs/building-lab/renderer.js'),Review=require('../prototypes/labs/building-lab/review.js');
const C=require('../prototypes/labs/city-lab/city-model.js'),G=require('../prototypes/labs/city-lab/city-geometry.js'),S=require('../prototypes/labs/city-lab/city-sparse.js');

function popcount(v){v-=v>>>1&0x55555555;v=(v&0x33333333)+(v>>>2&0x33333333);return ((v+(v>>>4)&0x0f0f0f0f)*0x01010101)>>>24;}
function occupancyMaterials(vol){
  let count=0;for(const m of vol)if(m)count++;
  const bits=new Uint32Array(Math.ceil(vol.length/32)),ranks=new Uint32Array(Math.ceil(vol.length/256)),materials=new Uint8Array(count);let j=0;
  for(let i=0;i<vol.length;i++){if(i%256===0)ranks[i>>>8]=j;if(vol[i]){bits[i>>>5]|=1<<(i&31);materials[j++]=vol[i];}}
  function sample(i){if(!(bits[i>>>5]&(1<<(i&31))))return 0;let n=ranks[i>>>8];for(let w=(i>>>8)*8;w<(i>>>5);w++)n+=popcount(bits[w]);n+=popcount(bits[i>>>5]&((1<<(i&31))-1));return materials[n];}
  for(let i=0;i<vol.length;i+=Math.max(1,Math.floor(vol.length/2048)))assert.equal(sample(i),vol[i]);
  return {bits,ranks,materials,sample,bytes:bits.byteLength+ranks.byteLength+materials.byteLength};
}

function compactBricks(v){
  const unique=[],ids=new Map(),remap=new Uint16Array(v.nb);
  for(let k=0;k<v.nb;k++){
    const brick=new Uint8Array(64);for(let z=0;z<4;z++)for(let y=0;y<4;y++)for(let x=0;x<4;x++)brick[x+4*(y+4*z)]=v.bricks[(Math.floor(k/64)*4+y)*1024+(k%64)*16+z*4+x];
    const key=String.fromCharCode(...brick);let id=ids.get(key);if(id===undefined){id=unique.length;ids.set(key,id);unique.push(brick);}remap[k]=id;
  }
  const coarse=Uint16Array.from(v.coarse,c=>c<256?c:256+remap[c-256]),brickRows=Math.max(1,Math.ceil(unique.length/64))*4,bricks=new Uint8Array(1024*brickRows);
  const palettes=[],packed=[],offsets=new Uint32Array(unique.length+1);let payloadBytes=0;
  for(let k=0;k<unique.length;k++){
    const brick=unique[k],palette=[...new Set(brick)],bits=Math.ceil(Math.log2(palette.length)),indices=new Map(palette.map((m,i)=>[m,i])),data=new Uint8Array(bits*8);
    for(let i=0;i<64;i++){const code=indices.get(brick[i]),bit=i*bits,byte=bit>>>3,shift=bit&7;data[byte]|=code<<shift;if(shift+bits>8)data[byte+1]|=code>>>(8-shift);}
    for(let i=0;i<64;i++){const bit=i*bits,byte=bit>>>3,shift=bit&7;assert.equal(palette[((data[byte]|(data[byte+1]||0)<<8)>>>shift)&((1<<bits)-1)],brick[i]);}
    offsets[k]=payloadBytes;payloadBytes+=2+palette.length+data.length;palettes.push(palette);packed.push(data);
    for(let z=0;z<4;z++)for(let y=0;y<4;y++)for(let x=0;x<4;x++)bricks[(Math.floor(k/64)*4+y)*1024+(k%64)*16+z*4+x]=brick[x+4*(y+4*z)];
  }
  offsets[unique.length]=payloadBytes;
  const deduplicated={...v,coarse,bricks,brickRows,nb:unique.length,bytes:coarse.byteLength+bricks.byteLength+v.pal.byteLength};
  return {deduplicated,uniqueBricks:unique.length,originalBricks:v.nb,paletteBytes:coarse.byteLength+offsets.byteLength+payloadBytes+v.pal.byteLength,palettes,packed};
}

function profile({seed=1,terrains=['flat','uneven'],parcelIds=[0,12],repeats=3}={}){
  const rows=[],storage=[];
  for(const terrain of terrains){const city=C.generate(seed,{terrain});
    for(const id of parcelIds){const parcel=city.parcels[id];
      for(let repeat=0;repeat<repeats;repeat++)for(const mode of ['low:.5','low:1','low:2','facade:mesh','exterior:sparse','exterior:mesh','full:sparse','full:mesh']){
        const t=performance.now(),plan=P.generate(parcel.seed,parcel.options),p=performance.now(),[tier,backend]=mode.split(':');let built=p,prepared=p,geometry,sourceBytes=0,transferBytes=0,quads=0,volume,sparse;
        if(tier==='low'||tier==='facade'){geometry=tier==='low'?G.coarseMesh(plan,parcel,city.extent,V.M,Number(backend)):G.planMesh(plan,parcel,city.extent,V.M);built=prepared=performance.now();}
        else{volume=V.build(plan,{exterior:tier==='exterior',closedDoors:true});built=performance.now();G.cityVolume(plan,volume,tier==='exterior');if(tier==='full')volume=Review.openDoors(volume);prepared=performance.now();sourceBytes=volume.vol.byteLength;
          if(backend==='sparse')sparse=S.fromVolume(volume,G.model(parcel,volume),process.env.CITY_BENCH_BASELINE?{deduplicate:false,crop:false}:{});else geometry=R.meshSegment(volume.vol,volume.dims,0,volume.dims[1]);}
        const done=performance.now(),geometryBytes=sparse?sparse.bytes:geometry.verts.byteLength+geometry.idx.byteLength;quads=geometry?.quads||0;transferBytes=geometryBytes+(tier==='full'?sourceBytes:0);
        rows.push({seed,terrain,id,repeat,mode,planMs:p-t,voxelMs:tier==='low'||tier==='facade'?0:built-p,prepareMs:prepared-built,convertMs:tier==='low'||tier==='facade'?built-p:done-prepared,totalMs:done-t,sourceBytes,geometryBytes,transferBytes,quads,mixedBricks:sparse?.nb||0});
        if(repeat===0&&sparse){const a=performance.now(),matrix=occupancyMaterials(volume.vol),afterMatrix=performance.now(),compact=compactBricks(sparse),afterCompact=performance.now();
          for(let i=0;i<volume.vol.length;i+=Math.max(1,Math.floor(volume.vol.length/2048))){const x=i%volume.dims[0],z=Math.floor(i/volume.dims[0])%volume.dims[2],y=Math.floor(i/(volume.dims[0]*volume.dims[2]));assert.equal(S.sample(compact.deduplicated,x,y,z),volume.vol[i]);}
          storage.push({seed,terrain,id,tier,denseBytes:sourceBytes,occupancyOnlyBytes:matrix.bits.byteLength,occupancyMaterialsRankBytes:matrix.bytes,matrixEncodeMs:afterMatrix-a,sparseBytes:sparse.bytes,deduplicatedSparseBytes:compact.deduplicated.bytes,palettePackedSerializedBytes:compact.paletteBytes,mixedBricks:sparse.nb,uniqueBricks:compact.uniqueBricks,compactExtraMs:afterCompact-afterMatrix});}
      }
    }
  }
  return {environment:{date:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,seed,repeats},limits:['Serial Node CPU benchmark, not browser/GPU/mobile performance.','Repeat0 includes colder caches; repeated seeds do not simulate a complete city load.','transferBytes estimates typed-array payloads, excluding structured-clone metadata, small door geometry and worker queue latency.','Binary occupancy alone discards material identity and is not equivalent.','Palette bytes are an experimental serialized representation, not a GPU-compatible atlas.','Deduplication here is a second compaction pass; compactExtraMs is NOT a replacement conversion speedup.'],rows,storage};
}

if(require.main===module){
  const output=process.argv[2];if(output&&!fs.statSync(path.dirname(path.resolve(output))).isDirectory())throw new Error('Output parent must be an existing directory');
  const data=profile({repeats:Number(process.env.CITY_BENCH_REPEATS)||3,parcelIds:(process.env.CITY_BENCH_PARCELS||'0,12').split(',').map(Number)});
  console.table(data.rows.map(r=>({terrain:r.terrain,id:r.id,repeat:r.repeat,mode:r.mode,totalMs:+r.totalMs.toFixed(1),voxelMs:+r.voxelMs.toFixed(1),convertMs:+r.convertMs.toFixed(1),geometryMiB:+(r.geometryBytes/1048576).toFixed(3)})));
  console.table(data.storage.map(r=>({...r,matrixEncodeMs:+r.matrixEncodeMs.toFixed(1),compactExtraMs:+r.compactExtraMs.toFixed(1)})));
  if(output)fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');
}
module.exports={occupancyMaterials,compactBricks,profile};
