<script lang="ts">
  import type {Session} from './lib/session.ts';

  let {state,ondestination,onapproach,onrequest,ondepart}:{
    state:Session;
    ondestination:(v:'ridge'|'shelf')=>void;
    onapproach:(v:'careful'|'direct')=>void;
    onrequest:()=>void;
    ondepart:()=>void}=$props();

  const base=import.meta.env.BASE_URL;
  const gear=$derived(state.tasks.assembly.receipt?.delivery);
  const kit=$derived(gear&&gear.kind==='gear'?gear.kits.find(k=>k.crew==='Daven'):undefined);
  const cargo=$derived(state.tasks.dispatch.receipt?.delivery);
  const aboard=$derived(!!kit&&!!cargo&&cargo.kind==='cargo'&&cargo.shippedIds.includes(0));
  const CREW=[
    {name:'Daven',role:'front line',img:'assets/cast/daven-pell-v7.png'},
    {name:'Hanae',role:'recovery',img:'assets/cast/hanae-mori-v3.png'},
    {name:'Arunima',role:'support',img:'assets/cast/arunima-das-v4.png'}];
</script>

<section class="screen exploration">
  <header class="screen-head">
    <p class="eyebrow">EXPLORATION · CAIRN SURFACE</p>
    <h2>Choose where the crew climbs at dawn</h2>
    <p class="lede">Daven leads, Hanae keeps everyone standing, Arunima watches the flanks. Pick a destination and how they approach it; the night's work decides what they carry.</p>
  </header>

  <div class="map">
    <svg class="contours" viewBox="0 0 640 300" aria-hidden="true" preserveAspectRatio="none">
      <path d="M0,260 C120,240 160,180 260,170 C360,160 400,90 520,80 C580,76 620,60 640,50"/>
      <path d="M0,290 C130,270 190,215 280,205 C380,192 430,125 540,115 C590,110 625,95 640,88"/>
      <path d="M40,300 C150,285 210,240 300,232 C400,222 450,160 560,150 C600,146 630,132 640,126"/>
      <path d="M300,300 C380,280 430,240 520,230 C570,224 610,205 640,196"/>
    </svg>
    <button class="pin pin-ridge" class:on={state.destination==='ridge'} aria-pressed={state.destination==='ridge'}
      onclick={()=>ondestination('ridge')}>
      <b>Ridge archive</b><small>Steep approach · encounter 9 · full archive</small>
    </button>
    <button class="pin pin-shelf" class:on={state.destination==='shelf'} aria-pressed={state.destination==='shelf'}
      onclick={()=>ondestination('shelf')}>
      <b>Sheltered shelf</b><small>Shallow approach · encounter 5 · small archive</small>
    </button>
  </div>

  <div class="prep">
    <section class="panel">
      <p class="eyebrow">APPROACH</p>
      <div class="segmented" role="group" aria-label="Approach">
        <button class:on={state.approach==='careful'} aria-pressed={state.approach==='careful'} onclick={()=>onapproach('careful')}>
          <b>Careful</b><small>+1 to the encounter, slower and quieter</small></button>
        <button class:on={state.approach==='direct'} aria-pressed={state.approach==='direct'} onclick={()=>onapproach('direct')}>
          <b>Direct</b><small>no bonus, straight up the face</small></button>
      </div>
    </section>

    <section class="panel">
      <p class="eyebrow">CREW</p>
      <ul class="crew">
        {#each CREW as c (c.name)}
          <li>
            <img src="{base}{c.img}" alt="Portrait of {c.name}" width="64" height="64">
            <b>{c.name}</b><small>{c.role}</small>
            {#if c.name==='Daven'}
              <em>{aboard?`kit aboard · Guard ${kit!.stats.Guard} / Mend ${kit!.stats.Mend}`:kit?'kit built, not yet aboard':'no kit'}</em>
            {/if}
          </li>
        {/each}
      </ul>
      {#if kit}
        <p class="request-done">Daven's kit is built{aboard?' and aboard the convoy.':', waiting on cargo.'}</p>
      {:else if state.requested}
        <p class="request-done">Kit requested — Logistics has the order (Guard ≥ 5, Mend ≥ 3).</p>
      {:else}
        <button class="request" onclick={onrequest}>Request Daven's field kit</button>
      {/if}
    </section>
  </div>

  <div class="depart-row">
    <button class="primary depart" onclick={ondepart}>Depart at dawn</button>
    <p class="depart-note">Departure is always possible — the crew goes with whatever is ready.</p>
  </div>
</section>
