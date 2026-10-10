import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadIconSets } from '@packagelab/idocs-core/node'
import { type IconResolver, lazyIconResolver } from '../../src/model/icons'

export const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

/** The same icon catalog the CLI uses. */
export const icons: IconResolver = lazyIconResolver(loadIconSets)

/** A project on disk: `files` maps relative paths to text. Returns its root. */
export function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'idocs-vscode-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

export const MINI = `title: Mini
nodes:
  web: { kind: client, title: Web }
  api: { kind: service, title: API, in: backend, refs: [src/api.ts, src/missing.ts] }
groups:
  backend: Backend
edges:
  - web -> api: HTTPS
scenarios:
  load:
    title: Load
    steps:
      - web -> api: GET /
      - api -> web: 200
`
