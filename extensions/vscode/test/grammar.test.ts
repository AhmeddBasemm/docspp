import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LineCounter, Parser } from 'yaml'
import { buildGrammar } from '../scripts/grammar.mjs'
import { matches, tokenize } from './helpers/tokenize'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')

/** `text` -> its most specific scope, for the tokens of one line. */
async function line(text: string, index = 0): Promise<Record<string, string>> {
  const lines = await tokenize(text)
  const out: Record<string, string> = {}
  for (const t of lines[index] ?? []) {
    if (t.text.trim()) out[t.text.trim()] = t.scopes[t.scopes.length - 1] ?? ''
  }
  return out
}

describe('generated grammar', () => {
  it('is up to date (run `pnpm --filter idocs-vscode grammar`)', () => {
    const committed = JSON.parse(
      readFileSync(join(here, '../syntaxes/idocs.tmLanguage.json'), 'utf8'),
    )
    expect(committed).toEqual(JSON.parse(JSON.stringify(buildGrammar())))
  })
})

describe('keys and scalars', () => {
  it('scopes comments, keys and plain values', async () => {
    expect(await line('title: Hello, diagrams # why')).toMatchObject({
      title: 'entity.name.tag.yaml',
      ':': 'punctuation.separator.key-value.mapping.yaml',
      'Hello, diagrams': 'string.unquoted.plain.out.yaml',
      '#': 'punctuation.definition.comment.yaml',
      why: 'comment.line.number-sign.yaml',
    })
  })

  it('keeps a # without a leading space inside the value', async () => {
    expect(await line('url: https://example.com/#top')).toMatchObject({
      'https://example.com/#top': 'string.unquoted.plain.out.yaml',
    })
  })

  it('handles quoted values and quoted keys', async () => {
    const tokens = await line(`"my key": "a # b \\" c"`)
    expect(tokens['"my key"']).toBe('entity.name.tag.yaml')
    expect(tokens['a # b']).toBe('string.quoted.double.yaml')
    expect(tokens['\\"']).toBe('constant.character.escape.yaml')
    expect(await line(`sub: 'it''s'`)).toMatchObject({
      it: 'string.quoted.single.yaml',
      "''": 'constant.character.escape.yaml',
      s: 'string.quoted.single.yaml',
    })
  })

  it('scopes numbers, booleans and null, but not words that start like them', async () => {
    expect(await line('w: 220')).toMatchObject({ '220': 'constant.numeric.yaml' })
    expect(await line('both: true')).toMatchObject({ true: 'constant.language.boolean.yaml' })
    expect(await line('x: null')).toMatchObject({ null: 'constant.language.null.yaml' })
    expect(await line('title: true story')).toMatchObject({
      'true story': 'string.unquoted.plain.out.yaml',
    })
    expect(await line('title: 404 not found')).toMatchObject({
      '404 not found': 'string.unquoted.plain.out.yaml',
    })
  })

  it('scopes anchors, aliases and tags', async () => {
    expect(await line('base: &base')).toMatchObject({ base: 'entity.name.type.anchor.yaml' })
    expect(await line('copy: *base')).toMatchObject({ base: 'variable.other.alias.yaml' })
    expect(await line('<<: *base')).toMatchObject({ '<<': 'entity.name.tag.yaml' })
  })

  it('treats document markers and directives as such', async () => {
    const lines = await tokenize('%YAML 1.2\n---\ntitle: x\n...')
    expect(lines[0]?.[0]?.scopes.at(-1)).toBe('meta.directive.yaml')
    expect(lines[1]?.[0]?.scopes.at(-1)).toBe('entity.other.document.begin.yaml')
    expect(lines[3]?.[0]?.scopes.at(-1)).toBe('entity.other.document.end.yaml')
  })
})

