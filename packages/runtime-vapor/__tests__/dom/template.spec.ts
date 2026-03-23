import { template } from '../../src/dom/template'
import { child, next, nthChild } from '../../src/dom/node'

describe('api: template', () => {
  test('create element', () => {
    const t = template('<div>')
    const root = t()
    expect(root).toBeInstanceOf(HTMLDivElement)

    const root2 = t()
    expect(root2).toBeInstanceOf(HTMLDivElement)
    expect(root2).not.toBe(root)
  })

  test('create root element', () => {
    const t = template('<div>', true)
    const root = t()
    expect(root.$root).toBe(true)
  })

  test('nthChild', () => {
    const t = template('<div><span><b>nested</b></span><p></p></div>')
    const root = t() as ParentNode
    const span = nthChild(root, 0) as ParentNode
    const b = nthChild(span, 0)
    const p = nthChild(root, 1)
    expect(span).toBe(root.firstChild)
    expect(b).toBe(root.firstChild!.firstChild)
    expect(p).toBe(root.firstChild!.nextSibling)
  })

  test('next', () => {
    const t = template('<div><span></span><b></b><p></p></div>')
    const root = t() as ParentNode
    const span = child(root as ParentNode)
    const b = next(span)

    expect(span).toBe(root.childNodes[0])
    expect(b).toBe(root.childNodes[1])
    expect(nthChild(root, 2)).toBe(root.childNodes[2])
    expect(next(b)).toBe(root.childNodes[2])
  })

  test('attribute quote omission', () => {
    {
      const t = template('<div id=foo class=bar alt=`<="foo></div>')
      const root = t() as HTMLElement

      expect(root.attributes).toHaveLength(3)
      expect(root.getAttribute('id')).toBe('foo')
      expect(root.getAttribute('class')).toBe('bar')
      expect(root.getAttribute('alt')).toBe('`<="foo')
    }

    {
      const t = template('<div id="foo>bar"class="has whitespace"></div>')
      const root = t() as HTMLElement

      expect(root.attributes).toHaveLength(2)
      expect(root.getAttribute('id')).toBe('foo>bar')
      expect(root.getAttribute('class')).toBe('has whitespace')
    }
  })
})
