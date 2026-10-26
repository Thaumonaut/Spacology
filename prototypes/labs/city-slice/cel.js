// Cel shading for the city slice (Genshin-style, no outlines): three's toon lighting model with our own ramp, so the
// sun reads as a few flat, softly edged bands instead of a smooth falloff; no specular at all; shadowed areas fall to
// the sky/ground fill, which the scene tints cool; and a faint rim light along silhouettes to separate forms.
// Textures and normal maps still apply: the ramp quantises lighting, not surface detail.
import * as THREE from 'three/webgpu';
import {float,vec3,normalView,positionViewDirection,dot,saturate,pow,uniform} from 'three/tsl';

// Ramp over the toon lookup (dot(N, L) * 0.5 + 0.5): shade, a narrow mid band at the terminator, full light. Edges are
// smoothstepped over about 2% of the range so band borders are soft rather than aliased.
export function celRamp({shade=.5,mid=.78,terminator=.5,midWidth=.12,soft=.02}={}){const N=256,data=new Uint8Array(N*4);
  const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  for(let i=0;i<N;i++){const x=(i+.5)/N,v=shade+(mid-shade)*ss(terminator-soft,terminator+soft,x)+(1-mid)*ss(terminator+midWidth-soft,terminator+midWidth+soft,x);data.set([Math.round(v*255),0,0,255],i*4);}
  const t=new THREE.DataTexture(data,N,1,THREE.RGBAFormat);t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;}

// Shared rim settings (uniforms, so they can be tuned live).
export const rim={color:uniform(new THREE.Color(0xdfe8ff)),strength:uniform(.07),power:uniform(4)};

export function celMaterial({map,normalMap,normalScale=1,ramp}){
  const m=new THREE.MeshToonNodeMaterial({map,normalMap,vertexColors:true,gradientMap:ramp});
  if(normalMap)m.normalScale=new THREE.Vector2(normalScale,normalScale);
  const fres=pow(float(1).sub(saturate(dot(normalView,positionViewDirection))),rim.power);
  m.emissiveNode=vec3(rim.color).mul(fres).mul(rim.strength);
  return m;}
