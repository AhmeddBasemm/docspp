// A tiny static file server for built sites, so tests do not depend on `astro preview`,
// which re-spawns itself as a background daemon that is hard to stop.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
}

/** Serve `dir` on `port`. Directories resolve to their index.html, like a static host. */
export function serve(dir, port) {
  const root = resolve(dir)
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    let file = normalize(join(root, pathname))
    if (!file.startsWith(root)) {
      res.writeHead(403).end()
      return
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found')
      return
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  return new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(port, () =>
      done({
        url: `http://localhost:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      }),
    )
  })
}
