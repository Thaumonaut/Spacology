'use strict';
// Terrain metrics, identical for real and generated grids. A grid is {n, step (m), h: Float32Array n*n (rows south)}.
// mask(k) -> true for land cells counted in the statistics (the generator's sea is excluded; it is an outlet for flow).
const D8=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const pct=(a,p)=>a.length?a[Math.min(a.length-1,Math.floor(p*a.length))]:NaN,mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const sorted=a=>Float64Array.from(a).sort();

// Horn slope (degrees) and gradient at interior cells.
function slopes(G){const {n,step,h}=G,s=new Float32Array(n*n).fill(NaN);
  for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const a=(r,c)=>h[(j+r)*n+i+c];
    const gx=((a(-1,1)+2*a(0,1)+a(1,1))-(a(-1,-1)+2*a(0,-1)+a(1,-1)))/(8*step),gz=((a(1,-1)+2*a(1,0)+a(1,1))-(a(-1,-1)+2*a(-1,0)+a(-1,1)))/(8*step);
    s[j*n+i]=Math.atan(Math.hypot(gx,gz))*180/Math.PI;}
  return s;}

function hypsometry(G,mask){const v=[];for(let k=0;k<G.h.length;k++)if(mask(k))v.push(G.h[k]);const s=sorted(v),lo=s[0],hi=s[s.length-1],m=mean(s);
  return {min:lo,max:hi,mean:m,HI:(m-lo)/((hi-lo)||1),p10:pct(s,.1),p50:pct(s,.5),p90:pct(s,.9),
    // Skew of the distribution: positive = most ground low with a few tall peaks (plains + spikes), negative = plateau.
    skew:(()=>{let m2=0,m3=0;for(const x of s){m2+=(x-m)**2;m3+=(x-m)**3;}m2/=s.length;m3/=s.length;return m3/Math.pow(m2,1.5);})(),
    hist:Array.from({length:10},(_,b)=>s.filter(x=>x>=lo+(hi-lo)*b/10&&(b===9?x<=hi:x<lo+(hi-lo)*(b+1)/10)).length/s.length)};}

function slopeStats(G,S,mask){const v=[];for(let k=0;k<S.length;k++)if(S[k]===S[k]&&mask(k))v.push(S[k]);const s=sorted(v),f=(a,b)=>v.filter(x=>x>=a&&x<b).length/v.length*100;
  return {mean:mean(v),p50:pct(s,.5),p90:pct(s,.9),max:s[s.length-1],lt10:f(0,10),s10_25:f(10,25),s25_40:f(25,40),gt40:f(40,91)};}

// Relief per km: max-min in non-overlapping 1 km blocks fully on land.
function reliefPerKm(G,mask){const B=Math.round(1000/G.step),n=G.n,r=[];
  for(let bj=0;bj+B<=n;bj+=B)for(let bi=0;bi+B<=n;bi+=B){let lo=Infinity,hi=-Infinity,ok=true;
    for(let j=bj;j<bj+B&&ok;j++)for(let i=bi;i<bi+B;i++){const k=j*n+i;if(!mask(k)){ok=false;break;}lo=Math.min(lo,G.h[k]);hi=Math.max(hi,G.h[k]);}
    if(ok)r.push(hi-lo);}
  const s=sorted(r);return {blocks:r.length,mean:mean(r),p50:pct(s,.5),p90:pct(s,.9),max:s[s.length-1]};}

