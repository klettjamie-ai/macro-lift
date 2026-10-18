// Macro & Lift service worker: offline app shell, stale-while-revalidate updates.
const CACHE='macrolift-v3';
const SHELL=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png','vendor/zxing.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const url=new URL(req.url);
  if(url.origin!==location.origin)return; // Open Food Facts etc. go straight to the network
  e.respondWith(caches.open(CACHE).then(async c=>{
    const key=req.mode==='navigate'?'index.html':req;
    const cached=await c.match(key,{ignoreSearch:true});
    const net=fetch(req).then(r=>{if(r&&r.ok)c.put(key,r.clone());return r}).catch(()=>null);
    if(cached){e.waitUntil(net);return cached}
    return (await net)||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
  }));
});
