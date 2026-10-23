// temp: compare smooth meshes vs an old model file (absolute vertex lists)
const path=require('path');
const cur=require(path.resolve(__dirname,'../prototypes/labs/microvoxel-world/voxel-world-model.js'));
const old=require(process.argv[2]);
function tris(buf,count,dy){const f=new Float32Array(buf),b=new Int8Array(buf),u=new Uint8Array(buf),out=[];
  for(let t=0;t<count;t+=3){const v=[];for(let k=0;k<3;k++){const o=(t+k)*4;v.push([f[o].toFixed(3),(f[o+1]+dy).toFixed(3),f[o+2].toFixed(3),b[(t+k)*16+12],b[(t+k)*16+13],b[(t+k)*16+14],u[(t+k)*16+15]].join(','));}out.push(v.join(';'));}return out;}
const a=cur.createWorld(2718,.25,'infinite'),b=old.createWorld(2718,.25,'infinite');
let bad=0,n=0,multi=0;
for(const [L,R,ox,oz] of [[0,3,0,0],[2,3,0,0],[3,2,0,0],[5,1,0,0],[1,2,-64,8],[2,2,-32,4],[4,2,-16,2]])for(let j=-R;j<R;j++)for(let i=-R;i<R;i++){
  const N=a.node(L,ox+i,oz+j,{smooth:true}),M=b.node(L,ox+i,oz+j,{smooth:true});n++;
  const A=N.slices.flatMap(s=>s.smooth?tris(s.smooth.buffer,s.smooth.count,s.y):[]).sort(),B=tris(M.smooth.buffer,M.smooth.count,0).sort();
  if(N.slices.length>1)multi++;
  if(A.join('|')!==B.join('|')){bad++;if(bad<4){const sa=new Set(A),sb=new Set(B);console.log(L,ox+i,oz+j,A.filter(x=>!sb.has(x)).slice(0,2),B.filter(x=>!sa.has(x)).slice(0,2));}}
}
console.log({nodes:n,bad,multiSlice:multi});
