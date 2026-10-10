import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProject } from '@the-package-labs/idocs-core/node'
import { beforeAll, describe, expect, it } from 'vitest'
import { packageName, scaffold } from '../src/scaffold'

// scripts/template.mjs is plain JavaScript shared with the build.
const { buildTemplate } = (await import('../../../scripts/template.mjs')) as {
  buildTemplate: (out: string, o?: { keepAliases?: boolean }) => string
}

let template: string
beforeAll(() => {
  template = buildTemplate(join(mkdtempSync(join(tmpdir(), 'idocs-tpl-')), 'template'), {
    keepAliases: true,
  })
})

const fresh = () => join(mkdtempSync(join(tmpdir(), 'idocs-new-')), 'my-new-docs')

describe('template', () => {
  it('has no workspace: versions, no placeholders, and ships the shared skill', () => {
    const pkg = JSON.parse(readFileSync(join(template, 'package.json'), 'utf8'))
    const specs = [
      ...Object.values(pkg.dependencies),
      ...Object.values(pkg.devDependencies),
    ] as string[]
    expect(specs.some((s) => s.startsWith('workspace:'))).toBe(false)
    expect(pkg.dependencies['@the-package-labs/idocs-astro']).toMatch(/^\^\d+\.\d+\.\d+$/)
    expect(existsSync(join(template, '.claude/skills/idocs/SKILL.md'))).toBe(true)
    // The whole skill travels, not just its entry file.
    expect(existsSync(join(template, '.claude/skills/idocs/references/format.md'))).toBe(true)
    expect(
      existsSync(join(template, '.claude/skills/idocs/assets/examples/shop.diagram.yaml')),
    ).toBe(true)
    expect(readFileSync(join(template, 'README.md'), 'utf8')).not.toContain('__DOCS_URL__')
    expect(existsSync(join(template, 'node_modules'))).toBe(false)
  })
})

describe('scaffold', () => {
  it('copies the template, restores dotfiles and names the package after the folder', () => {
    const target = fresh()
    const { name } = scaffold(template, target)
    expect(name).toBe('my-new-docs')
    expect(JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).name).toBe('my-new-docs')
    expect(existsSync(join(target, '.gitignore'))).toBe(true)
    expect(existsSync(join(target, '_gitignore'))).toBe(false)
    expect(existsSync(join(target, 'pnpm-workspace.yaml'))).toBe(true)
    expect(existsSync(join(target, '.github/workflows/deploy.yml'))).toBe(true)
  })

  it('produces diagrams that compile', () => {
    const target = fresh()
    scaffold(template, target)
    const project = loadProject(target)
    expect(project.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(project.diagrams.shop?.scenarios.map((s) => s.id)).toEqual([
      'browse',
      'checkout',
      'declined',
    ])
  })

  it('refuses a folder that already has files, and accepts an empty one', () => {
    const target = fresh()
    scaffold(template, target)
    expect(() => scaffold(template, target)).toThrow(/not empty/)
    const empty = mkdtempSync(join(tmpdir(), 'idocs-empty-'))
    expect(() => scaffold(template, empty)).not.toThrow()
    writeFileSync(join(empty, 'extra.txt'), 'x')
  })

  it('makes valid package names', () => {
    expect(packageName('My Docs!')).toBe('my-docs')
    expect(packageName('___')).toBe('my-docs')
    expect(packageName('Acme.Platform')).toBe('acme.platform')
  })
})
