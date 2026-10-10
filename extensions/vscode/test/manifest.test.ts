import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The manifest is the one place that has to agree with the code, the files on disk and the
// package contents. These tests read it the way VS Code and vsce do.
const root = join(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const contributes = manifest.contributes

const declared: string[] = contributes.commands.map((c: { command: string }) => c.command)
const registered = [
  ...readFileSync(join(root, 'src/vscode/commands.ts'), 'utf8').matchAll(/register\(\s*'(\w+)'/g),
].map((m) => `idocs.${m[1]}`)

/** Commands that VS Code itself provides, which menus and links may use. */
const builtin = (id: string) => !id.startsWith('idocs.')

describe('commands', () => {
  it('registers every command it declares, and declares every command it registers', () => {
    expect([...declared].sort()).toEqual([...registered].sort())
  })

  it('only refers to declared commands from menus, keybindings and the walkthrough', () => {
    const used = new Set<string>()
    for (const list of Object.values<{ command: string }[]>(contributes.menus)) {
      for (const item of list) used.add(item.command)
    }
    for (const k of contributes.keybindings) used.add(k.command)
    const text = JSON.stringify(contributes.walkthroughs)
    for (const m of text.matchAll(/command:([\w.]+)/g)) used.add(m[1] as string)
    for (const step of contributes.walkthroughs.flatMap((w: { steps: unknown[] }) => w.steps)) {
      for (const e of (step as { completionEvents: string[] }).completionEvents) {
        used.add(e.replace('onCommand:', ''))
      }
    }
    for (const id of used) {
      expect(builtin(id) || declared.includes(id), `${id} is not declared`).toBe(true)
    }
  })

  it('gives every command a title and the idocs category', () => {
    for (const c of contributes.commands) {
      expect(c.title, c.command).toBeTruthy()
      expect(c.category, c.command).toBe('idocs')
    }
  })
})

describe('contributions point at files that exist', () => {
  const paths = [
    manifest.icon,
    manifest.main,
    ...contributes.grammars.map((g: { path: string }) => g.path),
    ...contributes.snippets.map((s: { path: string }) => s.path),
    ...contributes.languages.map((l: { configuration: string }) => l.configuration),
    ...contributes.languages.flatMap((l: { icon: { light: string; dark: string } }) => [
      l.icon.light,
      l.icon.dark,
    ]),
    ...contributes.walkthroughs.flatMap((w: { steps: { media: { markdown: string } }[] }) =>
      w.steps.map((s) => s.media.markdown),
    ),
  ]
    .map((p: string) => p.replace(/^\.\//, ''))
    // `main` is built, so it exists only after `pnpm build`.
    .filter((p) => !p.startsWith('dist/'))

  for (const path of paths) {
    it(path, () => {
      expect(existsSync(join(root, path))).toBe(true)
    })
  }
})

describe('the package', () => {
  it('ships what the manifest points at', () => {
    const listed = execFileSync(join(root, 'node_modules/.bin/vsce'), ['ls', '--no-dependencies'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .map((l) => l.trim())
    const shipped = (p: string) => listed.includes(p.replace(/^\.\//, ''))
    for (const g of contributes.grammars) expect(shipped(g.path), g.path).toBe(true)
    for (const s of contributes.snippets) expect(shipped(s.path), s.path).toBe(true)
    for (const l of contributes.languages) {
      expect(shipped(l.configuration), l.configuration).toBe(true)
      expect(shipped(l.icon.light), l.icon.light).toBe(true)
      expect(shipped(l.icon.dark), l.icon.dark).toBe(true)
    }
    for (const w of contributes.walkthroughs) {
      for (const step of w.steps)
        expect(shipped(step.media.markdown), step.media.markdown).toBe(true)
    }
    expect(shipped(manifest.icon)).toBe(true)
    expect(shipped('README.md')).toBe(true)
    expect(shipped('CHANGELOG.md')).toBe(true)
  })

  it('leaves sources, tests and maps out', () => {
    const listed = execFileSync(join(root, 'node_modules/.bin/vsce'), ['ls', '--no-dependencies'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(listed).not.toMatch(/^src\//m)
    expect(listed).not.toMatch(/^test\//m)
    expect(listed).not.toMatch(/\.map$/m)
    expect(listed).not.toMatch(/integration\//)
  })

  it('is described the way the marketplace needs', () => {
    expect(manifest.publisher).toBeTruthy()
    expect(manifest.engines.vscode).toMatch(/^\^1\.\d+\.0$/)
    expect(manifest.repository.directory).toBe('extensions/vscode')
    expect(contributes.configuration.properties['idocs.updateDelay'].default).toBe(250)
  })
})
