const fs=require('fs');
const html=fs.readFileSync('/mnt/user-data/outputs/ops.html','utf8');
const code=html.match(/<script>([\s\S]*)<\/script>/)[1];
const ids=[...new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(x=>x[1]))];
function mk(id){return{id,style:{},dataset:{},_h:'',classList:{_s:new Set(),
  add(){[...arguments].forEach(c=>this._s.add(c))},remove(){[...arguments].forEach(c=>this._s.delete(c))},
  toggle(){},contains(c){return this._s.has(c)}},
  appendChild(c){return c},remove(){},querySelector(){return mk('q')},querySelectorAll(){return []},
  addEventListener(){},get innerHTML(){return this._h},set innerHTML(v){this._h=v}};}
const REG={}; ids.forEach(i=>REG[i]=mk(i));
const document={getElementById:i=>REG[i]||null,createElement:t=>mk(t),
  querySelectorAll:()=>[],body:mk('b'),addEventListener(){}};
const window={addEventListener(){}};
let api;
try{
 api=new Function('document','window','console','Math','Date','JSON','Array','Object',
  'String','Number','isFinite',
  code+`;return {get S(){return S}, newRun, rollOffers, buyPack, confirmPack, doRefresh,
   forge, launch, strength, fielded, tagN, demand, rarityOdds, rollDests, refreshCost,
   RAR, POOL, bandFor, toggleCard};`
 )(document,window,console,Math,Date,JSON,Array,Object,String,Number,isFinite);
}catch(e){console.log('LOAD FAILED: '+e.message);process.exit(1);}
console.log('ops loads cleanly');

// a plausible player: buy the pack that matches or carries a prime, keep good cards
let ends={},fin=[],legs=0,packs=0,refr=0,kept=0,stripped=0,prime=0,forged=0,rost=0;
const rarMix=[0,0,0,0]; let fld=0;
const N=60;
for(let r=0;r<N;r++){
  api.newRun();
  const S=api.S;
  let guard=0;
  while(guard++<120){
    if(S.integrity<=0){ ends.lost=(ends.lost||0)+1; break; }
    if(S.leg>S.legs){ ends.home=(ends.home||0)+1; break; }
    // shop while affordable
    let spins=0;
    while(spins++<3){
      const st=api.strength();
      const scored=S.offers.map((o,i)=>{
        const f=api.fielded();
        let fit=0;
        if(o.theme.mech){ fit=f.filter(c=>o.theme.d&&true).length; }
        return [i,o.best*3+(S.gold>=o.cost?0:-99)-o.cost/30];
      }).sort((a,b)=>b[1]-a[1]);
      const best=scored[0];
      if(best[1]<-50) break;
      const o=S.offers[best[0]];
      if(S.gold<o.cost) break;
      api.buyPack(best[0]); packs++;
      // triage: keep coins, keep chars that pair or are rare+, keep suiting fittings
      S.pack.cards.forEach(c=>{
        if(c.type==='coin') c.mark='keep';
        else if(c.type==='char'){
          const pals=api.fielded().filter(u=>{
            return false; });
          c.mark = (c.r>=2 || api.fielded().length<6) ? 'keep' : 'strip';

        } else {
          c.mark = api.fielded().some(u=>c.want.indexOf(u.k)>=0)?'keep':'strip';
        }
      });
      prime+=S.pack.cards.filter(c=>c.type==='char'&&c.r>=3).length;
      kept+=S.pack.cards.filter(c=>c.mark==='keep').length;
      stripped+=S.pack.cards.filter(c=>c.mark==='strip').length;
      // respect the roster ceiling
      let room=16-S.roster.length;
      S.pack.cards.filter(c=>c.mark==='keep'&&c.type==='char').forEach(c=>{
        if(room<=0) c.mark='strip'; else room--; });
      api.confirmPack();
    }
    api.forge(); forged++;
    // bench anyone past the free upkeep line unless they are strong
    const f2=api.fielded().slice().sort((a,b)=>b.r-a.r);
    f2.forEach((u,i)=>{ if(i>=8&&u.r<2) u.onField=false; });
    api.rollDests();
    const st=api.strength();
    // take the hardest world you can actually handle
    const order=S.dests.map((d,i)=>[i,st.total/api.demand(S.leg,d.danger),d.danger])
      .filter(x=>x[1]>=0.85).sort((a,b)=>b[2]-a[2]);
    const go=order.length?order[0][0]:
      S.dests.map((d,i)=>[i,d.danger]).sort((a,b)=>a[1]-b[1])[0][0];
    api.launch(go); legs++;
  }
  fin.push(S.integrity); rost+=S.roster.length;
  S.roster.forEach(u=>rarMix[u.r]++); fld+=api.fielded().length;
}
fin.sort((a,b)=>a-b);
console.log('\n'+N+' voyages, a plausible captain');
console.log('  ended         '+JSON.stringify(ends));
console.log('  legs run      '+(legs/N).toFixed(1));
console.log('  packs opened  '+(packs/N).toFixed(1));
console.log('  cards kept    '+(kept/N).toFixed(1)+'  stripped '+(stripped/N).toFixed(1));
console.log('  primes seen   '+(prime/N).toFixed(2)+' per voyage  ('+
  (prime/Math.max(1,packs)*100).toFixed(1)+'% of packs carry one)');
console.log('  roster size   '+(rost/N).toFixed(1)+'  fielded '+(fld/N).toFixed(1));
console.log('  crew rarity   '+rarMix.map((n,i)=>['C','U','R','P'][i]+' '+Math.round(n/N*10)/10).join('  '));
console.log('  final integ   median '+fin[Math.floor(N/2)].toFixed(0)+'%  range '+
  fin[0].toFixed(0)+'\u2013'+fin[N-1].toFixed(0)+'%');
