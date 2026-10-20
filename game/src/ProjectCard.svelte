<script lang="ts">
  let {eyebrow,title,description,consequence,status,label,disabled=false,onclick,id=undefined}:{
    eyebrow:string;title:string;description:string;consequence:string;status:string;label:string;
    disabled?:boolean;onclick:()=>void;id?:string}=$props();
</script>

<button class="card" {id} {disabled} {onclick}>
  <span class="eyebrow">{eyebrow}</span>
  <span class="card-title">{title}</span>
  <span class="card-desc">{description}</span>
  <span class="card-cons">{consequence}</span>
  <span class="card-foot"><span class="card-status">{status}</span><span class="card-label">{label}</span></span>
</button>
