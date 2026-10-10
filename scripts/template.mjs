// Turns templates/starter into a standalone project: no workspace: versions, the shared
// idocs skill included, placeholders filled in. Used by create-idocs (at build time)
// and by the template-repo sync workflow.
//
//   node scripts/template.mjs --out ../my-template-repo
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP = new Set(['node_modules', 'dist', '.astro', '.DS_Store', 'pnpm-lock.yaml'])
/** Files npm would drop or that would confuse pnpm inside this repo carry a leading underscore. */
const RENAMES = { _gitignore: '.gitignore', '_pnpm-workspace.yaml': 'pnpm-workspace.yaml' }
const TEXT = /\.(md|mdx|json|ya?ml|mjs|ts|css|svg|txt)$|^_gitignore$|^\.gitignore$/

export function workspaceVersions() {
  const out = {}
  for (const name of readdirSync(join(root, 'packages'))) {
    const file = join(root, 'packages', name, 'package.json')
    if (!existsSync(file)) continue
    const pkg = JSON.parse(readFileSync(file, 'utf8'))
    out[pkg.name] = pkg.version
  }
  return out
}

/**
 * @param {string} outDir
 * @param {{ docsUrl?: string, keepAliases?: boolean }} [options]
 *   npm drops `.gitignore` from published packages, so the scaffolder ships `_gitignore` and
 *   renames it when it copies (keepAliases).
 */
export function buildTemplate(outDir, options = {}) {
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const docsUrl = options.docsUrl ?? rootPkg.homepage ?? ''
  const versions = workspaceVersions()

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  cpSync(join(root, 'templates/starter'), outDir, {
    recursive: true,
    filter: (src) => !SKIP.has(src.split('/').pop() ?? ''),
  })

  // One skill, maintained once in skills/idocs, shipped with every new project (and installable
  // anywhere with `npx skills add`). dereference: .claude/skills/idocs in this repo is a symlink.
  cpSync(join(root, 'skills/idocs'), join(outDir, '.claude/skills/idocs'), {
    recursive: true,
    dereference: true,
  })

  // A package keeps the underscore names (create-idocs renames them); a repository gets the real ones.
  if (!options.keepAliases) {
    for (const [from, to] of Object.entries(RENAMES)) {
      if (existsSync(join(outDir, from))) renameSync(join(outDir, from), join(outDir, to))
    }
  }

  const pkgFile = join(outDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
  for (const field of ['dependencies', 'devDependencies']) {
    for (const [dep, spec] of Object.entries(pkg[field] ?? {})) {
      if (!String(spec).startsWith('workspace:')) continue
      const version = versions[dep]
      if (!version) throw new Error(`Template depends on ${dep}, which is not in this workspace`)
      pkg[field][dep] = `^${version}`
    }
  }
  writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`)

  fillPlaceholders(outDir, { __DOCS_URL__: docsUrl })
  return outDir
}

function fillPlaceholders(dir, values) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) fillPlaceholders(path, values)
    else if (TEXT.test(entry.name)) {
      let text = readFileSync(path, 'utf8')
      const next = Object.entries(values).reduce((t, [k, v]) => t.replaceAll(k, v), text)
      if (next !== text) writeFileSync(path, next)
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out')
  const out = i > 0 ? process.argv[i + 1] : undefined
  if (!out) {
    console.error('Usage: node scripts/template.mjs --out <dir>')
    process.exit(2)
  }
  console.log(`Template written to ${buildTemplate(resolve(out))}`)
}
