// Cloudflare 정적 에셋(auto-trailing-slash) 동작을 흉내내는 로컬 서버
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = process.argv[2]; const port = Number(process.argv[3] || 3031);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff', '.txt':'text/plain', '.geojson':'application/json', '.glb':'model/gltf-binary', '.webp':'image/webp', '.map':'application/json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/') && p.length > 1) p = p.slice(0, -1);
  const cands = p === '/' ? ['index.html'] : [p, p + '.html', p + '/index.html'];
  for (const c of cands) {
    const f = path.join(root, c);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
      return fs.createReadStream(f).pipe(res);
    }
  }
  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
  fs.createReadStream(path.join(root, '404.html')).pipe(res);
}).listen(port, () => console.log('listening ' + port));
