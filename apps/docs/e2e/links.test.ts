import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Checks the built site without a browser: every internal link, anchor and asset must exist.
// `pnpm test:e2e` builds the docs first.
const DIST = fileURLToPath(new URL('../dist', import.meta.url))

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === '.prerender' || name === 'pagefind') return []
    if (statSync(path).isDirectory()) return htmlFiles(path)
    return path.endsWith('.html') ? [path] : []
  })
}

const pageUrl = (file: string) => `/${relative(DIST, file).replace(/index\.html$/, '')}`
const isExternal = (href: string) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href)

/** The file a URL path is served from, the way a static host resolves it. */
function fileFor(pathname: string): string | undefined {
  const target = join(DIST, decodeURIComponent(pathname))
  if (existsSync(target) && statSync(target).isFile()) return target
  const index = join(target, 'index.html')
  return existsSync(index) ? index : undefined
}

const pages = htmlFiles(DIST)
const html = new Map(pages.map((file) => [file, readFileSync(file, 'utf8')]))

describe('built site', () => {
  it('has the landing page and every section of the docs', () => {
    expect(pages.length).toBeGreaterThan(40)
    for (const path of [
      '/',
      '/guides/introduction/',
      '/format/nodes/',
      '/scenarios/story-view/',
      '/layout/hints/',
      '/customize/theming/',
      '/embed/publishing/',
      '/ai/skill/',
      '/reference/schema/',
      '/project/faq/',
      '/examples/checkout/',
    ]) {
      expect(fileFor(path), path).toBeDefined()
    }
  })

  it('has no broken internal links, anchors or assets', () => {
    const broken: string[] = []
    for (const [file, text] of html) {
      const from = pageUrl(file)
      const refs = [
        ...text.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g),
        ...text.matchAll(/<link\b[^>]*?\shref="([^"]*)"/g),
        ...text.matchAll(/<(?:img|script)\b[^>]*?\ssrc="([^"]*)"/g),
      ]
      for (const [, href = ''] of refs) {
        if (!href || isExternal(href)) continue
        const url = new URL(href, `http://site${from}`)
        const target = fileFor(url.pathname)
        if (!target) {
          broken.push(`${from} -> ${href}`)
          continue
        }
        // Diagram deep links look like #checkout=place-order.4 and are not element ids.
        const hash = decodeURIComponent(url.hash.slice(1))
        if (hash && !hash.includes('=') && target.endsWith('.html')) {
          const body = html.get(target) ?? readFileSync(target, 'utf8')
          if (!body.includes(`id="${hash}"`)) broken.push(`${from} -> ${href} (no #${hash})`)
        }
      }
    }
    expect(broken).toEqual([])
  })

  it('keeps the old guide addresses working', () => {
    for (const [old, now] of [
      ['/guides/writing-diagrams/', '/format/overview/'],
      ['/guides/scenarios/', '/scenarios/overview/'],
      ['/guides/icons-and-theming/', '/customize/icons/'],
      ['/guides/ai-authoring/', '/ai/skill/'],
    ] as const) {
      const file = fileFor(old)
      expect(file, old).toBeDefined()
      expect(readFileSync(file!, 'utf8'), old).toContain(now)
    }
  })
})
