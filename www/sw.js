/* 训练日记 PWA service worker：离线可开 + 线上更新立即可见。
   策略：网络优先，失败回退缓存。
   v19 三处修复：① 云 SDK 已内联进 index.html，不再单独缓存 cloud-sdk.js；
   ② install 逐项容错，任一资源 403 不会让整个 SW 安装失败（否则新版本永远装不上）；
   ③ 非 2xx 响应绝不写缓存——站点鉴权失败会返回「链接不完整」的 HTML，
      过去被当成 JS 缓存下来，导致云服务一直加载不了且刷新无效。 */
const CACHE = 'trainlog-v34';
const ASSETS = ['./', './index.html', './app.js', './style.css', './icon.svg', './manifest.webmanifest'];

/* v34：会话失效兜底修复。
   过去 403 时无论什么请求都回退到缓存的首页 HTML——app.js 拿到一段 HTML 当脚本解析，
   报语法错、页面只剩空壳，表现就是「长时间白屏」。现在按请求类型区分：
   - 资源请求（script/style/image/manifest）：缓存有副本就用副本；没有就返回空的同类型响应，
     绝不返回 HTML。app.js 变成空脚本，不会报错，由页面的看门狗给出明确提示。
   - 导航请求（document）：有缓存首页就用，否则把原始 403 页面还给浏览器（至少能看到提示）。 */
function isAssetRequest(req) {
  var d = req.destination;
  if (d && d !== 'document' && d !== 'navigate' && d !== '') return true;
  return /\.(?:js|css|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|webmanifest)(?:[?#]|$)/i.test(new URL(req.url).pathname);
}
function emptyFor(req) {
  var d = req.destination || '';
  var path = new URL(req.url).pathname;
  if (d === 'manifest' || /\.webmanifest(?:[?#]|$)/i.test(path)) {
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/manifest+json' } });
  }
  if (d === 'style' || /\.css(?:[?#]|$)/i.test(path)) {
    return new Response('', { status: 200, headers: { 'Content-Type': 'text/css; charset=utf-8' } });
  }
  if (d === 'image' || /\.(?:svg|png|jpe?g|gif|webp|ico)(?:[?#]|$)/i.test(path)) {
    return new Response('', { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
  }
  return new Response('', { status: 200, headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
}
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (a) {
      return fetch(a).then(function (r) {
        if (r.ok) return c.put(a, r);
      }).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  /* 跨域资源不拦截、不缓存：始终拿最新版，断网时由前端优雅降级为纯本地 */
  if (new URL(e.request.url).origin !== self.location.origin) return;
  const asset = isAssetRequest(e.request);
  /* 统一兜底：命中缓存副本就用；否则资源给空响应、导航给缓存首页或原始错误页，绝不用 HTML 冒充脚本 */
  function fallback(orig) {
    return caches.match(e.request).then(function (m) {
      if (m) return m;
      if (asset) return emptyFor(e.request);
      return caches.match('./index.html').then(function (h) {
        return h || orig || new Response('', { status: 503 });
      });
    });
  }
  e.respondWith(fetch(e.request).then(function (r) {
    if (!r.ok) return fallback(r);   /* 403 / 404 不写缓存，避免错误页长期污染 */
    const copy = r.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    return r;
  }).catch(function () { return fallback(null); }));
});
