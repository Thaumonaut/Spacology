const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../../prototypes/spacology-v0.1.0.js'),'utf8');
const start=source.indexOf('function handleDrop(');
const end=source.indexOf("\ndocument.addEventListener('click'",start);
function drop(from,gear,ref='Bosk'){
  const state={gear:[...gear],equipped:{},resolved:false};
  const context={
    equipGear(owner,name,index,fromPack=false){
      if(!fromPack){const index=state.gear.indexOf(name);if(index<0)return false;state.gear.splice(index,1)}
      state.equipped[owner]=[name];return true;
    },
    resolveCard(index,action,perform){assert.equal(index,2);assert.equal(action,'equipped');if(perform()!==true)return false;state.resolved=true;return true}
  };
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  const zone={dataset:{item:'Bosk',copyId:ref==='Bosk'?undefined:ref},matches:selector=>selector==='.item.character'};
  context.handleDrop({kind:'gear',name:'Bore Bit',from,index:2},zone);
  return state;
}
for(const ref of ['Bosk','copy-7']){
  let state=drop('pack',[],ref);
  assert.equal(state.resolved,true,'Dropping pack gear on reserve crew must resolve the card');
  assert.deepEqual(state.equipped[ref],['Bore Bit']);
  state=drop('pack',['Bore Bit'],ref);
  assert.equal(state.resolved,true);assert.deepEqual(state.gear,['Bore Bit'],'Pack equip must preserve an existing loose duplicate');
  state=drop('inventory',['Bore Bit'],ref);
  assert.equal(state.resolved,false);assert.deepEqual(state.gear,[]);assert.deepEqual(state.equipped[ref],['Bore Bit']);
}
console.log('PASS pack/inventory gear drops onto all reserve instances preserve source ownership and resolve paid rewards');
