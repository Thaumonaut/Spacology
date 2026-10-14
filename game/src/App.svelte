<script lang="ts">
  import {tick} from 'svelte';
  import {createExpedition} from './lib/session.svelte.ts';
  import {JOBS,previewEncounter} from './lib/session.ts';
  import type {Department,Job} from './lib/session.ts';
  import DepartmentTabs from './DepartmentTabs.svelte';
  import Exploration from './Exploration.svelte';
  import Research from './Research.svelte';
  import Logistics from './Logistics.svelte';
  import EncounterReportView from './EncounterReport.svelte';
  import MiniGameHost from './MiniGameHost.svelte';
  import DeliveryReceipt from './DeliveryReceipt.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';

  const expedition=createExpedition();
  let selected=$state<Department>('exploration');
  let openJob=$state<Job|null>(null);
  let reviewJob=$state<Job|null>(null);
  let mounted=$state<Partial<Record<Job,number>>>({});
  let confirm=$state<'depart'|'reset'|null>(null);

  const JOBLIST:Job[]=['study','assembly','dispatch'];
  const hostVisible=$derived(openJob!==null&&expedition.state.phase==='night'
    &&JOBS[openJob].department===selected&&mounted[openJob]===expedition.state.tasks[openJob].attempt);
  const preview=$derived(previewEncounter(expedition.state));
  const unfinished=$derived(JOBLIST.some(j=>expedition.state.tasks[j].status!=='complete'));

  async function open(job:Job){
    selected=JOBS[job].department;
    const t=expedition.state.tasks[job];
    if(t.status==='complete'){
      openJob=null;reviewJob=job;
      await tick();document.querySelector('.saved')?.scrollIntoView({block:'start'});
      return;
    }
    if(t.status==='idle')expedition.actions.start(job);
    if(expedition.state.tasks[job].status!=='active')return;
    mounted[job]=expedition.state.tasks[job].attempt;
    reviewJob=null;openJob=job;
    await tick();document.querySelector('.host:not([hidden])')?.scrollIntoView({block:'start'});
  }
  function retry(job:Job){expedition.actions.start(job);void open(job);}
  async function back(job:Job){
    openJob=null;reviewJob=null;
    await tick();document.getElementById(`open-${job}`)?.focus();
  }
  function selectDepartment(v:Department){
    selected=v;openJob=null;reviewJob=null;window.scrollTo({top:0});
  }
  function doDepart(){
    confirm=null;openJob=null;reviewJob=null;
    expedition.actions.depart();window.scrollTo({top:0});
  }
  function askDepart(){if(unfinished)confirm='depart';else doDepart();}
  function doReset(){
    confirm=null;openJob=null;reviewJob=null;mounted={};selected='exploration';
    expedition.actions.reset();window.scrollTo({top:0});
  }
  const departBody=$derived.by(()=>{
    const p=preview;
    const kit=p.equipped?`Daven's kit is aboard (Guard ${p.gear!.Guard} / Mend ${p.gear!.Mend})`:"Daven's kit is not aboard";
    const research=p.research?`study removed ${p.research.removed.length}, weakened ${p.research.weakened.length}`:'no study delivered';
    return `Depart with what is ready now? ${kit}; ${p.supplied} supply crate${p.supplied===1?'':'s'}; ${research}. `+
      `That puts strength ${p.strength} against ${p.difficulty} on the ${p.destination} (${p.success?'expected to succeed':'expected to fall short'}). `+
      'Work still open will not affect this outing.';
  });
</script>

