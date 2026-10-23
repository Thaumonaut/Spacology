(function(root){
  'use strict';
  const K=typeof module==='object'&&module.exports?require('../shared/minigames/minigame-kit.js'):root.MiniGameKit;
  const entry=(id,title,file,category,status,description)=>({id,title,file,category,status,description});
  const entries=[
    entry('demo','Spacology v0.1 · voyage','spacology-v0.1.0.html?menu=1','Combat','Preserved','The existing Ops-to-battle demo. Continue your saved voyage.'),
    entry('expedition','The ridge expedition','../expedition/','Exploration','Experiment','The Svelte three-team slice, using the real station games.'),
    entry('team-building','Team-building lab','team-building-lab.html','Combat','Experiment','Compare packs, drafts and guaranteed targeting. Isolated combat forecasts.'),
    entry('equipment-puzzle','Equipment workbench','equipment-puzzle.html','Logistics','Experiment','Fit, connect and power components; test the result against the team-building model.'),
    entry('runner-next','Relay Runner · 3D','../runner/','Exploration','Experiment','The newer Three.js / ECS runner experiment.'),
    entry('microvoxel-world','Microvoxel World','microvoxel-world.html','Exploration','Experiment','A seeded river catchment: compressed voxels, worker meshing and a moving crew. Separate world-quality proof.'),
    ...K.GAMES.map(g=>({...g,category:g.role,status:g.role==='Reserve'?'Reserve':'Experiment',description:g.output,station:true})),
    entry('battle','Animated battle stage','watchable-fight.html','Combat','Reusable','The original combat choreography, with team and planet controls.'),
    entry('weaver-voyage','Weaver voyage lab','weaver-voyage-lab.html','Combat','Earlier experiment','A 21-node Aether and equipment-set voyage; its own balance model.'),
    entry('affix-lab','Affix team-building lab','affix-lab.html','Combat','Earlier experiment','Affix-driven requisition and upkeep; its own balance model.'),
    entry('relay-runner','Relay Runner · 2D','relay-runner.html','Exploration','Earlier experiment','The original canvas runner, retained alongside the 3D experiment.'),
    entry('worldgen','World generator','worldgen.html','Reference','Reference','Terrain, climate and alien-environment authoring.'),
    entry('art-gallery','Art archive','art-gallery.html','Reference','Reference','Retained crew, enemy and world art.'),
    entry('weavers','Aether Weaver reference','aether-weavers.html','Reference','Reference','Crew kits and expedition reference.'),
    entry('atlas','Star atlas','star-atlas.html','Reference','Reference','World and destination study.'),
    ...['ops','voyage','grid-lab','placement-lab'].map(id=>entry(id,id.replaceAll('-',' '),id+'.html','Reference','Earlier experiment','Retained standalone study; not the current demo.')),
    ...[
      ['action-animation-test-v3','Action animation · v3','Reference'],
      ['animation-library-v2','Animation library · v2','Reference'],
      ['battle-rhythm-v2','Battle rhythm · v2','Reference'],
      ['call-and-response','Call and response','Reference'],
      ['stage-test','Stage composition','Reference'],
      ['turn-order-team-comp','Turn order & team composition','Reference'],
      ['action-animation-test-v2','Action animation · v2','Archived'],
      ['action-animation-test','Action animation · v1','Archived'],
      ['animation-library','Animation library · v1','Archived'],
      ['battle-rhythm','Battle rhythm · v1','Archived']
    ].map(([id,title,status])=>entry(id,title,'animation/'+id+'.html','Reference',status,'Preserved animation study. Reuse its staging ideas; live choreography is in the battle stage.')),
    ...['battlefield','combat-bench-2','combat-bench','run','session','voyage-bench'].map(id=>entry(id,id.replaceAll('-',' '),'superseded/'+id+'.html','Reference','Archived','Superseded prototype. Kept for comparison, not current rules.'))
  ];
  if(typeof module==='object'&&module.exports)module.exports=entries;else root.SpacologyLibrary=entries;
})(typeof globalThis==='object'?globalThis:this);
