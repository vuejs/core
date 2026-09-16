import { createPlainElement, createVaporSSRApp } from '../../src'
import { nextTick, reactive, ref } from '@vue/runtime-dom'
import {
  formatHtml,
  mountWithHydration,
  setupHydrationTest,
  testHydration,
  triggerEvent,
} from './_helpers'

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
})
