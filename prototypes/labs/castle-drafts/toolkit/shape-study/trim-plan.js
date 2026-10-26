/* Continuous mitered beam rings: no overlapping box caps or duplicate corner posts. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ShapeStudyTrim=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function offset(loop,d){return loop.map((p,i)=>{const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length],u=[p[0]-a[0],p[1]-a[1]],v=[b[0]-p[0],b[1]-p[1]],l=Math.hypot(...u),r=Math.hypot(...v),n=[u[1]/l,-u[0]/l],m=[v[1]/r,-v[0]/r],den=1+n[0]*m[0]+n[1]*m[1];if(l<1e-8||r<1e-8||den<.05)throw Error('Invalid timber corner');return [p[0]+d*(n[0]+m[0])/den,p[1]+d*(n[1]+m[1])/den];});}
function ring(loop,y,h,width=.23){const out=[],outer=offset(loop,width/2),inner=offset(loop,-width/2),p=(v,yy)=>[v[0],yy,v[1]],tri=(a,b,c)=>out.push(...a,...b,...c),quad=(a,b,c,d)=>{tri(a,b,c);tri(a,c,d);};for(let i=0;i<loop.length;i++){const j=(i+1)%loop.length,a=p(outer[i],y),b=p(outer[j],y),c=p(inner[j],y),d=p(inner[i],y),aa=p(outer[i],y+h),bb=p(outer[j],y+h),cc=p(inner[j],y+h),dd=p(inner[i],y+h);quad(aa,dd,cc,bb);quad(a,b,c,d);quad(a,aa,bb,b);quad(d,c,cc,dd);}return out;}
function posts(loop){const unique=new Map();for(const p of loop)unique.set(p.map(n=>n.toFixed(6)).join(','),p);return [...unique.values()];}
return {offset,ring,posts};
});
