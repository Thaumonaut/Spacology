// temp: nodes crossing slice seams, compare both meshes vs old model
const path=require('path');
const cur=require(path.resolve(__dirname,'../prototypes/labs/microvoxel-world/voxel-world-model.js'));
const old=require(process.argv[2]);
function tris(buf,count,dy){const f=new Float32Array(buf),b=new Int8Array(buf),u=new Uint8Array(buf),out=[];
  for(let t=0;t<count;t+=3){const v=[];for(let k=0;k<3;k++){const o=(t+k)*4;v.push([f[o].toFixed(2),(f[o+1]+dy).toFixed(2),f[o+2].toFixed(2),u[(t+k)*16+15]].join(','));}out.push(v.join(';'));}return out;}
function quads(sl){const out=[];const v=new DataView(sl.buffer);for(let q=0;q<sl.count;q+=6){const o=q*8,pts=[];for(let k=0;k<6;k++)pts.push([0,1,2].map(a=>v.getUint16(o+k*8+a*2,true)+(a===1?sl.y:0)).join(','));out.push(pts.join(';')+'|'+v.getUint8(o+6)+'|'+v.getUint8(o+7));}return out;}
// unit faces from quads
function faces(list){const out=[];for(const q of list){const [p,n,m]=q.split('|');const P=p.split(';').map(s=>s.split(',').map(Number));const ax=Math.floor(+n/2);const lo=[0,1,2].map(a=>Math.min(...P.map(x=>x[a]))),hi=[0,1,2].map(a=>Math.max(...P.map(x=>x[a])));
  const u=(ax+1)%3,w=(ax+2)%3;for(let a=lo[u];a<hi[u];a++)for(let b=lo[w];b<hi[w];b++){const c=[0,0,0];c[ax]=lo[ax];c[u]=a;c[w]=b;out.push(c.join(',')+'|'+n+'|'+m);}}return out.sort();}
const a=cur.createWorld(+process.argv[3]||2718,.25,'infinite'),b=old.createWorld(+process.argv[3]||2718,.25,'infinite');
let found=0,badQ=0,badS=0;
for(let L=0;L<=3&&found<40;L++)for(let k=0;k<400&&found<(L+1)*10;k++){
  const nx=Math.round(Math.cos(k*.7)*k*(4>>Math.min(L,2))),nz=Math.round(Math.sin(k*.7)*k*(4>>Math.min(L,2)));
  const N=a.node(L,nx,nz,{smooth:true});if(N.slices.length<2)continue;found++;
  const M=b.node(L,nx,nz,{smooth:true});
  const fa=faces(N.slices.flatMap(quads)),fb=faces(quads({y:0,buffer:M.buffer,count:M.count})).filter(f=>!(f.split('|')[1]==='2'&&f.split(',')[1]==='0'));
  if(fa.join()!==fb.join()){badQ++;if(badQ<3)console.log('quad faces differ',L,nx,nz,fa.length,fb.length);}
  const A=N.slices.flatMap(s=>s.smooth?tris(s.smooth.buffer,s.smooth.count,s.y):[]).sort(),B=tris(M.smooth.buffer,M.smooth.count,0).sort();
  if(A.join('|')!==B.join('|')){badS++;if(badS<3){const sa=new Set(A),sb=new Set(B);console.log('smooth differs',L,nx,nz,A.filter(x=>!sb.has(x)).length,A.filter(x=>!sb.has(x)).slice(0,2),B.filter(x=>!sa.has(x)).slice(0,2));}}
}
console.log({multiSliceNodes:found,badQuadFaces:badQ,badSmooth:badS});
