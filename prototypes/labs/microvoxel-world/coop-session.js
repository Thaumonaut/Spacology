(function(root){
  'use strict';
  // Host-authoritative co-op supply-line session. Pure rules: no rendering or transport.
  const ROLES=Object.freeze(['explore','research','logistics']),PHASES=Object.freeze(['night','day','dusk']);
  const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]],ROOT_YIELD=8,BUILD_POINTS=3,CLAIM_COST=2,PACKS=[4,8],STUDY_LIMIT=2,HINT_LIMIT=2;
  const target=day=>6+3*(day-1);
  function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function createSession(world,atlas){
    const S=k=>{const [q,r]=k.split(',').map(Number);return atlas.summary(q,r);},root=atlas.key(atlas.rootHex.q,atlas.rootHex.r);
    const seats={explore:null,research:null,logistics:null},players=new Set(),readySet=new Set();
    let day=1,phase='night',report=null,dawn=null,dayPlan={survey:[],study:[],build:null};
    const explore={surveyed:new Set([root]),hints:new Set(),plan:[],supplies:8};
    const research={surveyed:new Set([root]),samples:new Set(),identified:new Map(),hints:new Set(),study:new Set()};
    const logistics={surveyed:new Set([root]),profiles:new Map(),lines:[],build:null,packed:8};
    const neighbours=k=>{const [q,r]=k.split(',').map(Number);return DIRS.map(([dq,dr])=>atlas.key(q+dq,r+dr));};
    const frontier=set=>{const out=new Set();for(const k of set)for(const n of neighbours(k))if(!set.has(n)&&S(n).inside)out.add(n);return [...out].sort();};
    const tripCost=k=>Math.ceil(S(k).cost);
    function fit(plan,budget){const out=[];let used=0;for(const k of plan){const c=tripCost(k);if(used+c>budget)break;used+=c;out.push(k);}return out;}
    function profile(k){
      const s=S(k),name=s.biome==='Basalt ridge'?'Ferrite seam':/River|Wetland/.test(s.biome)?'Placer iron':'Ferrite nodules';
      return {key:k,name,yield:5+hash(world.seed+':'+k)%4};
    }
    function route(from,known){
      const dist=new Map([[from,0]]),prev=new Map(),open=[from];
      while(open.length){open.sort((a,b)=>dist.get(a)-dist.get(b)||a.localeCompare(b));const k=open.shift();if(k===root)break;
        for(const n of neighbours(k)){if(!known.has(n))continue;const d=dist.get(k)+S(n).cost;if(d<(dist.get(n)??Infinity)){dist.set(n,d);prev.set(n,k);open.push(n);}}}
      if(!dist.has(root))return null;const path=[root];while(path[0]!==from)path.unshift(prev.get(path[0]));
      return {path,cost:Math.round(dist.get(root)*10)/10};
    }
    const lineYield=(p,r)=>Math.max(1,Math.round(p.yield-r.cost*.4));
    const points=()=>BUILD_POINTS-(logistics.packed>PACKS[0]?1:0);
    const human=role=>seats[role]!==null;
    // Autopilots fill unclaimed roles just before their phase resolves.
    const auto={
      explore(){const f=frontier(explore.surveyed);explore.plan=fit([...f].sort((a,b)=>(explore.hints.has(b)-explore.hints.has(a))||tripCost(a)-tripCost(b)||a.localeCompare(b)),explore.supplies);},
      researchNight(){research.hints=new Set(frontier(research.surveyed).filter(k=>S(k).resource).slice(0,HINT_LIMIT));},
      researchDay(){research.study=new Set([...research.samples].filter(k=>!research.identified.has(k)).sort().slice(0,STUDY_LIMIT));},
      logisticsNight(){logistics.packed=[...logistics.profiles.keys()].some(k=>!logistics.lines.some(l=>l.key===k))?PACKS[0]:PACKS[1];},
      logisticsDay(){const c=[...logistics.profiles.values()].filter(p=>!logistics.lines.some(l=>l.key===p.key)).map(p=>({p,r:route(p.key,logistics.surveyed)})).filter(x=>x.r).sort((a,b)=>lineYield(b.p,b.r)-lineYield(a.p,a.r)||a.p.key.localeCompare(b.p.key));logistics.build=c[0]?.p.key??null;},
    };
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
        const studied=[];for(const k of research.study)if(research.samples.has(k)&&!research.identified.has(k)){research.identified.set(k,profile(k));studied.push(k);}
        const samples=[];for(const k of dayPlan.survey){explore.surveyed.add(k);if(S(k).resource&&k!==root)samples.push(k);}
        for(const k of samples)research.samples.add(k);
        research.surveyed=new Set(explore.surveyed);logistics.surveyed=new Set(explore.surveyed);
        for(const k of studied)logistics.profiles.set(k,research.identified.get(k));
        const delivered=ROOT_YIELD+logistics.lines.reduce((a,l)=>a+l.yield,0),t=target(day);
        report={day,target:t,delivered,met:delivered>=t,shortfall:Math.max(0,t-delivered),lines:[{key:root,name:'Ferrite root',yield:ROOT_YIELD},...logistics.lines.map(l=>({key:l.key,name:l.name,yield:l.yield}))],surveyed:dayPlan.survey.length,samples:samples.length,studied:studied.length,built};
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
        if(role==='explore'){if(phase!=='night')return 'Exploration plans at night.';if(!frontier(explore.surveyed).includes(k))return 'Only frontier hexes can be surveyed.';const i=explore.plan.indexOf(k);if(i>=0)explore.plan.splice(i,1);else explore.plan.push(k);return null;}
        if(role==='research'){if(phase==='night'){if(!frontier(research.surveyed).includes(k))return 'Hints go on frontier hexes.';return toggle(research.hints,k,HINT_LIMIT);}if(phase==='day'){if(!research.samples.has(k)||research.identified.has(k))return 'Only unidentified samples can be studied.';return toggle(research.study,k,STUDY_LIMIT);}return 'Research acts at night and by day.';}
        if(role==='logistics'){if(phase!=='day')return 'Logistics builds by day.';if(!logistics.profiles.has(k)||logistics.lines.some(l=>l.key===k))return 'Only identified, unconnected resources can be claimed.';if(points()<CLAIM_COST)return 'Not enough build points today.';if(!route(k,logistics.surveyed))return 'No surveyed route to camp.';logistics.build=logistics.build===k?null:k;return null;}
      }
      if(m.kind==='pack'){if(role!=='logistics'||phase!=='night')return 'Logistics packs at night.';if(!PACKS.includes(m.supplies))return 'Invalid supplies.';logistics.packed=m.supplies;return null;}
      return 'Unknown intent.';
    }
    function ready(id,flag=true){if(!roleOf(id))return 'Claim a role first.';if(flag)readySet.add(id);else readySet.delete(id);maybeAdvance();return null;}
    function hexes(role){
      const out=[],add=(k,state,extra)=>{const s=S(k);out.push({...s,state,...extra});};
      if(role==='explore'){const plan=phase==='day'?dayPlan.survey:explore.plan;for(const k of explore.surveyed)add(k,'surveyed');for(const k of frontier(explore.surveyed)){const i=plan.indexOf(k);add(k,i>=0?'planned':explore.hints.has(k)?'hinted':'frontier',{order:i+1});}}
      else if(role==='research'){for(const k of research.surveyed)if(!research.samples.has(k)&&k!==root)add(k,'ground');for(const k of frontier(research.surveyed))if(research.hints.has(k)||S(k).resource)add(k,research.hints.has(k)?'hinted':'signs');for(const k of research.samples)add(k,research.identified.has(k)?'identified':research.study.has(k)?'studying':'needs-sample');add(root,'identified');}
      else{const lines=new Set(logistics.lines.map(l=>l.key)),route=new Set(logistics.lines.flatMap(l=>l.route));for(const k of logistics.surveyed){const p=logistics.profiles.get(k);add(k,k===logistics.build?'planned':lines.has(k)?'line':p?'usable':k===root?'line':route.has(k)?'route':'ground',{steps:atlas.distance(S(k),S(root)),profile:p||null});}}
      return out;
    }
    function viewFor(id){
      const role=roleOf(id),base={day,phase,target:target(day),seats:Object.fromEntries(ROLES.map(r=>[r,seats[r]===null?'autopilot':seats[r]===id?'you':'teammate'])),waiting:ROLES.filter(r=>human(r)&&!readySet.has(seats[r])),ready:readySet.has(id),role,report:phase==='dusk'?report:null,crew:{survey:phase==='day'?[...dayPlan.survey]:[],build:phase==='day'?logistics.build:null}};
      if(!role)return {...base,hexes:[]};
      const own=role==='explore'?{supplies:explore.supplies,plan:[...explore.plan],planCost:explore.plan.reduce((a,k)=>a+tripCost(k),0),dawn}
        :role==='research'?{hints:[...research.hints],study:[...research.study],samples:[...research.samples].filter(k=>!research.identified.has(k)),identified:[...research.identified.values()]}
        :{packed:logistics.packed,points:points(),build:logistics.build,profiles:[...logistics.profiles.values()].map(p=>{const r=route(p.key,logistics.surveyed);return {...p,route:r&&r.cost,lineYield:r?lineYield(p,r):null,connected:logistics.lines.some(l=>l.key===p.key)};}),lines:logistics.lines.map(l=>({...l}))};
      return {...base,...own,hexes:hexes(role)};
    }
    function snapshot(){return {day,phase,seats:{...seats},ready:[...readySet],explore:{surveyed:explore.surveyed.size,plan:[...explore.plan],supplies:explore.supplies},research:{samples:research.samples.size,identified:research.identified.size},logistics:{profiles:logistics.profiles.size,lines:logistics.lines.length,packed:logistics.packed},report};}
    return {join,leave,claim,intent,ready,viewFor,snapshot,roleOf,target,root};
  }
  const api={createSession,ROLES,PHASES,target};
  root.CoopSession=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
