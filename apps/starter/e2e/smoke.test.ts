import { type ChildProcess, spawn } from 'node:child_process'
import { type Browser, chromium, type Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 4501
const BASE = `http://localhost:${PORT}`

let server: ChildProcess
let browser: Browser

async function waitFor(url: string, ms = 60_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`${url} did not come up`)
}

beforeAll(async () => {
  server = spawn(
    'pnpm',
    ['--filter', '@idocs/starter', 'exec', 'astro', 'preview', '--port', String(PORT)],
    {
      stdio: 'ignore',
    },
  )
  await waitFor(`${BASE}/examples/checkout/`)
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
})

afterAll(async () => {
  await browser?.close()
  server?.kill()
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
  await page.waitForSelector('.idocs-node')
  await page.waitForTimeout(500)
  return { page, problems, close: () => ctx.close() }
}

const stepActive = (page: Page) => page.locator('.idocs-step.is-active .idocs-step-n')

describe('checkout example', () => {
  it('renders every node with an icon, edges and a legend', async () => {
    const { page, problems, close } = await open('/examples/checkout/')
    expect(await page.locator('[data-node]').count()).toBe(12)
    expect(await page.locator('[data-node] .idocs-icon svg').count()).toBe(12)
    expect(await page.locator('.idocs-edge').count()).toBeGreaterThan(10)
    expect(await page.locator('.idocs-legend span').count()).toBeGreaterThan(2)
    expect(problems).toEqual([])
    await close()
  })

  it('plays a scenario: packets fly, the step list follows, the hash is shareable', async () => {
    const { page, problems, close } = await open('/examples/checkout/')
    await page.click('.idocs-chip-btn:has-text("Place an order")')
    await page.waitForSelector('.idocs-packet', { state: 'attached', timeout: 5000 })
    await page.waitForSelector('.idocs-step.is-active')
    await page.waitForFunction(
      () => document.querySelector('.idocs-btn.is-primary')?.textContent?.includes('Replay'),
      null,
      { timeout: 40_000 },
    )
    expect(await page.locator('.idocs-step.is-done').count()).toBeGreaterThan(5)
    expect(await page.evaluate(() => location.hash)).toMatch(/^#checkout=place-order\.\d+$/)
    expect(problems).toEqual([])
    await close()
  })

  it('steps with next and previous, and jumps by clicking a step', async () => {
    const { page, close } = await open('/examples/checkout/')
    await page.click('.idocs-chip-btn:has-text("Browse a product (cache hit)")')
    await page.click('.idocs-btn.is-primary') // pause
    await page.waitForTimeout(150)
    // Paused mid-step: the first Next finishes that step, the second plays the one after it.
    const resumed = () =>
      page.waitForFunction(
        () => document.querySelector('.idocs-btn.is-primary')?.textContent?.includes('Resume'),
        null,
        { timeout: 8000 },
      )
    await page.click('button[aria-label="Next step"]')
    await resumed()
    await page.click('button[aria-label="Next step"]')
    await resumed()
    expect(Number(await stepActive(page).first().textContent())).toBeGreaterThanOrEqual(2)
    await page.click('.idocs-step:nth-of-type(1)')
    await page.waitForTimeout(300)
    await page.click('.idocs-btn.is-primary')
    await close()
  })

  it('shows the sequence view for the same scenario', async () => {
    const { page, close } = await open('/examples/checkout/')
    await page.click('.idocs-chip-btn:has-text("Card declined")')
    await page.click('.idocs-modes button:has-text("Sequence")')
    await page.waitForSelector('.idocs-seq svg')
    const rows = await page.locator('.idocs-seq .seq-row').count()
    const steps = await page.locator('.idocs-step').count()
    expect(rows).toBe(steps)
    await close()
  })

  it('opens a drawer with the markdown doc and closes it with Escape', async () => {
    const { page, close } = await open('/examples/checkout/')
    await page.click('[data-node="orders"]')
    const drawer = page.locator('.idocs-drawer')
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
    await page.locator('.idocs-drawer').waitFor()
    expect(await page.locator('.idocs-drawer').textContent()).toContain('rate limit')
    await close()
  })

  it('restores a scenario and step from the URL', async () => {
    const { page, close } = await open('/examples/checkout/#checkout=place-order.3')
    await page.waitForSelector('.idocs-step.is-active')
    expect(await page.locator('.idocs-chip-btn[aria-pressed="true"]').textContent()).toContain(
      'Place an order',
    )
    expect(Number(await stepActive(page).first().textContent())).toBe(3)
    await close()
  })

  it('switches views from the tabs', async () => {
    const { page, close } = await open('/examples/checkout/')
    const before = await page.locator('[data-node]').count()
    await page.click('.idocs-tab:has-text("Backend only")')
    await page.waitForFunction((n) => document.querySelectorAll('[data-node]').length < n, before)
    await close()
  })

  it('toggles planned items', async () => {
    const { page, close } = await open('/examples/checkout/')
    await page.click('.idocs-tool:has-text("Hide planned")')
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
    await dark.page.waitForSelector('.idocs-node')
    const darkBg = await dark.page.evaluate(
      () => getComputedStyle(document.querySelector('[data-node]')!).backgroundColor,
    )
    expect(darkBg).not.toBe(lightBg)
    await dark.close()
  })
})

describe('platform example', () => {
  it('renders the large diagram and plays a scenario to the end', async () => {
    const { page, problems, close } = await open('/examples/platform/')
    expect(await page.locator('[data-node]').count()).toBe(37)
    expect(await page.locator('.idocs-zone').count()).toBe(9)
    await page.click('.idocs-chip-btn:has-text("Dispatch a job to a device")')
    await page.selectOption('.idocs-player select', '2')
    await page.waitForFunction(
      () => document.querySelector('.idocs-btn.is-primary')?.textContent?.includes('Replay'),
      null,
      { timeout: 50_000 },
    )
    expect(problems).toEqual([])
    await close()
  })

  it('keeps the camera on the action when the diagram is large', async () => {
    const { page, close } = await open('/examples/platform/')
    const before = await page
      .locator('.idocs-world')
      .evaluate((el) => (el as HTMLElement).style.transform)
    await page.click('.idocs-chip-btn:has-text("Device is offline")')
    await page.waitForTimeout(2500)
    const during = await page
      .locator('.idocs-world')
      .evaluate((el) => (el as HTMLElement).style.transform)
    expect(during).not.toBe(before)
    expect(await page.locator('.idocs-tool:has-text("Follow")').getAttribute('aria-pressed')).toBe(
      'true',
    )
    await close()
  })
})