// Characteristic ridge-valley spacing along rows and columns: each transect is high-passed (minus a 3 km moving
// average), and its autocorrelation's first minimum lag L gives a half-wavelength; spacing = 2L (median over transects).
// Also the mean distance between successive local maxima with >= minProm m drop on both sides (ridge crossings).
function spacing(G,mask,minProm=40){const {n,step,h}=G,W=Math.round(1500/step),lags=[],gaps=[];
  const one=p=>{const m=p.length;if(m<2*W+1)return;const c=new Float64Array(m+1);for(let k=0;k<m;k++)c[k+1]=c[k]+p[k];
    const r=new Float64Array(m);for(let k=0;k<m;k++){const a=Math.max(0,k-W),b=Math.min(m,k+W+1);r[k]=p[k]-(c[b]-c[a])/(b-a);}
    let v0=0;for(const x of r)v0+=x*x;if(v0<1e-6)return;let prev=1;
    for(let L=1;L<m/2;L++){let s=0;for(let k=0;k+L<m;k++)s+=r[k]*r[k+L];s/=v0;if(s>prev){lags.push((L-1)*step*2);break;}prev=s;}
    // ridge crossings: peaks of the raw profile with minProm drop on both sides before a higher point
    let lastPeak=-1;for(let k=1;k<m-1;k++){if(!(p[k]>=p[k-1]&&p[k]>p[k+1]))continue;let lo=p[k],okL=false,okR=false;
      for(let q=k-1;q>=0&&p[q]<=p[k];q--){lo=Math.min(lo,p[q]);if(p[k]-lo>=minProm){okL=true;break;}}lo=p[k];
      for(let q=k+1;q<m&&p[q]<=p[k];q++){lo=Math.min(lo,p[q]);if(p[k]-lo>=minProm){okR=true;break;}}
      if(okL&&okR){if(lastPeak>=0)gaps.push((k-lastPeak)*step);lastPeak=k;}}};
  const stride=Math.max(1,Math.round(500/step));
  for(let j=0;j<n;j+=stride){let run=[];for(let i=0;i<=n;i++){if(i<n&&mask(j*n+i))run.push(h[j*n+i]);else{one(run);run=[];}}}
  for(let i=0;i<n;i+=stride){let run=[];for(let j=0;j<=n;j++){if(j<n&&mask(j*n+i))run.push(h[j*n+i]);else{one(run);run=[];}}}
  const s=sorted(lags),g=sorted(gaps);return {autocorrWavelength:pct(s,.5),ridgeGap:pct(g,.5),ridgeGapMean:mean(gaps),transects:lags.length};}

// Radially averaged power spectrum slope (log P vs log k) between 120 m and 3 km wavelengths, via 1D row/column DFTs
// of Hann-windowed, detrended transects (cheap, no 2D FFT): P(k) ~ k^-beta. Normalised per transect length.
function spectrum(G,mask){const {n,step,h}=G,acc=new Map();
  const one=p=>{const m=p.length;if(m<128)return;const a=(p[m-1]-p[0])/(m-1);const x=new Float64Array(m);for(let k=0;k<m;k++)x[k]=(p[k]-p[0]-a*k)*(.5-.5*Math.cos(2*Math.PI*k/(m-1)));
    for(let f=1;f<m/2;f++){const lam=m*step/f;if(lam<120||lam>3000)continue;let re=0,im=0;for(let k=0;k<m;k++){const t=2*Math.PI*f*k/m;re+=x[k]*Math.cos(t);im-=x[k]*Math.sin(t);}
      const b=Math.round(Math.log(lam)*8);const e=acc.get(b)||[0,0];e[0]+=(re*re+im*im)*step/m;e[1]++;acc.set(b,e);}};
  // Land runs of at least 128 cells along every ~600 m row and column (masked cells split a transect).
  const stride=Math.max(1,Math.round(600/step));
  for(let j=0;j<n;j+=stride){let run=[];for(let i=0;i<=n;i++){if(i<n&&mask(j*n+i))run.push(h[j*n+i]);else{one(run);run=[];}}}
  for(let i=0;i<n;i+=stride){let run=[];for(let j=0;j<=n;j++){if(j<n&&mask(j*n+i))run.push(h[j*n+i]);else{one(run);run=[];}}}
  const pts=[...acc].map(([b,[p,c]])=>[-b/8,Math.log(p/c)]);if(pts.length<4)return {beta:NaN};
  const mx=mean(pts.map(p=>p[0])),my=mean(pts.map(p=>p[1]));let sxy=0,sxx=0;for(const [x,y] of pts){sxy+=(x-mx)*(y-my);sxx+=(x-mx)**2;}
  // x = log k (k = 1/lambda), so beta = -slope.
  return {beta:-(sxy/sxx)};}

