import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  base:'./',
  plugins:[{
    name:'offline-city',
    apply:'build',
    generateBundle(_options,bundle) {
      const hash=createHash('sha256');
      const publicFiles=readdirSync('public',{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile())
        .map(entry=>(entry.parentPath+'/'+entry.name).replace(/^public\//,'')).sort();
      for(const file of publicFiles) hash.update(readFileSync('public/'+file));
      for(const [file,entry] of Object.entries(bundle)) hash.update(file).update(entry.type==='chunk'?entry.code:entry.source);
      const files=['./',...new Set([...publicFiles,...Object.keys(bundle)])];
      this.emitFile({type:'asset',fileName:'sw.js',source:`
const prefix = 'mipolune-' + self.registration.scope + '-';
const cacheName = prefix + ${JSON.stringify(hash.digest('hex').slice(0,16))};
const files = ${JSON.stringify(files)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(cacheName).then(async cache => {
    if (request.mode === 'navigate') return await cache.match('./') || fetch(request);
    return await cache.match(request) || fetch(request);
  }));
});
`});
    },
  }],
  build:{chunkSizeWarningLimit:700},
});
