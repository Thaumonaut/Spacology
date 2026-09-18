// ---------------------------------------------------------------------------
// STAGE 2 - the composer.  Takes a pool of characters and assembles rosters
// that actually reach tag thresholds and satisfy the applier/spender rule.
// ---------------------------------------------------------------------------
const TAGS=['Hull','Blight','Drive','Ordnance','Assay','Crew'];
const APPLIER={Blight:c=>c.apply, Assay:c=>c.marks, Hull:c=>c.barrier||c.onHitBarrier};
const SPENDER={Blight:c=>c.detonate, Assay:c=>c.react, Hull:c=>c.thorns};

function tagCount(team){const t={};team.forEach(c=>c.tags.forEach(g=>t[g]=(t[g]||0)+1));return t;}

// build a team aimed at a chosen deep tag, then fill for coverage
function compose(pool,rnd,size,targetTag){
  const team=[];
  const wants=pool.filter(c=>c.tags.includes(targetTag));
  if(wants.length<2) return null;
  // spender first, then its appliers, so the payoff is never orphaned
  const sp=wants.filter(c=>SPENDER[targetTag]?SPENDER[targetTag](c):true);
  const ap=wants.filter(c=>APPLIER[targetTag]?APPLIER[targetTag](c):true);
  if(SPENDER[targetTag]){
    if(!sp.length||ap.length<2) return null;
    team.push(sp[Math.floor(rnd()*sp.length)]);
    const picks=ap.slice().sort(()=>rnd()-0.5).slice(0,2);
    picks.forEach(p=>{if(!team.includes(p))team.push(p);});
  }
  // top up the target tag to four
  while(tagCount(team)[targetTag]<4 && team.length<size){
    const c=wants[Math.floor(rnd()*wants.length)];
    if(!team.includes(c)) team.push(c); else if(rnd()<0.15) team.push(c);
    if(team.length>=size) break;
  }
  // remaining slots: prefer something that pushes a second tag to two
  while(team.length<size){
    const tc=tagCount(team);
    const near=pool.filter(c=>c.tags.some(g=>g!==targetTag&&(tc[g]||0)===1));
    const from=(near.length&&rnd()<0.7)?near:pool;
    const c=from[Math.floor(rnd()*from.length)];
    if(!team.includes(c)||rnd()<0.1) team.push(c);
  }
  return team.slice(0,size);
}
module.exports={compose,tagCount,TAGS,APPLIER,SPENDER};
