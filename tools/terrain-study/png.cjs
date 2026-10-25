'use strict';
// Minimal PNG codec (zlib only, no dependencies). decode(): 8-bit greyscale / RGB / RGBA / grey+alpha, non-interlaced
// (all Terrarium tiles are 8-bit RGB). encode(): 8-bit RGB or greyscale with per-row filter choice for smaller files.
const zlib=require('node:zlib');
const SIG=Buffer.from([137,80,78,71,13,10,26,10]);
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decode(buf){
  if(!buf.subarray(0,8).equals(SIG))throw new Error('not a PNG');
  let o=8,width=0,height=0,depth=0,ctype=0,inter=0;const idat=[];let palette=null;
  while(o<buf.length){const len=buf.readUInt32BE(o),type=buf.toString('ascii',o+4,o+8),data=buf.subarray(o+8,o+8+len);o+=12+len;
    if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];ctype=data[9];inter=data[12];}
    else if(type==='PLTE')palette=data;else if(type==='IDAT')idat.push(data);else if(type==='IEND')break;}
  if(depth!==8||inter)throw new Error(`unsupported PNG: depth ${depth} interlace ${inter}`);
  const ch={0:1,2:3,3:1,4:2,6:4}[ctype];if(!ch)throw new Error('unsupported colour type '+ctype);
  const raw=zlib.inflateSync(Buffer.concat(idat)),stride=width*ch,out=new Uint8Array(width*height*3);
  let prev=new Uint8Array(stride),cur=new Uint8Array(stride);
  for(let y=0;y<height;y++){const f=raw[y*(stride+1)],row=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1));
    for(let i=0;i<stride;i++){const a=i>=ch?cur[i-ch]:0,b=prev[i],c=i>=ch?prev[i-ch]:0,x=row[i];
      cur[i]=(f===0?x:f===1?x+a:f===2?x+b:f===3?x+((a+b)>>1):x+paeth(a,b,c))&255;}
    for(let i=0;i<width;i++){const p=(y*width+i)*3;
      if(ctype===3){const k=cur[i]*3;out[p]=palette[k];out[p+1]=palette[k+1];out[p+2]=palette[k+2];}
      else if(ch<3){out[p]=out[p+1]=out[p+2]=cur[i*ch];}
      else{out[p]=cur[i*ch];out[p+1]=cur[i*ch+1];out[p+2]=cur[i*ch+2];}}
    const t=prev;prev=cur;cur=t;}
  return {width,height,rgb:out};
}
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc(b){let c=0xffffffff;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const l=Buffer.alloc(4);l.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type,'ascii'),data]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);}
// data: Uint8Array width*height*ch (ch 3 = RGB, 1 = greyscale).
function encode(width,height,rgb,ch=3){
  const stride=width*ch,raw=Buffer.alloc((stride+1)*height),row=Buffer.alloc(stride);
  for(let y=0;y<height;y++){let best=null,bestS=Infinity,bestF=0;
    for(let f=0;f<5;f++){let s=0;for(let i=0;i<stride;i++){const x=rgb[y*stride+i],a=i>=ch?rgb[y*stride+i-ch]:0,b=y?rgb[(y-1)*stride+i]:0,c=i>=ch&&y?rgb[(y-1)*stride+i-ch]:0;
        const v=(x-(f===0?0:f===1?a:f===2?b:f===3?((a+b)>>1):paeth(a,b,c)))&255;row[i]=v;s+=v<128?v:256-v;}
      if(s<bestS){bestS=s;bestF=f;best=Buffer.from(row);}}
    raw[y*(stride+1)]=bestF;best.copy(raw,y*(stride+1)+1);}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(width,0);ih.writeUInt32BE(height,4);ih[8]=8;ih[9]=ch===1?0:2;
  return Buffer.concat([SIG,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
module.exports={decode,encode};
