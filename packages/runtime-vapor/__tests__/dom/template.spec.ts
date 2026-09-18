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

describe('children that render nothing', () => {
  // The single newline the compiler drops after <pre> leaves an empty text
  // node in the ast, and an empty literal renders nothing at all. Neither has
  // a node in the template string, so the children after them must still be
  // located - and updated - at the right position. (<textarea> loses its
  // newline the same way, but being RCDATA it never has an element child.)
  test.each([
    ['<pre>\n<b>{{ data }}</b></pre>', '<pre><b>bar</b></pre>'],
    ['<pre>\r\n<b>{{ data }}</b></pre>', '<pre><b>bar</b></pre>'],
    ['<pre>\n<code>{{ data }}</code>\n</pre>', '<pre><code>bar</code>\n</pre>'],
    ['<pre>\n<b>x</b>{{ data }}</pre>', '<pre><b>x</b>bar</pre>'],
    [
      '<div><pre>\n<b>{{ data }}</b></pre><i>{{ data }}</i></div>',
      '<div><pre><b>bar</b></pre><i>bar</i></div>',
    ],
    [
      '<pre>\n<b>{{ data }}</b><select><option>1</option></select></pre>',
      '<pre><b>bar</b><select><option>1</option></select></pre>',
    ],
    [`<div>{{ '' }}<b>{{ data }}</b></div>`, '<div><b>bar</b></div>'],
    [
      `<div><b>{{ data }}</b>{{ '' }}<i>{{ data }}</i></div>`,
      '<div><b>bar</b><i>bar</i></div>',
    ],
  ])('%j renders as %j in both modes', async (tpl, expected) => {
    const { vdom, vapor } = await renderParity(
      { App: `<template>${tpl}</template>` },
      () => ref('foo'),
      data => {
        data.value = 'bar'
      },
    )
    expect(vdom.after).toBe(expected)
    expect(vapor.after).toBe(expected)
  })

  // Such a child must not count as the last one that materializes either: the
  // block before it is then an append rather than an anchored insert, so no
  // `<!>` placeholder is left behind in the dom.
  test.each([
    [
      `<div><template><q>{{ data }}</q></template>{{ '' }}</div>`,
      '<div><template></template></div>',
    ],
    [
      `<div><Transition><b>{{ data }}</b></Transition>{{ '' }}</div>`,
      '<div><b>bar</b></div>',
    ],
    [
      `<div><KeepAlive><b>{{ data }}</b></KeepAlive>{{ '' }}</div>`,
      '<div><b>bar</b></div>',
    ],
  ])('%j leaves no anchor behind in both modes', async (tpl, expected) => {
    const { vdom, vapor } = await renderParity(
      { App: `<template>${tpl}</template>` },
      () => ref('foo'),
      data => {
        data.value = 'bar'
      },
    )
    expect(vdom.after).toBe(expected)
    expect(vapor.after).toBe(expected)
  })
})

describe('character references in static templates', () => {
  // The compiler resolves the references while parsing the template, and vapor
  // hands its template string to the html parser again at runtime. Whatever is
  // left in that string must therefore survive a second parse unchanged.
  test.each([
    // static attribute values
    [
      '<a href="/x?q=1&amp;amp;lang">z</a>',
      '<a href="/x?q=1&amp;amp;lang">z</a>',
    ],
    ['<a title="&amp;nbsp;">z</a>', '<a title="&amp;nbsp;">z</a>'],
    ['<a title="&#38;copy;">z</a>', '<a title="&amp;copy;">z</a>'],
    ['<a title="&amp;lt">z</a>', '<a title="&amp;lt">z</a>'],
    ['<div title="a &amp;lt; b">z</div>', '<div title="a &amp;lt; b">z</div>'],
    ['<div data-x=&amp;lt;>z</div>', '<div data-x="&amp;lt;">z</div>'],
    ['<div v-pre title="&amp;lt;">z</div>', '<div title="&amp;lt;">z</div>'],
    [
      '<svg><rect data-x="&amp;lt;"></rect></svg>',
      '<svg><rect data-x="&amp;lt;"></rect></svg>',
    ],
    [
      '<textarea placeholder="&amp;lt;"></textarea>',
      '<textarea placeholder="&amp;lt;"></textarea>',
    ],
    // text that would otherwise be parsed as markup
    ['&lt;b&gt;hi&lt;/b&gt;', '&lt;b&gt;hi&lt;/b&gt;'],
    ['&lt;/div&gt;tail', '&lt;/div&gt;tail'],
    ['&lt;!--c--&gt;tail', '&lt;!--c--&gt;tail'],
    [
      '<template v-if="true">&lt;b&gt;x&lt;/b&gt;</template>',
      '&lt;b&gt;x&lt;/b&gt;',
    ],
    // comment data is raw text, the parser resolves nothing inside a comment
    ['<div><!--a & b--></div>', '<div><!--a & b--></div>'],
    ['<div><!--a < b--></div>', '<div><!--a < b--></div>'],
    ['<div><!--a " b--></div>', '<div><!--a " b--></div>'],
    ["<div><!--a ' b--></div>", "<div><!--a ' b--></div>"],
    ['<div><!--&lt;--></div>', '<div><!--&lt;--></div>'],
    ['<div><!--<b class="x">--></div>', '<div><!--<b class="x">--></div>'],
    ['<!--a & b-->', '<!--a & b-->'],
    ['<div><!--x---></div>', '<div><!--x---></div>'],
    // untouched
    ['<a title="&amp;nope;">z</a>', '<a title="&amp;nope;">z</a>'],
    ['<div>&amp;lt;</div>', '<div>&amp;lt;</div>'],
    ['a&lt;b&gt;hi&lt;/b&gt;', 'a&lt;b&gt;hi&lt;/b&gt;'],
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
