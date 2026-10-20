<script lang="ts">
  import type {Department,Session} from './lib/session.ts';

  let {selected,onselect,state}:{selected:Department;onselect:(v:Department)=>void;state:Session}=$props();

  function summary(s:Session,d:Department):string{
    if(d==='exploration'){
      if(s.phase==='report')return 'Returned';
      return s.requested?'Kit requested':'No kit requested';
    }
    if(d==='research'){
      const t=s.tasks.study;
      return t.status==='complete'?'Study delivered':t.status==='active'?'Study in progress':'Sample ready';
    }
    const a=s.tasks.assembly,c=s.tasks.dispatch;
    const cargo=c.receipt?.delivery,gear=a.receipt?.delivery;
    if(c.status==='complete'&&cargo?.kind==='cargo')
      return cargo.shippedIds.includes(0)?'Kit delivered':cargo.shippedIds.length?'Supplies shipped · kit waiting':'Nothing shipped';
    if(c.status==='active')return 'Loading the convoy';
    if(a.status==='complete')
      return gear?.kind==='gear'&&gear.kits.length?'Kit built':'Assembly incomplete';
    if(a.status==='active')return 'Building the kit';
    return 'Workshop ready';
  }

  const TABS:{id:Department;label:string}[]=[
    {id:'exploration',label:'Exploration'},
    {id:'research',label:'Research'},
    {id:'logistics',label:'Logistics'}];
</script>

<nav class="tabs" aria-label="Departments">
  {#each TABS as t (t.id)}
    <button class="tab" class:on={selected===t.id} aria-pressed={selected===t.id} onclick={()=>onselect(t.id)}>
      <b>{t.label}</b><span>{summary(state,t.id)}</span>
    </button>
  {/each}
</nav>
