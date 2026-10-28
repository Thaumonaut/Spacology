// temp: compare node surfaces vs an old model file
const path=require('path');
const cur=require(path.resolve(__dirname,process.env.CUR||'../prototypes/labs/microvoxel-world/voxel-world-model.js'));
const old=require(process.argv[2]);
function surface(n){const out=[];for(const sl of n.slices||[{y:0,buffer:n.buffer,count:n.count}]){const v=new DataView(sl.buffer);for(let q=0;q<sl.count;q+=6){const o=q*8,pts=[];for(let k=0;k<6;k++)pts.push([0,1,2].map(a=>v.getUint16(o+k*8+a*2,true)+(a===1?sl.y:0)).join(','));
  const normal=v.getUint8(o+6);if(normal===2&&pts.every(p=>p.split(',')[1]==='0'))continue;out.push(pts.join(';')+'|'+normal+'|'+v.getUint8(o+7));}}return out.sort();}
const a=cur.createWorld(2718,.25,'infinite'),b=old.createWorld(2718,.25,'infinite');
const MIX=[[0,4,0,0],[1,4,0,0],[2,4,0,0],[3,3,0,0],[4,2,0,0],[5,1,0,0],[1,3,-64,8],[2,3,-32,4]];
let bad=0;
for(const [L,R,ox,oz] of MIX)for(let j=-R;j<R;j++)for(let i=-R;i<R;i++){
  const n=a.node(L,ox+i,oz+j),m=b.node(L,ox+i,oz+j),A=surface(n),B=surface(m);
  if(A.join()!==B.join()){bad++;const sa=new Set(A),sb=new Set(B);const onlyA=A.filter(x=>!sb.has(x)),onlyB=B.filter(x=>!sa.has(x));
    if(bad<6)console.log(L,ox+i,oz+j,'slices',n.slices.map(s=>s.y+':'+s.count),'top',n.top,m.top,'onlyNew',onlyA.length,onlyA.slice(0,3),'onlyOld',onlyB.length,onlyB.slice(0,3));}
}
console.log('bad',bad);