// Priority-flood depression fill (with a tiny epsilon so filled flats still drain), D8 receivers, flow accumulation,
// channels (accumulated area >= areaKm2), drainage density, Strahler orders and bifurcation ratio, and the share of
// the land that had to be filled (closed depressions; real terrain has few outside karst and glacial basins).
function drainage(G,mask,areaKm2=.25){
  const {n,step,h}=G,N=n*n,f=new Float64Array(N),done=new Uint8Array(N),heap=[],cellA=step*step/1e6,eps=1e-4;
  const push=(k,v)=>{heap.push([v,k]);let c=heap.length-1;while(c){const p=(c-1)>>1;if(heap[p][0]<=heap[c][0])break;[heap[p],heap[c]]=[heap[c],heap[p]];c=p;}};
  const pop=()=>{const t=heap[0],l=heap.pop();if(heap.length){heap[0]=l;let c=0;for(;;){const a=2*c+1,b=a+1;let m=c;if(a<heap.length&&heap[a][0]<heap[m][0])m=a;if(b<heap.length&&heap[b][0]<heap[m][0])m=b;if(m===c)break;[heap[m],heap[c]]=[heap[c],heap[m]];c=m;}}return t;};
  for(let k=0;k<N;k++){const i=k%n,j=(k/n)|0;if(i===0||j===0||i===n-1||j===n-1||!mask(k)){f[k]=h[k];done[k]=1;push(k,h[k]);}}
  const rec=new Int32Array(N).fill(-1);let filled=0,landN=0;
  while(heap.length){const [v,k]=pop(),i=k%n,j=(k/n)|0;
    for(const [di,dj] of D8){const a=i+di,b=j+dj;if(a<0||b<0||a>=n||b>=n)continue;const q=b*n+a;if(done[q])continue;done[q]=1;
      if(h[q]<=v+eps){f[q]=v+eps;if(h[q]<v-.5)filled++;}else f[q]=h[q];rec[q]=k;push(q,f[q]);}}
  // Receivers from the priority flood point toward the outlet; use steepest descent on the filled surface instead
  // where it exists (natural D8), falling back to the flood parent on flats.
  for(let k=0;k<N;k++){if(!mask(k))continue;landN++;const i=k%n,j=(k/n)|0;if(i===0||j===0||i===n-1||j===n-1){rec[k]=-1;continue;}
    let best=-1,bs=0;for(const [di,dj] of D8){const q=(j+dj)*n+i+di,d=(f[k]-f[q])/(step*Math.hypot(di,dj));if(d>bs){bs=d;best=q;}}if(best>=0)rec[k]=best;}
  const order=Array.from({length:N},(_,k)=>k).sort((a,b)=>f[b]-f[a]),A=new Float64Array(N).fill(cellA);
  for(const k of order){const r=rec[k];if(r>=0)A[r]+=A[k];}
  const ch=new Uint8Array(N);let len=0;for(let k=0;k<N;k++)if(mask(k)&&A[k]>=areaKm2){ch[k]=1;const r=rec[k];if(r>=0){const di=Math.abs(r%n-k%n),dj=Math.abs(((r/n)|0)-((k/n)|0));len+=step*(di&&dj?Math.SQRT2:1);}}
  // Strahler orders over channel cells (process upstream first).
  const S=new Uint8Array(N),top=new Uint8Array(N),cnt=new Uint8Array(N);
  for(const k of order){if(!ch[k])continue;if(!S[k])S[k]=1;const r=rec[k];if(r<0||!ch[r])continue;
    if(S[k]>top[r]){top[r]=S[k];cnt[r]=1;}else if(S[k]===top[r])cnt[r]++;S[r]=Math.max(S[r],cnt[r]>=2?top[r]+1:top[r]);}
  // Count streams per order: a stream segment starts at a cell whose order differs from its upstream channel cells.
  const streams=[0,0,0,0,0,0,0,0,0];for(let k=0;k<N;k++){if(!ch[k])continue;const r=rec[k];if(r<0||!ch[r]||S[r]!==S[k])streams[S[k]]++;}
  // Longest flow path to each cell (m), for Hack's law L = c A^h over channel cells draining 1-50 km2, and the Strahler
  // order a ~10 km2 catchment reaches (window-size independent, unlike the window's maximum order).
  const Lup=new Float64Array(N);for(const k of order){const r=rec[k];if(r<0)continue;const di=Math.abs(r%n-k%n),dj=Math.abs(((r/n)|0)-((k/n)|0)),d=Lup[k]+step*(di&&dj?Math.SQRT2:1);if(d>Lup[r])Lup[r]=d;}
  let hx=0,hy=0,hxx=0,hxy=0,hn=0;const o10=[];let big=0;
  for(let k=0;k<N;k++){if(!ch[k])continue;if(A[k]>=1&&A[k]<=50){const x=Math.log(A[k]),y=Math.log(Lup[k]/1000);hx+=x;hy+=y;hxx+=x*x;hxy+=x*y;hn++;}
    if(A[k]>=8&&A[k]<=12)o10.push(S[k]);const r=rec[k];if(A[k]>=5&&(r<0||!mask(r)))big++;}
  const hack=hn>10?(hn*hxy-hx*hy)/(hn*hxx-hx*hx):NaN,hackC=hn>10?Math.exp((hy-hack*hx)/hn):NaN;o10.sort((a,b)=>a-b);
  const orders=streams.slice(1).filter(v=>v>0),rb=[];for(let o=0;o+1<orders.length;o++)if(orders[o+1]>=1)rb.push(orders[o]/orders[o+1]);
  const areaLand=landN*cellA;
  return {areaKm2:areaLand,channelThresholdKm2:areaKm2,drainageDensity:len/1000/areaLand,streamsByOrder:orders,bifurcation:rb.length?mean(rb):NaN,maxOrder:orders.length,orderAt10km2:o10.length?o10[o10.length>>1]:NaN,hackH:hack,hackC,maxAreaKm2:Array.from(A).reduce((m,v,k)=>mask(k)&&v>m?v:m,0),closedDepressionShare:filled/landN*100,A,ch,rec};}

