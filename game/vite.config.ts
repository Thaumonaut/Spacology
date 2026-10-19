import {svelte} from '@sveltejs/vite-plugin-svelte';
import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const files=['prototypes/shared/minigames/minigame-kit.js','prototypes/shared/minigames/minigame-kit.css',
  ...['aether-attunement','gear-pack','pallet-stacking'].flatMap(id=>[
    `prototypes/${id}.html`,
    ...['.css','.js','-model.js'].map(ext=>`prototypes/minigames/${id}/${id}${ext}`)]),
  ...['daven-pell-v7','hanae-mori-v3','arunima-das-v4'].map(id=>`assets/cast/${id}.png`)];
const allowed=new Set(files);
const MIME:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};

function localAssets(){
  return {
    name:'spacology-local-assets',
    configureServer(server:{middlewares:{use:(fn:(req:{url?:string},res:{setHeader:(k:string,v:string)=>void,end:(b:Uint8Array|string)=>void},next:()=>void)=>void)=>void}}){
      server.middlewares.use((req,res,next)=>{
        const pathname=decodeURIComponent((req.url||'').split('?')[0]).replace(/^\/+/,'');
        if(!allowed.has(pathname))return next();
        res.setHeader('Content-Type',MIME[pathname.slice(pathname.lastIndexOf('.'))]||'application/octet-stream');
        res.setHeader('Cache-Control','no-store');
        res.end(readFileSync(repo+pathname));
      });
    },
    generateBundle(this:{emitFile:(f:{type:string;fileName:string;source:Uint8Array})=>void}){
      for(const f of files)this.emitFile({type:'asset',fileName:f,source:readFileSync(repo+f)});
    }
  };
}

export default defineConfig({base:'./',plugins:[svelte(),localAssets()],build:{target:'es2022'}});
