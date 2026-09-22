const assert=require('node:assert/strict'),R=require('../../prototypes/down-recovery.js');
const state={downRecovery:'revive'},unit={hp:0,max:101,sp:100,av:5,alive:false},battle={limit:5,av:100};
assert.deepEqual(R.recover(state,unit,battle),{hp:51,costAV:50});assert.equal(battle.limit,4.5);assert.equal(battle.av,100);assert.equal(unit.av,100);assert(unit.alive&&unit.recoveryGuard);
unit.hp=0;R.recover(state,unit,battle);assert.equal(battle.limit,4);assert.equal(battle.revives,2);assert.equal(battle.recoveryAV,100);
battle.av=380;unit.hp=0;assert.equal(R.recover(state,unit,battle).costAV,20);assert.equal(battle.limit,3.8);assert.equal(battle.av,380);unit.hp=0;assert.equal(R.recover(state,unit,battle),null);
assert.equal(R.mode({}),'revive');assert.equal(R.mode({lastStand:false}),'none');assert.equal(R.mode({downRecovery:'lastStand'}),'lastStand');
assert.equal(R.recover({downRecovery:'lastStand'},unit,{limit:5,av:0}),null);assert.equal(R.recover(state,{...unit,summon:true},{limit:5,av:0}),null);
console.log('PASS 50% recovery, repeat costs, normal turn delay, deadline clamp, legacy opt-out and mutually exclusive modes');