describe('idocs values', () => {
  it('scopes kinds, enums, references and icons by the key they follow', async () => {
    expect(await line('  kind: service')).toMatchObject({ service: 'support.constant.kind.idocs' })
    expect(await line('  status: planned')).toMatchObject({
      planned: 'support.constant.enum.idocs',
    })
    expect(await line('  family: blue')).toMatchObject({ blue: 'support.constant.enum.idocs' })
    expect(await line('  in: backend')).toMatchObject({
      backend: 'variable.other.reference.idocs',
    })
    expect(await line('  icon: logos:redis')).toMatchObject({
      'logos:redis': 'support.constant.icon.idocs',
    })
    expect(await line('  icon: ./icons/mine.svg')).toMatchObject({
      './icons/mine.svg': 'support.constant.icon.idocs',
    })
  })

  it('leaves quoted values of those keys as strings', async () => {
    expect(await line('  icon: "logos:redis"')).toMatchObject({
      'logos:redis': 'string.quoted.double.yaml',
    })
  })

  it('scopes references in flow sequences', async () => {
    expect(await line('    via: [gateway, cache]')).toMatchObject({
      gateway: 'variable.other.reference.idocs',
      cache: 'variable.other.reference.idocs',
    })
    expect(await line('    nodes: [a, b]')).toMatchObject({ a: 'variable.other.reference.idocs' })
  })

  it('does not treat other keys that merely contain a keyword as semantic', async () => {
    expect(await line('  kinds: x')).toMatchObject({ x: 'string.unquoted.plain.out.yaml' })
    expect(await line('  index: x')).toMatchObject({ x: 'string.unquoted.plain.out.yaml' })
  })

  it('reads a comment after a semantic value', async () => {
    expect(await line('  kind: service # the api')).toMatchObject({
      service: 'support.constant.kind.idocs',
      'the api': 'comment.line.number-sign.yaml',
    })
  })
})

describe('arrows', () => {
  it('scopes both ends of an edge and the arrow', async () => {
    expect(await line('  - browser -> api: HTTPS')).toMatchObject({
      '-': 'punctuation.definition.block.sequence.item.yaml',
      browser: 'variable.other.reference.idocs',
      '->': 'keyword.operator.arrow.idocs',
      api: 'variable.other.reference.idocs',
      HTTPS: 'string.unquoted.plain.out.yaml',
    })
  })

  it('handles two-way edges, ids with dashes and no spaces around the arrow', async () => {
    expect(await line('- api-v2 <-> db.main: sync')).toMatchObject({
      'api-v2': 'variable.other.reference.idocs',
      '<->': 'keyword.operator.arrow.idocs',
      'db.main': 'variable.other.reference.idocs',
    })
    expect(await line('- a->b: x')).toMatchObject({
      a: 'variable.other.reference.idocs',
      '->': 'keyword.operator.arrow.idocs',
      b: 'variable.other.reference.idocs',
    })
  })

  it('accepts a bare arrow item and one with a nested mapping', async () => {
    expect(await line('  - a -> b')).toMatchObject({ '->': 'keyword.operator.arrow.idocs' })
    expect(await line('  - a -> b:')).toMatchObject({ '->': 'keyword.operator.arrow.idocs' })
    expect(await line('- a -> b # note')).toMatchObject({
      note: 'comment.line.number-sign.yaml',
    })
  })

  it('reads the extra properties of an edge written as a flow mapping', async () => {
    expect(await line('  - a -> b: { kind: data, label: SQL }')).toMatchObject({
      kind: 'entity.name.tag.yaml',
      data: 'support.constant.kind.idocs',
      SQL: 'string.unquoted.plain.in.yaml',
      '{': 'punctuation.definition.mapping.begin.yaml',
      '}': 'punctuation.definition.mapping.end.yaml',
    })
  })

  it('scopes the node of a self step', async () => {
    expect(await line('  - at api: validates the token')).toMatchObject({
      at: 'entity.name.tag.yaml',
      api: 'variable.other.reference.idocs',
      'validates the token': 'string.unquoted.plain.out.yaml',
    })
  })

  it('does not read arrows in ordinary values as edges', async () => {
    expect(await line('title: a -> b')).toMatchObject({
      'a -> b': 'string.unquoted.plain.out.yaml',
    })
    expect(await line('- see the docs -> api')).not.toHaveProperty('->')
  })
})

