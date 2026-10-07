import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { authoringJsonSchema } from '../src/node'
import { docsRoot } from './helpers'

const templateRoot = join(docsRoot, '../../templates/starter')

describe('committed diagram.schema.json', () => {
  const expected = `${JSON.stringify(authoringJsonSchema(), null, 2)}\n`

  for (const [label, root] of [
    ['apps/docs', docsRoot],
    ['templates/starter', templateRoot],
  ] as const) {
    it(`${label} is up to date (run \`pnpm idocs schema ${label}\` after changing the schema)`, () => {
      expect(readFileSync(join(root, 'diagrams/diagram.schema.json'), 'utf8')).toBe(expected)
    })
  }
})
