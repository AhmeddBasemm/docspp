// Builds a production bundle and packs it into idocs-vscode-<version>.vsix next to package.json.
// The bundle already contains its dependencies, so vsce is told not to look at node_modules.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { name, version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const out = join(root, `${name}-${version}.vsix`)

execFileSync('node', ['scripts/build.mjs', '--production'], { cwd: root, stdio: 'inherit' })
execFileSync(join(root, 'node_modules/.bin/vsce'), ['package', '--no-dependencies', '--out', out], {
  cwd: root,
  stdio: 'inherit',
})
console.log(`\npacked ${out}`)
