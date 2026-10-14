import {acceptResult,chooseApproach,chooseDestination,createSession,depart,requestKit,restoreSession,startJob,STORAGE_KEY} from './session.ts';
import type {Job,Receipt,Session} from './session.ts';

export function createExpedition(){
  let state=$state<Session>(createSession(crypto.randomUUID()));
  let warning=$state<string|null>(null);
  let restartedTasks=$state(false);
  loadStored();

  function loadStored(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw)return;
      const parsed:unknown=JSON.parse(raw);
      const s=restoreSession(parsed);
      if(!s)return;
      const wasActive=typeof parsed==='object'&&parsed!==null&&'tasks' in parsed&&typeof parsed.tasks==='object'&&parsed.tasks!==null&&
        Object.values(parsed.tasks).some(t=>typeof t==='object'&&t!==null&&'status' in t&&t.status==='active');
      state=s;
      restartedTasks=wasActive;
      if(wasActive)save();
    }catch{
      warning='Browser storage is unavailable or unreadable: progress lasts for this visit only.';
    }
  }
  function save(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
    catch{warning='Browser storage is unavailable: progress lasts for this visit only.';}
  }
  function commit(next:Session){
    if(next===state)return;
    state=next;
    save();
  }
  const actions={
    request:()=>commit(requestKit(state)),
    destination:(v:'ridge'|'shelf')=>commit(chooseDestination(state,v)),
    approach:(v:'careful'|'direct')=>commit(chooseApproach(state,v)),
    start:(job:Job)=>commit(startJob(state,job)),
    result:(job:Job,attempt:number,receipt:Receipt)=>commit(acceptResult(state,job,attempt,receipt)),
    depart:()=>commit(depart(state)),
    reset:()=>{state=createSession(crypto.randomUUID());restartedTasks=false;save();}
  };
  return {get state(){return state;},get warning(){return warning;},get restartedTasks(){return restartedTasks;},actions};
}
