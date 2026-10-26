#!/usr/bin/env node
'use strict';
// Snow vs bare rock on cold mountain ground: samples geography() on a grid over the land and reports, for columns above
// the snowline (biome snow/alpine/glacier), the share that is snow by slope band. Real ranges: snow rarely holds above
// ~45 deg, so steep faces should read as rock.   node tools/snow-survey.cjs [model.js] [seed]
const path=require('node:path');
const M=require(path.resolve(process.argv[2]||path.join(__dirname,'../prototypes/labs/microvoxel-world/voxel-world-model.js')));
const w=M.createWorld(Number(process.argv[3]||2718),.25,'infinite'),bands=[[0,20],[20,30],[30,40],[40,50],[50,90]],c=bands.map(()=>[0,0]);
let cold=0,snow=0;
for(let z=-16000;z<16000;z+=60)for(let x=-16000;x<16000;x+=60){const g=w.geography(x+17,z+29);if(g.sea)continue;
  const b=g.biome,isSnow=(b==='snow'&&!g.exposed)||b==='glacier';if(!isSnow&&b!=='alpine')continue;cold++;if(isSnow)snow++;
  const deg=Math.atan(g.slope)*180/Math.PI,i=bands.findIndex(([a,e])=>deg>=a&&deg<e);c[i][0]++;if(isSnow)c[i][1]++;if(b==='glacier')c[i][2]=(c[i][2]||0)+1;}
console.log(`cold mountain columns ${cold}, snow ${(100*snow/cold).toFixed(1)}%`);
bands.forEach(([a,e],i)=>console.log(`  ${a}-${e} deg: ${c[i][0]} columns, snow ${(100*c[i][1]/Math.max(1,c[i][0])).toFixed(1)}% (glacier ${(100*(c[i][2]||0)/Math.max(1,c[i][0])).toFixed(1)}%)`));
