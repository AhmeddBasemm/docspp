import { describe, expect, it } from 'vitest'
import { scopeSvgIds } from '../src'

describe('scopeSvgIds', () => {
  it('leaves fragments without ids alone', () => {
    const body = '<path d="M0 0h8v8z" fill="#123"/>'
    expect(scopeSvgIds(body, 'x')).toBe(body)
  })

  it('renames ids and every kind of reference to them', () => {
    const body =
      '<defs><linearGradient id="a"/><clipPath id="c"/></defs>' +
      '<path fill="url(#a)" style="clip-path:url(&quot;#c&quot;)"/>' +
      '<use href="#a"/><use xlink:href="#c"/><rect stroke="url(\'#a\')"/>'
    const out = scopeSvgIds(body, 'k1')
    expect(out).toContain('id="k1-a"')
    expect(out).toContain('id="k1-c"')
    expect(out).toContain('fill="url(#k1-a)"')
    expect(out).toContain('<use href="#k1-a"/>')
    expect(out).toContain('<use xlink:href="#k1-c"/>')
    expect(out).toContain('stroke="url(\'#k1-a\')"')
    expect(out).not.toMatch(/id="a"|id="c"/)
  })

  it('does not mix up ids that start the same way', () => {
    const out = scopeSvgIds('<g id="a"/><g id="ab"/><p fill="url(#a)"/><p fill="url(#ab)"/>', 's')
    expect(out).toBe('<g id="s-a"/><g id="s-ab"/><p fill="url(#s-a)"/><p fill="url(#s-ab)"/>')
  })

  it('gives two instances of one icon ids that differ', () => {
    const body = '<linearGradient id="g"/><path fill="url(#g)"/>'
    expect(scopeSvgIds(body, 'one')).not.toBe(scopeSvgIds(body, 'two'))
  })
})
