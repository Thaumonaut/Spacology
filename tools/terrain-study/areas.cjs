'use strict';
// Study areas. Real areas: centre lat/lon, square side (km). Ours: centre world x/z (metres, seed 2718), side (km).
// Grids are resampled to `step` metres, rows running south (+z in the world), columns east (+x).
const os=require('node:os'),path=require('node:path');
const DATA=process.env.TERRAIN_STUDY_DIR||path.join(os.tmpdir(),'terrain-study');
const STEP=30,ZOOM=12;
const REAL=[
  {name:'rainier',label:'Mt Rainier (stratovolcano)',kind:'volcano',lat:46.8529,lon:-121.7604,km:30},
  {name:'fuji',label:'Mt Fuji (stratovolcano)',kind:'volcano',lat:35.3606,lon:138.7274,km:30},
  {name:'bernese',label:'Bernese Alps (Eiger-Jungfrau)',kind:'alpine',lat:46.56,lon:7.98,km:20},
  {name:'tetons',label:'Teton Range (young fault block)',kind:'young',lat:43.74,lon:-110.84,km:20},
  {name:'southern-alps',label:'Southern Alps NZ (Aoraki)',kind:'young',lat:-43.595,lon:170.142,km:20},
  {name:'smokies',label:'Great Smoky Mtns (old, rounded)',kind:'old',lat:35.58,lon:-83.48,km:20},
  {name:'gallatin',label:'Gallatin Valley MT (intermontane plain)',kind:'plain',lat:45.75,lon:-111.2,km:20},
];
// Generator areas (seed 2718), chosen from scan-ours.cjs: the two tallest volcanoes, both spines (tallest chains), a
// secondary/minor-range belt (lowest, roundest mountains), and an open lowland between ranges.
const OURS=[
  {name:'ours-volcano',label:'Ours: volcano (H 1623 m)',kind:'volcano',x:7505,z:-4771,km:16,vent:[7505,-4771]},
  {name:'ours-volcano2',label:'Ours: coastal volcano (H 1543 m)',kind:'volcano',x:-2523,z:-7417,km:16,vent:[-2523,-7417]},
  {name:'ours-spine-e',label:'Ours: east spine + branches',kind:'alpine',x:10800,z:-2700,km:12},
  {name:'ours-spine-w',label:'Ours: west spine + branches',kind:'young',x:-600,z:-6200,km:12},
  {name:'ours-minor',label:'Ours: minor/secondary ranges',kind:'old',x:1800,z:-8300,km:8},
  // No land window wider than ~3 km has under ~300 m of relief (see README): these are the flattest land we have.
  {name:'ours-plain',label:'Ours: flattest 4 km between ranges',kind:'plain',x:3100,z:-5000,km:4},
  {name:'ours-home',label:'Ours: home lowland',kind:'plain',x:800,z:200,km:3},
];
module.exports={DATA,STEP,ZOOM,REAL,OURS};
