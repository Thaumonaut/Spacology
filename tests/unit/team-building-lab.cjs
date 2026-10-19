'use strict';
const assert=require('node:assert/strict'),M=require('../../prototypes/labs/team-building/team-building-model.js');
const state=M.create({mode:'target',engine:'counter',seed:41});state.target='Ilka';
for(let i=0;i<2;i++){const chosen=M.offers(state,'crew').find(id=>id!=='Ilka');assert.equal(M.act(state,{type:'crew',id:chosen}),null);M.settle(state);}
assert.equal(state.progress,2);assert.equal(state.owned.Ilka,undefined);
assert.equal(M.act(state,{type:'crew',id:'Ilka'}),null);assert.equal(state.owned.Ilka,1);assert.equal(state.progress,0);assert.equal(state.history.at(-1).received.length,1);
const spent=state.gold;assert.ok(M.act(state,{type:'crew',id:'Ilka'}));assert.equal(state.gold,spent);
const other=M.create({seed:41,engine:'counter',mode:'draft'});const target=M.create({seed:41,engine:'counter',mode:'target'});assert.deepEqual(M.offers(other,'crew'),M.offers(target,'crew'));
const snapshot=JSON.stringify(other);const forecast=M.fight(other);assert.equal(JSON.stringify(other),snapshot);assert.deepEqual(M.fight(other),forecast);assert.ok(forecast.metrics.enemyAttacks>0);
const ultra=M.create({engine:'break',sandbox:true});ultra.team=['Wren','Quill','Roonie','Nahana'];assert.ok(M.fight(ultra).metrics.ultra>0);
const reflect=M.create({engine:'counter',sandbox:true});reflect.team=['Reva','Ilka','Latch','Roonie','Nahana'];reflect.enemyAdvance=true;const counter=M.fight(reflect,{encounter:M.encounters[2]});assert.ok(counter.metrics.retaliation>0);assert.ok(counter.metrics.absorbed>0);assert.ok(counter.metrics.enemyAdvances>0);
const dot=M.create({engine:'dot',sandbox:true});dot.team=['Nour','Spore','Redcap','Latch','Nahana'];assert.ok(M.fight(dot).metrics.dot>0);
for(const engine of Object.keys(M.engines))for(let seed=1;seed<=20;seed++){const s=M.create({engine,seed});const r=M.fight(s);assert.ok(['Clear','Deadline','Defeat'].includes(r.reason));for(const n of Object.values(r.metrics))assert.ok(Number.isFinite(n));}
const inv=M.create({sandbox:true});inv.team=['Silen','Roonie','Nahana'];for(const id of ['Focus Lens','Quick Latch','Bore Bit'])assert.equal(M.act(inv,{type:'sandboxGear',id}),null);assert.equal(M.act(inv,{type:'equip',index:0,owner:'Silen'}),null);assert.equal(M.act(inv,{type:'equip',index:1,owner:'Silen'}),null);assert.ok(M.act(inv,{type:'equip',index:2,owner:'Silen'}));assert.equal(inv.equipment[2].owner,null);
console.log('Team-building lab: guaranteed targeting, budget idempotency, deterministic non-mutating forecasts, meaningful mechanic triggers, finite combat, and gear limits passed.');
