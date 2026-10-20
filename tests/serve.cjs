#!/usr/bin/env node
'use strict';
// Static server for prototypes or the built Pages artifact (--root dist).
// `npm run serve` (port 4173, this machine only); `npm run serve -- --host 0.0.0.0` for an iPad on the
// same Wi-Fi; `--port N` to change the port. The test runner starts it on a free port instead.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const TYPES={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.cjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8',
  '.md':'text/plain; charset=utf-8','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'
};

function resolveFile(urlPath,root=ROOT){
  let rel;
  try{rel=decodeURIComponent(urlPath.split('?')[0].split('#')[0]);}catch{return null;}
  const file=path.resolve(root,'.'+path.posix.normalize('/'+rel));
  if(file!==root&&!file.startsWith(root+path.sep))return null;
  try{
    const stat=fs.statSync(file);
    if(stat.isDirectory()){const index=path.join(file,'index.html');return fs.existsSync(index)?index:null;}
    return stat.isFile()?file:null;
  }catch{return null;}
}

function start({port=4173,host='127.0.0.1',root=ROOT,prefix='/'}={}){
  const server=http.createServer((req,res)=>{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
    const file=req.url.startsWith(prefix)?resolveFile('/'+req.url.slice(prefix.length),root):null;
    if(!file){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'}).end('Not found');return;}
    res.writeHead(200,{'content-type':TYPES[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
    if(req.method==='HEAD'){res.end();return;}
    fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  });
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,host,()=>{
      const address=server.address();
      resolve({server,url:`http://${host==='0.0.0.0'?'127.0.0.1':host}:${address.port}${prefix.replace(/\/$/,'')}`,close:()=>new Promise(r=>server.close(()=>r()))});
    });
  });
}

module.exports={start,resolveFile,ROOT};

if(require.main===module){
  const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0&&args[i+1]!==undefined?args[i+1]:fallback;};
  const port=Number(flag('port',4173)),host=flag('host','127.0.0.1'),root=path.resolve(flag('root',ROOT));
  start({port,host,root}).then(({url})=>{
    console.log(`Serving ${root} at ${url}/`);
    if(host==='0.0.0.0')console.log(`Listening on every interface, port ${port}: open http://<this Mac's LAN IP>:${port}/ from the iPad.`);
  },error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use; try --port ${port+1}.`:error.message);process.exit(1);});
}