describe('block scalars', () => {
  it('ends a literal block at the first line that is not indented further', async () => {
    const lines = await tokenize('note: |\n  one\n\n  two\ntitle: next')
    expect(lines[1]?.[0]?.scopes).toContain('meta.embedded.block.markdown')
    expect(lines[3]?.[0]?.scopes).toContain('meta.embedded.block.markdown')
    expect(lines[4]?.[0]?.scopes.at(-1)).toBe('entity.name.tag.yaml')
    expect(lines[4]?.some((t) => t.scopes.includes('meta.block-scalar.idocs'))).toBe(false)
  })

  it('gives markdown keys an embedded markdown scope and other keys a plain block', async () => {
    const md = await tokenize('description: >-\n  hello')
    expect(md[1]?.[0]?.scopes).toContain('meta.embedded.block.markdown')
    const other = await tokenize('sub: |\n  hello')
    expect(other[1]?.[0]?.scopes.at(-1)).toBe('string.unquoted.block.yaml')
  })

  it('knows where a block scalar after "- key:" ends', async () => {
    const lines = await tokenize('- note: |\n    inside\n  title: outside')
    expect(lines[1]?.[0]?.scopes).toContain('meta.embedded.block.markdown')
    expect(lines[2]?.[0]?.scopes).not.toContain('meta.block-scalar.idocs')
    expect(lines[2]?.find((t) => t.text === 'title')?.scopes.at(-1)).toBe('entity.name.tag.yaml')
  })

  it('does not scan the inside of a block scalar for keys, arrows or comments', async () => {
    const lines = await tokenize('note: |\n  a -> b: c # not a comment\n  kind: service')
    for (const n of [1, 2]) {
      expect(lines[n]?.every((t) => t.scopes.includes('meta.embedded.block.markdown'))).toBe(true)
    }
  })

  it('reads a comment after the block indicator', async () => {
    expect(await line('sub: | # lines', 0)).toMatchObject({
      '# lines': 'comment.line.number-sign.yaml',
    })
  })
})

describe('flow collections', () => {
  it('reads a flow mapping that spans lines', async () => {
    const lines = await tokenize('a: {\n  kind: data,\n  label: SQL\n}\nnext: 1')
    expect(lines[1]?.find((t) => t.text === 'kind')?.scopes.at(-1)).toBe('entity.name.tag.yaml')
    expect(lines[1]?.find((t) => t.text === 'data')?.scopes.at(-1)).toBe(
      'support.constant.kind.idocs',
    )
    expect(lines[2]?.find((t) => t.text === 'SQL')?.scopes.at(-1)).toBe(
      'string.unquoted.plain.in.yaml',
    )
    expect(lines[4]?.find((t) => t.text === 'next')?.scopes.at(-1)).toBe('entity.name.tag.yaml')
  })

  it('reads nested collections and quoted items', async () => {
    expect(await line('chips: [{ label: a, sub: "b, c" }, plain]')).toMatchObject({
      label: 'entity.name.tag.yaml',
      'b, c': 'string.quoted.double.yaml',
      plain: 'string.unquoted.plain.in.yaml',
    })
  })

  it('allows a comma inside a plain block value but not inside a flow one', async () => {
    expect(await line('title: one, two')).toMatchObject({
      'one, two': 'string.unquoted.plain.out.yaml',
    })
    expect(await line('lines: [one, two]')).toMatchObject({
      one: 'string.unquoted.plain.in.yaml',
      two: 'string.unquoted.plain.in.yaml',
    })
  })
})

