// Kit parts (CastleRender format) to three.js geometry. CastleRender.meshParts produces triangles with normals, vertex
// colours and a surface pattern id; here each triangle is wound to match its normal (so front-face culling is correct),
// given UVs in metres from its own plane (walls: along the wall and up; floors and roofs: across and up the slope), so
// textures never stretch whatever the rotation or pitch, and a tangent for normal mapping. Triangles are grouped by
// surface kind; each group becomes one BufferGeometry sharing that kind's material.
import * as THREE from 'three/webgpu';
import {PATTERN_KIND} from './textures.js';

// Kit colours are authored in display (sRGB) space; three lights in linear space.
const lin=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
export function partsToGroups(parts,palette,tiles){
  const m=window.CastleRender.meshParts(parts,palette),groups=new Map(),solids=[];
  // Part centroids (meshParts tags each triangle with its part index): faces are wound to point away from their
  // part's centre. The kit's own normals are not reliable (the old renderer flipped them toward the eye), and every
  // kit part is a closed, near-convex solid, so outward-from-centre is the true outside.
  const cen=new Map();for(let t=0;t<m.p.length/9;t++){const id=m.id[t],c=cen.get(id)||[0,0,0,0];for(let i=0;i<9;i++)c[i%3]+=m.p[t*9+i];c[3]+=3;cen.set(id,c);}
  const G=k=>{let g=groups.get(k);if(!g){g={p:[],n:[],c:[],uv:[],tg:[]};groups.set(k,g);}return g;};
  for(let t=0;t<m.p.length/9;t++){const o=t*9,A=[m.p[o],m.p[o+1],m.p[o+2]],B=[m.p[o+3],m.p[o+4],m.p[o+5]],C=[m.p[o+6],m.p[o+7],m.p[o+8]];
    const v=t*3,flag=m.f[v];if(flag===1)continue;
    let N=[m.n[o],m.n[o+1],m.n[o+2]];const e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]],F=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],fl=Math.hypot(...F);if(fl<1e-9)continue;
    let fn=F.map(x=>x/fl);const pc=cen.get(m.id[t]),cx=pc[0]/pc[3],cy=pc[1]/pc[3],cz=pc[2]/pc[3],tc=[(A[0]+B[0]+C[0])/3-cx,(A[1]+B[1]+C[1])/3-cy,(A[2]+B[2]+C[2])/3-cz];
    // Outward: the face normal must point away from the part centre; shading normals follow it.
    const out=fn[0]*tc[0]+fn[1]*tc[1]+fn[2]*tc[2]<0?-1:1;N=fn.map(x=>x*out);
    let tri=[A,B,C],nv=[[m.n[o],m.n[o+1],m.n[o+2]],[m.n[o+3],m.n[o+4],m.n[o+5]],[m.n[o+6],m.n[o+7],m.n[o+8]]].map(v=>v[0]*N[0]+v[1]*N[1]+v[2]*N[2]<0?v.map(x=>-x):v),cv=[[m.c[o],m.c[o+1],m.c[o+2]],[m.c[o+3],m.c[o+4],m.c[o+5]],[m.c[o+6],m.c[o+7],m.c[o+8]]];
    if(fn[0]*N[0]+fn[1]*N[1]+fn[2]*N[2]<0){tri=[A,C,B];nv=[nv[0],nv[2],nv[1]];cv=[cv[0],cv[2],cv[1]];}
    const kind=flag===2?'glow':PATTERN_KIND[m.t[v]]||'plain',tile=(tiles[kind]||tiles.plain).tile;
    // Face frame: U horizontal along the face (or world X on flat faces), V up the face (or world Z on flat faces).
    let U,V;if(Math.abs(fn[1])>.95){U=[1,0,0];V=[0,0,fn[1]>0?-1:1];}else{const h=Math.hypot(fn[0],fn[2]);U=[-fn[2]/h,0,fn[0]/h];V=[fn[1]*fn[0]/h*-1,h,fn[1]*fn[2]/h*-1];const vl=Math.hypot(...V);V=V.map(x=>x/vl);}
    const w=Math.sign((fn[1]*U[2]-fn[2]*U[1])*V[0]+(fn[2]*U[0]-fn[0]*U[2])*V[1]+(fn[0]*U[1]-fn[1]*U[0])*V[2])||1,g=G(kind);
    for(let i=0;i<3;i++){const P=tri[i];g.p.push(...P);g.n.push(...nv[i]);g.c.push(...cv[i].map(lin));g.uv.push((P[0]*U[0]+P[1]*U[1]+P[2]*U[2])/tile,(P[0]*V[0]+P[1]*V[1]+P[2]*V[2])/tile);g.tg.push(U[0],U[1],U[2],w);}
    if(m.k[t]&&kind!=='glow')solids.push(...tri[0],...tri[1],...tri[2]);}
  return {groups,solids:new Float32Array(solids)};}
export function groupsToMeshes(groups,materials){const out=[];
  for(const [kind,g] of groups){if(!g.p.length)continue;const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(g.p,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(g.n,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(g.c,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(g.uv,2));geo.setAttribute('tangent',new THREE.Float32BufferAttribute(g.tg,4));geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,materials[kind]||materials.plain);mesh.castShadow=kind!=='glow';mesh.receiveShadow=true;mesh.userData.kind=kind;out.push(mesh);}
  return out;}
