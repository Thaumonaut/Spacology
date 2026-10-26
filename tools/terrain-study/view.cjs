'use strict';
// Perspective silhouette view of a height grid (a "voxel space" column renderer: per screen column, march out along
// the ray and draw each sample above the highest drawn so far). Shaded by the sun (NW, 45 degrees) with distance haze,
// sky above. Used to judge ridge and peak silhouettes from a standing eye (styles.cjs view).
// grid: {n, step, h, x0, z0} with h[j*n+i] at (x0 + i*step, z0 + j*step). eye: {x, z, y}; yaw: radians, 0 = toward +z.
function bil(G,x,z){const fx=(x-G.x0)/G.step,fz=(z-G.z0)/G.step,i=Math.floor(fx),j=Math.floor(fz);if(i<0||j<0||i>=G.n-1||j>=G.n-1)return NaN;
  const u=fx-i,v=fz-j,H=G.h,n=G.n;return (H[j*n+i]*(1-u)+H[j*n+i+1]*u)*(1-v)+(H[(j+1)*n+i]*(1-u)+H[(j+1)*n+i+1]*u)*v;}
function render(G,eye,yaw,{W=960,Hh=420,fov=70,pitch=0,far=7000,sea=null}={}){
  const img=new Uint8Array(W*Hh*3),f=W/2/Math.tan(fov*Math.PI/360),hor=Hh/2+pitch*f,L=[-.5,.7,.5],Ln=Math.hypot(...L);
  for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const t=y/Hh,p=(y*W+x)*3;img[p]=150+60*t;img[p+1]=185+45*t;img[p+2]=225+20*t;}
  for(let c=0;c<W;c++){const a=yaw+Math.atan((c-W/2)/f),dx=Math.sin(a),dz=Math.cos(a),cosA=Math.cos(a-yaw);let ymin=Hh,d=8;
    while(d<far&&ymin>0){const x=eye.x+dx*d,z=eye.z+dz*d;let h=bil(G,x,z);if(h!==h)break;const water=sea!=null&&h<sea;if(water)h=sea;
      const sy=Math.floor(hor-(h-eye.y)/(d*cosA)*f);
      if(sy<ymin){const e=G.step,gx=(bil(G,x+e,z)-bil(G,x-e,z))/(2*e),gz=(bil(G,x,z+e)-bil(G,x,z-e))/(2*e),nl=Math.hypot(gx,gz,1);
        let s=water?.75:Math.max(0,(-gx*L[0]-gz*L[2]+L[1])/(nl*Ln));const fog=Math.min(1,d/far)**1.3,base=water?[70,110,150]:[200,196,188];
        for(let y=Math.max(0,sy);y<ymin;y++){const p=(y*W+c)*3;for(let k=0;k<3;k++){const sky=[170,200,235][k];img[p+k]=Math.round((base[k]*(.25+.8*s))*(1-fog)+sky*fog);}}
        ymin=Math.max(0,sy);}
      d+=Math.max(1.5,d*.004);}}
  return {w:W,h:Hh,rgb:img};
}
module.exports={render,bil};
