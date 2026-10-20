'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let stored=null,blocked=false;
const context={module:{exports:{}},localStorage:{getItem(){if(blocked)throw new Error('Storage unavailable');return stored;}}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve('../../prototypes/shared/minigames/minigame-kit.js'),'utf8'),context);
const load=()=>JSON.parse(JSON.stringify(context.module.exports.load()));
for(const value of [null,'{',JSON.stringify({version:2,sessions:[]}),JSON.stringify({version:1}),JSON.stringify({version:1,sessions:null}),JSON.stringify({version:1,sessions:{}})]){
  stored=value;assert.deepEqual(load(),{version:1,sessions:[]});
}
const session={game:'element-pairs',tier:'good',startedAt:'2026-10-20T12:00:00.000Z',rating:{fun:4}};
stored=JSON.stringify({version:1,sessions:[null,false,7,'invalid',[],session]});
assert.deepEqual(load(),{version:1,sessions:[session]},'retain valid history while dropping malformed entries');
assert.equal(JSON.parse(stored).sessions.length,6,'reading history does not overwrite storage');
blocked=true;assert.deepEqual(load(),{version:1,sessions:[]});
console.log('PASS minigame storage: malformed history and blocked storage recover without losing valid sessions');