// Peaks and topographic prominence by union-find over cells sorted high to low (8-connected). A component's key col
// is the cell where it first joins a component with a higher summit. Peaks on the window edge are dropped.
function peaks(G,mask){const {n,h}=G,N=n*n,ord=Array.from({length:N},(_,k)=>k).filter(k=>mask(k)).sort((a,b)=>h[b]-h[a]);
  const par=new Int32Array(N).fill(-1),top=new Int32Array(N),seen=new Uint8Array(N),prom=[];
  const find=k=>{while(par[k]!==k){par[k]=par[par[k]];k=par[k];}return k;};
  for(const k of ord){seen[k]=1;par[k]=k;top[k]=k;const i=k%n,j=(k/n)|0;
    for(const [di,dj] of D8){const a=i+di,b=j+dj;if(a<0||b<0||a>=n||b>=n)continue;const q=b*n+a;if(!seen[q])continue;
      const ra=find(k),rb=find(q);if(ra===rb)continue;const ta=top[ra],tb=top[rb],hi=h[ta]>=h[tb]?ta:tb,lo=hi===ta?tb:ta;
      if(lo!==k)prom.push({k:lo,p:h[lo]-h[k]});par[rb]=ra;top[ra]=hi;}}
  const edge=k=>{const i=k%n,j=(k/n)|0;return i<2||j<2||i>n-3||j>n-3;};
  const P=prom.filter(o=>!edge(o.k)),area=ord.length*G.step*G.step/1e6,per=t=>P.filter(o=>o.p>=t).length/area*100;
  const big=P.filter(o=>o.p>=100).map(o=>o.p).sort((a,b)=>b-a);
  return {per100km2_p30:per(30),per100km2_p100:per(100),per100km2_p300:per(300),topProminences:big.slice(0,5).map(v=>Math.round(v)),
    // Nearest-neighbour spacing of the >=100 m prominence peaks (km).
    peakSpacingKm:(()=>{const pk=P.filter(o=>o.p>=100).map(o=>[o.k%n,(o.k/n)|0]);if(pk.length<2)return NaN;
      return mean(pk.map(([x,y])=>Math.min(...pk.filter(q=>q[0]!==x||q[1]!==y).map(q=>Math.hypot(q[0]-x,q[1]-y)))))*G.step/1000;})()};}

