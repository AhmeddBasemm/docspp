#!/usr/bin/env node
import { dirname, join, relative } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { scaffold } from './scaffold'

const HELP = `create-docspp: start a docs site with interactive architecture diagrams

Usage
  npm create docspp@latest [folder]
  pnpm create docspp [folder]

The folder must not exist or must be empty. The project uses pnpm.
`

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP)
    return
  }

  let target = args.find((a) => !a.startsWith('-'))
  if (!target) {
    if (process.stdin.isTTY) {
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      target = (await rl.question('Where should the project go? (my-docs) ')).trim() || 'my-docs'
      rl.close()
    } else target = 'my-docs'
  }

  // dist/index.js sits next to template/ in the published package; src/ sits next to it in the repo.
  const here = dirname(fileURLToPath(import.meta.url))
  const templateDir = join(here, '..', 'template')

  const { dir, name } = scaffold(templateDir, target)
  const where = relative(process.cwd(), dir) || '.'
  console.log(`\nCreated ${name} in ${where}\n`)
  console.log('Next:')
  if (where !== '.') console.log(`  cd ${where}`)
  console.log('  pnpm install')
  console.log('  pnpm dev\n')
  console.log('Then edit diagrams/shop/diagram.yaml and watch the page reload.')
  console.log('No pnpm? npm install -g pnpm\n')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
