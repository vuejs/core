import { template } from '../../src/dom/template'
import { nextTick, ref } from '@vue/runtime-dom'
import { compile, makeRender } from '../_utils'
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
    const t = template('<div>', 1)
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

describe('createElement-backed children', () => {
  const define = makeRender()

  test('nested plain <template> element inserts and updates its children', async () => {
    const data = ref({ msg: 'a' })
    const { host } = define(
      compile(
        `<template><div><template><i>{{ data.msg }}</i></template><b/></div></template>`,
        data,
      ),
    ).render()
    // children are inserted as child nodes (like vdom's createElement path),
    // which template serialization does not show; the `<!>` placeholder that
    // anchored the insertion stays in place.
    expect(host.innerHTML).toBe(
      '<div><template></template><!----><b></b></div>',
    )
    const tpl = host.querySelector('template')!
    expect(tpl.childNodes.length).toBe(1)
    expect(tpl.firstChild!.textContent).toBe('a')

    data.value.msg = 'b'
    await nextTick()
    expect(tpl.firstChild!.textContent).toBe('b')
  })
})
