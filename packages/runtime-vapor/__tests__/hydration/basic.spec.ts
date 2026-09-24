import { createPlainElement, createVaporSSRApp } from '../../src'
import { nextTick, reactive, ref } from '@vue/runtime-dom'
import {
  formatHtml,
  mountWithHydration,
  setupHydrationTest,
  testHydration,
  triggerEvent,
} from './_helpers'
import { compile } from '../_utils'

setupHydrationTest()

describe('Vapor Mode hydration', () => {
  describe('text', () => {
    test('root text', async () => {
      const { data, container } = await testHydration(`
      <template>{{ data }}</template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"foo"`)

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"bar"`)
    })

    test('consecutive text nodes', async () => {
      const { data, container } = await testHydration(`
      <template>{{ data }}{{ data }}</template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"foofoo"`)

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"barbar"`)
    })

    test('consecutive text nodes with insertion anchor', async () => {
      const { data, container } = await testHydration(`
      <template><span/>{{ data }}{{ data }}<span/></template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span>foofoo<span></span><!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span>barbar<span></span><!--]-->
        "
      `,
      )
    })

    test('mixed text nodes', async () => {
      const { data, container } = await testHydration(`
      <template>{{ data }}A{{ data }}B{{ data }}</template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"fooAfooBfoo"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"barAbarBbar"`,
      )
    })

    test('mixed text nodes with insertion anchor', async () => {
      const { data, container } = await testHydration(`
      <template><span/>{{ data }}A{{ data }}B{{ data }}<span/></template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span>fooAfooBfoo<span></span><!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span>barAbarBbar<span></span><!--]-->
        "
      `,
      )
    })

    test('empty text node', async () => {
      const data = reactive({ txt: '' })
      const { container } = await testHydration(
        `<template><div>{{ data.txt }}</div></template>`,
        undefined,
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div></div>"`,
      )

      data.txt = 'foo'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div>"`,
      )
    })

    test('empty text node in slot', async () => {
      const data = reactive({ txt: '' })
      const { container } = await testHydration(
        `<template><components.Child>{{data.txt}}</components.Child></template>`,
        {
          Child: `<template><slot/></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><!--]-->
        "
      `,
      )

      data.txt = 'foo'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->foo<!--]-->
        "
      `,
      )
    })

    test('empty text node at root followed by an element', async () => {
      const data = reactive({ txt: '' })
      const { container } = await testHydration(
        `<template>{{ data.txt }}<span>s</span></template>`,
        undefined,
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>s</span><!--]-->
        "
      `,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.txt = 'foo'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->foo<span>s</span><!--]-->
        "
      `,
      )
    })
  })

  describe('element', () => {
    test('root comment', async () => {
      const { container } = await testHydration(`
      <template><!----></template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"<!---->"`)
      expect(`mismatch in <div>`).not.toHaveBeenWarned()
    })

    test('root with mixed element and text', async () => {
      const { container, data } = await testHydration(`
      <template> A<span>{{ data }}</span>{{ data }}</template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--> A<span>foo</span>foo<!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--> A<span>bar</span>bar<!--]-->
        "
      `,
      )
    })

    test('empty element', async () => {
      const { container } = await testHydration(`
      <template><div/></template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div></div>"`,
      )
      expect(`mismatch in <div>`).not.toHaveBeenWarned()
    })

    test('plain element fallback hydrates unresolved lowercase tag', async () => {
      const code = `
      <template>
        <center><span>{{ data }}</span></center>
        <span>after</span>
      </template>
    `
      const { container, data, html } = await testHydration(code)
      expect(formatHtml(html)).toMatchInlineSnapshot(
        `
        "
        <!--[--><center><span>foo</span></center><span>after</span><!--]-->
        "
      `,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><center><span>foo</span></center><span>after</span><!--]-->
        "
      `,
      )
      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><center><span>bar</span></center><span>after</span><!--]-->
        "
      `,
      )
      expect(`Failed to resolve component: center`).toHaveBeenWarned()
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('element with binding and text children', async () => {
      const { container, data } = await testHydration(`
      <template><div :class="data">{{ data }}</div></template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div class="foo">foo</div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div class="bar">bar</div>"`,
      )
    })

    test('element with elements children', async () => {
      const { container } = await testHydration(`
      <template>
        <div>
          <span>{{ data }}</span>
          <span :class="data" @click="data = 'bar'"/>
        </div>
      </template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>foo</span><span class="foo"></span></div>"`,
      )

      // event handler
      triggerEvent('click', container.querySelector('.foo')!)

      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>bar</span><span class="bar"></span></div>"`,
      )
    })

    test('custom element with children', async () => {
      const { container, data } = await testHydration(
        `<template><div><my-el><span>{{ data }}</span></my-el></div></template>`,
        undefined,
        undefined,
        {
          compilerOptions: { isCustomElement: tag => tag.startsWith('my-') },
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><my-el><span>foo</span></my-el></div>"`,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><my-el><span>bar</span></my-el></div>"`,
      )
    })

    test('custom element with multiple children and a following sibling', async () => {
      const { container, data } = await testHydration(
        `<template><div><my-el><span>{{ data }}</span><i>{{ data }}</i></my-el><b>{{ data }}</b></div></template>`,
        undefined,
        undefined,
        {
          compilerOptions: { isCustomElement: tag => tag.startsWith('my-') },
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><my-el><span>foo</span><i>foo</i></my-el><b>foo</b></div>"`,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><my-el><span>bar</span><i>bar</i></my-el><b>bar</b></div>"`,
      )
    })

    test('custom element with an initially empty text child', async () => {
      const data = ref('')
      const { container } = await testHydration(
        `<template><my-el>{{ data }}</my-el></template>`,
        undefined,
        data,
        {
          compilerOptions: { isCustomElement: tag => tag.startsWith('my-') },
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<my-el></my-el>"`,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.value = 'foo'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<my-el>foo</my-el>"`,
      )
    })

    test('custom element with an initially empty text child after another child', async () => {
      const data = ref('')
      const { container } = await testHydration(
        `<template><my-el><b>head</b>{{ data }}</my-el></template>`,
        undefined,
        data,
        {
          compilerOptions: { isCustomElement: tag => tag.startsWith('my-') },
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<my-el><b>head</b></my-el>"`,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.value = 'foo'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<my-el><b>head</b>foo</my-el>"`,
      )
    })

    test('custom element rendered by v-for', async () => {
      const { container, data } = await testHydration(
        `<template><div><my-el v-for="i in 2"><span>{{ data }}</span></my-el></div></template>`,
        undefined,
        undefined,
        {
          compilerOptions: { isCustomElement: tag => tag.startsWith('my-') },
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<div>
        <!--[--><my-el><span>foo</span></my-el><my-el><span>foo</span></my-el><!--]-->
        </div>"
      `)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<div>
        <!--[--><my-el><span>bar</span></my-el><my-el><span>bar</span></my-el><!--]-->
        </div>"
      `)
    })

    test('custom element with a block child before a template child', async () => {
      const { container, data } = await testHydration(
        `<template><my-el><components.Child/><span>{{ data }}</span></my-el></template>`,
        { Child: `<template><b>child</b></template>` },
        undefined,
        {
          compilerOptions: { isCustomElement: tag => tag.startsWith('my-') },
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<my-el><b>child</b><span>foo</span></my-el>"`,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<my-el><b>child</b><span>bar</span></my-el>"`,
      )
    })

    test('custom element followed by a root sibling', async () => {
      const { container, data } = await testHydration(
        `<template><my-el><span>{{ data }}</span></my-el><div>{{ data }}</div></template>`,
        undefined,
        undefined,
        {
          compilerOptions: { isCustomElement: tag => tag.startsWith('my-') },
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "
        <!--[--><my-el><span>foo</span></my-el><div>foo</div><!--]-->
        "
      `)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "
        <!--[--><my-el><span>bar</span></my-el><div>bar</div><!--]-->
        "
      `)
    })

    test('custom element with an initially empty text child before another child', async () => {
      const { container, data } = await testHydration(
        `<template><my-el>{{ data }}<b>tail</b></my-el></template>`,
        undefined,
        ref(''),
        {
          compilerOptions: { isCustomElement: tag => tag.startsWith('my-') },
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<my-el><b>tail</b></my-el>"`,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<my-el>bar<b>tail</b></my-el>"`,
      )
    })

    test('custom element with a v-for child before an initially empty text child', async () => {
      const { container, data } = await testHydration(
        `<template><my-el><span v-for="i in 2">{{ i }}</span>{{ data }}</my-el></template>`,
        undefined,
        ref(''),
        {
          compilerOptions: { isCustomElement: tag => tag.startsWith('my-') },
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<my-el>
        <!--[--><span>1</span><span>2</span><!--]-->
        </my-el>"
      `)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<my-el>
        <!--[--><span>1</span><span>2</span><!--]-->
        bar</my-el>"
      `)
    })

    test('element with ref', async () => {
      const { data, container } = await testHydration(
        `<template>
          <div ref="data">hi</div>
        </template>
      `,
        {},
        ref(null),
      )

      expect(data.value).toBe(container.firstChild)
    })
  })

  describe('force hydrate prop', async () => {
    test('force hydrate prop with `.prop` modifier', async () => {
      const { container } = await mountWithHydration(
        '<input type="checkbox">',
        `<input type="checkbox" .indeterminate="true"/>`,
      )
      expect((container.firstChild! as any).indeterminate).toBe(true)
    })

    test('force hydrate input v-model with non-string value bindings', async () => {
      const { container } = await mountWithHydration(
        '<input type="checkbox" value="true">',
        `<input type="checkbox" :true-value="true"/>`,
      )
      expect((container.firstChild as any)._trueValue).toBe(true)
    })

    test('force hydrate checkbox with indeterminate', async () => {
      const { container } = await mountWithHydration(
        '<input type="checkbox" indeterminate/>',
        `<input type="checkbox" :indeterminate="true"/>`,
      )
      expect((container.firstChild! as any).indeterminate).toBe(true)
    })

    test('force hydrate select option with non-string value bindings', async () => {
      const { container } = await mountWithHydration(
        '<select><option value="true">ok</option></select>',
        `<select><option :value="true">ok</option></select>`,
      )
      expect((container.firstChild!.firstChild as any)._value).toBe(true)
    })

    test('force hydrate select option with number value bindings', async () => {
      const { container } = await mountWithHydration(
        '<select><option value="1">ok</option></select>',
        `<select><option :value="1">ok</option></select>`,
      )
      expect((container.firstChild!.firstChild as any)._value).toBe(1)
    })

    test('force hydrate input v-model with number value bindings', async () => {
      const { container } = await mountWithHydration(
        '<input type="checkbox">',
        `<input type="checkbox" :true-value="1" :false-value="0"/>`,
      )
      expect((container.firstChild as any)._trueValue).toBe(1)
      expect((container.firstChild as any)._falseValue).toBe(0)
    })

    test('force hydrate input v-model with static value attributes', async () => {
      const { container } = await mountWithHydration(
        '<input type="checkbox">',
        `<input type="checkbox" true-value="yes" false-value="no"/>`,
      )
      const input = container.firstChild as HTMLInputElement
      expect((input as any)._trueValue).toBe('yes')
      expect((input as any)._falseValue).toBe('no')
      // written like vdom's forcePatch of value-like keys on an input
      expect(input.getAttribute('true-value')).toBe('yes')
      expect(input.getAttribute('false-value')).toBe('no')
    })

    test('checkbox v-model with static value attributes toggles after hydration', async () => {
      const { container, data } = await testHydration(
        `<template><div><input type="checkbox" v-model="data" true-value="yes" false-value="no"></div></template>`,
        undefined,
        ref('yes'),
      )
      const input = container.querySelector('input')!
      expect(input.checked).toBe(true)

      input.checked = false
      triggerEvent('change', input)
      await nextTick()
      expect(data.value).toBe('no')
    })

    test('checkbox v-model with number value bindings toggles after hydration', async () => {
      const { container, data } = await testHydration(
        `<template><div><input type="checkbox" v-model="data" :true-value="1" :false-value="0"></div></template>`,
        undefined,
        ref(1),
      )
      const input = container.querySelector('input')!
      expect(input.checked).toBe(true)

      input.checked = false
      triggerEvent('change', input)
      await nextTick()
      expect(data.value).toBe(0)
    })

    test('select v-model with number option values after hydration', async () => {
      const { container, data } = await testHydration(
        `<template><div><select v-model="data"><option :value="1">a</option><option :value="2">b</option></select></div></template>`,
        undefined,
        ref(1),
      )
      const select = container.querySelector('select')!
      expect(select.selectedIndex).toBe(0)

      select.selectedIndex = 1
      triggerEvent('change', select)
      await nextTick()
      expect(data.value).toBe(2)
    })

    test('select multiple v-model with number option values after hydration', async () => {
      const { container, data } = await testHydration(
        `<template><div><select multiple v-model="data"><option :value="1">a</option><option :value="2">b</option></select></div></template>`,
        undefined,
        ref([1]),
      )
      const select = container.querySelector('select')!
      expect(select.options[0].selected).toBe(true)
      expect(select.options[1].selected).toBe(false)

      select.options[1].selected = true
      triggerEvent('change', select)
      await nextTick()
      expect(data.value).toEqual([1, 2])
    })

    test('force hydrate v-bind with .prop modifiers', async () => {
      const { container } = await mountWithHydration(
        '<div .foo="true"/>',
        `<div v-bind="data"/>`,
        ref({ '.foo': true }),
      )
      expect((container.firstChild! as any).foo).toBe(true)
    })

    test('force hydrate custom element with dynamic props', () => {
      class MyElement extends HTMLElement {
        foo = ''
        constructor() {
          super()
        }
      }
      customElements.define('my-element-7203', MyElement)

      const msg = ref('bar')
      const container = document.createElement('div')
      container.innerHTML = '<my-element-7203></my-element-7203>'
      const app = createVaporSSRApp({
        setup() {
          return createPlainElement('my-element-7203', {
            foo: () => msg.value,
          })
        },
      })
      app.mount(container)
      expect((container.firstChild as any).foo).toBe(msg.value)
    })
  })

  test('empty interpolation before a multi-root component', async () => {
    const data = reactive({ txt: '' })
    const { container, html } = await testHydration(
      `<template>{{ data.txt }}<components.Child /></template>`,
      { Child: `<template>child<span>suffix</span></template>` },
      data,
    )

    expect(container.innerHTML).toBe(html)
    const text = container.childNodes[1]
    const childText = container.childNodes[3]
    expect(text.nodeType).toBe(3)
    expect(text.nodeValue).toBe('')
    expect(childText.nodeValue).toBe('child')
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration text mismatch`).not.toHaveBeenWarned()

    data.txt = 'prefix'
    await nextTick()
    expect(container.innerHTML).toBe(
      '<!--[-->prefix<!--[-->child<span>suffix</span><!--]--><!--]-->',
    )
    expect(container.childNodes[1]).toBe(text)
    expect(container.childNodes[3]).toBe(childText)

    data.txt = ''
    await nextTick()
    expect(container.innerHTML).toBe(html)
  })

  test.each([
    ['{{ data.txt }}<br>', 0, 'foo<br>', '<br>'],
    ['<br>{{ data.txt }}', 1, '<br>foo', '<br>'],
    ['<br><br>{{ data.txt }}', 2, '<br><br>foo', '<br><br>'],
  ])(
    'empty interpolation among element children: %s',
    async (template, index, updated, initial) => {
      const data = reactive({ txt: '' })
      const { container, html } = await testHydration(
        `<template><p>${template}</p></template>`,
        {},
        data,
      )

      expect(html).toBe(`<p>${initial}</p>`)
      expect(container.innerHTML).toBe(html)
      const p = container.firstChild!
      const text = p.childNodes[index]
      const br = container.querySelector('br')
      expect(text.nodeType).toBe(3)
      expect(text.nodeValue).toBe('')
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration text mismatch`).not.toHaveBeenWarned()

      data.txt = 'foo'
      await nextTick()
      expect(container.innerHTML).toBe(`<p>${updated}</p>`)
      expect(p.childNodes[index]).toBe(text)
      expect(container.querySelector('br')).toBe(br)

      data.txt = ''
      await nextTick()
      expect(container.innerHTML).toBe(html)
      expect(p.childNodes[index]).toBe(text)
    },
  )

  test('empty text positions preserve nested sibling references', async () => {
    const data = reactive({ before: '', after: '', title: 'one' })
    const { container, html } = await testHydration(
      `<template><div>
        <p><i/>{{ data.before }}<b :title="data.title"/>{{ data.after }}</p>
        <p><i/>{{ data.before }}<b :title="data.title"/>{{ data.after }}</p>
      </div></template>`,
      {},
      data,
    )

    expect(container.innerHTML).toBe(html)
    const parents = Array.from(container.querySelectorAll('p'))
    const children = parents.map(p => Array.from(p.childNodes))
    for (const nodes of children) {
      expect(nodes.map(n => n.nodeType)).toEqual([1, 3, 1, 3])
    }

    data.before = 'before'
    data.after = 'after'
    data.title = 'two'
    await nextTick()
    for (const [index, p] of parents.entries()) {
      expect(p.innerHTML).toBe('<i></i>before<b title="two"></b>after')
      children[index].forEach((child, i) => {
        expect(p.childNodes[i]).toBe(child)
      })
    }

    data.before = data.after = ''
    data.title = 'one'
    await nextTick()
    expect(container.innerHTML).toBe(html)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration text mismatch`).not.toHaveBeenWarned()
  })

  // the compiler drops the leading newline of <pre> per the html spec, and so
  // does the parser reading the server output, so the empty text node it
  // leaves behind must not shift the children after it
  test.each([
    ['<pre>\n<b>{{ data.txt }}</b></pre>', '<pre><b>foo</b></pre>'],
    [
      '<pre>\n<code>{{ data.txt }}</code>\n</pre>',
      '<pre><code>foo</code>\n</pre>',
    ],
    ['<pre>\n<b>{{ data.txt }}</b><i/></pre>', '<pre><b>foo</b><i></i></pre>'],
    [
      '<div><pre>\n<b>{{ data.txt }}</b></pre><i>{{ data.txt }}</i></div>',
      '<div><pre><b>foo</b></pre><i>foo</i></div>',
    ],
    [`<div>{{ '' }}<b>{{ data.txt }}</b></div>`, '<div><b>foo</b></div>'],
  ])('empty child among element children: %s', async (template, expected) => {
    const data = reactive({ txt: 'foo' })
    const { container, html } = await testHydration(
      `<template>${template}</template>`,
      {},
      data,
    )

    expect(html).toBe(expected)
    expect(container.innerHTML).toBe(html)

    data.txt = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(expected.replace(/foo/g, 'bar'))
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    expect(`Hydration text mismatch`).not.toHaveBeenWarned()
  })

  test.each([
    [
      '<b v-if="data.show">{{ data.txt }}</b>',
      '<pre><b>foo</b></pre>',
      '<pre><b>foo</b><!--if--></pre>',
      '<pre><b>bar</b><!--if--></pre>',
    ],
    [
      '<b v-for="i in data.list" :key="i">{{ data.txt }}</b>',
      '<pre><!--[--><b>foo</b><!--]--></pre>',
      '<pre><!--[--><b>foo</b><!--]--></pre>',
      '<pre><!--[--><b>bar</b><!--]--></pre>',
    ],
  ])(
    'block as the first child after a dropped newline: %s',
    async (block, ssr, hydrated, updated) => {
      const data = reactive({ txt: 'foo', show: true, list: [1] })
      const { container, html } = await testHydration(
        `<template><pre>\n${block}</pre></template>`,
        {},
        data,
      )

      expect(html).toBe(ssr)
      expect(container.innerHTML).toBe(hydrated)

      data.txt = 'bar'
      await nextTick()
      expect(container.innerHTML).toBe(updated)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    },
  )

  // A child that renders nothing takes no logical unit in the server output
  // either, so a block appended after it has to start one unit earlier than
  // the child count suggests - otherwise hydration walks off the end.
  test('block after a child that renders nothing', async () => {
    const data = reactive({ txt: 'foo', list: [1, 2] })
    const { container, html } = await testHydration(
      `<template><div><b>{{ data.txt }}</b>{{ '' }}<i v-for="i in data.list">x</i></div></template>`,
      {},
      data,
    )

    expect(html).toBe('<div><b>foo</b><!--[--><i>x</i><i>x</i><!--]--></div>')
    expect(container.innerHTML).toBe(html)

    data.txt = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(
      '<div><b>bar</b><!--[--><i>x</i><i>x</i><!--]--></div>',
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  })

  // the server markup cannot carry a dom property, so a `.prop` binding has to
  // be written on the client, as vdom does (runtime-core/src/hydration.ts)
  describe('.prop binding', () => {
    test('writes the dom property', async () => {
      const data = reactive({ n: 1 })
      const { container } = await testHydration(
        `<template><div :payload.prop="data.n"></div></template>`,
        {},
        data,
      )

      const el = container.firstChild as any
      expect(el.payload).toBe(1)

      data.n = 2
      await nextTick()
      expect(el.payload).toBe(2)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('writes the value property', async () => {
      const data = reactive({ txt: 'foo' })
      const { container } = await testHydration(
        `<template><div :value.prop="data.txt"></div></template>`,
        {},
        data,
      )

      const el = container.firstChild as any
      expect(el.value).toBe('foo')

      data.txt = 'bar'
      await nextTick()
      expect(el.value).toBe('bar')
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })
  })

  // the server can only render `value` as an attribute, which a <select>
  // ignores, so the binding has to select its option on the client
  test('select value binding', async () => {
    const data = reactive({ v: 'b' })
    const { container } = await testHydration(
      `<template><select :value="data.v"><option value="a">a</option><option value="b">b</option></select></template>`,
      {},
      data,
    )

    const el = container.firstChild as HTMLSelectElement
    expect(el.value).toBe('b')

    data.v = 'a'
    await nextTick()
    expect(el.value).toBe('a')
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  // a camelCase aria key compiles to a direct dom property write, which vdom
  // also performs during hydration; the lowercased `arialabel` is what the
  // server renders for it
  test('aria property binding', async () => {
    const data = reactive({ label: 'foo' })
    const { container, html } = await testHydration(
      `<template><div :ariaLabel="data.label"></div></template>`,
      {},
      data,
    )

    expect(html).toBe('<div arialabel="foo"></div>')
    const el = container.firstChild as HTMLElement
    expect(el.getAttribute('aria-label')).toBe('foo')

    data.label = 'bar'
    await nextTick()
    expect(el.getAttribute('aria-label')).toBe('bar')
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  // vdom writes every static-key binding during hydration (`dynamicProps`),
  // whether the compiler routes it to a property setter, to `setProp`, or
  // merges it with a spread; keys that only come from a spread stay untouched
  describe('static key bindings', () => {
    test('non-reflected property through setProp', async () => {
      const data = reactive({ idx: 1 })
      const { container } = await testHydration(
        `<template><select :selectedIndex="data.idx"><option>a</option><option>b</option></select></template>`,
        {},
        data,
      )

      const el = container.firstChild as HTMLSelectElement
      expect(el.selectedIndex).toBe(1)

      data.idx = 0
      await nextTick()
      expect(el.selectedIndex).toBe(0)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('unchanged resource url is not re-assigned', async () => {
      const data = reactive({ src: '/a.png' })
      const setSrc = vi.spyOn(HTMLImageElement.prototype, 'src', 'set')
      const { container } = await testHydration(
        `<template><img :src="data.src"></template>`,
        {},
        data,
      )

      expect(setSrc).not.toHaveBeenCalled()

      data.src = '/b.png'
      await nextTick()
      expect(setSrc).toHaveBeenCalledTimes(1)
      expect((container.firstChild as Element).getAttribute('src')).toBe(
        '/b.png',
      )
      setSrc.mockRestore()
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('merged with a spread', async () => {
      const data = reactive({ v: 'b', idx: 1, label: 'foo', attrs: {} })
      const { container } = await testHydration(
        `<template><div>` +
          `<select :value="data.v" v-bind="data.attrs"><option value="a">a</option><option value="b">b</option></select>` +
          `<select :selectedIndex="data.idx" v-bind="data.attrs"><option>a</option><option>b</option></select>` +
          `<span :ariaLabel="data.label" v-bind="data.attrs"></span>` +
          `</div></template>`,
        {},
        data,
      )

      const [byValue, byIndex] = Array.from(
        container.querySelectorAll('select'),
      )
      const span = container.querySelector('span')!
      expect(byValue.value).toBe('b')
      expect(byIndex.selectedIndex).toBe(1)
      expect(span.getAttribute('aria-label')).toBe('foo')

      data.v = 'a'
      data.idx = 0
      data.label = 'bar'
      await nextTick()
      expect(byValue.value).toBe('a')
      expect(byIndex.selectedIndex).toBe(0)
      expect(span.getAttribute('aria-label')).toBe('bar')
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('key that only comes from a spread is left alone', async () => {
      const data = reactive({ attrs: { value: 'b', 'data-foo': 'client' } })
      const { container } = await testHydration(
        `<template><select v-bind="data.attrs"><option value="a">a</option><option value="b">b</option></select></template>`,
        {},
        data,
        {
          serverData: reactive({ attrs: { value: 'b', 'data-foo': 'server' } }),
        },
      )

      const el = container.firstChild as HTMLSelectElement
      expect(el.value).toBe('a')
      expect(el.getAttribute('data-foo')).toBe('server')
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('mismatched attribute through setAttr takes the client value', async () => {
      const data = reactive({ v: 'client' })
      const { container } = await testHydration(
        `<template><div :spellcheck="data.v" :data-foo="data.v"></div></template>`,
        {},
        data,
        { serverData: reactive({ v: 'server' }) },
      )

      const el = container.firstChild as HTMLElement
      expect(el.getAttribute('spellcheck')).toBe('client')
      expect(el.getAttribute('data-foo')).toBe('client')
      expect(`Hydration attribute mismatch`).toHaveBeenWarned()
    })

    test('.attr merged with a spread', async () => {
      const data = reactive({ v: 'client', attrs: {} })
      const { container } = await testHydration(
        `<template><div :spellcheck.attr="data.v" v-bind="data.attrs"></div></template>`,
        {},
        data,
        { serverData: reactive({ v: 'server', attrs: {} }) },
      )

      expect(
        (container.firstChild as HTMLElement).getAttribute('spellcheck'),
      ).toBe('client')
      expect(`Hydration attribute mismatch`).toHaveBeenWarned()
    })

    // vdom does not list a constant in dynamicProps, so it is not re-applied
    test('dynamic element constant attribute is left alone', async () => {
      const { container } = await testHydration(
        `<template><component :is="'select'" selectedIndex="1"><option>a</option><option>b</option></component></template>`,
      )

      expect((container.firstChild as HTMLSelectElement).selectedIndex).toBe(0)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    // a static key group placed after the spread lives inside rawProps.$
    test('dynamic element', async () => {
      const data = reactive({ v: 'b', attrs: {} })
      const { container } = await testHydration(
        `<template><div>` +
          `<component :is="'select'" :value="data.v" v-bind="data.attrs"><option value="a">a</option><option value="b">b</option></component>` +
          `<component :is="'select'" v-bind="data.attrs" :value="data.v"><option value="a">a</option><option value="b">b</option></component>` +
          `</div></template>`,
        {},
        data,
      )

      const [before, after] = Array.from(container.querySelectorAll('select'))
      expect(before.value).toBe('b')
      expect(after.value).toBe('b')

      data.v = 'a'
      await nextTick()
      expect(before.value).toBe('a')
      expect(after.value).toBe('a')
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })
  })

  // vdom force patches innerHTML / textContent like any other static key
  // binding, so the client content replaces the server content
  describe('innerHTML / textContent bindings', () => {
    test.each([
      ['v-html', `<div v-html="data.v"></div>`, '<b>s</b>', '<b>c</b>'],
      ['.prop', `<div :innerHTML.prop="data.v"></div>`, '<b>s</b>', '<b>c</b>'],
      [':textContent', `<div :textContent="data.v"></div>`, 's', 'c'],
      [
        'merged with a spread',
        `<div :innerHTML="data.v" v-bind="data.attrs"></div>`,
        '<b>s</b>',
        '<b>c</b>',
      ],
    ])('%s takes the client content', async (_, el, server, client) => {
      const { container } = await testHydration(
        `<template><div>${el}</div></template>`,
        {},
        reactive({ v: client, attrs: {} }),
        { serverData: reactive({ v: server, attrs: {} }) },
      )

      expect((container.firstChild!.firstChild as HTMLElement).innerHTML).toBe(
        client,
      )
      if (el.includes('textContent')) {
        expect(`Hydration text content mismatch`).toHaveBeenWarned()
      }
    })

    // vdom force patches every key on a custom element, spread keys included
    test('spread key on a custom element takes the client content', async () => {
      const container = document.createElement('div')
      container.innerHTML =
        '<div><my-box>server</my-box><my-box>server</my-box></div>'
      const comp = compile(
        `<template><div><my-box v-bind="data.a"></my-box><my-box v-bind="data.b"></my-box></div></template>`,
        ref({
          a: { textContent: 'client' },
          b: { innerHTML: '<b>client</b>' },
        }),
        {},
        { compilerOptions: { isCustomElement: tag => tag.startsWith('my-') } },
      )
      createVaporSSRApp(comp).mount(container)

      expect(container.innerHTML).toBe(
        '<div><my-box>client</my-box><my-box><b>client</b></my-box></div>',
      )
      expect(`Hydration text content mismatch`).toHaveBeenWarned()
    })

    test('empty client content clears the server content', async () => {
      const { container } = await testHydration(
        `<template><div><div v-html="data.v"></div></div></template>`,
        {},
        reactive({ v: '' }),
        { serverData: reactive({ v: '<svg></svg>' }) },
      )

      expect(container.innerHTML).toBe('<div><div></div></div>')
    })
  })

  test('update after hydration removes the server checked attribute', async () => {
    const { container, data } = await testHydration(
      `<template><div><input type="checkbox" :checked="data"></div></template>`,
      undefined,
      ref(true),
    )
    expect(container.innerHTML).toBe(
      '<div><input type="checkbox" checked=""></div>',
    )

    data.value = false
    await nextTick()
    expect(container.innerHTML).toBe('<div><input type="checkbox"></div>')
  })
})
