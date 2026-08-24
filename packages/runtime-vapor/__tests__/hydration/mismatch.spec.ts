import {
  child,
  createComponent,
  createVaporSSRApp,
  defineVaporComponent,
  renderEffect,
  setStyle,
  setText,
  template,
  useVaporCssVars,
} from '../../src'
import { nextTick, ref } from '@vue/runtime-dom'
import { Namespaces } from '@vue/shared'
import { VueServerRenderer, compile, runtimeDom } from '../_utils'
import {
  currentHydrationNode,
  hydrateNode,
  setIsHydratingEnabled,
  validateHydrationTarget,
} from '../../src/dom/hydration'
import {
  compileVaporComponent,
  mountWithHydration,
  setupHydrationTest,
  testWithVaporApp,
} from './_helpers'

setupHydrationTest()

describe('mismatch handling', () => {
  test('text node', async () => {
    const foo = ref('bar')
    const { container } = await mountWithHydration(`foo`, `{{data}}`, foo)
    expect(container.textContent).toBe('bar')
    expect(`Hydration text mismatch`).toHaveBeenWarned()
  })

  test('element text content', async () => {
    const data = ref({ textContent: 'bar' })
    const { container } = await mountWithHydration(
      `<div>foo</div>`,
      `<div v-bind="data"></div>`,
      data,
    )
    expect(container.innerHTML).toBe('<div>bar</div>')
    expect(`Hydration text content mismatch`).toHaveBeenWarned()
  })

  // test('not enough children', () => {
  //   const { container } = mountWithHydration(`<div></div>`, () =>
  //     h('div', [h('span', 'foo'), h('span', 'bar')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div><span>foo</span><span>bar</span></div>',
  //   )
  //   expect(`Hydration children mismatch`).toHaveBeenWarned()
  // })
  // test('too many children', () => {
  //   const { container } = mountWithHydration(
  //     `<div><span>foo</span><span>bar</span></div>`,
  //     () => h('div', [h('span', 'foo')]),
  //   )
  //   expect(container.innerHTML).toBe('<div><span>foo</span></div>')
  //   expect(`Hydration children mismatch`).toHaveBeenWarned()
  // })
  test('complete mismatch', async () => {
    const data = ref('span')
    const { container } = await mountWithHydration(
      `<div>foo</div>`,
      `<component :is="data">foo</component>`,
      data,
    )
    expect(container.innerHTML).toBe('<span>foo</span><!--dynamic-component-->')
    expect(`Hydration node mismatch`).toHaveBeenWarned()
  })
  test('element mismatch should use client template static content', () => {
    const container = document.createElement('div')
    container.innerHTML =
      '<span class="server-only">server text</span><i>after</i>'

    setIsHydratingEnabled(true)
    try {
      hydrateNode(container.firstChild!, () => {
        const n0 = template(
          '<div class="client-only">client text</div>',
        )() as HTMLElement

        expect(n0).toBe(container.firstChild)
      })
    } finally {
      setIsHydratingEnabled(false)
    }

    expect(container.innerHTML).toBe(
      '<div class="client-only">client text</div><i>after</i>',
    )
    expect(`Hydration node mismatch`).toHaveBeenWarned()
  })
  test('element mismatch should apply dynamic props on recreated node', async () => {
    const data = ref('client-id')
    const { container } = await mountWithHydration(
      `<span id="server-id">foo</span>`,
      `<div :id="data">foo</div>`,
      data,
    )
    expect(container.innerHTML).toBe('<div id="client-id">foo</div>')
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    // recreated nodes never existed on the server, so no per-prop checks
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

    // cache must reflect the written value so later updates are not skipped
    data.value = 'updated-id'
    await nextTick()
    expect(container.innerHTML).toBe('<div id="updated-id">foo</div>')
  })
  test('element mismatch should apply dynamic class and style on recreated node', async () => {
    const data = ref({ cls: 'foo', style: { color: 'red' } })
    const { container } = await mountWithHydration(
      `<span class="server">foo</span>`,
      `<div :class="data.cls" :style="data.style">foo</div>`,
      data,
    )
    const el = container.firstChild as HTMLElement
    expect(el.className).toBe('foo')
    expect(el.style.color).toBe('red')
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    expect(`Hydration class mismatch`).not.toHaveBeenWarned()
    expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })
  test('element mismatch should write dynamic text without text mismatch warning', async () => {
    const data = ref('client text')
    const { container } = await mountWithHydration(
      `<p>server text</p>`,
      `<div>{{ data }}</div>`,
      data,
    )
    expect(container.innerHTML).toBe('<div>client text</div>')
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    expect(`Hydration text mismatch`).not.toHaveBeenWarned()
  })
  test('element mismatch should apply dynamic props on recreated descendants', async () => {
    const data = ref('child-id')
    const { container } = await mountWithHydration(
      `<p><b id="server">x</b></p>`,
      `<div><span :id="data">x</span></div>`,
      data,
    )
    expect(container.innerHTML).toBe('<div><span id="child-id">x</span></div>')
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })
  test('element mismatch with shared tag prefix should be detected', async () => {
    const data = ref('foo')
    const { container } = await mountWithHydration(
      `<i>x</i>`,
      `<ins :id="data">x</ins>`,
      data,
    )
    expect(container.innerHTML).toBe('<ins id="foo">x</ins>')
    expect(`Hydration node mismatch`).toHaveBeenWarned()
  })
  test('element mismatch should not break following component hydration', async () => {
    const data = ref('initial')
    const appCode = `<template>
      <div>
        <components.First />
        <components.Second />
      </div>
    </template>`

    const ssrComponents: Record<string, any> = {}
    ssrComponents.First = compile(
      `<template><span>{{ data }}</span></template>`,
      data,
      ssrComponents,
      { vapor: true, ssr: true },
    )
    ssrComponents.Second = compile(
      `<template><i>{{ data }}</i></template>`,
      data,
      ssrComponents,
      { vapor: true, ssr: true },
    )
    const serverComp = compile(appCode, data, ssrComponents, {
      vapor: true,
      ssr: true,
    })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
    )

    const clientComponents: Record<string, any> = {}
    clientComponents.First = compile(
      `<template><p>{{ data }}</p></template>`,
      data,
      clientComponents,
      { vapor: true },
    )
    clientComponents.Second = compile(
      `<template><i>{{ data }}</i></template>`,
      data,
      clientComponents,
      { vapor: true },
    )
    const clientComp = compile(appCode, data, clientComponents, {
      vapor: true,
    })
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    createVaporSSRApp(clientComp).mount(container)

    expect(container.innerHTML).toBe('<div><p>initial</p><i>initial</i></div>')
    expect(`Hydration node mismatch`).toHaveBeenWarned()

    data.value = 'updated'
    await nextTick()
    expect(container.innerHTML).toBe('<div><p>updated</p><i>updated</i></div>')
  })
  test('static text content mismatch should warn', async () => {
    const { container } = await mountWithHydration(`server text`, `client text`)
    expect(container.textContent).toBe('client text')
    expect(`Hydration text mismatch`).toHaveBeenWarned()
  })
  test('v-if block should replace server empty branch', async () => {
    const data = ref(true)
    const { container } = await mountWithHydration(
      `<div><span>a</span><!----></div>`,
      `<div><span>a</span><p v-if="data">yes</p></div>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<div><span>a</span><p>yes</p><!--if--></div>',
    )
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  })
  test('fragment start mismatch warning labels the server node', () => {
    const container = document.createElement('div')
    container.innerHTML = '<!--[--><span>server</span><!--]-->'
    const warn = vi.spyOn(console, 'warn')

    setIsHydratingEnabled(true)
    try {
      hydrateNode(container.firstChild!, () => {
        validateHydrationTarget(currentHydrationNode!, '<div></div>')
      })
    } finally {
      setIsHydratingEnabled(false)
    }

    expect(`Hydration node mismatch`).toHaveBeenWarned()
    expect(
      warn.mock.calls.some(call => call.includes('(start of fragment)')),
    ).toBe(true)
  })
  test('dynamic component element mismatch should adopt slot children', async () => {
    const data = ref('foo')
    const { container } = await mountWithHydration(
      '<span><b>foo</b></span>',
      `<component :is="'div'"><b>{{ data }}</b></component>`,
      data,
    )

    expect(container.innerHTML).toBe(
      '<div><b>foo</b></div><!--dynamic-component-->',
    )
    expect(`Hydration node mismatch`).toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(
      '<div><b>bar</b></div><!--dynamic-component-->',
    )
  })
  test('dynamic component element mismatch should not adopt named slot children', async () => {
    const data = ref({ name: 'foo', msg: 'client' })
    const { container } = await mountWithHydration(
      '<span><b>stale</b></span>',
      `<component :is="'div'">
        <template v-slot:[data.name]>
          <b>{{ data.msg }}</b>
        </template>
      </component>`,
      data,
    )

    expect(container.innerHTML).toBe(
      '<div><!----></div><!--dynamic-component-->',
    )
    expect(`Hydration node mismatch`).toHaveBeenWarned()

    data.value = { name: 'default', msg: 'updated' }
    await nextTick()
    expect(container.innerHTML).toBe(
      '<div><b>updated</b><!----></div><!--dynamic-component-->',
    )
  })

  test('SVG child mismatch preserves namespace', () => {
    setIsHydratingEnabled(true)
    try {
      const container = document.createElement('div')
      container.innerHTML = `<svg><rect></rect></svg>`
      const svg = container.firstChild as SVGElement

      hydrateNode(svg.firstChild!, () => {
        template('<circle></circle>', 1, Namespaces.SVG)()
      })
      expect(`Hydration node mismatch`).toHaveBeenWarned()

      const circle = svg.firstChild as SVGElement
      expect(circle.localName).toBe('circle')
      expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg')
    } finally {
      setIsHydratingEnabled(false)
    }
  })

  test('MathML child mismatch preserves namespace', () => {
    setIsHydratingEnabled(true)
    try {
      const container = document.createElement('div')
      container.innerHTML = `<math><mn></mn></math>`
      const math = container.firstChild as MathMLElement

      hydrateNode(math.firstChild!, () => {
        template('<mi></mi>', 1, Namespaces.MATH_ML)()
      })
      expect(`Hydration node mismatch`).toHaveBeenWarned()

      const mi = math.firstChild as MathMLElement
      expect(mi.localName).toBe('mi')
      expect(mi.namespaceURI).toBe('http://www.w3.org/1998/Math/MathML')
    } finally {
      setIsHydratingEnabled(false)
    }
  })

  test('v-if empty branch should remove stale branch before trailing sibling', async () => {
    const code = `
      <div>
        <span v-if="data.show">shown</span>
        <i>{{ data.tail }}</i>
      </div>
    `
    const ssrData = ref({ show: true, tail: 'tail' })
    const clientData = ref({ show: false, tail: 'tail' })
    const SSRComp = compileVaporComponent(code, ssrData, undefined, true)
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(SSRComp),
    )

    const { container } = await mountWithHydration(html, code, clientData)

    expect(container.innerHTML).toBe('<div><!--if--><i>tail</i></div>')
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).toHaveBeenWarned()

    clientData.value.show = true
    clientData.value.tail = 'tail updated'
    await nextTick()
    expect(container.innerHTML).toBe(
      '<div><span>shown</span><!--if--><i>tail updated</i></div>',
    )
  })
  test('v-if empty branch should not break following component hydration', async () => {
    const code = `
      <div>
        <span v-if="data.show">shown</span>
        <components.Second />
      </div>
    `
    const ssrData = ref({ show: true, tail: 'tail' })
    const ssrComponents = {
      Second: compileVaporComponent(
        `<i>{{ data.tail }}</i>`,
        ssrData,
        undefined,
        true,
      ),
    }
    const SSRComp = compileVaporComponent(code, ssrData, ssrComponents, true)
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(SSRComp),
    )
    expect(html).toBe('<div><span>shown</span><i>tail</i></div>')

    const clientData = ref({ show: false, tail: 'tail' })
    const clientComponents = {
      Second: compileVaporComponent(`<i>{{ data.tail }}</i>`, clientData),
    }
    const { container } = await mountWithHydration(
      html,
      code,
      clientData,
      clientComponents,
    )

    expect(container.innerHTML).toBe('<div><!--if--><i>tail</i></div>')
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).toHaveBeenWarned()

    clientData.value.show = true
    clientData.value.tail = 'tail updated'
    await nextTick()
    expect(container.innerHTML).toBe(
      '<div><span>shown</span><!--if--><i>tail updated</i></div>',
    )
  })
  test('fragment mismatch removal', async () => {
    const data = ref({ items: [] as string[] })
    const { container } = await mountWithHydration(
      `<div><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>`,
      `<div>
        <div v-for="item in data.items" :key="item">foo</div>
        <div>baz</div>
      </div>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<div><!--[--><!--]--><div>baz</div></div>',
    )
    expect(`Hydration children mismatch`).toHaveBeenWarned()
  })
  test('fragment not enough children', async () => {
    const data = ref({ items: ['a', 'b'] })
    const { container } = await mountWithHydration(
      `<div><!--[--><div>foo</div><!--]--><div>baz</div></div>`,
      `<div>
        <div v-for="item in data.items" :key="item">foo</div>
        <div>baz</div>
      </div>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<div><!--[--><div>foo</div><div>foo</div><!--]--><div>baz</div></div>',
    )
    expect(`Hydration node mismatch`).toHaveBeenWarned()
  })
  test('fragment too many children', async () => {
    const data = ref({ items: ['a'] })
    const { container } = await mountWithHydration(
      `<div><!--[--><div>foo</div><div>foo</div><!--]--><div>baz</div></div>`,
      `<div>
        <div v-for="item in data.items" :key="item">foo</div>
        <div>baz</div>
      </div>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<div><!--[--><div>foo</div><!--]--><div>baz</div></div>',
    )
    expect(`Hydration children mismatch`).toHaveBeenWarned()
  })
  test('Teleport target has empty children', async () => {
    const teleportContainer = document.createElement('div')
    teleportContainer.id = 'teleport'
    document.body.appendChild(teleportContainer)
    await mountWithHydration(
      '<!--teleport start--><!--teleport end-->',
      `<teleport to="#teleport"><span>value</span></teleport>`,
    )
    expect(teleportContainer.innerHTML).toBe(`<span>value</span>`)
    expect(`Hydration children mismatch`).toHaveBeenWarned()
  })
  // test('comment mismatch (element)', () => {
  //   const { container } = mountWithHydration(`<div><span></span></div>`, () =>
  //     h('div', [createCommentVNode('hi')]),
  //   )
  //   expect(container.innerHTML).toBe('<div><!--hi--></div>')
  //   expect(`Hydration node mismatch`).toHaveBeenWarned()
  // })
  // test('comment mismatch (text)', () => {
  //   const { container } = mountWithHydration(`<div>foobar</div>`, () =>
  //     h('div', [createCommentVNode('hi')]),
  //   )
  //   expect(container.innerHTML).toBe('<div><!--hi--></div>')
  //   expect(`Hydration node mismatch`).toHaveBeenWarned()
  // })
  test('class mismatch', async () => {
    await mountWithHydration(
      `<div class="foo bar"></div>`,
      `<div :class="data"></div>`,
      ref(['foo', 'bar']),
    )

    await mountWithHydration(
      `<div class="foo bar"></div>`,
      `<div :class="data"></div>`,
      ref({ foo: true, bar: true }),
    )

    await mountWithHydration(
      `<div class="foo bar"></div>`,
      `<div :class="data"></div>`,
      ref('foo bar'),
    )

    // svg classes
    await mountWithHydration(
      `<svg class="foo bar"></svg>`,
      `<svg :class="data"></svg>`,
      ref('foo bar'),
    )

    // class with different order
    await mountWithHydration(
      `<div class="foo bar"></div>`,
      `<div :class="data"></div>`,
      ref('bar foo'),
    )
    expect(`Hydration class mismatch`).not.toHaveBeenWarned()

    // single root mismatch
    const { container: root } = await mountWithHydration(
      `<div class="foo bar"></div>`,
      `<div :class="data"></div>`,
      ref('baz'),
    )
    expect(root.innerHTML).toBe('<div class="foo bar"></div>')
    expect(`Hydration class mismatch`).toHaveBeenWarned()

    // multiple root mismatch
    const { container } = await mountWithHydration(
      `<div class="foo bar"></div><span/>`,
      `<div :class="data"></div><span/>`,
      ref('foo'),
    )
    expect(container.innerHTML).toBe('<div class="foo bar"></div><span></span>')
    expect(`Hydration class mismatch`).toHaveBeenWarned()
  })

  test('style mismatch', async () => {
    await mountWithHydration(
      `<div style="color:red;"></div>`,
      `<div :style="data"></div>`,
      ref({ color: 'red' }),
    )

    await mountWithHydration(
      `<div style="color:red;"></div>`,
      `<div :style="data"></div>`,
      ref('color:red;'),
    )

    // style with different order
    await mountWithHydration(
      `<div style="color:red; font-size: 12px;"></div>`,
      `<div :style="data"></div>`,
      ref(`font-size: 12px; color:red;`),
    )

    expect(`Hydration style mismatch`).not.toHaveBeenWarned()

    // single root mismatch
    const { container: root } = await mountWithHydration(
      `<div style="color:red;"></div>`,
      `<div :style="data"></div>`,
      ref({ color: 'green' }),
    )
    expect(root.innerHTML).toBe('<div style="color:red;"></div>')
    expect(`Hydration style mismatch`).toHaveBeenWarned()

    // multiple root mismatch
    const { container } = await mountWithHydration(
      `<div style="color:red;"></div><span/>`,
      `<div :style="data"></div><span/>`,
      ref({ color: 'green' }),
    )
    expect(container.innerHTML).toBe(
      '<div style="color:red;"></div><span></span>',
    )
    expect(`Hydration style mismatch`).toHaveBeenWarned()
  })

  test('style mismatch when no style attribute is present', async () => {
    const { container } = await mountWithHydration(
      `<div></div>`,
      `<div :style="data"></div>`,
      ref({ color: 'red' }),
    )
    expect(container.innerHTML).toBe('<div></div>')
    expect(`Hydration style mismatch`).toHaveBeenWarnedTimes(1)
  })

  test('style mismatch w/ v-show', async () => {
    await mountWithHydration(
      `<div style="color:red;display:none"></div>`,
      `<div v-show="data" style="color: red;"></div>`,
      ref(false),
    )
    expect(`Hydration style mismatch`).not.toHaveBeenWarned()

    // mismatch with single root
    const { container: root } = await mountWithHydration(
      `<div style="color:red;"></div>`,
      `<div v-show="data" style="color: red;"></div>`,
      ref(false),
    )
    expect(root.innerHTML).toBe(
      '<div style="color: red; display: none;"></div>',
    )
    expect(`Hydration style mismatch`).toHaveBeenWarned()

    // mismatch with multiple root
    const { container } = await mountWithHydration(
      `<div style="color:red;"></div><span/>`,
      `<div v-show="data.show" :style="data.style"></div><span/>`,
      ref({ show: false, style: 'color: red' }),
    )
    expect(container.innerHTML).toBe(
      '<div style="color: red; display: none;"></div><span></span>',
    )
    expect(`Hydration style mismatch`).toHaveBeenWarned()
  })

  test('attr mismatch', async () => {
    await mountWithHydration(
      `<div id="foo"></div>`,
      `<div :id="data"></div>`,
      ref('foo'),
    )

    await mountWithHydration(
      `<div spellcheck></div>`,
      `<div :spellcheck="data"></div>`,
      ref(''),
    )

    await mountWithHydration(
      `<div></div>`,
      `<div :id="data"></div>`,
      ref(undefined),
    )

    // boolean
    await mountWithHydration(
      `<select multiple></div>`,
      `<select :multiple="data"></select>`,
      ref(true),
    )

    await mountWithHydration(
      `<select multiple></div>`,
      `<select :multiple="data"></select>`,
      ref('multiple'),
    )

    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    const { container: missingAttr } = await mountWithHydration(
      `<div></div>`,
      `<div :id="data"></div>`,
      ref('foo'),
    )
    expect(missingAttr.innerHTML).toBe('<div></div>')
    expect(`Hydration attribute mismatch`).toHaveBeenWarnedTimes(1)

    const { container: changedAttr } = await mountWithHydration(
      `<div id="bar"></div>`,
      `<div :id="data"></div>`,
      ref('foo'),
    )
    expect(changedAttr.innerHTML).toBe('<div id="bar"></div>')
    expect(`Hydration attribute mismatch`).toHaveBeenWarnedTimes(2)
  })

  test('attr special case: textarea value', async () => {
    await mountWithHydration(
      `<textarea>foo</textarea>`,
      `<textarea :value="data"></textarea>`,
      ref('foo'),
    )

    await mountWithHydration(
      `<textarea></textarea>`,
      `<textarea :value="data"></textarea>`,
      ref(''),
    )
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

    await mountWithHydration(
      `<textarea>foo</textarea>`,
      `<textarea :value="data"></textarea>`,
      ref('bar'),
    )
    expect(`Hydration attribute mismatch`).toHaveBeenWarned()
  })

  test('<textarea> with newlines at the beginning', async () => {
    await mountWithHydration(
      `<textarea>\nhello</textarea>`,
      `<textarea :value="data"></textarea>`,
      ref('\nhello'),
    )

    await mountWithHydration(
      `<textarea>\nhello</textarea>`,
      `<textarea v-text="data"></textarea>`,
      ref('\nhello'),
    )

    await mountWithHydration(
      `<textarea>\nhello</textarea>`,
      `<textarea v-bind="data"></textarea>`,
      ref({ textContent: '\nhello' }),
    )
    expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  })

  test('<pre> with newlines at the beginning', async () => {
    await mountWithHydration(`<pre>\n</pre>`, `<pre>{{data}}</pre>`, ref('\n'))

    await mountWithHydration(
      `<pre>\n</pre>`,
      `<pre v-text="data"></pre>`,
      ref('\n'),
    )

    await mountWithHydration(
      `<pre>\n</pre>`,
      `<pre v-bind="data"></pre>`,
      ref({ textContent: '\n' }),
    )
    expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  })

  test('boolean attr handling', async () => {
    await mountWithHydration(
      `<input />`,
      `<input :readonly="data" />`,
      ref(false),
    )

    await mountWithHydration(
      `<input readonly />`,
      `<input :readonly="data" />`,
      ref(true),
    )

    await mountWithHydration(
      `<input readonly="readonly" />`,
      `<input :readonly="data" />`,
      ref(true),
    )
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })

  test('client value is null or undefined', async () => {
    await mountWithHydration(
      `<div></div>`,
      `<div :draggable="data"></div>`,
      ref(undefined),
    )
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    await mountWithHydration(`<input />`, `<input :type="data" />`, ref(null))
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })

  test('should not warn against object values', async () => {
    await mountWithHydration(`<input />`, `<input :from="data" />`, ref({}))
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })

  test('should not warn on falsy bindings of non-property keys', async () => {
    await mountWithHydration(
      `<button></button>`,
      `<button :href="data"></button>`,
      ref(undefined),
    )
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })

  test('should not warn on non-renderable option values', async () => {
    await mountWithHydration(
      `<select><option>hello</option></select>`,
      `<select><option :value="data">hello</option></select>`,
      ref(['foo']),
    )
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })

  test('should not warn css v-bind', async () => {
    const container = document.createElement('div')
    container.innerHTML = `<div style="--foo:red;color:var(--foo);" />`
    const app = createVaporSSRApp({
      setup() {
        useVaporCssVars(() => ({ foo: 'red' }))
        const n0 = template('<div></div>', 1)() as any
        renderEffect(() => setStyle(n0, { color: 'var(--foo)' }))
        return n0
      },
    })
    app.mount(container)
    expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })

  test('css vars should only be added to expected on component root dom', () => {
    const container = document.createElement('div')
    container.innerHTML = `<div style="--foo:red;"><div style="color:var(--foo);" /></div>`
    const app = createVaporSSRApp({
      setup() {
        useVaporCssVars(() => ({ foo: 'red' }))
        const n0 = template('<div><div></div></div>', 1)() as any
        const n1 = child(n0) as any
        renderEffect(() => setStyle(n1, { color: 'var(--foo)' }))
        return n0
      },
    })
    app.mount(container)
    expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })

  test('css vars support fallthrough', () => {
    const container = document.createElement('div')
    container.innerHTML = `<div style="padding: 4px;--foo:red;"></div>`
    const app = createVaporSSRApp({
      setup() {
        useVaporCssVars(() => ({ foo: 'red' }))
        return createComponent(Child)
      },
    })
    const Child = defineVaporComponent({
      setup() {
        const n0 = template('<div></div>', 1)() as any
        renderEffect(() => setStyle(n0, { padding: '4px' }))
        return n0
      },
    })
    app.mount(container)
    expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })

  test('css vars fallthrough mismatch when variable is missing', () => {
    const container = document.createElement('div')
    container.innerHTML = `<div style="padding: 4px;"></div>`
    const app = createVaporSSRApp({
      setup() {
        useVaporCssVars(() => ({ foo: 'red' }))
        return createComponent(Child)
      },
    })
    const Child = defineVaporComponent({
      setup() {
        const n0 = template('<div></div>', 1)() as any
        renderEffect(() => setStyle(n0, { padding: '4px' }))
        return n0
      },
    })
    app.mount(container)
    expect(`Hydration style mismatch`).toHaveBeenWarned()
  })

  // vapor directive does not have a created hook
  test('should not warn for directives that mutate DOM in created', () => {
    // const container = document.createElement('div')
    // container.innerHTML = `<div class="test red"></div>`
    // const vColor: ObjectDirective = {
    //   created(el, binding) {
    //     el.classList.add(binding.value)
    //   },
    // }
    // const app = createSSRApp({
    //   setup() {
    //     return () =>
    //       withDirectives(h('div', { class: 'test' }), [[vColor, 'red']])
    //   },
    // })
    // app.mount(container)
    // expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })

  test('escape css var name', () => {
    const container = document.createElement('div')
    container.innerHTML = `<div style="padding: 4px;--foo\\.bar:red;"></div>`
    const app = createVaporSSRApp({
      setup() {
        useVaporCssVars(() => ({ 'foo.bar': 'red' }))
        return createComponent(Child)
      },
    })
    const Child = defineVaporComponent({
      setup() {
        const n0 = template('<div></div>', 1)() as any
        renderEffect(() => setStyle(n0, { padding: '4px' }))
        return n0
      },
    })
    app.mount(container)
    expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })

  describe('static template', () => {
    beforeEach(() => {
      setIsHydratingEnabled(true)
    })

    afterEach(() => {
      setIsHydratingEnabled(false)
    })

    test('static element', async () => {
      const container = document.createElement('div')
      container.innerHTML = `<div><span>foo</span></div><span>after</span>`
      const msg = ref('after')

      hydrateNode(container.firstChild!, () => {
        const n0 = template('<div><span>foo', 2)() as HTMLElement
        const n1 = template('<span> </span>')() as HTMLElement
        const x1 = child(n1) as Text

        expect(n0).toBe(container.firstChild)
        expect(n1).toBe(container.lastChild)
        renderEffect(() => setText(x1, msg.value))
      })

      expect(container.innerHTML).toBe(
        `<div><span>foo</span></div><span>after</span>`,
      )
      msg.value = 'updated'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<div><span>foo</span></div><span>updated</span>`,
      )
    })

    test('static text', async () => {
      const container = document.createElement('div')
      container.innerHTML = `hello<span>after</span>`
      const msg = ref('after')

      hydrateNode(container.firstChild!, () => {
        const n0 = template('hello', 2)() as Text
        const n1 = template('<span> </span>')() as HTMLElement
        const x1 = child(n1) as Text

        expect(n0).toBe(container.firstChild)
        expect(n0.data).toBe('hello')
        expect(n1).toBe(container.lastChild)
        renderEffect(() => setText(x1, msg.value))
      })

      expect(container.innerHTML).toBe(`hello<span>after</span>`)
      msg.value = 'updated'
      await nextTick()
      expect(container.innerHTML).toBe(`hello<span>updated</span>`)
    })

    test('static comment', async () => {
      const container = document.createElement('div')
      container.innerHTML = `<!--foo--><span>after</span>`
      const msg = ref('after')

      hydrateNode(container.firstChild!, () => {
        const n0 = template('<!--foo-->', 2)() as Comment
        const n1 = template('<span> </span>')() as HTMLElement
        const x1 = child(n1) as Text

        expect(n0).toBe(container.firstChild)
        expect(n0.data).toBe('foo')
        expect(n1).toBe(container.lastChild)
        renderEffect(() => setText(x1, msg.value))
      })

      expect(container.innerHTML).toBe(`<!--foo--><span>after</span>`)
      msg.value = 'updated'
      await nextTick()
      expect(container.innerHTML).toBe(`<!--foo--><span>updated</span>`)
    })

    test('repeated adoptions clone the CSR cache only once', async () => {
      const container = document.createElement('div')
      container.innerHTML = `<span>s</span><span>s</span><span>after</span>`
      // factory created outside so it can be invoked again after hydration
      const t0 = template('<span>s</span>', 2)
      const msg = ref('after')

      const cloneSpy = vi.spyOn(Node.prototype, 'cloneNode')
      hydrateNode(container.firstChild!, () => {
        const n0 = t0() as HTMLElement
        // second adoption of the same factory, as in a static template
        // repeated by v-for
        const n1 = t0() as HTMLElement
        const n2 = template('<span> </span>')() as HTMLElement
        const x2 = child(n2) as Text

        expect(n0).toBe(container.childNodes[0])
        expect(n1).toBe(container.childNodes[1])
        renderEffect(() => setText(x2, msg.value))
      })
      expect(cloneSpy).toHaveBeenCalledTimes(1)
      cloneSpy.mockRestore()

      // post-hydration CSR mount comes from the cached clone and is detached
      const csr = t0() as HTMLElement
      expect(csr.outerHTML).toBe('<span>s</span>')
      expect(csr).not.toBe(container.childNodes[0])
      expect(csr.parentNode).toBe(null)

      msg.value = 'updated'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<span>s</span><span>s</span><span>updated</span>`,
      )
    })

    test('warns on static element tag mismatch', () => {
      const container = document.createElement('div')
      container.innerHTML = `<span>foo</span><span>after</span>`

      hydrateNode(container.firstChild!, () => {
        const n0 = template('<div>foo', 2)() as HTMLElement
        const n1 = template('<span>after', 2)() as HTMLElement

        expect(n0).toBe(container.firstChild)
        expect(n1).toBe(container.lastChild)
      })

      expect(`Hydration node mismatch`).toHaveBeenWarned()
    })

    test('warns on static first-node type mismatches', () => {
      const cases = [
        { server: `foo<span>after</span>`, client: '<div>foo' },
        { server: `<!--foo--><span>after</span>`, client: '<div>foo' },
        { server: `<div>foo</div><span>after</span>`, client: 'foo' },
      ]

      for (const { server, client } of cases) {
        const container = document.createElement('div')
        container.innerHTML = server

        hydrateNode(container.firstChild!, () => {
          template(client, 2)()
          template('<span>after', 2)()
        })
      }

      expect(`Hydration node mismatch`).toHaveBeenWarnedTimes(3)
    })

    test('does not warn static first-node mismatch when parent allows children mismatch', () => {
      const container = document.createElement('div')
      container.innerHTML = `<div data-allow-mismatch="children"><span>foo</span><span>after</span></div>`
      const parent = container.firstChild as HTMLElement

      hydrateNode(parent.firstChild!, () => {
        const n0 = template('<div>foo', 2)() as HTMLElement
        const n1 = template('<span>after', 2)() as HTMLElement

        expect(n0).toBe(parent.firstChild)
        expect(n1).toBe(parent.lastChild)
      })

      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('multi-root static nodes', async () => {
      const container = document.createElement('div')
      container.innerHTML = `<!--[--><div>one</div><p>two</p><!--]--><span>after</span>`
      const msg = ref('after')

      hydrateNode(container.firstChild!, () => {
        const n0 = template('<div>one', 2)() as HTMLElement
        const n1 = template('<p>two', 2)() as HTMLElement
        const n2 = template('<span> </span>')() as HTMLElement
        const x2 = child(n2) as Text

        expect(n0).toBe(container.childNodes[1])
        expect(n1).toBe(container.childNodes[2])
        expect(n2).toBe(container.lastChild)
        renderEffect(() => setText(x2, msg.value))
      })

      expect(container.innerHTML).toBe(
        `<!--[--><div>one</div><p>two</p><!--]--><span>after</span>`,
      )
      msg.value = 'updated'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--[--><div>one</div><p>two</p><!--]--><span>updated</span>`,
      )
    })

    test('stripped static template', async () => {
      const container = document.createElement('div')
      container.innerHTML = `<div>claimed</div><span>after</span>`
      const msg = ref('after')

      hydrateNode(container.firstChild!, () => {
        const n0 = template('', 2)() as HTMLElement
        const n1 = template('<span> </span>')() as HTMLElement
        const x1 = child(n1) as Text

        expect(n0).toBe(container.firstChild)
        expect(n1).toBe(container.lastChild)
        renderEffect(() => setText(x1, msg.value))
      })

      expect(container.innerHTML).toBe(`<div>claimed</div><span>after</span>`)
      msg.value = 'updated'
      await nextTick()
      expect(container.innerHTML).toBe(`<div>claimed</div><span>updated</span>`)
    })

    test('stripped static template can be cloned after hydration', () => {
      const container = document.createElement('div')
      container.innerHTML = `<div>claimed</div>`
      const t1 = template('', 3)
      let hydrated: HTMLElement

      hydrateNode(container.firstChild!, () => {
        hydrated = t1() as HTMLElement
        expect(hydrated).toBe(container.firstChild)
        expect((hydrated as any).$root).toBe(true)
      })

      hydrated!.textContent = 'mutated'

      const cloned = t1() as HTMLElement
      expect(cloned).not.toBe(hydrated!)
      expect((cloned as any).$root).toBe(true)
      expect(cloned.outerHTML).toBe(`<div>claimed</div>`)
    })
  })

  test('nested insertion hydration preserves outer sibling cursor', async () => {
    const { container, data } = await testWithVaporApp(
      `
      <template>
        <section><div><components.Child /></div><span>static</span></section>
        <section>{{ data }}</section>
      </template>
      `,
      {
        Child: '<template><a>child</a></template>',
      },
    )

    expect(container.innerHTML).toBe(
      `<!--[--><section><div><a>child</a></div><span>static</span></section><section>foo</section><!--]-->`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(
      `<!--[--><section><div><a>child</a></div><span>static</span></section><section>bar</section><!--]-->`,
    )
  })

  test('nested v-if hydration preserves outer sibling cursor', async () => {
    const { container, data } = await testWithVaporApp(`
      <template>
        <section><div><span v-if="true">child</span></div><span>static</span></section>
        <section>{{ data }}</section>
      </template>
    `)

    expect(container.innerHTML).toBe(
      `<!--[--><section><div><span>child</span></div><span>static</span></section><section>foo</section><!--]-->`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(
      `<!--[--><section><div><span>child</span></div><span>static</span></section><section>bar</section><!--]-->`,
    )
  })

  test('nested v-if hydration preserves same-root dynamic sibling and outer cursor', async () => {
    const { container, data } = await testWithVaporApp(`
      <template>
        <section><div><span v-if="true">child</span></div><span>{{ data }}</span></section>
        <section>{{ data }}</section>
      </template>
    `)

    expect(container.innerHTML).toBe(
      `<!--[--><section><div><span>child</span></div><span>foo</span></section><section>foo</section><!--]-->`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(
      `<!--[--><section><div><span>child</span></div><span>bar</span></section><section>bar</section><!--]-->`,
    )
  })

  test('nthChild hydration uses logical index after inserted sibling', async () => {
    const { container, data } = await testWithVaporApp(
      `
      <template>
        <div>
          <components.Child />
          <span>static</span>
          <p>static</p>
          <section>{{ data }}</section>
        </div>
      </template>
    `,
      {
        Child: '<template><a>child</a></template>',
      },
    )

    expect(container.innerHTML).toBe(
      `<div><a>child</a><span>static</span><p>static</p><section>foo</section></div>`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(
      `<div><a>child</a><span>static</span><p>static</p><section>bar</section></div>`,
    )
  })

  test('single-root nested v-if hydration keeps static siblings', async () => {
    const { container, data } = await testWithVaporApp(`
      <template>
        <main>
          <section><div><span v-if="true">child</span></div><span>static</span></section>
          <section>{{ data }}</section>
        </main>
      </template>
    `)

    expect(container.innerHTML).toBe(
      `<main><section><div><span>child</span></div><span>static</span></section><section>foo</section></main>`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(
      `<main><section><div><span>child</span></div><span>static</span></section><section>bar</section></main>`,
    )
  })

  test('nested v-for hydration preserves outer sibling cursor', async () => {
    const { container, data } = await testWithVaporApp(`
      <template>
        <section><div><span v-for="item in ['child']">{{ item }}</span></div><span>static</span></section>
        <section>{{ data }}</section>
      </template>
    `)

    expect(container.innerHTML).toBe(
      `<!--[--><section><div><!--[--><span>child</span><!--]--></div><span>static</span></section><section>foo</section><!--]-->`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(
      `<!--[--><section><div><!--[--><span>child</span><!--]--></div><span>static</span></section><section>bar</section><!--]-->`,
    )
  })

  test('nested slot hydration preserves outer sibling cursor', async () => {
    const { container, data } = await testWithVaporApp(
      `
      <template>
        <components.Wrapper><a>child</a></components.Wrapper>
      </template>
      `,
      {
        Wrapper: `
          <template>
            <section><div><slot /></div><span>static</span></section>
            <section>{{ data }}</section>
          </template>
        `,
      },
    )

    expect(container.innerHTML).toBe(
      `<!--[--><section><div><!--[--><a>child</a><!--]--></div><span>static</span></section><section>foo</section><!--]-->`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(
      `<!--[--><section><div><!--[--><a>child</a><!--]--></div><span>static</span></section><section>bar</section><!--]-->`,
    )
  })
})

describe('data-allow-mismatch', () => {
  test('element text content', async () => {
    const data = ref({ textContent: 'bar' })
    const { container } = await mountWithHydration(
      `<div data-allow-mismatch="text">foo</div>`,
      `<div v-bind="data"></div>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="text">bar</div>',
    )
    expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  })
  // test('not enough children', () => {
  //   const { container } = mountWithHydration(
  //     `<div data-allow-mismatch="children"></div>`,
  //     () => h('div', [h('span', 'foo'), h('span', 'bar')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div data-allow-mismatch="children"><span>foo</span><span>bar</span></div>',
  //   )
  //   expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  // })
  // test('too many children', () => {
  //   const { container } = mountWithHydration(
  //     `<div data-allow-mismatch="children"><span>foo</span><span>bar</span></div>`,
  //     () => h('div', [h('span', 'foo')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div data-allow-mismatch="children"><span>foo</span></div>',
  //   )
  //   expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  // })
  test('complete mismatch', async () => {
    const { container } = await mountWithHydration(
      `<div data-allow-mismatch="children"><div>foo</div></div>`,
      `<div><component :is="data">foo</component></div>`,
      ref('span'),
    )
    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="children"><span>foo</span><!--dynamic-component--></div>',
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })
  test('fragment mismatch removal', async () => {
    const data = ref({ items: [] as string[] })
    const { container } = await mountWithHydration(
      `<div data-allow-mismatch="children"><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>`,
      `<div data-allow-mismatch="children">
        <div v-for="item in data.items" :key="item">foo</div>
        <div>baz</div>
      </div>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="children"><!--[--><!--]--><div>baz</div></div>',
    )
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  })
  test('fragment not enough children', async () => {
    const data = ref({ items: ['a', 'b'] })
    const { container } = await mountWithHydration(
      `<div data-allow-mismatch="children"><!--[--><div>foo</div><!--]--><div>baz</div></div>`,
      `<div data-allow-mismatch="children">
        <div v-for="item in data.items" :key="item">foo</div>
        <div>baz</div>
      </div>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="children"><!--[--><div>foo</div><div>foo</div><!--]--><div>baz</div></div>',
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })
  test('fragment too many children', async () => {
    const data = ref({ items: ['a'] })
    const { container } = await mountWithHydration(
      `<div data-allow-mismatch="children"><!--[--><div>foo</div><div>foo</div><!--]--><div>baz</div></div>`,
      `<div data-allow-mismatch="children">
        <div v-for="item in data.items" :key="item">foo</div>
        <div>baz</div>
      </div>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="children"><!--[--><div>foo</div><!--]--><div>baz</div></div>',
    )
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  })
  // test('comment mismatch (element)', () => {
  //   const { container } = mountWithHydration(
  //     `<div data-allow-mismatch="children"><span></span></div>`,
  //     () => h('div', [createCommentVNode('hi')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div data-allow-mismatch="children"><!--hi--></div>',
  //   )
  //   expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  // })
  // test('comment mismatch (text)', () => {
  //   const { container } = mountWithHydration(
  //     `<div data-allow-mismatch="children">foobar</div>`,
  //     () => h('div', [createCommentVNode('hi')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div data-allow-mismatch="children"><!--hi--></div>',
  //   )
  //   expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  // })
  test('class mismatch', async () => {
    const data = ref('foo')
    const { container } = await mountWithHydration(
      `<section><div class="bar" data-allow-mismatch="class"></div></section>`,
      `<section><div :class="data"></div></section>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<section><div class="bar" data-allow-mismatch="class"></div></section>',
    )

    data.value = 'baz'
    await nextTick()
    expect(container.innerHTML).toBe(
      '<section><div class="baz" data-allow-mismatch="class"></div></section>',
    )
    expect(`Hydration class mismatch`).not.toHaveBeenWarned()
  })

  test('style mismatch', async () => {
    const data = ref({ color: 'green' })
    const { container } = await mountWithHydration(
      `<section><div style="color:red;" data-allow-mismatch="style"></div></section>`,
      `<section><div :style="data"></div></section>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<section><div style="color:red;" data-allow-mismatch="style"></div></section>',
    )

    data.value = { color: 'blue' }
    await nextTick()
    expect(container.innerHTML).toBe(
      '<section><div style="color: blue;" data-allow-mismatch="style"></div></section>',
    )
    expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })

  test('style mismatch w/ v-show', async () => {
    const data = ref(false)
    const { container } = await mountWithHydration(
      `<section><div style="color:red;" data-allow-mismatch="style"></div></section>`,
      `<section><div v-show="data" style="color: red;"></div></section>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<section><div style="color:red;" data-allow-mismatch="style"></div></section>',
    )

    data.value = true
    await nextTick()
    expect(container.innerHTML).toBe(
      '<section><div style="color:red;" data-allow-mismatch="style"></div></section>',
    )

    data.value = false
    await nextTick()
    expect(container.innerHTML).toBe(
      '<section><div style="color: red; display: none;" data-allow-mismatch="style"></div></section>',
    )
    expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })

  test('attr mismatch', async () => {
    const missing = ref('foo')
    const { container: missingContainer } = await mountWithHydration(
      `<section><div data-allow-mismatch="attribute"></div></section>`,
      `<section><div :id="data"></div></section>`,
      missing,
    )
    expect(missingContainer.innerHTML).toBe(
      '<section><div data-allow-mismatch="attribute"></div></section>',
    )

    missing.value = 'baz'
    await nextTick()
    expect(missingContainer.innerHTML).toBe(
      '<section><div data-allow-mismatch="attribute" id="baz"></div></section>',
    )

    const mismatched = ref('foo')
    const { container: mismatchedContainer } = await mountWithHydration(
      `<section><div id="bar" data-allow-mismatch="attribute"></div></section>`,
      `<section><div :id="data"></div></section>`,
      mismatched,
    )
    expect(mismatchedContainer.innerHTML).toBe(
      '<section><div id="bar" data-allow-mismatch="attribute"></div></section>',
    )

    mismatched.value = 'baz'
    await nextTick()
    expect(mismatchedContainer.innerHTML).toBe(
      '<section><div id="baz" data-allow-mismatch="attribute"></div></section>',
    )

    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })
})
