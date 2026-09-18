// ============================================================================
//  Re-scores a fixed list of teams with the difficulty ceiling raised, and
//  reports how much each world was hiding.  Use after any run where a team
//  returns a value at the default ceiling of 5.96.
//
//  node uncensor.js
// ============================================================================
const {score}=require('./synergy.js');
const WL=['open','murk','hive','fortress','bloom'];
const TOP=[
 ['Pyre','Ash','Corr','Rime','Maul'],['Maul','Wex','Pyre','Ash','Cinder'],
 ['Maul','Vitre','Bosk','Ash','Pyre'],['Cinder','Mote','Bosk','Pyre','Ash'],
 ['Quill','Pyre','Ash','Corr','Maul'],['Maul','Ash','Mote','Vitre','Rime'],
 ['Tarn','Vitre','Nettle','Maul','Rime'],['Sump','Bosk','Corr','Vitre','Ledger'],
 ['Tarn','Mote','Cinder','Ledger','Vitre'],['Wex','Sump','Nettle','Bosk','Ferrule']
];
console.log('SAME TEAMS, CEILING RAISED 6.0 -> 24.0  (10 search steps)\n');
console.log('  team                                  '+WL.map(w=>w.slice(0,5).padEnd(7)).join('')+' avg');
const rows=TOP.map(t=>{
  const v=WL.map(w=>score(t,w,26,24.0,10));
  return {t,v,avg:v.reduce((a,b)=>a+b,0)/v.length};
});
rows.forEach(r=>console.log('  '+r.t.join(', ').padEnd(38)+
  r.v.map(x=>x.toFixed(2).padEnd(7)).join('')+r.avg.toFixed(2)));
console.log('\nHOW MUCH WAS HIDDEN  (per world, across these teams)');
WL.forEach((w,i)=>{
  const vals=rows.map(r=>r.v[i]);
  const censored=vals.filter(v=>v>5.9).length;
  console.log('  '+w.padEnd(10)+'max '+Math.max(...vals).toFixed(2).padStart(6)+
    '   was censored at 5.96 for '+censored+' of '+rows.length);
});
