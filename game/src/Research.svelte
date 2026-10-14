<script lang="ts">
  import {canRetry} from './lib/session.ts';
  import type {Session} from './lib/session.ts';
  import ProjectCard from './ProjectCard.svelte';

  let {state,onopen,onretry}:{state:Session;onopen:()=>void;onretry:()=>void}=$props();

  const t=$derived(state.tasks.study);
  const d=$derived(t.receipt?.delivery);
  const research=$derived(d&&d.kind==='research'?d:null);
  const label=$derived(t.status==='idle'?'Open the sample':t.status==='active'?'Resume the study':'Review the delivery');
  const status=$derived(t.status==='idle'?'Sample ready':t.status==='active'?'Testing in progress':`Delivered · ${t.receipt!.tier}`);
</script>

<section class="screen research">
  <header class="screen-head">
    <p class="eyebrow">RESEARCH · NIGHT LAB</p>
    <h2>The boss under glass</h2>
    <p class="lede">A tissue sample from CURATOR // LAST INSTRUCTION waits on the bench. Each clean reaction strips one of its defences and can expose what ends it.</p>
  </header>

  <div class="bench">
    <div class="sample" aria-hidden="true"><i class="scan"></i><i class="tissue"></i></div>
    <div class="boss-card">
      <p class="eyebrow">BOSS STUDY</p>
      <h3>CURATOR // LAST INSTRUCTION</h3>
      <p class="meta">Anchor · Custodian Array</p>
      <ul class="buffs">
        <li><b>Archive lock</b><small>restores itself to the last saved state</small></li>
        <li><b>Catalogue relay</b><small>strengthens every unit it has catalogued</small></li>
      </ul>
    </div>
  </div>

  <div class="project">
    <ProjectCard id="open-study"
      eyebrow="PROJECT · AETHER ATTUNEMENT"
      title="Study the incoming sample"
      description="Apply reagents to the tissue: the reacted region absorbs every touching group of that element. Meet the sample's objective within the sample’s move limit to remove the buff it targets."
      consequence="Removed buffs count +2, weakened +1 for tomorrow's encounter. A clean End-on sample reveals the boss weakness."
      {status} {label} onclick={onopen}/>
    {#if t.status==='complete'&&canRetry(state,'study')}
      <button class="retry" onclick={onretry}>Retry with a fresh sample</button>
    {/if}
  </div>

  {#if research}
    <section class="findings">
      <p class="eyebrow">DELIVERED FINDINGS · {t.receipt!.tier.toUpperCase()}</p>
      <ul class="badges">
        {#each research.removed as n (n)}<li class="removed">Removed · {n}</li>{/each}
        {#each research.weakened as n (n)}<li class="weakened">Weakened · {n}</li>{/each}
        {#if research.weakness}<li class="weakness">Weakness found · {research.weakness}</li>{/if}
        {#if !research.removed.length&&!research.weakened.length}<li class="weakened">No defence touched</li>{/if}
      </ul>
      <p class="muted">{t.receipt!.output}</p>
    </section>
  {/if}

  <aside class="archive-note">
    <p class="eyebrow">DISCOVERIES THIS OUTING</p>
    <p>{research?(research.weakness?`The crew knows the Curator ends on ${research.weakness}; that note travels with them.`:'The Curator keeps its weakness for another night.'):'Nothing learned yet — the sample is still on the bench.'}</p>
  </aside>
</section>