// Curvature: Laplacian over a 2-cell (60 m) stencil, 1/km. Ridge sharpness = mean -Laplacian on divides (accumulation of
// a single cell, slope > 10 degrees); valley sharpness = mean +Laplacian on channels. Ratio > 1: ridges sharper than valleys.
function curvature(G,mask,S,D){const {n,step,h}=G,d=2,L=[],ridge=[],valley=[],cellA=step*step/1e6;
  for(let j=d;j<n-d;j++)for(let i=d;i<n-d;i++){const k=j*n+i;if(!mask(k))continue;
    const lap=(h[k+d]+h[k-d]+h[k+d*n]+h[k-d*n]-4*h[k])/((d*step)**2)*1000;L.push(lap);
    if(D.A[k]<=cellA*1.01&&S[k]>10)ridge.push(-lap);if(D.ch[k])valley.push(lap);}
  const s=sorted(L);return {p5:pct(s,.05),p95:pct(s,.95),ridgeSharp:mean(ridge),valleySharp:mean(valley),ratio:mean(ridge)/mean(valley)};}

// Volcano radial profile around vent (grid i, j): median height per 250 m ring, flank slope, base radius (where the
// median falls to within 5% of the summit-to-base drop above the base), concavity exponent p of h = H (1 - r/R)^p,
// and ribs: on circles at 0.3/0.5/0.7 R the height residual after removing angular harmonics 0-3; ribs = residual maxima
// with >= 0.4 x its std drop each side, depth = mean peak-to-trough (m), and the dominant angular harmonic (4-60).
function volcano(G,vi,vj){const {n,step,h}=G,ring=250,bins=[];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const r=Math.hypot(i-vi,j-vj)*step,b=Math.floor(r/ring);(bins[b]=bins[b]||[]).push(h[j*n+i]);}
  const maxR=Math.min(vi,vj,n-1-vi,n-1-vj)*step,prof=[];for(let b=0;b*ring<maxR;b++){const s=sorted(bins[b]);prof.push({r:(b+.5)*ring,h:pct(s,.5)});}
  let top=0;for(let k=0;k<prof.length&&prof[k].r<1500;k++)top=Math.max(top,prof[k].h);
  const base=Math.min(...prof.slice(-4).map(p=>p.h));let R=prof[prof.length-1].r;for(const p of prof)if(p.h-base<.05*(top-base)){R=p.r;break;}
  // Fit p in h-base = (top-base)(1-r/R)^p over 0.15R..0.85R (log-log least squares through the origin).
  let sx=0,sxy=0;for(const p of prof){if(p.r<.15*R||p.r>.85*R)continue;const y=(p.h-base)/(top-base),x=1-p.r/R;if(y>0&&x>0){sx+=Math.log(x)**2;sxy+=Math.log(x)*Math.log(y);}}
  const slopeAt=f=>{const a=prof.find(p=>p.r>=f*R-ring),b=prof.find(p=>p.r>=f*R+ring);return a&&b?Math.atan((a.h-b.h)/(b.r-a.r))*180/Math.PI:NaN;};
  const ribs=[.3,.5,.7].map(f=>{const r=f*R/step,M=Math.max(64,Math.round(2*Math.PI*r)),v=new Float64Array(M);
    for(let k=0;k<M;k++){const a=2*Math.PI*k/M,x=vi+r*Math.cos(a),y=vj+r*Math.sin(a),ix=Math.floor(x),iy=Math.floor(y),u=x-ix,w=y-iy;
      v[k]=(h[iy*n+ix]*(1-u)+h[iy*n+ix+1]*u)*(1-w)+(h[(iy+1)*n+ix]*(1-u)+h[(iy+1)*n+ix+1]*u)*w;}
    const res=Float64Array.from(v);let best=0,bestP=0;
    for(let m=0;m<=60;m++){let re=0,im=0;for(let k=0;k<M;k++){re+=v[k]*Math.cos(2*Math.PI*m*k/M);im+=v[k]*Math.sin(2*Math.PI*m*k/M);}
      if(m<=3){const c=(m?2:1)/M;for(let k=0;k<M;k++)res[k]-=c*(re*Math.cos(2*Math.PI*m*k/M)+im*Math.sin(2*Math.PI*m*k/M));}
      else if(re*re+im*im>bestP){bestP=re*re+im*im;best=m;}}
    let sd=0;for(const x of res)sd+=x*x;sd=Math.sqrt(sd/M);const thr=.4*sd,pk=[];
    // circular prominence-like test
    for(let k=0;k<M;k++){const x=res[k];if(!(x>=res[(k+M-1)%M]&&x>res[(k+1)%M]))continue;let lo=x,ok=0;
      for(let q=1;q<M/2;q++){const y=res[(k+q)%M];if(y>x)break;lo=Math.min(lo,y);if(x-lo>=thr){ok++;break;}}lo=x;
      for(let q=1;q<M/2;q++){const y=res[(k-q+M)%M];if(y>x)break;lo=Math.min(lo,y);if(x-lo>=thr){ok++;break;}}if(ok===2)pk.push(k);}
    return {rFrac:f,ribs:pk.length,dominantHarmonic:best,residualStd:sd,depth:2*Math.SQRT2*sd};});
  return {summit:top,base,heightAboveBase:top-base,baseRadius:R,radiusOverHeight:R/(top-base),concavityP:sxy/sx,
    flankSlope:{at20:slopeAt(.2),at40:slopeAt(.4),at60:slopeAt(.6),at80:slopeAt(.8)},ribs,profile:prof.map(p=>[p.r,Math.round(p.h)])};}

// Local relief (m): max - min within +-r metres (separable square max/min filter). Mountain cells: >= 300 m within 1 km.
function localRelief(G,r=1000){const {n,step,h}=G,R=Math.round(r/step),mx=new Float32Array(n*n),mn=new Float32Array(n*n),out=new Float32Array(n*n);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){let a=-Infinity,b=Infinity;for(let q=Math.max(0,i-R);q<=Math.min(n-1,i+R);q++){const v=h[j*n+q];if(v>a)a=v;if(v<b)b=v;}mx[j*n+i]=a;mn[j*n+i]=b;}
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){let a=-Infinity,b=Infinity;for(let q=Math.max(0,j-R);q<=Math.min(n-1,j+R);q++){a=Math.max(a,mx[q*n+i]);b=Math.min(b,mn[q*n+i]);}out[j*n+i]=a-b;}
  return out;}
module.exports={localRelief,slopes,hypsometry,slopeStats,reliefPerKm,spacing,spectrum,drainage,peaks,curvature,volcano,pct,sorted};
