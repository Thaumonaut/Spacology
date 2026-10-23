// Top-down biome map: node map.cjs model.js out.bmp cx cz span px [surface]
const fs=require('fs');const [,,mod,out,CX,CZ,SPAN,PX,mode]=process.argv;const M=require(mod),w=M.createWorld(2718,.25,'infinite');
const N=+PX,span=+SPAN,cx=+CX,cz=+CZ;const pal={};const col=b=>pal[b]||(pal[b]=(()=>{let h=0;for(const c of b)h=(h*31+c.charCodeAt(0))>>>0;return [(h&255),(h>>8)&255,(h>>16)&255];})());
const fixed={sea:[30,60,140],forest:[30,110,40],grassland:[150,200,90],flowers:[230,210,90],autumn:[210,110,30],blossom:[240,150,200],redwood:[90,40,30],steppe:[190,180,110],savanna:[200,170,70],golden:[230,200,40],desert:[240,220,160],boreal:[40,80,70],heath:[150,90,140],tundra:[170,180,170],wetland:[60,150,140],fen:[90,120,80],rainforest:[10,70,20],bamboo:[100,170,60],pinkgrass:[240,120,170],badlands:[200,110,70],beach:[250,240,200],montane:[60,90,60],snow:[255,255,255],alpine:[120,120,120],meadow:[140,190,140],subalpine:[90,130,100],glacier:[200,230,255],gorge:[60,40,40]};Object.assign(pal,fixed);
const row=(N*3+3)&~3,buf=Buffer.alloc(54+row*N);buf.write('BM');buf.writeUInt32LE(54+row*N,2);buf.writeUInt32LE(54,10);buf.writeUInt32LE(40,14);buf.writeInt32LE(N,18);buf.writeInt32LE(-N,22);buf.writeUInt16LE(1,26);buf.writeUInt16LE(24,28);
let H=0;const hh=(a,b)=>{let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^999;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=cx-span/2+span*(i+.5)/N,z=cz-span/2+span*(j+.5)/N,g=w.geography(x,z);
 let b=g.biome;if(mode==='surface'&&g.blend>0&&g.blend>.5+(hh(i,j)-.5)*.9)b=g.biome2;
 const c=g.water>g.height&&!g.sea?[50,90,200]:col(b);const o=54+j*row+i*3;buf[o]=c[2];buf[o+1]=c[1];buf[o+2]=c[0];}
fs.writeFileSync(out,buf);