describe('markdown code fences', () => {
  const injection = JSON.parse(
    readFileSync(join(here, '../syntaxes/idocs-markdown.injection.tmLanguage.json'), 'utf8'),
  )
  const begin: string = injection.repository['idocs-code-block'].begin

  it('opens on an idocs fence and on nothing else', async () => {
    expect(await matches(begin, '```idocs')).toBe(true)
    expect(await matches(begin, '~~~ idocs')).toBe(true)
    expect(await matches(begin, '  ```IDocs title="x"')).toBe(true)
    expect(await matches(begin, '```yaml')).toBe(false)
    expect(await matches(begin, '```idocs-extra')).toBe(false)
  })

  it('injects into markdown only', () => {
    expect(injection.injectionSelector).toBe('L:text.html.markdown')
    expect(injection.repository['idocs-code-block'].patterns[0].patterns[0].include).toBe(
      'source.idocs',
    )
  })
})

// The grammar and the real YAML parser must agree about what is a key, a comment and a string,
// for every diagram the repository ships. That catches rules that work on the cases above but
// break on real-world layout.
function diagramFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.astro') continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...diagramFiles(path))
    else if (/\/diagrams\/.+\.ya?ml$/.test(path) && !path.endsWith('.schema.json')) out.push(path)
  }
  return out
}

const files = [
  ...diagramFiles(join(repo, 'apps/docs/diagrams')),
  ...diagramFiles(join(repo, 'templates/starter/diagrams')),
  join(repo, 'skills/idocs/assets/examples/shop.diagram.yaml'),
]

describe('real diagrams', () => {
  it('finds diagrams to check', () => {
    expect(files.length).toBeGreaterThan(15)
  })

  for (const file of files) {
    it(`agrees with the YAML parser: ${file.slice(repo.length + 1)}`, async () => {
      const text = readFileSync(file, 'utf8')
      const lines = await tokenize(text)
      const counter = new LineCounter()
      const tokens = [...new Parser(counter.addNewLine).parse(text)]
      const problems: string[] = []

      const scopesAt = (offset: number): string[] => {
        const { line, col } = counter.linePos(offset)
        const tok = lines[line - 1]?.find(
          (t) => t.start <= col - 1 && col - 1 < t.start + t.text.length,
        )
        return tok?.scopes ?? []
      }
      const expectScope = (offset: number, text: string, scope: string, what: string) => {
        if (!scopesAt(offset).some((s) => s.startsWith(scope))) {
          const { line, col } = counter.linePos(offset)
          problems.push(
            `${line}:${col} ${what} "${text}" is not ${scope}: ${scopesAt(offset).join(' ')}`,
          )
        }
      }

      const walk = (value: unknown): void => {
        if (Array.isArray(value)) return void value.forEach(walk)
        if (!value || typeof value !== 'object') return
        const t = value as {
          type?: string
          offset?: number
          source?: string
          items?: { key?: unknown; start?: unknown[]; value?: unknown; sep?: unknown[] }[]
          start?: unknown[]
          end?: unknown[]
        }
        if (t.type === 'comment' && t.offset !== undefined && t.source !== undefined) {
          expectScope(t.offset, t.source, 'comment.line', 'comment')
        }
        if (
          (t.type === 'double-quoted-scalar' || t.type === 'single-quoted-scalar') &&
          t.offset !== undefined
        ) {
          expectScope(t.offset + 1, t.source ?? '', 'string.quoted', 'string')
        }
        if (t.type === 'block-map' || t.type === 'flow-collection') {
          for (const item of t.items ?? []) {
            const key = item.key as { type?: string; offset?: number; source?: string } | undefined
            if (key?.type === 'scalar' && key.offset !== undefined && !key.source?.includes('->')) {
              expectScope(key.offset, key.source ?? '', 'entity.name.tag', 'key')
            }
          }
        }
        for (const v of Object.values(value)) walk(v)
      }
      walk(tokens)
      expect(problems).toEqual([])
    })
  }
})
