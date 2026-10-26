'use strict';
const assert=require('node:assert/strict'),N=require('../../prototypes/labs/castle-drafts/toolkit/city-study/neighborhoods.js'),A=require('../../prototypes/labs/castle-drafts/toolkit/city-study/anime-plan.js');
const domain=[[0,0],[30,0],[30,30],[0,30]],seeds=[[5,5],[24,8],[12,25]],cells=N.voronoi(domain,seeds);
assert(Math.abs(cells.reduce((s,c)=>s+N.area(c),0)-900)<1e-6);
for(let i=0;i<cells.length;i++)for(const p of cells[i])for(const seed of seeds)assert((p[0]-seeds[i][0])**2+(p[1]-seeds[i][1])**2<=(p[0]-seed[0])**2+(p[1]-seed[1])**2+1e-6);
const w=A.make({rings:4,streetLife:false});assert(w.neighborhoods.some(n=>n.kind==='voronoi'));assert(w.neighborhoods.some(n=>n.kind==='rectilinear'));assert.equal(w.courtyards.length,16);assert(w.lanes.length>100);assert(w.spokeWidths.some(v=>v>=8));for(const court of w.courtyards){const p=court.poly.reduce((a,b)=>[a[0]+b[0]/court.poly.length,a[1]+b[1]/court.poly.length],[0,0]);assert.equal(A.surface(...p,w).kind,'courtyard');}
console.log('PASS mixed neighbourhoods: true Voronoi partition, regular blocks, reserved courts, alleys and market avenues');

const T=require('../../prototypes/labs/castle-drafts/toolkit/shape-study/trim-plan.js'),large=A.make({rings:12,streetLife:false});for(const lot of large.lots)for(const loop of [...lot.plan.floors.flatMap(f=>f.loops),...(lot.plan.accent?[lot.plan.accent.poly]:[])])assert(T.ring(loop,0,.16).every(Number.isFinite),'all metropolis floor and tower accents support timber');
