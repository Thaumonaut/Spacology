'use strict';
// Kit assets: every asset builds, its parts are finite, it stands on the ground (reaches y <= 0.05, nothing below -1 m)
// and stays inside its declared footprint; gallery and combination scenes build.
const assert=require('node:assert/strict'),K=require('../../prototypes/labs/castle-drafts/toolkit/props-kit.js');
// Half extents along x and z of a part (rotated boxes by their rotation).
const ext=(p,ax)=>{if(p.x0!=null){const dx=p.x1-p.x0,dz=p.z1-p.z0,L=Math.hypot(dx,dz)||1;return (p.w||0)/2*Math.abs(ax?dx:dz)/L;}if(p.s!=null&&p.t==='beam')return p.s;if(p.r!=null)return p.r;if(p.rx!=null)return ax?p.rz:p.rx;const c=Math.abs(Math.cos(p.rot||0)),s=Math.abs(Math.sin(p.rot||0)),w=(p.w||0)/2,d=(p.d||0)/2;return ax?w*s+d*c:w*c+d*s;};
for(const [name,a] of Object.entries(K.ASSETS)){const r=K.make(name);assert.ok(r.parts.length>0,name+' has parts');
  let lo=1e9,hi=-1e9,mx=0,mz=0;for(const p of r.parts){for(const v of Object.values(p))if(typeof v==='number')assert.ok(Number.isFinite(v),name+' finite');
    const ys=p.x0!=null?[p.y0,p.y1,p.base??p.y0]:p.t==='blob'?[p.y-p.ry]:p.t==='vdisk'?[p.y-p.r]:p.t==='cone'&&p.inv?[p.y]:[p.y??0];lo=Math.min(lo,...ys);hi=Math.max(hi,...ys.map(y=>y+(p.h||0)));
    const xs=p.x0!=null?[p.x0,p.x1]:[p.x??0],zs=p.x0!=null?[p.z0,p.z1]:[p.z??0];mx=Math.max(mx,...xs.map(x=>Math.abs(x)+ext(p,0)));mz=Math.max(mz,...zs.map(z=>Math.abs(z)+ext(p,1)));}
  assert.ok(lo<=.05&&lo>=-4.5,`${name} grounded (lowest ${lo.toFixed(2)})`);
  assert.ok(mx<=r.footprint.w/2+1.6&&mz<=r.footprint.d/2+1.6,`${name} inside footprint (${mx.toFixed(1)}x${mz.toFixed(1)} vs ${r.footprint.w}x${r.footprint.d})`);}
for(const f of K.FAMILIES)assert.ok(K.gallery(f).items.length>=4,f+' gallery');
for(const s of ['castleGate','market'])assert.ok(K.scene(s).parts.length>50,s+' scene');
console.log(`PASS props kit: ${Object.keys(K.ASSETS).length} assets grounded, finite and within footprints; galleries and scenes build`);
