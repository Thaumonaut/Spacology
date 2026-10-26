'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});try{
 const p=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173')+'/prototypes/labs/castle-drafts/toolkit/');
 await p.waitForFunction(()=>window.TownKitDemo?.frames>0);
 const initial=await p.evaluate(()=>({buildings:TownKitDemo.scene.buildings.length,width:document.querySelector('canvas').width,triangles:TownKitDemo.renderer.stats.tris,error:TownKitDemo.renderer.gl.getError()}));
 assert.equal(initial.buildings,3);assert.equal(initial.width,1280,'framebuffer matches viewport');assert(initial.triangles>1000);assert.equal(initial.error,0);
 for(const [preset,expected] of [['fronts',['steppedHouse','doubleBayHouse','orielHouse']],['massing',['cornerHouse','courtyardInn','towerWorkshop']],['storage',['undercroftHouse','galleryHouse','warehouse']],['green',['orielHouse','bayHouse','galleryHouse']],['forms',['galleryHouse','gambrelHouse','sweptHouse']],['large',['pub','inn','manor']],['slumDense',['stackedDwelling','patchedLodging','shack','leanTo','tenement']],['homes',['stoneCottage','weaversHouse','merchantHouse','gableHouse']],['shops',['bakery','florist','bookseller']],['craft',['smithy','warehouse','house']],['civic',['chapel','pub','towerhouse']],['slums',['shack','leanTo','tenement']],['market',['armourer','apothecary','bookseller','generalGoods','clothing']]]){await p.selectOption('#preset',preset);assert.deepEqual(await p.evaluate(()=>TownKitDemo.scene.buildings.map(b=>b.variant)),expected);assert.equal(await p.evaluate(()=>TownKitDemo.renderer.gl.getError()),0);}
 await p.selectOption('#preset','street');
 await p.locator('#grade').evaluate(e=>{e.value='18';e.dispatchEvent(new Event('input'));});
 assert(await p.evaluate(()=>TownKitDemo.scene.road.steps>0));
 await p.locator('#sockets').check();await p.selectOption('#light','golden');
 assert.equal(await p.evaluate(()=>TownKitDemo.renderer.gl.getError()),0);
 await p.locator('#walk').click();await p.waitForFunction(()=>TownKitDemo.cam.fp!==null);
 const start=await p.evaluate(()=>TownKitDemo.cam.fp.eye[0]);await p.keyboard.down('w');
 await p.waitForFunction(x=>TownKitDemo.cam.fp.eye[0]>x+1,start,{timeout:10000});await p.keyboard.up('w');
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>TownKitDemo.cam.fp),null);
 await p.locator('#menu').click();await p.locator('#reset').click();
 await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>document.querySelector('canvas').width===390);
 await p.setViewportSize({width:1280,height:900});await p.selectOption('#preset','city');const city=await p.evaluate(()=>({n:TownKitDemo.scene.buildings.length,error:TownKitDemo.renderer.gl.getError(),tris:TownKitDemo.renderer.stats.tris,edges:TownKitDemo.scene.sidewalk.rows.length,roadWidth:TownKitDemo.scene.sidewalk.carriagewayWidth}));assert.equal(city.edges,32);assert(city.roadWidth>=4);assert.equal(city.n,224);assert.equal(city.error,0);assert(city.tris>500000);assert.deepEqual(errors,[]);
 console.log('PASS toolkit browser: imported assets, framebuffer size, incline/stair rebuild, sockets, both lights, uphill walking, exit/reset, mobile resize; no WebGL errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
