const assert=require('node:assert/strict'),F=require('../../prototypes/formation-rules.js');
const names=s=>[...s.field,...s.support,...s.reserve].filter(Boolean).sort();
assert.equal(F.position('Arunima'),'field');assert.equal(F.position('Silen'),'field');assert.equal(F.position('Roonie'),'support');
for(const n of ['Ivara','Hanae','Quill','Maul'])assert.equal(F.position(n),'both');
const s={field:['Daven','Hanae','Ivara'],support:['Arunima','Roonie','Veska'],reserve:[],equipped:{Arunima:['Bore Bit']}};
const before=names(s);F.normalize(s);assert.deepEqual(names(s),before);assert(s.field.includes('Arunima'));assert(s.field.includes('Ivara'));assert.equal(s.field[0],'Daven');assert.deepEqual(s.equipped,{Arunima:['Bore Bit']});assert.deepEqual(F.normalize(s),[]);
const crowded={field:['Bosk','Tarn','Daven','Stella','Hanae'],support:['Arunima',null,'Veska'],reserve:[]};F.normalize(crowded);assert(crowded.field.includes('Arunima'));assert(crowded.support.includes('Hanae'));assert.equal(crowded.reserve.length,0);
const full={field:['Bosk','Tarn','Daven','Stella','Beatriz'],support:['Arunima'],reserve:['Coda','Roonie','Ivara','Spore','Redcap','Veska'],equipped:{Arunima:['Bore Bit']}};const all=names(full);F.normalize(full);assert.deepEqual(names(full),all);assert(full.reserve.includes('Arunima'));assert.equal(full.reserve.length,7);assert.deepEqual(full.equipped.Arunima,['Bore Bit']);
console.log('PASS role placement, old-formation migration, hybrid relocation, overflow/copy/gear retention and idempotency');
