<script lang="ts">
  import type {Job,Receipt} from './lib/session.ts';

  let {job,receipt,onback}:{job:Job;receipt:Receipt;onback:()=>void}=$props();

  const TITLE:Record<Job,string>={study:'Aether attunement · boss study',assembly:'Gear assembly',dispatch:'Rocket loading'};
  const d=$derived(receipt.delivery);
</script>

<section class="saved">
  <div class="saved-bar">
    <button class="back" onclick={onback}>Back to station</button>
    <p class="host-note">This is the stored result — replaying it would not change tonight.</p>
  </div>
  <div class="saved-card">
    <p class="eyebrow">{TITLE[job]} · SAVED DELIVERY</p>
    <h2 class="tier {receipt.tier}">{receipt.tier}</h2>
    {#if receipt.output}<p class="saved-output">{receipt.output}</p>{/if}

    {#if d.kind==='research'}
      <p class="eyebrow">FINDINGS · {d.boss}</p>
      <ul class="badges">
        {#each d.removed as n (n)}<li class="removed">Removed · {n}</li>{/each}
        {#each d.weakened as n (n)}<li class="weakened">Weakened · {n}</li>{/each}
        {#if d.weakness}<li class="weakness">Weakness · {d.weakness}</li>{/if}
        {#if !d.removed.length&&!d.weakened.length}<li class="weakened">No defence touched</li>{/if}
      </ul>
    {:else if d.kind==='gear'}
      <p class="eyebrow">KITS READY</p>
      {#if d.kits.length}
        <ul class="badges">
          {#each d.kits as k (k.crew)}<li class="removed">{k.crew} · Guard {k.stats.Guard} · Pace {k.stats.Pace} · Burst {k.stats.Burst} · Mend {k.stats.Mend}</li>{/each}
        </ul>
      {:else}<p class="muted">No kit met its order — nothing was delivered.</p>{/if}
    {:else}
      <p class="eyebrow">CONVOY MANIFEST</p>
      <p>{d.shippedIds.length} of {d.total} crates shipped{d.shippedIds.includes(0)?" — Daven's field kit aboard":" — Daven's field kit left behind"}.</p>
      <p class="muted">{d.shippedIds.filter(id=>id!==0).length} supply crate{d.shippedIds.filter(id=>id!==0).length===1?'':'s'} delivered.</p>
    {/if}
  </div>
</section>
