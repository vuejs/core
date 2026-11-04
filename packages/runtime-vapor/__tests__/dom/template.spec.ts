import { template } from '../../src/dom/template'
import { nextTick, ref } from '@vue/runtime-dom'
import { compile, makeRender, renderParity, stripAnchors } from '../_utils'
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
    expect(root.$root).toBeTruthy()
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

describe('form children', () => {
  const define = makeRender()

  // the parser removes only the form element on `</form>`, so an abbreviated
  // child of the form would stay open and adopt the `<p>` that follows it,
  // leaving `next(form)` null
  test('next sibling of a form stays a sibling', async () => {
    const data = ref({ msg: 'hi' })
    const { host } = define(
      compile(
        `<template><section><form><div>x</div></form><p>{{ data.msg }}</p></section></template>`,
        data,
      ),
    ).render()
    expect(host.innerHTML).toBe(
      '<section><form><div>x</div></form><p>hi</p></section>',
    )

    data.value.msg = 'bye'
    await nextTick()
    expect(host.querySelector('p')!.textContent).toBe('bye')
  })

  test('a second form is not dropped', () => {
    const { host } = define(
      compile(
        `<template><section><div><form><input name="a"></form></div><div><form><input name="b"></form></div></section></template>`,
        ref({}),
      ),
    ).render()
    expect(host.querySelectorAll('form')).toHaveLength(2)
    expect(host.innerHTML).toBe(
      '<section><div><form><input name="a"></form></div>' +
        '<div><form><input name="b"></form></div></section>',
    )
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

describe('text children of a createElement-backed parent', () => {
  // These parents build their children with `createElement`/`createTextNode`
  // instead of an html string, so nothing parses their text a second time and
  // escaping it would put the escape sequence itself into the dom.
  const customElement = { isCustomElement: (tag: string) => tag === 'my-el' }

  test.each([
    ['<my-el>Tom &amp; Jerry</my-el>', '<my-el>Tom &amp; Jerry</my-el>'],
    ['<my-el>a &lt;&gt; b</my-el>', '<my-el>a &lt;&gt; b</my-el>'],
    ['<my-el>a &quot; b</my-el>', '<my-el>a " b</my-el>'],
    // the leading "<" guard: this text must stay text, not become markup
    [
      '<my-el>&lt;b&gt;x&lt;/b&gt;</my-el>',
      '<my-el>&lt;b&gt;x&lt;/b&gt;</my-el>',
    ],
    // a template-string-backed parent still needs its text escaped
    ['<div>Tom &amp; Jerry</div>', '<div>Tom &amp; Jerry</div>'],
    ['<div>&lt;b&gt;x&lt;/b&gt;</div>', '<div>&lt;b&gt;x&lt;/b&gt;</div>'],
  ])('plain text %j renders as %j in both modes', async (tpl, expected) => {
    const { vdom, vapor } = await renderParity(
      { App: `<template>${tpl}</template>` },
      () => ref('foo'),
      () => {},
      {},
      customElement,
    )
    expect(vdom.after).toBe(expected)
    expect(vapor.after).toBe(expected)
  })

  test.each([
    ['<my-el>{{ "Tom & Jerry" }}<i/></my-el>', 'Tom & Jerry'],
    ['<my-el>{{ "<b>x</b>" }}<i/></my-el>', '<b>x</b>'],
    ['<div>{{ "Tom & Jerry" }}<i/></div>', 'Tom & Jerry'],
  ])('folded interpolation %j renders text %j', async (tpl, expected) => {
    const { vdom, vapor } = await renderParity(
      { App: `<template>${tpl}</template>` },
      () => ref('foo'),
      () => {},
      {},
      customElement,
    )
    expect(vdom.text).toBe(expected)
    expect(vapor.text).toBe(expected)
  })

  // a nested plain <template> element is createElement-backed for the same
  // reason, without needing `isCustomElement`. Both modes append the text to
  // the element rather than to its `content`, which html serialization hides,
  // so compare the text.
  test('nested plain <template> element keeps its text raw', async () => {
    const tpl = `<div><template>Tom &amp; Jerry</template></div>`
    const { vdom, vapor } = await renderParity(
      { App: `<template>${tpl}</template>` },
      () => ref('foo'),
      () => {},
    )
    expect(vdom.text).toBe('Tom & Jerry')
    expect(vapor.text).toBe('Tom & Jerry')
  })
})

// Compare property writes and attributes with VDOM for bindings that cannot fold.
describe('constant props with no content attribute behind them', () => {
  // Plain <script setup> lets the compile option select the renderer.
  test('the two parity legs compile to different renderers', () => {
    const src =
      `<script setup>const data = _data</script>` +
      `<template><video :volume="0.5"></video></template>`
    expect(compile(src, ref(0), {}, { vapor: false }).__vapor).toBeUndefined()
    expect(compile(src, ref(0), {}, { vapor: true }).__vapor).toBe(true)
  })

  async function parity(tpl: string, key: string, selector: string) {
    const seen: Record<string, unknown> = {}
    const { vdom, vapor } = await renderParity(
      { App: `<template>${tpl}</template>` },
      () => ref(0),
      (_data, root, mode) => {
        const el = root.querySelector(selector) as any
        // HTML parsing lowercases folded attribute names.
        seen[mode] = { prop: el[key], attr: el.getAttribute(key.toLowerCase()) }
      },
    )
    expect(vapor.after).toBe(vdom.after)
    expect(seen.vapor).toEqual(seen.vdom)
    return seen.vdom
  }

  // Plain attributes use the same folding guard as constant bindings.
  const noAttr: Array<[string, string, string, Record<string, unknown>]> = [
    [
      `<video :volume="0.5"></video>`,
      'volume',
      'video',
      { prop: 0.5, attr: null },
    ],
    [
      `<video volume="0.5"></video>`,
      'volume',
      'video',
      { prop: 0.5, attr: null },
    ],
    [
      `<video :playbackRate="2"></video>`,
      'playbackRate',
      'video',
      { prop: 2, attr: null },
    ],
    [
      `<video :defaultPlaybackRate="2"></video>`,
      'defaultPlaybackRate',
      'video',
      { prop: 2, attr: null },
    ],
    [
      `<video :currentTime="3"></video>`,
      'currentTime',
      'video',
      { prop: 3, attr: null },
    ],
    [
      `<input type="number" :valueAsNumber="5">`,
      'valueAsNumber',
      'input',
      { prop: 5, attr: null },
    ],
  ]
  test.each(noAttr)(
    '%s writes the dom property and leaves the markup alone',
    async (tpl, key, selector, expected) => {
      expect(await parity(tpl, key, selector)).toEqual(expected)
    },
  )

  // Properties initialized by content attributes keep folding.
  const withAttr: Array<[string, string, string, Record<string, unknown>]> = [
    [`<input :value="'a'">`, 'value', 'input', { prop: 'a', attr: 'a' }],
    [`<input :checked="true">`, 'checked', 'input', { prop: true, attr: '' }],
    [`<div :hidden="true"></div>`, 'hidden', 'div', { prop: true, attr: '' }],
  ]
  test.each(withAttr)(
    '%s keeps folding into the template string',
    async (tpl, key, selector, expected) => {
      expect(await parity(tpl, key, selector)).toEqual(expected)
    },
  )

  test('valueAsNumber on a text input warns the way vdom does', async () => {
    await parity(`<input :valueAsNumber="5">`, 'valueAsNumber', 'input')
    expect(
      `Failed setting prop "valueAsNumber" on <input>`,
    ).toHaveBeenWarnedTimes(2)
  })
})

describe('DOM prop initialization order', () => {
  test('initializes option values before an explicit select value', async () => {
    await renderParity(
      {
        App: `<template><select :value="2"><option :value="1">One</option><option :disabled="data" :value="2">Two</option></select></template>`,
      },
      () => ref(false),
      (_data, root) => {
        const select = root.querySelector('select')!
        expect(select.value).toBe('2')
        expect(select.selectedIndex).toBe(1)
        expect(select.options[1].selected).toBe(true)
      },
    )
  })

  test.each([
    [`<input :type="data" :valueAsNumber="5">`, 'number', 5],
    [`<input :type="data" :valueAsNumber.prop="5">`, 'number', 5],
    [`<input type="range" :max="data" :valueAsNumber="500">`, 1000, 500],
    [`<input type="range" :max="data" :valueAsNumber.prop="500">`, 1000, 500],
  ])(
    'initializes preceding dynamic props before %s',
    async (tpl, initial, value) => {
      await renderParity(
        { App: `<template>${tpl}</template>` },
        () => ref(initial),
        (_data, root) => {
          const input = root.querySelector('input')!
          expect(input.valueAsNumber).toBe(value)
          expect(input.value).toBe(String(value))
        },
      )
    },
  )

  test('does not repeat constant setters on reactive updates', async () => {
    const setter = vi.spyOn(HTMLInputElement.prototype, 'valueAsNumber', 'set')
    try {
      await renderParity(
        {
          App: `<template><input :type="data.type" :valueAsNumber="5" :title="data.title"></template>`,
        },
        () => ref({ type: 'number', title: 'before' }),
        async (data, root) => {
          const input = root.querySelector('input')!
          expect(input.valueAsNumber).toBe(5)
          const initialCalls = setter.mock.calls.length
          input.value = '7'
          data.value.type = 'range'
          data.value.title = 'after'
          await nextTick()

          expect(input.type).toBe('range')
          expect(input.title).toBe('after')
          expect(input.valueAsNumber).toBe(7)
          expect(setter).toHaveBeenCalledTimes(initialCalls)
        },
      )
    } finally {
      setter.mockRestore()
    }
  })

  test.each([
    `<input :type="data.type" :valueAsNumber="5"><components.Child/>`,
    `<input v-for="type in data.types" :key="type" :type="type" :valueAsNumber="5">`,
    `<input v-for="type in data.types" :key="type" :type="type === data.type ? 'number' : 'range'" :valueAsNumber="5">`,
  ])('preserves prop order across block boundaries: %s', async tpl => {
    await renderParity(
      {
        App: `<template>${tpl}</template>`,
        Child: `<template><span/></template>`,
      },
      () => ref({ type: 'number', types: ['number'] }),
      (_data, root) => {
        expect(root.querySelector('input')!.valueAsNumber).toBe(5)
      },
    )
  })

  test.each([
    `<input type="range" :value="data.value" :max="data.max">`,
    `<input type="range" :max="data.max" :value="500">`,
    `<input type="range" v-bind="data">`,
    `<components.Child :value="data.value" :max="data.max"/>`,
  ])('sets value after max: %s', async tpl => {
    await renderParity(
      {
        App: `<template>${tpl}</template>`,
        Child: `<template><input type="range"></template>`,
      },
      () => ref({ value: 500, max: 1000 }),
      (_data, root) => {
        expect(root.querySelector('input')!.value).toBe('500')
      },
    )
  })

  test('sets a constant value after max past a constant setter', async () => {
    await renderParity(
      {
        App:
          `<script setup>const data = _data; const step = 1</script>` +
          `<template><input type="range" :max="data" :step="step" :value="500"></template>`,
      },
      () => ref(1000),
      (_data, root) => {
        expect(root.querySelector('input')!.value).toBe('500')
      },
    )
  })

  test('reapplies an unchanged value after max changes', async () => {
    // jsdom does not clamp the value when max changes, browsers do
    const { set } = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'max',
    )!
    const setter = vi
      .spyOn(HTMLInputElement.prototype, 'max', 'set')
      .mockImplementation(function (this: HTMLInputElement, max) {
        set!.call(this, max)
        this.value = this.value
      })
    try {
      await renderParity(
        { App: `<template><input type="range" v-bind="data"></template>` },
        () => ref({ value: 500, max: 1000 }),
        async (data, root) => {
          const input = root.querySelector('input')!
          expect(input.value).toBe('500')
          data.value = { value: 500, max: 100 }
          await nextTick()
          expect(input.value).toBe('100')
          data.value = { value: 500, max: 1000 }
          await nextTick()
          expect(input.value).toBe('500')
        },
      )
    } finally {
      setter.mockRestore()
    }
  })

  test.each([
    `<input type="range" :max="data" value="500">`,
    `<input type="range" :max="data" :value="'500'">`,
  ])('sets a static value after max: %s', async tpl => {
    await renderParity(
      { App: `<template>${tpl}</template>` },
      () => ref(1000),
      (_data, root) => {
        expect(root.querySelector('input')!.value).toBe('500')
      },
    )
  })
})

describe('descendants that close an open ancestor', () => {
  // The html parser closes an open `<p>`, `<li>`, `<a>`, ... at a start tag
  // deeper down, not only at a child one. VDOM builds these trees with the
  // dom api; the compiler has to keep such a descendant out of the html
  // string of its ancestors.
  test.each([
    [
      '<p><span><div>{{ data }}</div></span></p>',
      '<p><span><div>bar</div></span></p>',
    ],
    [
      '<p><span><div><section>{{ data }}</section></div></span></p>',
      '<p><span><div><section>bar</section></div></span></p>',
    ],
    [
      '<a href="#a"><div><a href="#b">{{ data }}</a></div></a>',
      '<a href="#a"><div><a href="#b">bar</a></div></a>',
    ],
    [
      '<ul><li><span><li>{{ data }}</li></span></li></ul>',
      '<ul><li><span><li>bar</li></span></li></ul>',
    ],
    [
      '<dl><dt><div><dd>{{ data }}</dd></div></dt></dl>',
      '<dl><dt><div><dd>bar</dd></div></dt></dl>',
    ],
    [
      '<form><table><tbody><tr><td><form><input :value="data"></form></td></tr></tbody></table></form>',
      '<form><table><tbody><tr><td><form><input value="bar"></form></td></tr></tbody></table></form>',
    ],
    [
      '<ruby><rt>a</rt><rt><rt>{{ data }}</rt></rt></ruby>',
      '<ruby><rt>a</rt><rt><rt>bar</rt></rt></ruby>',
    ],
    [
      '<p><button><div>{{ data }}</div></button></p>',
      '<p><button><div>bar</div></button></p>',
    ],
    [
      '<a><svg><foreignObject><a>x</a></foreignObject></svg><span>{{ data }}</span></a>',
      '<a><svg><foreignObject><a>x</a></foreignObject></svg><span>bar</span></a>',
    ],
    [
      '<form><svg><foreignObject><form>x</form></foreignObject></svg><span>{{ data }}</span></form>',
      '<form><svg><foreignObject><form>x</form></foreignObject></svg><span>bar</span></form>',
    ],
    [
      '<p><span><i>{{ data }}</i><div v-if="data === \'bar\'">{{ data }}</div></span></p>',
      '<p><span><i>bar</i><div>bar</div></span></p>',
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
    expect(stripAnchors(vapor.after)).toBe(expected)
  })
})

describe('special element under a parent whose end tag cannot close it', () => {
  test.each([
    [
      '<main><legend><div>x</div></legend><p>{{ data }}</p></main>',
      '<main><legend><div>x</div></legend><p>bar</p></main>',
    ],
    [
      '<div><audio><p>a</p></audio><p>{{ data }}</p></div>',
      '<div><audio><p>a</p></audio><p>bar</p></div>',
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
})

describe('nodes the html parser would move out of place', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const MATHML_NS = 'http://www.w3.org/1998/Math/MathML'
  test.each([
    ['<svg><div>{{ data }}</div></svg>', '<svg><div>bar</div></svg>', SVG_NS],
    [
      '<svg><g><div>{{ data }}</div></g></svg>',
      '<svg><g><div>bar</div></g></svg>',
      SVG_NS,
    ],
    [
      '<math><mrow><div>{{ data }}</div></mrow></math>',
      '<math><mrow><div>bar</div></mrow></math>',
      MATHML_NS,
    ],
    [
      '<table><tbody>foo<tr><td>{{ data }}</td></tr></tbody></table>',
      '<table><tbody>foo<tr><td>bar</td></tr></tbody></table>',
    ],
    [
      `<table>{{ 'x' }}<tbody><tr><td>{{ data }}</td></tr></tbody></table>`,
      '<table>x<tbody><tr><td>bar</td></tr></tbody></table>',
    ],
    // only ascii whitespace may stay in a table part
    [
      '<table>&nbsp;<tbody><tr><td>{{ data }}</td></tr></tbody></table>',
      '<table>&nbsp;<tbody><tr><td>bar</td></tr></tbody></table>',
    ],
  ] as [string, string, string?][])(
    '%j renders as %j in both modes',
    async (tpl, expected, ns) => {
      const { vdom, vapor } = await renderParity(
        { App: `<template>${tpl}</template>` },
        () => ref('foo'),
        (data, root) => {
          // created in the namespace it was written in, like vdom
          if (ns) expect(root.querySelector('div')!.namespaceURI).toBe(ns)
          data.value = 'bar'
        },
      )
      expect(vdom.after).toBe(expected)
      expect(stripAnchors(vapor.after)).toBe(expected)
    },
  )

  test('a custom element keeps the namespace of its foreign parent', async () => {
    const { vdom, vapor } = await renderParity(
      { App: `<template><svg><my-el>{{ data }}</my-el></svg></template>` },
      () => ref('foo'),
      (data, root) => {
        expect(root.querySelector('my-el')!.namespaceURI).toBe(SVG_NS)
        data.value = 'bar'
      },
      {},
      { isCustomElement: tag => tag === 'my-el' },
    )
    expect(vdom.after).toBe('<svg><my-el>bar</my-el></svg>')
    expect(vapor.after).toBe('<svg><my-el>bar</my-el></svg>')
  })
})
