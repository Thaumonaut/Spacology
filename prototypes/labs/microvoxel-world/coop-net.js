(function(root){
  'use strict';
  // Room transports. 'local' uses BroadcastChannel (solo, same-browser tabs, tests); 'peerjs' uses PeerJS public signaling.
  const PREFIX='spacology-supply-';
  const code=()=>Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
  const normalise=c=>String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  function local(room,isHost){
    const id=isHost?'host':'guest-'+Math.random().toString(36).slice(2,8),ch=new BroadcastChannel(PREFIX+room),handlers=new Set();
    ch.onmessage=e=>{const m=e.data;if(m.from===id)return;if(isHost?m.to==='host':(m.to===id||m.to==='*'))for(const f of handlers)f(m);};
    return {id,room,ready:Promise.resolve(id),send(to,msg){ch.postMessage({...msg,from:id,to});},on(f){handlers.add(f);},close(){ch.close();}};
  }
  function peer(room,isHost){
    if(typeof Peer!=='function')return {ready:Promise.reject(new Error('PeerJS is unavailable.'))};
    const handlers=new Set(),conns=new Map(),p=isHost?new Peer(PREFIX+room):new Peer();let host=null;
    const deliver=(m,from)=>{for(const f of handlers)f({...m,from});};
    const ready=new Promise((resolve,reject)=>{
      p.on('error',e=>reject(new Error(e.type==='unavailable-id'?'That room code is already in use.':e.type==='peer-unavailable'?'No room with that code is open.':e.type==='network'||e.type==='server-error'?'Could not reach the signaling service.':(e.message||String(e.type)))));
      p.on('open',id=>{
        if(isHost){p.on('connection',c=>{c.on('open',()=>conns.set(c.peer,c));c.on('data',m=>deliver(m,c.peer));c.on('close',()=>{conns.delete(c.peer);deliver({t:'bye'},c.peer);});});resolve(id);}
        else{host=p.connect(PREFIX+room,{reliable:true});host.on('open',()=>resolve(id));host.on('data',m=>deliver(m,'host'));host.on('close',()=>deliver({t:'closed'},'host'));host.on('error',e=>reject(e));}
      });
    });
    return {get id(){return isHost?'host':p.id;},room,ready,
      send(to,msg){if(!isHost){host?.open&&host.send(msg);return;}const list=to==='*'?[...conns.values()]:[conns.get(to)].filter(Boolean);for(const c of list)c.send(msg);},
      on(f){handlers.add(f);},close(){p.destroy();}};
  }
  function createTransport(kind,room,isHost){room=normalise(room);return kind==='peerjs'?peer(room,isHost):local(room,isHost);}
  const api={createTransport,code,normalise,PREFIX};
  root.CoopNet=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