<div class="app">
  <header class="top">
    <div class="mission">
      <p class="eyebrow">THE RIDGE EXPEDITION · CAIRN</p>
      <h1>Recover the ridge archive</h1>
    </div>
    <div class="top-right">
      <span class="chip badge">Local playtest · one browser</span>
      <span class="chip badge">Real puzzles · simulated encounter</span>
      {#if expedition.state.phase==='night'}
        <button class="quiet" onclick={()=>confirm='reset'}>Start over</button>
      {/if}
    </div>
  </header>

  <div class="objective">
    <span class="phase">{expedition.state.phase==='night'?'Night preparation':'Day report'}</span>
    <span>{expedition.state.phase==='night'
      ?`Goal: bring the archive home from ${expedition.state.destination==='ridge'?'the ridge':'the sheltered shelf'} · depart whenever the crew is ready`
      :'Expedition complete · review each department’s contribution'}</span>
  </div>

  {#if expedition.warning}<p class="notice warn" role="status">{expedition.warning}</p>{/if}
  {#if expedition.restartedTasks&&expedition.state.phase==='night'}
    <p class="notice" role="status">Unfinished puzzles restart after reload; completed deliveries are saved.</p>
  {/if}

  <DepartmentTabs {selected} onselect={selectDepartment} state={expedition.state}/>

  <div class="hosts">
    {#each JOBLIST as job (job)}
      {@const t=expedition.state.tasks[job]}
      {#if expedition.state.phase==='night'&&mounted[job]===t.attempt}
        {#key `${expedition.state.runId}:${job}:${t.attempt}`}
          <MiniGameHost {job} runId={expedition.state.runId} attempt={t.attempt}
            visible={hostVisible&&openJob===job}
            onresult={(r)=>expedition.actions.result(job,t.attempt,r)}
            onreturn={()=>back(job)}/>
        {/key}
      {/if}
    {/each}
  </div>

  {#if reviewJob!==null&&expedition.state.tasks[reviewJob].receipt}
    <DeliveryReceipt job={reviewJob} receipt={expedition.state.tasks[reviewJob].receipt!} onback={()=>back(reviewJob!)}/>
  {/if}

  <div class="workspace" hidden={hostVisible||reviewJob!==null}>
    <div class="screen-col">
      {#if expedition.state.phase==='report'&&expedition.state.report}
        <EncounterReportView report={expedition.state.report} onreset={()=>confirm='reset'}/>
      {:else if selected==='exploration'}
        <Exploration state={expedition.state}
          ondestination={(v)=>expedition.actions.destination(v)}
          onapproach={(v)=>expedition.actions.approach(v)}
          onrequest={()=>expedition.actions.request()}
          ondepart={askDepart}/>
      {:else if selected==='research'}
        <Research state={expedition.state} onopen={()=>open('study')} onretry={()=>retry('study')}/>
      {:else}
        <Logistics state={expedition.state} onopen={open} onretry={retry}/>
      {/if}
    </div>

    <aside class="rail">
      {#if expedition.state.phase==='night'}
        <section class="panel readiness">
          <p class="eyebrow">READINESS</p>
          <ul>
            <li><span>Boss study</span><b>{preview.research?`${preview.research.removed.length} removed · ${preview.research.weakened.length} weakened`:'not delivered'}</b></li>
            <li><span>Daven's kit</span><b>{preview.equipped?`aboard · Guard ${preview.gear!.Guard} / Mend ${preview.gear!.Mend}`:'not aboard'}</b></li>
            <li><span>Supplies</span><b>{preview.supplied} crate{preview.supplied===1?'':'s'}</b></li>
            <li class="expect"><span>Expected encounter</span><b class={preview.success?'good':'bad'}>{preview.strength} vs {preview.difficulty} · {preview.success?'holds':'too strong'}</b></li>
          </ul>
          <details class="rules">
            <summary>Illustrative encounter rules</summary>
            <ul>{#each preview.breakdown as b (b.label)}<li><span>{b.label}</span><b>+{b.value}</b></li>{/each}</ul>
          </details>
        </section>
      {/if}
      <section class="panel log" aria-live="polite">
        <p class="eyebrow">ACTIVITY</p>
        {#if expedition.state.log.length}
          <ul>
            {#each expedition.state.log.slice(-5).reverse() as e}
              <li class={e.department}>{e.text}</li>
            {/each}
          </ul>
        {:else}<p class="muted">Nothing logged yet — the night is young.</p>{/if}
      </section>
    </aside>
  </div>

  {#if confirm==='depart'}
    <ConfirmDialog title="Depart at dawn?" body={departBody} confirmLabel="Depart" onconfirm={doDepart} oncancel={()=>confirm=null}/>
  {:else if confirm==='reset'}
    <ConfirmDialog title="Try the expedition again?" body="The current run, its deliveries and its report are discarded; saved preferences in the puzzles stay as they are." confirmLabel="Start over" onconfirm={doReset} oncancel={()=>confirm=null}/>
  {/if}
</div>
