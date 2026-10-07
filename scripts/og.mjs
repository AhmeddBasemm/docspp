// Renders apps/docs/public/og.png, the image shown when a docspp link is shared.
// Run `node scripts/og.mjs` after changing the landing page's look. Needs Google Chrome.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const fonts = fileURLToPath(new URL('../apps/docs/node_modules/@fontsource/', import.meta.url))
const face = (family, weight, dir, file) => {
  const data = readFileSync(`${fonts}${dir}/files/${file}.woff2`).toString('base64')
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2')}`
}

const html = `<!doctype html><meta charset="utf-8"><style>
${face('Plex Condensed', 600, 'ibm-plex-sans-condensed', 'ibm-plex-sans-condensed-latin-600-normal')}
${face('Plex Mono', 400, 'ibm-plex-mono', 'ibm-plex-mono-latin-400-normal')}
${face('Plex Mono', 500, 'ibm-plex-mono', 'ibm-plex-mono-latin-500-normal')}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#0a1117;color:#e7eef2;position:relative;overflow:hidden;font-family:'Plex Condensed',sans-serif}
.grid{position:absolute;inset:0;background-image:radial-gradient(rgb(255 255 255 / 9%) 1.2px,transparent 1.6px);background-size:26px 26px}
.brand{position:absolute;left:72px;top:60px;display:flex;align-items:center;gap:16px;font-size:40px;font-weight:600;letter-spacing:-.01em}
h1{position:absolute;left:72px;top:170px;width:1000px;font-size:104px;line-height:.95;font-weight:600;letter-spacing:-.022em}
.play{display:inline-flex;align-items:center;gap:.14em;background:#55bcdb;color:#052029;border-radius:.17em;padding:.01em .24em .04em .16em}
.play svg{width:.5em;height:.5em}
.cmd{position:absolute;left:72px;bottom:56px;font:400 26px 'Plex Mono',monospace;color:#98a9b5}
.cmd b{color:#f2a759;font-weight:500;margin-right:14px}
svg.wires{position:absolute;right:0;top:0;width:520px;height:630px}
</style>
<div class="grid"></div>
<svg class="wires" viewBox="0 0 520 630" fill="none" stroke-linejoin="round">
  <path d="M520 110H380V250H250V150H190" stroke="#3b5261" stroke-width="2"/>
  <path d="M520 360H430V470H300V390H230" stroke="#3b5261" stroke-width="2"/>
  <path d="M470 630V540H360V600H290" stroke="#3b5261" stroke-width="2"/>
  <rect x="134" y="126" width="64" height="48" rx="11" fill="#111c25" stroke="#3b5261" stroke-width="2"/>
  <rect x="174" y="366" width="64" height="48" rx="11" fill="#111c25" stroke="#3b5261" stroke-width="2"/>
  <rect x="234" y="576" width="64" height="48" rx="11" fill="#111c25" stroke="#3b5261" stroke-width="2"/>
  <rect x="226" y="226" width="64" height="48" rx="11" fill="#111c25" stroke="#3b5261" stroke-width="2"/>
  <circle cx="380" cy="180" r="9" fill="#55bcdb"/>
  <circle cx="430" cy="415" r="9" fill="#f2a759"/>
  <circle cx="360" cy="570" r="9" fill="#55bcdb"/>
</svg>
<div class="brand">
  <svg width="46" height="46" viewBox="0 0 32 32"><path d="M13 8.5h9.5V19" fill="none" stroke="#55bcdb" stroke-width="2.2" stroke-linejoin="round"/><rect x="2" y="3.5" width="11" height="10" rx="2.4" fill="#55bcdb"/><rect x="17" y="18.5" width="13" height="10" rx="2.4" fill="#55bcdb"/><circle cx="22.5" cy="8.5" r="3.4" fill="#f2a759"/></svg>
  docspp
</div>
<h1>Architecture diagrams you can <span class="play"><svg viewBox="0 0 16 16"><path d="M3.5 1.8v12.4L14 8z" fill="currentColor"/></svg>press play</span> on.</h1>
<div class="cmd"><b>$</b>npm create docspp@latest my-docs</div>`

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.evaluate(() => document.fonts.ready)
const png = await page.screenshot({ type: 'png' })
await browser.close()
writeFileSync(fileURLToPath(new URL('../apps/docs/public/og.png', import.meta.url)), png)
console.log('wrote apps/docs/public/og.png')
