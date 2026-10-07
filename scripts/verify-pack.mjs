// Proves the published experience works, without publishing anything.
//
//   1. build and pack every package
//   2. scaffold a project with the packed create-docspp
//   3. point its @packagelab/docspp-* dependencies at the tarballs and install like a user would
//   4. check, build, and load the built site in Chrome
//
// Needs network (for Astro and friends) and Google Chrome. Pass --keep to leave the project behind.
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { serve } from './static-server.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const keep = process.argv.includes('--keep')
const work = mkdtempSync(join(tmpdir(), 'docspp-pack-'))
const packs = join(work, 'packs')
const project = join(work, 'my-docs')
const PORT = 4601
let server

const step = (msg) => console.log(`\n▸ ${msg}`)
const run = (cmd, args, cwd, quiet = true) =>
  execFileSync(cmd, args, { cwd, stdio: quiet ? 'pipe' : 'inherit', encoding: 'utf8' })

try {
  step('build packages')
  run('pnpm', ['build:packages'], root)

  step('pack')
  mkdirSync(packs, { recursive: true })
  const tarballs = {}
  for (const dir of ['core', 'react', 'astro', 'cli', 'create-docspp']) {
    const cwd = join(root, 'packages', dir)
    const name = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).name
    run('pnpm', ['pack', '--pack-destination', packs], cwd)
    // pnpm names the tarball <name without @, / as ->-<version>.tgz
    const stem = name.replace(/^@/, '').replace('/', '-').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    tarballs[name] = readdirSync(packs)
      .filter((f) => new RegExp(`^${stem}-\\d`).test(f))
      .map((f) => join(packs, f))[0]
    const listing = run('tar', ['-tzf', tarballs[name]], work)
    if (!listing.includes('package/LICENSE')) throw new Error(`${name} was packed without its LICENSE`)
    console.log(`  ${name}  ${tarballs[name]?.split('/').pop()}`)
  }

  step('scaffold with the packed create-docspp')
  run('tar', ['-xzf', tarballs['create-docspp'], '-C', packs], work)
  run('node', [join(packs, 'package/dist/index.js'), project], work)
  for (const file of ['SKILL.md', 'references/format.md', 'references/setup.md', 'assets/examples/shop.diagram.yaml']) {
    if (!existsSync(join(project, '.claude/skills/docspp', file))) throw new Error(`the scaffolded project is missing the docspp skill file ${file}`)
  }
  console.log('  the docspp skill came with it')

  step('install the packed packages')
  const pkgFile = join(project, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
  for (const field of ['dependencies', 'devDependencies']) {
    for (const dep of Object.keys(pkg[field] ?? {})) if (tarballs[dep]) pkg[field][dep] = `file:${tarballs[dep]}`
  }
  writeFileSync(pkgFile, JSON.stringify(pkg, null, 2))
  // Packages depend on each other by version; during this test those versions are not on npm.
  appendFileSync(
    join(project, 'pnpm-workspace.yaml'),
    `overrides:\n${Object.entries(tarballs).filter(([n]) => n.startsWith('@packagelab/')).map(([n, f]) => `  '${n}': file:${f}`).join('\n')}\n`,
  )
  run('pnpm', ['install'], project)

  step('docspp check')
  console.log(run('pnpm', ['check', '--strict'], project).trim().split('\n').slice(-2).join('\n'))

  step('astro build')
  run('pnpm', ['build'], project)

  step('load the built site in Chrome')
  server = await serve(join(project, 'dist'), PORT)
  const base = server.url
  const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright-core/index.mjs')).href)
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}/architecture/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-node]')
  const nodes = await page.locator('[data-node]').count()
  await page.click('.docspp-chip-btn:has-text("Place an order")')
  await page.waitForSelector('.docspp-packet', { state: 'attached', timeout: 8000 })
  await browser.close()
  if (nodes !== 7) throw new Error(`expected 7 nodes in the shop diagram, found ${nodes}`)
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`)
  console.log(`  ${nodes} nodes rendered, scenario played`)

  console.log('\n✓ the packed packages install, build and run')
} catch (err) {
  console.error('\n✗ verify-pack failed')
  console.error(err.stderr?.toString() || err.stdout?.toString() || err.message)
  process.exitCode = 1
} finally {
  await server?.close()
  if (keep) console.log(`\nProject kept at ${project}`)
  else rmSync(work, { recursive: true, force: true })
}
