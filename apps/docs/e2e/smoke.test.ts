import { fileURLToPath } from 'node:url'
import { type Browser, chromium, type Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { serve } from '../../../scripts/static-server.mjs'

const PORT = 4501
const BASE = `http://localhost:${PORT}`

let server: { close: () => Promise<void> }
let browser: Browser

beforeAll(async () => {
  // The built docs site; `pnpm test:e2e` builds it first.
  server = await serve(fileURLToPath(new URL('../dist', import.meta.url)), PORT)
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
})

afterAll(async () => {
  await browser?.close()
  await server?.close()
})

async function open(path: string, opts: { theme?: 'light' | 'dark' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    colorScheme: opts.theme ?? 'light',
  })
  const page = await ctx.newPage()
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/404|favicon/.test(m.text())) problems.push(m.text())
  })
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.docspp-node')
  await page.waitForTimeout(500)
  return { page, problems, close: () => ctx.close() }
}

const stepActive = (page: Page) => page.locator('.docspp-step.is-active .docspp-step-n')

describe('checkout example', () => {
  it('renders every node with an icon, edges and a legend', async () => {
    const { page, problems, close } = await open('/examples/checkout/')
    expect(await page.locator('[data-node]').count()).toBe(12)
    expect(await page.locator('[data-node] .docspp-icon svg').count()).toBe(12)
    expect(await page.locator('.docspp-edge').count()).toBeGreaterThan(10)
    expect(await page.locator('.docspp-legend span').count()).toBeGreaterThan(2)
    expect(problems).toEqual([])
    await close()
  })

  it('plays a scenario: packets fly, the step list follows, the hash is shareable', async () => {
    const { page, problems, close } = await open('/examples/checkout/')
    await page.click('.docspp-chip-btn:has-text("Place an order")')
    await page.waitForSelector('.docspp-packet', { state: 'attached', timeout: 5000 })
    await page.waitForSelector('.docspp-step.is-active')
    await page.waitForFunction(
      () => document.querySelector('.docspp-btn.is-primary')?.textContent?.includes('Replay'),
      null,
      { timeout: 40_000 },
    )
    expect(await page.locator('.docspp-step.is-done').count()).toBeGreaterThan(5)
    expect(await page.evaluate(() => location.hash)).toMatch(/^#checkout=place-order\.\d+$/)
    expect(problems).toEqual([])
    await close()
  })

  it('steps with next and previous, and jumps by clicking a step', async () => {
    const { page, close } = await open('/examples/checkout/')
    await page.click('.docspp-chip-btn:has-text("Browse a product (cache hit)")')
    await page.click('.docspp-btn.is-primary') // pause
    await page.waitForTimeout(150)
    // Paused mid-step: the first Next finishes that step, the second plays the one after it.
    const resumed = () =>
      page.waitForFunction(
        () => document.querySelector('.docspp-btn.is-primary')?.textContent?.includes('Resume'),
        null,
        { timeout: 8000 },
      )
    await page.click('button[aria-label="Next step"]')
    await resumed()
    await page.click('button[aria-label="Next step"]')
    await resumed()
    expect(Number(await stepActive(page).first().textContent())).toBeGreaterThanOrEqual(2)
    await page.click('.docspp-step:nth-of-type(1)')
    await page.waitForTimeout(300)
    await page.click('.docspp-btn.is-primary')
    await close()
  })

  it('shows the sequence view for the same scenario', async () => {
    const { page, close } = await open('/examples/checkout/')
    await page.click('.docspp-chip-btn:has-text("Card declined")')
    await page.click('.docspp-modes button:has-text("Sequence")')
    await page.waitForSelector('.docspp-seq svg')
    const rows = await page.locator('.docspp-seq .seq-row').count()
    const steps = await page.locator('.docspp-step').count()
    expect(rows).toBe(steps)
    await close()
  })

  it('opens a drawer with the markdown doc and closes it with Escape', async () => {
    const { page, close } = await open('/examples/checkout/')
    await page.click('[data-node="orders"]')
    const drawer = page.locator('.docspp-drawer')
    await drawer.waitFor()
    expect(await drawer.locator('table').count()).toBe(1)
    expect(await drawer.locator('pre').count()).toBe(1)
    await page.keyboard.press('Escape')
    await drawer.waitFor({ state: 'detached' })
    await close()
  })

  it('opens the drawer from the keyboard', async () => {
    const { page, close } = await open('/examples/checkout/')
    await page.focus('[data-node="gateway"]')
    await page.keyboard.press('Enter')
    await page.locator('.docspp-drawer').waitFor()
    expect(await page.locator('.docspp-drawer').textContent()).toContain('rate limit')
    await close()
  })

  it('restores a scenario and step from the URL', async () => {
    const { page, close } = await open('/examples/checkout/#checkout=place-order.3')
    await page.waitForSelector('.docspp-step.is-active')
    expect(await page.locator('.docspp-chip-btn[aria-pressed="true"]').textContent()).toContain(
      'Place an order',
    )
    expect(Number(await stepActive(page).first().textContent())).toBe(3)
    await close()
  })

  it('switches views from the tabs', async () => {
    const { page, close } = await open('/examples/checkout/')
    const before = await page.locator('[data-node]').count()
    await page.click('.docspp-tab:has-text("Backend only")')
    await page.waitForFunction((n) => document.querySelectorAll('[data-node]').length < n, before)
    await close()
  })

  it('toggles planned items', async () => {
    const { page, close } = await open('/examples/checkout/')
    await page.click('.docspp-tool:has-text("Hide planned")')
    expect(await page.locator('[data-node].is-hidden').count()).toBe(1)
    await close()
  })

  it('themes with the site: dark mode changes the surface colour', async () => {
    const light = await open('/examples/checkout/')
    const lightBg = await light.page.evaluate(
      () => getComputedStyle(document.querySelector('[data-node]')!).backgroundColor,
    )
    await light.close()
    const dark = await open('/examples/checkout/', { theme: 'dark' })
    await dark.page.evaluate(() => localStorage.setItem('starlight-theme', 'dark'))
    await dark.page.reload({ waitUntil: 'networkidle' })
    await dark.page.waitForSelector('.docspp-node')
    const darkBg = await dark.page.evaluate(
      () => getComputedStyle(document.querySelector('[data-node]')!).backgroundColor,
    )
    expect(darkBg).not.toBe(lightBg)
    await dark.close()
  })
})

describe('story view', () => {
  it('opens a scenario written with mode: story as swimlanes, grouped into the lanes it declares', async () => {
    const { page, problems, close } = await open('/examples/platform/')
    await page.click('.docspp-chip-btn:has-text("One read request")')
    await page.waitForSelector('.docspp-story-grid')
    expect(await page.locator('.docspp-lane-head').count()).toBe(8)
    expect(await page.locator('.docspp-phase-label').count()).toBe(5)
    expect(await page.locator('.docspp-sbox.role-lookup').count()).toBe(6)
    expect(await page.locator('.docspp-sbox:not(.role-lookup)').count()).toBe(13)
    expect(await page.locator('.docspp-story-summary, .docspp-summary.is-card').count()).toBe(1)
    // Connectors are measured from the real boxes, so they exist only once layout has settled.
    await page.waitForSelector('.docspp-slink')
    expect(await page.locator('.docspp-slink').count()).toBe(18)
    expect(problems).toEqual([])
    await close()
  })

  it('shows any scenario as a story, with lanes taken from the nodes involved', async () => {
    const { page, close } = await open('/examples/checkout/')
    await page.click('.docspp-chip-btn:has-text("Place an order")')
    await page.click('.docspp-modes button:has-text("Story")')
    await page.waitForSelector('.docspp-story-grid')
    expect(await page.locator('.docspp-lane-head').count()).toBe(6)
    expect(await page.locator('.docspp-sbox.st-planned').count()).toBe(1)
    await page.click('.docspp-modes button:has-text("Flow")')
    await page.waitForSelector('[data-node]')
    await close()
  })

  it('plays the clicked step and keeps the step list in step', async () => {
    const { page, close } = await open('/examples/checkout/')
    await page.click('.docspp-chip-btn:has-text("Place an order")')
    await page.click('.docspp-modes button:has-text("Story")')
    await page.waitForSelector('.docspp-story-grid')
    await page.click('.docspp-sbox:has-text("create payment intent")')
    await page.waitForSelector('.docspp-sbox.is-active')
    expect(Number(await stepActive(page).first().textContent())).toBe(3)
    await close()
  })
})

describe('zoom', () => {
  it('does not leave the diagram on a promoted layer once zooming stops, which would blur it', async () => {
    const { page, close } = await open('/examples/checkout/')
    for (let i = 0; i < 3; i++) await page.click('button[aria-label="Zoom in"]')
    await page.waitForTimeout(500)
    const willChange = await page
      .locator('.docspp-world')
      .evaluate((el) => getComputedStyle(el).willChange)
    expect(willChange).toBe('auto')
    await close()
  })
})

describe('platform example', () => {
  it('renders the large diagram and plays a scenario to the end', async () => {
    const { page, problems, close } = await open('/examples/platform/')
    expect(await page.locator('[data-node]').count()).toBe(37)
    expect(await page.locator('.docspp-zone').count()).toBe(9)
    await page.click('.docspp-chip-btn:has-text("Dispatch a job to a device")')
    await page.selectOption('.docspp-player select', '2')
    await page.waitForFunction(
      () => document.querySelector('.docspp-btn.is-primary')?.textContent?.includes('Replay'),
      null,
      { timeout: 50_000 },
    )
    expect(problems).toEqual([])
    await close()
  })

  it('keeps the camera on the action when the diagram is large', async () => {
    const { page, close } = await open('/examples/platform/')
    const before = await page
      .locator('.docspp-world')
      .evaluate((el) => (el as HTMLElement).style.transform)
    await page.click('.docspp-chip-btn:has-text("Device is offline")')
    await page.waitForTimeout(2500)
    const during = await page
      .locator('.docspp-world')
      .evaluate((el) => (el as HTMLElement).style.transform)
    expect(during).not.toBe(before)
    expect(await page.locator('.docspp-tool:has-text("Follow")').getAttribute('aria-pressed')).toBe(
      'true',
    )
    await close()
  })
})
