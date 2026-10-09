// Renders images/icon.png, the extension's marketplace icon: the docspp mark on a dark tile.
// The marketplace takes PNG only. Run `node scripts/icon.mjs` after changing images/icon-dark.svg.
// Needs Google Chrome.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = fileURLToPath(new URL('..', import.meta.url))
const mark = readFileSync(`${root}images/icon-dark.svg`, 'utf8')

const html = `<!doctype html><meta charset="utf-8"><style>
*{margin:0}
body{width:256px;height:256px;background:transparent}
.tile{width:256px;height:256px;border-radius:56px;background:#0d1920;display:grid;place-items:center}
svg{width:156px;height:156px}
</style><div class="tile">${mark}</div>`

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
const page = await browser.newPage({ viewport: { width: 256, height: 256 } })
await page.setContent(html)
await page.screenshot({ path: `${root}images/icon.png`, omitBackground: true })
await browser.close()
console.log('wrote images/icon.png')
