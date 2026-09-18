// ---------------------------------------------------------------------------
// STAGE 3 - the evaluator.  Scores a roster on power AND on watchability, and
// rejects anything that only wins by being uniformly strong everywhere.
// ---------------------------------------------------------------------------
const {WORLDS}=require('./roster.js');
const S=require('./synergy.js');
const WL=Object.keys(WORLDS);

function evaluate(team,names,N){
  const per={};
  WL.forEach(w=>per[w]=S.scoreTeam(team,w,N||24));
  const v=WL.map(w=>per[w].bp);
  const avg=v.reduce((a,b)=>a+b,0)/v.length;
  const spread=Math.max(...v)/Math.max(0.01,Math.min(...v));
  const ev=WL.reduce((a,w)=>a+per[w].evPerRound,0)/WL.length;
  const big=Math.max(...WL.map(w=>per[w].big));
  // interesting = strong enough, but not equally strong everywhere, and busy
  // aim for a target strength, not the maximum: overshooting is its own problem
  const TARGET=2.4;
  const power=+Math.max(0,1-Math.abs(avg-TARGET)/TARGET).toFixed(3);
  const variety=Math.min(1,(spread-1)/1.6);
  const spectacle=Math.min(1,big/260);
  const density=Math.min(1,ev/26);
  const interest=+(0.34*variety+0.33*spectacle+0.33*density).toFixed(3);
  return {names,avg:+avg.toFixed(2),spread:+spread.toFixed(2),
          big,ev:+ev.toFixed(1),power:+power.toFixed(2),interest,
          fit:+(0.5*power+0.5*interest).toFixed(3),per};
}
module.exports={evaluate,WL};
