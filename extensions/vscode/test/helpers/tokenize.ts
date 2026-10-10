import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createOnigScanner, createOnigString, loadWASM } from 'vscode-oniguruma'
import { INITIAL, parseRawGrammar, Registry } from 'vscode-textmate'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../../', import.meta.url))

export interface Token {
  text: string
  scopes: string[]
  line: number
  start: number
}

let registry: Registry | undefined

async function load(): Promise<Registry> {
  if (registry) return registry
  const wasm = readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'))
  await loadWASM(
    wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer,
  )
  registry = new Registry({
    onigLib: Promise.resolve({ createOnigScanner, createOnigString }),
    loadGrammar: async (scopeName) => {
      const file =
        scopeName === 'source.idocs'
          ? 'syntaxes/idocs.tmLanguage.json'
          : scopeName === 'markdown.idocs.codeblock'
            ? 'syntaxes/idocs-markdown.injection.tmLanguage.json'
            : undefined
      // VS Code has the markdown grammar; the tests only need the scope name to resolve.
      if (scopeName === 'text.html.markdown') {
        return parseRawGrammar(
          JSON.stringify({ scopeName, patterns: [{ match: '.+', name: 'markup.stub.markdown' }] }),
          'markdown.json',
        )
      }
      if (!file) return null
      return parseRawGrammar(readFileSync(`${root}${file}`, 'utf8'), `${root}${file}`)
    },
  })
  return registry
}

/** Tokenize `text` with the idocs grammar. Every character belongs to exactly one token. */
export async function tokenize(text: string, scopeName = 'source.idocs'): Promise<Token[][]> {
  const grammar = await (await load()).loadGrammar(scopeName)
  if (!grammar) throw new Error(`grammar ${scopeName} not found`)
  let stack = INITIAL
  return text.split('\n').map((line, i) => {
    const result = grammar.tokenizeLine(line, stack)
    stack = result.ruleStack
    return result.tokens.map((t) => ({
      text: line.slice(t.startIndex, t.endIndex),
      scopes: t.scopes,
      line: i,
      start: t.startIndex,
    }))
  })
}

/** The most specific scope of every non-blank token on each line: `text -> scope`. */
export function summarize(lines: Token[][]): string[] {
  return lines.map((tokens) =>
    tokens
      .filter((t) => t.text.trim() !== '')
      .map((t) => `${t.text.trim()} -> ${t.scopes[t.scopes.length - 1]}`)
      .join(' | '),
  )
}

/** Whether an Oniguruma pattern (as written in a grammar) matches somewhere in `text`. */
export async function matches(pattern: string, text: string): Promise<boolean> {
  await load()
  const scanner = createOnigScanner([pattern])
  const hit = scanner.findNextMatchSync(createOnigString(text), 0)
  scanner.dispose()
  return hit !== null
}
