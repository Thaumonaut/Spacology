// Highest non-volcano peaks within 12 km of home (coarse scan), for picking capture spots.
const M=require('../prototypes/labs/microvoxel-world/voxel-world-model.js');
const w=M.createWorld(2718,.25,'infinite'),out=[];
for(let z=-12000;z<12000;z+=250)for(let x=-12000;x<12000;x+=250){const g=w.geography(x,z);if(!g.sea)out.push([g.height*.25,x,z,g.biome]);}
out.sort((a,b)=>b[0]-a[0]);const picked=[];
for(const p of out){if(picked.every(q=>Math.hypot(q[1]-p[1],q[2]-p[2])>3000))picked.push(p);if(picked.length>=8)break;}
for(const p of picked)console.log(p.map(v=>typeof v==='number'?Math.round(v):v).join(' '));
