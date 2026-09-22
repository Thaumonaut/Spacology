const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:false}); const page=await browser.newPage();
 await page.goto((process.env.SPACOLOGY_BASE_URL || 'http://127.0.0.1:4173') + '/prototypes/spacology-v0.1.0.html');
 await page.evaluate(()=>{
  const state={schema:3,round:1,maxRounds:6,gold:42,integrity:100,level:1,capacity:4,shipSlots:1,field:['Ash',null,null,null,null,null,null,null],support:Array(8).fill(null),reserve:['Tarn'],gear:[],shipInventory:[],shipEquipped:[],equipped:{Tarn:['Bore Bit']},scrap:0,crystals:0,rarePity:0,selected:null,drag:null,openedThisRound:false,battlesWon:0,observations:0,packRefreshes:0,packOffers:['rot','tempo','bulwark']};
  localStorage.setItem('spacologyRunV010',JSON.stringify(state));
  localStorage.setItem('spacologyBattleResult',JSON.stringify({round:1,won:true,gold:34,integrity:2,observation:false,crystals:0,item:{type:'gear',name:'Bore Bit'},rarePity:1}));
 });
 await page.reload();
 const out=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('spacologyRunV010'));return {round:s.round,gearInventory:s.gear,tarnEquipped:s.equipped.Tarn,scrap:s.scrap}});
 console.log(JSON.stringify(out)); await browser.close();
 require('node:assert/strict').deepEqual(out,{round:2,gearInventory:[],tarnEquipped:['Bore Bit'],scrap:4});
})().catch(error=>{console.error(error);process.exitCode=1;});
