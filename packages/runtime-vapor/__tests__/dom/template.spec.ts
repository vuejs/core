import { template } from '../../src/dom/template'
import { child, next, nextn } from '../../src/dom/node'

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

  test('next', () => {
    const t = template('<div><span></span><b></b><p></p></div>')
    const root = t()
    const span = child(root as ParentNode)
    const b = next(span)

    expect(span).toBe(root.childNodes[0])
    expect(b).toBe(root.childNodes[1])
    expect(nextn(span, 2)).toBe(root.childNodes[2])
    expect(next(b)).toBe(root.childNodes[2])
  })
})
