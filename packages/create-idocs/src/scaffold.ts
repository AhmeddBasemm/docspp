import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { basename, resolve } from 'node:path'

const RENAMES: Record<string, string> = {
  _gitignore: '.gitignore',
  '_pnpm-workspace.yaml': 'pnpm-workspace.yaml',
}

export interface ScaffoldResult {
  dir: string
  name: string
}

/** A valid npm package name for a folder name. */
export function packageName(folder: string): string {
  const name = folder
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
  return name || 'my-docs'
}

/** Copy the template into `target`, which must not exist or must be empty. */
export function scaffold(templateDir: string, target: string): ScaffoldResult {
  const dir = resolve(target)
  if (!existsSync(templateDir)) throw new Error(`Template not found at ${templateDir}`)
  if (existsSync(dir) && readdirSync(dir).length > 0) {
    throw new Error(`${dir} is not empty. Choose another folder, or empty it first.`)
  }
  mkdirSync(dir, { recursive: true })
  cpSync(templateDir, dir, { recursive: true })

  // npm strips `.gitignore` from published packages, and a nested pnpm-workspace.yaml would
  // confuse this repository, so the template carries underscore names.
  for (const [from, to] of Object.entries(RENAMES)) {
    if (existsSync(resolve(dir, from))) renameSync(resolve(dir, from), resolve(dir, to))
  }

  const name = packageName(basename(dir))
  const file = resolve(dir, 'package.json')
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  pkg.name = name
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
  return { dir, name }
}
