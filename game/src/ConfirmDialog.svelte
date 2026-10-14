<script lang="ts">
  import {onMount} from 'svelte';

  let {title,body,confirmLabel,onconfirm,oncancel}:{
    title:string;body:string;confirmLabel:string;onconfirm:()=>void;oncancel:()=>void}=$props();

  let dialog:HTMLDialogElement|undefined=$state();
  let cancel:HTMLButtonElement|undefined=$state();
  let previous:HTMLElement|null=null;

  onMount(()=>{
    previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    dialog?.showModal();
    cancel?.focus();
    return()=>{if(dialog?.open)dialog.close();if(previous?.isConnected)previous.focus();};
  });
</script>

<dialog bind:this={dialog} class="confirm" aria-labelledby="cf-title" oncancel={(e)=>{e.preventDefault();oncancel();}}>
  <h3 id="cf-title">{title}</h3>
  <p>{body}</p>
  <div class="confirm-btns">
    <button class="primary" onclick={onconfirm}>{confirmLabel}</button>
    <button bind:this={cancel} onclick={oncancel}>Cancel</button>
  </div>
</dialog>
