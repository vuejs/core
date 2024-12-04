import { children, next, template } from '../../src/dom/template'

describe('api: template', () => {
  test('create element', () => {
    const t = template('<div>')
    const root = t()
    expect(root).toBeInstanceOf(HTMLDivElement)

    const root2 = t()
    expect(root2).toBeInstanceOf(HTMLDivElement)
    expect(root2).not.toBe(root)
  })

  test('children', () => {
    const t = template('<div><span><b>nested</b></span><p></p></div>')
    const root = t()
    const span = children(root, 0)
    const b = children(span, 0)
    const p = children(root, 1)
    expect(span).toBe(root.firstChild)
    expect(b).toBe(root.firstChild!.firstChild)
    expect(p).toBe(root.firstChild!.nextSibling)
  })

  test('next', () => {
    const t = template('<div><span></span><b></b><p></p></div>')
    const root = t()
    const span = children(root, 0)
    const b = next(span, 1)

    expect(span).toBe(root.childNodes[0])
    expect(b).toBe(root.childNodes[1])
    expect(next(span, 2)).toBe(root.childNodes[2])
    expect(next(b, 1)).toBe(root.childNodes[2])
  })
})
