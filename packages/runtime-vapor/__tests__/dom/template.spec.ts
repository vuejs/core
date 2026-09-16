import { template } from '../../src/dom/template'
import { nextTick, ref } from '@vue/runtime-dom'
import { compile, makeRender, renderParity } from '../_utils'
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

describe('leading newline in <pre> and <textarea>', () => {
  // The compiler already drops the first newline after these start tags.
  // Vapor must preserve the remaining newlines when parsing its template again.
  test.each([
    // one newline is consumed by the compiler, the rest must be kept
    ['<pre>\n\nline</pre>', '<pre>\nline</pre>'],
    ['<pre>\n\n\nline</pre>', '<pre>\n\nline</pre>'],
    ['<textarea>\n\nline</textarea>', '<textarea>\nline</textarea>'],
    ['<pre>\n\n<b>text</b></pre>', '<pre>\n<b>text</b></pre>'],
    ['<pre>\n\n<b>{{ data }}</b></pre>', '<pre>\n<b>foo</b></pre>'],
    ['<div><pre>\n\nline</pre></div>', '<div><pre>\nline</pre></div>'],
    ['<pre>\n\n<pre>\n\nin</pre></pre>', '<pre>\n<pre>\nin</pre></pre>'],
    // untouched: nothing is left for the runtime parser to eat
    ['<pre>\nline</pre>', '<pre>line</pre>'],
    ['<textarea>\nline</textarea>', '<textarea>line</textarea>'],
    ['<pre>line\n\nmore</pre>', '<pre>line\n\nmore</pre>'],
    ['<div>\n\nline</div>', '<div> line</div>'],
  ])('%j renders as %j in both modes', async (tpl, expected) => {
    const { vdom, vapor } = await renderParity(
      { App: `<template>${tpl}</template>` },
      () => ref('foo'),
      () => {},
    )
    expect(vdom.after).toBe(expected)
    expect(vapor.after).toBe(expected)
  })
})
