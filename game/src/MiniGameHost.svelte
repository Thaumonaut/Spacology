<script lang="ts">
  import {onMount} from 'svelte';
  import {JOBS} from './lib/session.ts';
  import type {Job,Receipt} from './lib/session.ts';

  let {job,runId,attempt,visible,onresult,onreturn}:{
    job:Job;runId:string;attempt:number;visible:boolean;
    onresult:(r:Receipt)=>void;onreturn:()=>void}=$props();

  const spec=$derived(JOBS[job]);
  const token=$derived(`${runId}:${job}:${attempt}`);
  const src=$derived(`${import.meta.env.BASE_URL}prototypes/${spec.game}.html?${new URLSearchParams({
    seed:String(spec.seed),difficulty:spec.difficulty,embed:'expedition',task:job,attempt:token})}`);
  const TITLE:Record<Job,string>={study:'Aether attunement boss study',assembly:'Gear assembly',dispatch:'Rocket loading'};
  const BLURB:Record<Job,string>={
    study:'Your result helps the ridge encounter: buffs you strip weaken it, a clean sample can reveal the weakness.',
    assembly:'Your result helps Daven in the field: only met orders become a real kit, and cargo still has to ship it.',
    dispatch:"Your result decides what actually arrives: Daven's kit counts only if crate 0 leaves the dock; four more crates count as supplies."};

  let frame:HTMLIFrameElement|undefined=$state();
  let loaded=$state(false);
  let failed=$state(false);

  onMount(()=>{
    const onMessage=(event:MessageEvent)=>{
      if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
      const d=event.data;
      if(!d||typeof d!=='object'||d.version!==1||d.task!==job||d.attempt!==token)return;
      if(d.game!==spec.game||d.seed!==spec.seed||d.difficulty!==spec.difficulty)return;
      if(d.type==='spacology:minigame-result')onresult({tier:d.tier,output:typeof d.output==='string'?d.output:'',delivery:d.delivery});
      else if(d.type==='spacology:minigame-return')onreturn();
    };
    window.addEventListener('message',onMessage);
    return()=>window.removeEventListener('message',onMessage);
  });
</script>

<section class="host" hidden={!visible} aria-label={TITLE[job]}>
  <div class="host-bar">
    <button class="back" onclick={onreturn}>Back to station</button>
    <p class="host-note">{BLURB[job]}</p>
  </div>
  {#if !loaded&&!failed}<p class="host-loading" role="status">Loading the puzzle…</p>{/if}
  {#if failed}<p class="host-loading" role="alert">The puzzle could not load. Check that the prototype files are present.</p>{/if}
  <iframe bind:this={frame} {src} title={TITLE[job]}
    onload={()=>{loaded=true;}} onerror={()=>{failed=true;}}></iframe>
</section>
