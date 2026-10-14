<script lang="ts">
  import type {EncounterReport} from './lib/session.ts';

  let {report,onreset}:{report:EncounterReport;onreset:()=>void}=$props();

  const big=$derived(report.success&&report.destination==='ridge');
  const dest=$derived(report.destination==='ridge'?'the ridge':'the sheltered shelf');
</script>

<section class="screen report">
  <p class="eyebrow">DAY REPORT · {dest.toUpperCase()}</p>
  <h2 class={big?'won':''}>{big?'Ridge archive recovered':'A partial expedition'}</h2>
  <p class="simtag">Simulated encounter · illustrative rules</p>
  <p class="lede">
    {report.success
      ?(report.destination==='ridge'
        ?`Strength ${report.strength} met the encounter's ${report.difficulty}: the crew comes home with the full archive and one new sample.`
        :`Strength ${report.strength} met the shelf's ${report.difficulty}: a small archive and one new sample come home.`)
      :`Strength ${report.strength} could not meet the encounter's ${report.difficulty}: the crew turned back, still carrying one sample.`}
  </p>

  <div class="receipts">
    <section class="receipt">
      <p class="eyebrow">RESEARCH</p>
      {#if report.research}
        <ul class="badges">
          {#each report.research.removed as n (n)}<li class="removed">Removed · {n}</li>{/each}
          {#each report.research.weakened as n (n)}<li class="weakened">Weakened · {n}</li>{/each}
          {#if report.research.weakness}<li class="weakness">Weakness · {report.research.weakness}</li>{/if}
        </ul>
        {#if !report.research.removed.length&&!report.research.weakened.length}<p class="muted">No defence touched.</p>{/if}
      {:else}<p class="muted">No study delivered.</p>{/if}
    </section>
    <section class="receipt">
      <p class="eyebrow">LOGISTICS</p>
      {#if report.equipped&&report.gear}
        <p>Daven's kit arrived — <b>Guard {report.gear.Guard} / Mend {report.gear.Mend}</b>.</p>
      {:else}
        <p class="muted">Daven's kit did not reach the front.</p>
      {/if}
      <p class="muted">{report.supplied} supply crate{report.supplied===1?'':'s'} delivered{report.supplied>=4?' (+1 supplies)':' (four needed for the bonus)'}.</p>
    </section>
    <section class="receipt">
      <p class="eyebrow">EXPLORATION</p>
      <p>{report.destination==='ridge'?'Ridge archive':'Sheltered shelf'} · {report.approach} approach.</p>
      <p class="muted">Strength {report.strength} vs encounter {report.difficulty} · archive +{report.archive} · sample +{report.samples}.</p>
    </section>
  </div>

  <details class="rules">
    <summary>Illustrative encounter rules — how strength {report.strength} was counted</summary>
    <ul>
      {#each report.breakdown as b (b.label)}<li><span>{b.label}</span><b>+{b.value}</b></li>{/each}
      <li class="total"><span>Total vs encounter</span><b>{report.strength} vs {report.difficulty}</b></li>
    </ul>
  </details>

  <p class="nextloop">The sample goes to the lab for the next outing — materials and follow-up expeditions are a next-loop concept, not playable in this mock.</p>

  <button class="primary" onclick={onreset}>Try the expedition again</button>
</section>
