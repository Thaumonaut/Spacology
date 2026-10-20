<script lang="ts">
  import {canRetry} from './lib/session.ts';
  import type {Job,Session} from './lib/session.ts';
  import ProjectCard from './ProjectCard.svelte';

  let {state,onopen,onretry}:{state:Session;onopen:(job:Job)=>void;onretry:(job:Job)=>void}=$props();

  const a=$derived(state.tasks.assembly),c=$derived(state.tasks.dispatch);
  const ad=$derived(a.receipt?.delivery),cd=$derived(c.receipt?.delivery);
  const kit=$derived(ad&&ad.kind==='gear'?ad.kits.find(k=>k.crew==='Daven'):undefined);
  const shipped=$derived(cd&&cd.kind==='cargo'?cd.shippedIds:[]);
  const aboard=$derived(shipped.includes(0));

  const aLabel=$derived(a.status==='idle'?'Open the workshop':a.status==='active'?'Resume assembly':'Review the build');
  const aStatus=$derived(a.status==='idle'?'Order standing':a.status==='active'?'Assembly in progress':kit?`Built · Guard ${kit.stats.Guard} / Mend ${kit.stats.Mend}`:'Built nothing for Daven');
  const cLabel=$derived(c.status==='idle'?'Open the cargo bay':c.status==='active'?'Resume loading':'Review the manifest');
  const cStatus=$derived(!kit?'Needs the kit built first'
    :c.status==='idle'?'Convoy waiting'
    :c.status==='active'?'Loading in progress'
    :aboard?'Kit aboard the convoy':"Kit left behind");
</script>

<section class="screen logistics">
  <header class="screen-head">
    <p class="eyebrow">LOGISTICS · WORKSHOP & CARGO BAY</p>
    <h2>Build it, then fly it</h2>
    <p class="lede">A kit that is only built helps nobody: it has to leave the dock in crate 0. Supplies around it still count, four crates or more.</p>
  </header>

  {#if state.requested}
    <section class="request-card">
      <p class="eyebrow">REQUEST · FROM EXPLORATION</p>
      <p><b>Daven · Sustain</b> — Guard ≥ 5 · Mend ≥ 3 · fits a 4×3 frame</p>
    </section>
  {:else}
    <p class="muted">No kit request tonight — Exploration can still send one, and the bench can build ahead regardless.</p>
  {/if}

  <div class="bay">
    <div class="rocket" aria-hidden="true"><i class="cone"></i><i class="hull"></i><i class="fin l"></i><i class="fin r"></i></div>
    <div class="chain">
      <div class="project">
        <ProjectCard id="open-assembly"
          eyebrow="PROJECT · GEAR ASSEMBLY"
          title="Build Daven's field kit"
          description="Fit the night's parts into a 4×3 frame so the finished kit reaches Guard ≥ 5 and Mend ≥ 3. Unmet orders are held back."
          consequence="Only a met order becomes a real kit for the encounter — its Guard and Mend decide the bonus once it flies."
          status={aStatus} label={aLabel} onclick={()=>onopen('assembly')}/>
        {#if a.status==='complete'&&canRetry(state,'assembly')}
          <button class="retry" onclick={()=>onretry('assembly')}>Rebuild the kit</button>
        {/if}
      </div>
      <div class="link" aria-hidden="true"><i></i><span>{kit?(aboard?'built → aboard':'built → still on the dock'):'kit must be built first'}</span><i></i></div>
      <div class="project">
        <ProjectCard id="open-dispatch"
          eyebrow="PROJECT · ROCKET LOADING"
          title="Load the convoy"
          description="Stack nine crates into two rockets without tipping them. Crate 0 is Daven's field kit — it only counts if it actually ships."
          consequence="Crate 0 aboard equips the kit. Four or more other crates delivered count as supplies (+1). A tipped rocket ships nothing."
          status={cStatus} label={cLabel} disabled={!kit&&c.status==='idle'} onclick={()=>onopen('dispatch')}/>
        {#if c.status==='complete'&&canRetry(state,'dispatch')}
          <button class="retry" onclick={()=>onretry('dispatch')}>Load the convoy again</button>
        {/if}
      </div>
    </div>
    <ul class="crates" aria-label="Delivered crates">
      {#each shipped as id (id)}<li class:kit={id===0}>{id===0?"Daven's kit":`crate ${id}`}</li>{/each}
      {#if !shipped.length}<li class="none">nothing delivered yet</li>{/if}
    </ul>
  </div>
</section>
