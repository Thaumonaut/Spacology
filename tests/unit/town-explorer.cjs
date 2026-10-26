'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');let next,now=0,moves=0;
const doc={hidden:false,addEventListener(){}},canvas={clientWidth:800,clientHeight:600,focus(){},setPointerCapture(){}},ctx={window:{},document:doc,performance:{now:()=>now},devicePixelRatio:1,requestAnimationFrame:f=>next=f,addEventListener(){},CastleRender:{Renderer:class{draw(){}}},CastleWalk:{Multi:class{}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../../prototypes/labs/castle-drafts/toolkit/interiors/explorer.js'),'utf8'),ctx);
const view=new ctx.window.TownExplorer(canvas,{onMove:()=>moves++});view.walker={x:0,y:0,z:0,yaw:0,pitch:0,update(dt){this.x+=dt},camera(){return {eye:[this.x,1.6,0],yaw:0,pitch:0}}};
for(let i=1;i<=120;i++){now=i*1000/120;next(now);}assert(view.frames>=58&&view.frames<=62,'120 Hz input renders at 60 FPS without dropping to 30 FPS');const frames=view.frames;
view.lookCaptured=true;for(let i=0;i<30;i++)canvas.onpointermove({movementX:1,movementY:0});assert.equal(view.frames,frames,'mouse events coalesce into the next animation frame');assert(view.dirty);
const before=view.walker.x,moveCount=moves;doc.hidden=true;for(let i=0;i<30;i++){now+=100;next(now);}assert.equal(moves,moveCount,'hidden tab skips simulation');assert.equal(view.frames,frames,'hidden tab skips rendering');doc.hidden=false;now+=1000/60;next(now);assert(view.walker.x-before<.02,'returning from a hidden tab does not advance elapsed background time');
console.log('PASS explorer: 60 FPS at 120 Hz, input coalescing, hidden-tab suspension and resume');
