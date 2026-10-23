(function(root){
  'use strict';
  // Host-authoritative co-op supply-line session. Pure rules: no rendering or transport.
  const ROLES=Object.freeze(['explore','research','logistics']),PHASES=Object.freeze(['night','day','dusk']);
  const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]],ROOT_YIELD=8,BUILD_POINTS=3,CLAIM_COST=2,PACKS=[4,8],STUDY_LIMIT=2,HINT_LIMIT=2;
  const target=day=>6+3*(day-1);
  // Crossing prices in build points by rock rating; unrated rock is priced as fractured. Cuttings need sound rock.
  const PRICES={ramp:{sound:4,fractured:6},cutting:{sound:7},bridge:{sound:5,fractured:8}},TRAVEL={ramp:4,cutting:1.5,bridge:1.5},CROSSINGS={cliff:['ramp','cutting'],gorge:['bridge']};
  const price=(type,rock)=>PRICES[type]?.[rock==='sound'?'sound':'fractured']??null;
  function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function createSession(world,atlas){
    const S=k=>{const [q,r]=k.split(',').map(Number);return atlas.summary(q,r);},root=atlas.key(atlas.rootHex.q,atlas.rootHex.r);
    const seats={explore:null,research:null,logistics:null},players=new Set(),readySet=new Set();
    let day=1,phase='night',report=null,dawn=null,dayPlan={survey:[],study:[],build:null};
    const explore={surveyed:new Set([root]),hints:new Set(),plan:[],supplies:8};
    const research={surveyed:new Set([root]),samples:new Set(),identified:new Map(),hints:new Set(),study:new Set()};
    const logistics={surveyed:new Set([root]),profiles:new Map(),lines:[],build:null,packed:8,barriers:new Map(),rock:new Map(),crossing:null};
    explore.scouted=new Set();research.rocks=new Set();research.rated=new Map();
    const crossed=new Map(),passable=k=>!S(k).barrier||crossed.has(k),costOf=k=>crossed.has(k)?TRAVEL[crossed.get(k).type]:S(k).cost;
    const neighbours=k=>{const [q,r]=k.split(',').map(Number);return DIRS.map(([dq,dr])=>atlas.key(q+dq,r+dr));};
    const frontier=set=>{const out=new Set();for(const k of set)for(const n of neighbours(k))if(!set.has(n)&&S(n).inside)out.add(n);return [...out].sort();};
    const tripCost=k=>passable(k)?Math.ceil(costOf(k)):1;
    function fit(plan,budget){const out=[];let used=0;for(const k of plan){const c=tripCost(k);if(used+c>budget)break;used+=c;out.push(k);}return out;}
    function profile(k){
      const s=S(k);if(s.resource==='Uplift signs')return {key:k,name:'Uplift seam',yield:9+hash(world.seed+':'+k)%3};
      const name=s.setting==='Volcanic island arc'||s.setting==='Coastal arc range'?'Volcanic sulphur':s.setting==='Rift valley'||s.biome==='Desert'?'Rift salts':s.setting==='Collision range'?'Ferrite seam':s.biome==='Basalt ridge'?'Ferrite seam':/River|Wetland/.test(s.biome)?'Placer iron':'Ferrite nodules';
      return {key:k,name,yield:5+hash(world.seed+':'+k)%4};
    }
    function route(from,known){
      const dist=new Map([[from,0]]),prev=new Map(),open=[from];
      while(open.length){open.sort((a,b)=>dist.get(a)-dist.get(b)||a.localeCompare(b));const k=open.shift();if(k===root)break;
        for(const n of neighbours(k)){if(!known.has(n))continue;const d=dist.get(k)+costOf(n);if(d<(dist.get(n)??Infinity)){dist.set(n,d);prev.set(n,k);open.push(n);}}}
      if(!dist.has(root))return null;const path=[root];while(path[0]!==from)path.unshift(prev.get(path[0]));
      return {path,cost:Math.round(dist.get(root)*10)/10};
    }
    const lineYield=(p,r)=>Math.max(1,Math.round(p.yield-r.cost*.4));
    const points=()=>BUILD_POINTS-(logistics.packed>PACKS[0]?1:0);
    const human=role=>seats[role]!==null;
    // Autopilots fill unclaimed roles just before their phase resolves.
    const auto={
      explore(){const f=frontier(explore.surveyed),open=f.filter(passable).sort((a,b)=>(explore.hints.has(b)-explore.hints.has(a))||tripCost(a)-tripCost(b)||a.localeCompare(b));
        const edge=f.find(k=>!passable(k)&&!explore.scouted.has(k)),scout=edge&&(!explore.scouted.size||!open.some(k=>S(k).resource));explore.plan=fit(scout?[edge,...open]:open,explore.supplies);},
      researchNight(){research.hints=new Set(frontier(research.surveyed).filter(k=>S(k).resource).slice(0,HINT_LIMIT));},
      researchDay(){research.study=new Set([...[...research.samples].filter(k=>!research.identified.has(k)).sort(),...[...research.rocks].filter(k=>!research.rated.has(k)).sort()].slice(0,STUDY_LIMIT));},
      logisticsNight(){logistics.packed=[...logistics.profiles.keys()].some(k=>!logistics.lines.some(l=>l.key===k))?PACKS[0]:PACKS[1];},
      logisticsDay(){const c=[...logistics.profiles.values()].filter(p=>!logistics.lines.some(l=>l.key===p.key)).map(p=>({p,r:route(p.key,logistics.surveyed)})).filter(x=>x.r).sort((a,b)=>lineYield(b.p,b.r)-lineYield(a.p,a.r)||a.p.key.localeCompare(b.p.key));logistics.build=c[0]?.p.key??null;
        if(!logistics.crossing&&!c.length)logistics.crossing=crossingOptions().sort((a,b)=>a.price-b.price||a.key.localeCompare(b.key))[0]??null;},
    };
    function crossingOptions(){const out=[];for(const [key,b] of logistics.barriers)if(!crossed.has(key))for(const type of CROSSINGS[b.kind]){const p=price(type,logistics.rock.get(key));if(p!==null)out.push({key,type,price:p,progress:0});}return out;}
    function advance(){
      if(phase==='night'){
        if(!human('explore'))auto.explore();if(!human('research'))auto.researchNight();if(!human('logistics'))auto.logisticsNight();
        explore.supplies=logistics.packed;explore.hints=new Set(research.hints);research.hints.clear();
        dayPlan={survey:fit(explore.plan,explore.supplies),study:[],build:null};
        dawn={supplies:explore.supplies,hints:[...explore.hints],planned:dayPlan.survey.length,dropped:explore.plan.length-dayPlan.survey.length};
        phase='day';
      }else if(phase==='day'){
        if(!human('research'))auto.researchDay();if(!human('logistics'))auto.logisticsDay();
        dayPlan.study=[...research.study];dayPlan.build=logistics.build;
        const built=[];if(logistics.build&&points()>=CLAIM_COST){const p=logistics.profiles.get(logistics.build),r=route(logistics.build,logistics.surveyed);if(p&&r){const line={key:p.key,name:p.name,route:r.path,cost:r.cost,yield:lineYield(p,r)};logistics.lines.push(line);built.push(line.key);}}
        let crossing=null;const c=logistics.crossing;
        if(c){c.progress+=Math.max(0,points()-(built.length?CLAIM_COST:0));c.price=price(c.type,logistics.rock.get(c.key));crossing={...c,done:c.progress>=c.price};
          if(crossing.done){crossing.progress=c.price;crossed.set(c.key,{type:c.type});explore.surveyed.add(c.key);logistics.crossing=null;}}
        const studied=[],rated=[];for(const k of research.study){if(research.samples.has(k)&&!research.identified.has(k)){research.identified.set(k,profile(k));studied.push(k);}
          else if(research.rocks.has(k)&&!research.rated.has(k)){research.rated.set(k,S(k).rock);rated.push(k);}}
        const samples=[],scouted=[];for(const k of dayPlan.survey){if(!passable(k)){if(!explore.scouted.has(k)){explore.scouted.add(k);scouted.push(k);}continue;}explore.surveyed.add(k);if(S(k).resource&&k!==root)samples.push(k);}
        for(const k of samples)research.samples.add(k);
        for(const k of scouted){research.rocks.add(k);logistics.barriers.set(k,{kind:S(k).terrain,span:S(k).span});}
        for(const k of rated)logistics.rock.set(k,research.rated.get(k));
        if(crossing&&!crossing.done&&rated.includes(crossing.key)){c.price=crossing.price=price(c.type,logistics.rock.get(c.key));}
        research.surveyed=new Set(explore.surveyed);logistics.surveyed=new Set(explore.surveyed);
        for(const k of studied)logistics.profiles.set(k,research.identified.get(k));
        const delivered=ROOT_YIELD+logistics.lines.reduce((a,l)=>a+l.yield,0),t=target(day);
        report={day,target:t,delivered,met:delivered>=t,shortfall:Math.max(0,t-delivered),lines:[{key:root,name:'Ferrite root',yield:ROOT_YIELD},...logistics.lines.map(l=>({key:l.key,name:l.name,yield:l.yield}))],surveyed:dayPlan.survey.length-scouted.length,samples:samples.length,studied:studied.length,built,scouted:scouted.length,rated:rated.length,crossing};
        explore.plan=[];research.study.clear();logistics.build=null;phase='dusk';
      }else{day++;phase='night';dawn=null;}
      readySet.clear();
    }
    function maybeAdvance(){const humans=ROLES.filter(human);if(humans.length&&humans.every(r=>readySet.has(seats[r])))advance();}
    const roleOf=id=>ROLES.find(r=>seats[r]===id)??null;
    function join(id){players.add(id);}
    function leave(id){players.delete(id);readySet.delete(id);for(const r of ROLES)if(seats[r]===id)seats[r]=null;maybeAdvance();}
    function claim(id,role){if(!ROLES.includes(role))return 'Unknown role.';if(seats[role]&&seats[role]!==id)return 'That role is taken.';for(const r of ROLES)if(seats[r]===id)seats[r]=null;seats[role]=id;readySet.delete(id);return null;}
    function toggle(set,k,limit){if(set.has(k))set.delete(k);else if(set.size<limit)set.add(k);else return `Limit of ${limit}.`;return null;}
    function intent(id,m){
      const role=roleOf(id);if(!role)return 'Claim a role first.';if(readySet.has(id))return 'You are ready; unready to change plans.';
      if(m.kind==='toggle'){
        const k=String(m.key);
        if(role==='explore'){if(phase!=='night')return 'Exploration plans at night.';if(!frontier(explore.surveyed).includes(k))return 'Only frontier hexes can be surveyed.';const i=explore.plan.indexOf(k);if(i<0&&explore.scouted.has(k))return 'That edge is already scouted.';if(i>=0)explore.plan.splice(i,1);else explore.plan.push(k);return null;}
        if(role==='research'){if(phase==='night'){if(!frontier(research.surveyed).includes(k))return 'Hints go on frontier hexes.';return toggle(research.hints,k,HINT_LIMIT);}if(phase==='day'){if(!(research.samples.has(k)&&!research.identified.has(k))&&!(research.rocks.has(k)&&!research.rated.has(k)))return 'Only unidentified samples can be studied.';return toggle(research.study,k,STUDY_LIMIT);}return 'Research acts at night and by day.';}
        if(role==='logistics'){if(phase!=='day')return 'Logistics builds by day.';if(!logistics.profiles.has(k)||logistics.lines.some(l=>l.key===k))return 'Only identified, unconnected resources can be claimed.';if(points()<CLAIM_COST)return 'Not enough build points today.';if(!route(k,logistics.surveyed))return 'No surveyed route to camp.';logistics.build=logistics.build===k?null:k;return null;}
      }
      if(m.kind==='cross'){
        const k=String(m.key),b=logistics.barriers.get(k),c=logistics.crossing;if(role!=='logistics')return 'Logistics engineers crossings.';if(phase==='dusk')return 'Crossings are planned at night or by day.';
        if(!b)return 'Exploration must scout this edge first.';if(crossed.has(k))return 'Already crossed.';if(!CROSSINGS[b.kind].includes(m.type))return `A ${m.type} cannot cross a ${b.kind}.`;
        const p=price(m.type,logistics.rock.get(k));if(p===null)return 'A cutting needs rock that Research has rated sound.';
        if(c&&c.key===k&&c.type===m.type){logistics.crossing=null;return null;}if(c&&c.progress>0)return 'Finish or cancel the crossing under way first.';
        logistics.crossing={key:k,type:m.type,price:p,progress:0};return null;}
      if(m.kind==='pack'){if(role!=='logistics'||phase!=='night')return 'Logistics packs at night.';if(!PACKS.includes(m.supplies))return 'Invalid supplies.';logistics.packed=m.supplies;return null;}
      return 'Unknown intent.';
    }
    function ready(id,flag=true){if(!roleOf(id))return 'Claim a role first.';if(flag)readySet.add(id);else readySet.delete(id);maybeAdvance();return null;}
    function hexes(role){
      // Hidden rock quality never leaves the host unless the role has learned it.
      const out=[],add=(k,state,extra)=>{const {rock,...s}=S(k);out.push({...s,state,crossed:crossed.get(k)?.type??null,...extra});};
      if(role==='explore'){const plan=phase==='day'?dayPlan.survey:explore.plan;for(const k of explore.surveyed)add(k,crossed.has(k)?'crossed':'surveyed');for(const k of frontier(explore.surveyed)){const i=plan.indexOf(k);add(k,i>=0?'planned':!passable(k)?explore.scouted.has(k)?'scouted':'barrier':explore.hints.has(k)?'hinted':'frontier',{order:i+1});}}
      else if(role==='research'){for(const k of research.surveyed)if(!research.samples.has(k)&&k!==root)add(k,'ground');for(const k of frontier(research.surveyed))if(research.hints.has(k)||S(k).resource)add(k,research.hints.has(k)?'hinted':'signs');for(const k of research.samples)add(k,research.identified.has(k)?'identified':research.study.has(k)?'studying':'needs-sample');add(root,'identified');
        for(const k of research.rocks)if(!crossed.has(k))add(k,research.rated.has(k)?'rock-rated':research.study.has(k)?'studying':'rock-sample',{rating:research.rated.get(k)??null});}
      else{const lines=new Set(logistics.lines.map(l=>l.key)),route=new Set(logistics.lines.flatMap(l=>l.route));for(const k of logistics.surveyed){const p=logistics.profiles.get(k);add(k,k===logistics.build?'planned':lines.has(k)?'line':p?'usable':k===root?'line':crossed.has(k)?'crossed':route.has(k)?'route':'ground',{steps:atlas.distance(S(k),S(root)),profile:p||null});}
        for(const [k,b] of logistics.barriers)if(!crossed.has(k)){const c=logistics.crossing?.key===k?logistics.crossing:null;add(k,c?'crossing':'barrier-known',{rating:logistics.rock.get(k)??null,crossing:c&&{...c},options:CROSSINGS[b.kind].map(type=>({type,price:price(type,logistics.rock.get(k))}))});}}
      return out;
    }
    function viewFor(id){
      const role=roleOf(id),base={day,phase,target:target(day),seats:Object.fromEntries(ROLES.map(r=>[r,seats[r]===null?'autopilot':seats[r]===id?'you':'teammate'])),waiting:ROLES.filter(r=>human(r)&&!readySet.has(seats[r])),ready:readySet.has(id),role,report:phase==='dusk'?report:null,crew:{survey:phase==='day'?[...dayPlan.survey]:[],build:phase==='day'?logistics.build:null,crossing:phase==='day'?logistics.crossing?.key??null:null,
        paths:phase==='day'?Object.fromEntries(dayPlan.survey.map(k=>[k,route(k,explore.surveyed)?.path??null])):{},
        buildPath:phase==='day'&&logistics.build?route(logistics.build,logistics.surveyed)?.path??null:null,crossingPath:phase==='day'&&logistics.crossing?route(logistics.crossing.key,logistics.surveyed)?.path??null:null}};
      if(!role)return {...base,hexes:[]};
      const own=role==='explore'?{supplies:explore.supplies,plan:[...explore.plan],planCost:explore.plan.reduce((a,k)=>a+tripCost(k),0),dawn}
        :role==='research'?{hints:[...research.hints],study:[...research.study],samples:[...research.samples].filter(k=>!research.identified.has(k)),identified:[...research.identified.values()]}
        :{packed:logistics.packed,points:points(),build:logistics.build,crossing:logistics.crossing&&{...logistics.crossing},crossings:[...crossed].map(([key,c])=>({key,type:c.type})),barriers:crossingOptions(),profiles:[...logistics.profiles.values()].map(p=>{const r=route(p.key,logistics.surveyed);return {...p,route:r&&r.cost,lineYield:r?lineYield(p,r):null,connected:logistics.lines.some(l=>l.key===p.key)};}),lines:logistics.lines.map(l=>({...l}))};
      return {...base,...own,hexes:hexes(role)};
    }
    function snapshot(){return {day,phase,seats:{...seats},ready:[...readySet],explore:{surveyed:explore.surveyed.size,plan:[...explore.plan],supplies:explore.supplies},research:{samples:research.samples.size,identified:research.identified.size},logistics:{profiles:logistics.profiles.size,lines:logistics.lines.length,packed:logistics.packed,barriers:logistics.barriers.size,crossing:logistics.crossing&&{...logistics.crossing},crossings:crossed.size},scouted:explore.scouted.size,rated:research.rated.size,report};}
    return {join,leave,claim,intent,ready,viewFor,snapshot,roleOf,target,root};
  }
  const api={createSession,ROLES,PHASES,target,price,PRICES,TRAVEL};
  root.CoopSession=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
