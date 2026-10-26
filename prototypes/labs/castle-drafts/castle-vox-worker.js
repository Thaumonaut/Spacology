// Voxelises ray-marched building models off the main thread. In: {id, parts (colours and patterns resolved), frame, cvs}.
// Out: the sparse model (typed arrays transferred).
importScripts('castle-vox.js');
onmessage=e=>{const {id,parts,frame,cvs}=e.data,t0=performance.now();
  const V=CastleVox.voxelizeSparse(parts,frame,cvs,p=>p.col||[1,0,1],p=>p.pat||0);
  if(!V.coarse){postMessage({id,empty:true,ms:performance.now()-t0});return;}
  postMessage({id,coarse:V.coarse,n:V.n,o:V.o,cvs:V.cvs,bricks:V.bricks,brickRows:V.brickRows,nb:V.nb,pal:V.pal,ms:performance.now()-t0},[V.coarse.buffer,V.bricks.buffer,V.pal.buffer]);};
