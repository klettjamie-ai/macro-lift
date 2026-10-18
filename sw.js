// Macro & Lift service worker: offline app shell, stale-while-revalidate updates.
const CACHE='macrolift-v4';
// Exercise demo clips are NOT precached: each one is stored the first time it plays, in its own cache
// (kept across app updates) so offline replays work without a big install download.
const CLIP_CACHE='macrolift-clips-v1';
const SHELL=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png','vendor/zxing.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==CLIP_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Serve a cached full clip, honouring Range requests (Safari/iOS always sends them for <video>).
async function fromFull(full,req){
  const range=req.headers.get('range');
  if(!range)return full;
  const buf=await full.arrayBuffer();const size=buf.byteLength;
  const m=/bytes=(\d*)-(\d*)/.exec(range)||[];let start=m[1]?parseInt(m[1],10):0;let end=m[2]?parseInt(m[2],10):size-1;
  if(!m[1]&&m[2]){start=Math.max(0,size-parseInt(m[2],10));end=size-1}
  end=Math.min(end,size-1);
  if(start>=size||start>end)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  return new Response(buf.slice(start,end+1),{status:206,statusText:'Partial Content',headers:{'Content-Type':full.headers.get('Content-Type')||'video/mp4','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
}
async function clip(req){
  const url=new URL(req.url);url.search='';const key=url.href;
  const c=await caches.open(CLIP_CACHE);
  let full=await c.match(key);
  if(!full){
    try{const r=await fetch(key,{cache:'no-cache'});// whole file, no Range, so it can be cached
      if(!r.ok)return r;await c.put(key,r.clone());full=r}
    catch(_){return new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}})}
  }
  return fromFull(full,req);
}
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const url=new URL(req.url);
  if(url.origin!==location.origin)return; // Open Food Facts, YouTube etc. go straight to the network
  if(/\/clips\/[^/]+\.mp4$/.test(url.pathname)){e.respondWith(clip(req));return}
  e.respondWith(caches.open(CACHE).then(async c=>{
    const key=req.mode==='navigate'?'index.html':req;
    const cached=await c.match(key,{ignoreSearch:true});
    const net=fetch(req).then(r=>{if(r&&r.ok)c.put(key,r.clone());return r}).catch(()=>null);
    if(cached){e.waitUntil(net);return cached}
    return (await net)||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
  }));
});
