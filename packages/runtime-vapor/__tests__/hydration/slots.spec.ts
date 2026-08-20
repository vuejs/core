import { createVaporSSRApp } from '../../src'
import { nextTick, reactive, ref } from '@vue/runtime-dom'
import { VueServerRenderer, compile, runtimeDom, runtimeVapor } from '../_utils'
import {
  compileVaporComponent,
  formatHtml,
  mountWithHydration,
  setupHydrationTest,
  testHydration,
} from './_helpers'

setupHydrationTest()

describe('Vapor Mode hydration', () => {
  describe('slots', () => {
    test('basic slot', async () => {
      const { data, container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data}}</span>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot/></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>foo</span><!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>bar</span><!--]-->
        "
      `,
      )
    })

    test('dynamic slot outlet update preserves slotted scope id', async () => {
      const data = ref({ slotName: 'one' })
      const childCode = `<template><slot :name="data.slotName" /></template>`
      const appCode = `<script setup vapor>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Child>
          <template #one><div>one</div></template>
          <template #two><section>two</section></template>
        </components.Child>
      </template>`

      const container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = `<!--[--><div child-s="">one</div><!--]-->`

      const clientComponents: Record<string, any> = {}
      clientComponents.Child = compile(childCode, data, clientComponents, {
        vapor: true,
        ssr: false,
      })
      clientComponents.Child.__scopeId = 'child'
      const ClientApp = compile(appCode, data, clientComponents, {
        vapor: true,
        ssr: false,
      })
      createVaporSSRApp(ClientApp).mount(container)

      expect(formatHtml(container.innerHTML)).toContain(
        `<div child-s="">one</div>`,
      )

      data.value = { slotName: 'two' }
      await nextTick()

      expect(formatHtml(container.innerHTML)).toContain(
        `<section child-s="">two</section>`,
      )
    })

    test('v-for slot content added after mount preserves slotted scope id', async () => {
      const data = ref(0)
      const childCode = `<template><slot /></template>`
      const appCode = `<script setup vapor>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Child>
          <div v-for="i in data">item</div>
          <i>tail</i>
        </components.Child>
      </template>`

      const container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = `<!--[--><!--[--><!--]--><i child-s="">tail</i><!--]-->`

      const clientComponents: Record<string, any> = {}
      clientComponents.Child = compile(childCode, data, clientComponents, {
        vapor: true,
        ssr: false,
      })
      clientComponents.Child.__scopeId = 'child'
      const ClientApp = compile(appCode, data, clientComponents, {
        vapor: true,
        ssr: false,
      })
      createVaporSSRApp(ClientApp).mount(container)

      expect(formatHtml(container.innerHTML)).toContain(
        `<i child-s="">tail</i>`,
      )

      data.value++
      await nextTick()

      expect(formatHtml(container.innerHTML)).toContain(
        `<div child-s="">item</div>`,
      )
    })

    test('vdom slot owner vapor slot content added after mount preserves slotted scope id', async () => {
      const show = ref(false)
      const childCode = `<template><div><slot /></div></template>`
      const appCode = `<script setup vapor>
        const show = _data
        const components = _components
      </script>
      <template>
        <components.Child>
          <button v-if="show">item</button>
        </components.Child>
      </template>`

      const ssrComponents: Record<string, any> = {}
      ssrComponents.Child = compile(childCode, show, ssrComponents, {
        vapor: false,
        ssr: true,
      })
      ssrComponents.Child.__scopeId = 'child'
      const ServerApp = compile(appCode, show, ssrComponents, {
        vapor: true,
        ssr: true,
      })
      const serverHtml = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(ServerApp),
      )
      const container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = serverHtml

      const clientComponents: Record<string, any> = {}
      clientComponents.Child = compile(childCode, show, clientComponents, {
        vapor: false,
        ssr: false,
      })
      clientComponents.Child.__scopeId = 'child'
      const ClientApp = compile(appCode, show, clientComponents, {
        vapor: true,
        ssr: false,
      })
      createVaporSSRApp(ClientApp)
        .use(runtimeVapor.vaporInteropPlugin)
        .mount(container)

      show.value = true
      await nextTick()

      expect(formatHtml(container.innerHTML)).toContain(
        `<button child-s="">item</button>`,
      )
    })

    test('named slot', async () => {
      const { data, container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo>
              <span>{{data}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot/><slot name="foo"/></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><!--]-->
        <!--[--><span>foo</span><!--]-->
        <!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><!--]-->
        <!--[--><span>bar</span><!--]-->
        <!--]-->
        "
      `,
      )
    })

    test('named slot with v-if', async () => {
      const { data, container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo v-if="data">
              <span>{{data}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot name="foo"/></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>foo</span><!--]-->
        "
      `,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><!--]-->
        "
      `,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "
        <!--[--><span>true</span><!--]-->
        "
      `)
    })

    test('named slot with initially empty v-if and trailing sibling', async () => {
      const data = reactive({
        show: false,
        msg: 'foo',
        tail: 'tail',
      })

      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo>
              <template v-if="data.show">
                <span>{{ data.msg }}</span>
              </template>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><div><slot name="foo"/></div><span>{{ data.tail }}</span></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>
        <!--[--><!--]-->
        <!--slot--></div><span>tail</span><!--]-->
        "
      `,
      )

      data.show = true
      data.msg = 'bar'
      data.tail = 'tail updated'
      await nextTick()

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>
        <!--[--><span>bar</span><!--]-->
        <!--slot--></div><span>tail updated</span><!--]-->
        "
      `,
      )

      data.show = false
      await nextTick()

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>
        <!--[--><!--]-->
        <!--slot--></div><span>tail updated</span><!--]-->
        "
      `,
      )
    })

    test('named slot with initially empty v-if and sibling inside slot content', async () => {
      const data = reactive({
        show: false,
        msgA: 'foo',
        msgB: 'bar',
        after: 'after',
        tail: 'tail',
      })

      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo>
              <template v-if="data.show">
                <span>{{ data.msgA }}</span>
                <b>{{ data.msgB }}</b>
              </template>
              <i>{{ data.after }}</i>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><div><slot name="foo"/></div><span>{{ data.tail }}</span></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>
        <!--[--><!----><i>after</i><!--]-->
        </div><span>tail</span><!--]-->
        "
      `,
      )

      data.show = true
      data.msgA = 'baz'
      data.msgB = 'qux'
      data.after = 'after updated'
      data.tail = 'tail updated'
      await nextTick()

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>
        <!--[--><span>baz</span><b>qux</b><!----><i>after updated</i><!--]-->
        </div><span>tail updated</span><!--]-->
        "
      `,
      )

      data.show = false
      await nextTick()

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>
        <!--[--><!----><i>after updated</i><!--]-->
        </div><span>tail updated</span><!--]-->
        "
      `,
      )
    })

    test('named slot with v-if and v-for', async () => {
      const data = reactive({
        show: true,
        items: ['a', 'b', 'c'],
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo v-if="data.show">
              <span v-for="item in data.items" :key="item">{{item}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot name="foo"/></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><span>a</span><span>b</span><span>c</span><!--]-->
        <!--]-->
        "
      `,
      )

      data.show = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><!--]-->
        "
      `,
      )

      data.show = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><span>a</span><span>b</span><span>c</span><!--for--><!--]-->
        "
      `,
      )
    })

    test('with insertion anchor', async () => {
      const { data, container } = await testHydration(
        `<template>
          <components.Child>
            <span/>
            <span>{{data}}</span>
            <span/>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot/></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span><span>foo</span><span></span><!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span><span>bar</span><span></span><!--]-->
        "
      `,
      )
    })

    test('with multi level anchor insertion', async () => {
      const { data, container } = await testHydration(
        `<template>
          <components.Child>
            <span/>
            <span>{{data}}</span>
            <span/>
          </components.Child>
        </template>`,
        {
          Child: `
          <template>
            <div/>
              <div/>
              <slot/>
              <div/>
            </div>
          </template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div></div><div></div>
        <!--[--><span></span><span>foo</span><span></span><!--]-->
        <div></div><!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div></div><div></div>
        <!--[--><span></span><span>bar</span><span></span><!--]-->
        <div></div><!--]-->
        "
      `,
      )
    })

    test('mixed slot and text node', async () => {
      const data = reactive({
        text: 'foo',
        msg: 'hi',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.text}}</span>
          </components.Child>
        </template>`,
        {
          Child: `<template><div><slot/>{{data.msg}}</div></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        hi</div>"
      `,
      )

      data.msg = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        bar</div>"
      `,
      )
    })

    test('mixed root slot and text node', async () => {
      const data = reactive({
        text: 'foo',
        msg: 'hi',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.text}}</span>
          </components.Child>
        </template>`,
        {
          Child: `<template>{{data.text}}<slot/>{{data.msg}}</template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->foo
        <!--[--><span>foo</span><!--]-->
        hi<!--]-->
        "
      `,
      )

      data.msg = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->foo
        <!--[--><span>foo</span><!--]-->
        bar<!--]-->
        "
      `,
      )
    })

    test('mixed consecutive slot and element', async () => {
      const data = reactive({
        text: 'foo',
        msg: 'hi',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo><span>{{data.text}}</span></template>
            <template #bar><span>bar</span></template>
          </components.Child>
        </template>`,
        {
          Child: `<template><div><slot name="foo"/><slot name="bar"/><div>{{data.msg}}</div></div></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        <!--[--><span>bar</span><!--]-->
        <div>hi</div></div>"
      `,
      )

      data.msg = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        <!--[--><span>bar</span><!--]-->
        <div>bar</div></div>"
      `,
      )
    })

    test('mixed slot and element', async () => {
      const data = reactive({
        text: 'foo',
        msg: 'hi',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.text}}</span>
          </components.Child>
        </template>`,
        {
          Child: `<template><div><slot/><div>{{data.msg}}</div></div></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        <div>hi</div></div>"
      `,
      )

      data.msg = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        <div>bar</div></div>"
      `,
      )
    })

    test('mixed slot and component', async () => {
      const data = reactive({
        msg1: 'foo',
        msg2: 'bar',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg1}}</span>
          </components.Child>
        </template>`,
        {
          Child: `
          <template>
            <div>
              <components.Child2/>
              <slot/>
              <components.Child2/>
            </div>
          </template>`,
          Child2: `
          <template>
            <div>{{data.msg2}}</div>
          </template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><div>bar</div>
        <!--[--><span>foo</span><!--]-->
        <div>bar</div></div>"
      `,
      )

      data.msg2 = 'hello'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><div>hello</div>
        <!--[--><span>foo</span><!--]-->
        <div>hello</div></div>"
      `,
      )
    })

    test('mixed slot and fragment component', async () => {
      const data = reactive({
        msg1: 'foo',
        msg2: 'bar',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg1}}</span>
          </components.Child>
        </template>`,
        {
          Child: `
          <template>
            <div>
              <components.Child2/>
              <slot/>
              <components.Child2/>
            </div>
          </template>`,
          Child2: `
          <template>
            <div>{{data.msg1}}</div> {{data.msg2}}
          </template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div>foo</div> bar<!--]-->
        <!--[--><span>foo</span><!--]-->
        <!--[--><div>foo</div> bar<!--]-->
        </div>"
      `,
      )

      data.msg1 = 'hello'
      data.msg2 = 'vapor'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div>hello</div> vapor<!--]-->
        <!--[--><span>hello</span><!--]-->
        <!--[--><div>hello</div> vapor<!--]-->
        </div>"
      `,
      )
    })

    test('mixed slot and v-if', async () => {
      const data = reactive({
        show: true,
        msg: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg}}</span>
          </components.Child>
        </template>`,
        {
          Child: `
          <template>
            <div v-if="data.show">{{data.msg}}</div>
            <slot/>
            <div v-if="data.show">{{data.msg}}</div>
          </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>foo</div><!--if-->
        <!--[--><span>foo</span><!--]-->
        <div>foo</div><!--if--><!--]-->
        "
      `,
      )

      data.show = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><!--if-->
        <!--[--><span>foo</span><!--]-->
        <!--if--><!--]-->
        "
      `,
      )

      data.show = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "
        <!--[--><div>foo</div><!--if-->
        <!--[--><span>foo</span><!--]-->
        <div>foo</div><!--if--><!--]-->
        "
      `)
    })

    test('mixed slot and v-for', async () => {
      const data = reactive({
        items: ['a', 'b', 'c'],
        msg: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg}}</span>
          </components.Child>
        </template>`,
        {
          Child: `
          <template>
            <div v-for="item in data.items" :key="item">{{item}}</div>
            <slot/>
            <div v-for="item in data.items" :key="item">{{item}}</div>
          </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><div>a</div><div>b</div><div>c</div><!--]-->
        <!--[--><span>foo</span><!--]-->
        <!--[--><div>a</div><div>b</div><div>c</div><!--]-->
        <!--]-->
        "
      `,
      )

      data.items.push('d')
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><div>a</div><div>b</div><div>c</div><div>d</div><!--]-->
        <!--[--><span>foo</span><!--]-->
        <!--[--><div>a</div><div>b</div><div>c</div><div>d</div><!--]-->
        <!--]-->
        "
      `,
      )
    })

    test('consecutive slots', async () => {
      const data = reactive({
        msg1: 'foo',
        msg2: 'bar',
      })

      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg1}}</span>
            <template #bar>
              <span>{{data.msg2}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot/><slot name="bar"/></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><span>foo</span><!--]-->
        <!--[--><span>bar</span><!--]-->
        <!--]-->
        "
      `,
      )

      data.msg1 = 'hello'
      data.msg2 = 'vapor'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><span>hello</span><!--]-->
        <!--[--><span>vapor</span><!--]-->
        <!--]-->
        "
      `,
      )
    })

    test('consecutive slots with insertion anchor', async () => {
      const data = reactive({
        msg1: 'foo',
        msg2: 'bar',
      })

      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg1}}</span>
            <template #bar>
              <span>{{data.msg2}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template>
            <div>
              <span/>
              <slot/>
              <slot name="bar"/>
              <span/>
            </div>
          </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><span>foo</span><!--]-->
        <!--[--><span>bar</span><!--]-->
        <span></span></div>"
      `,
      )

      data.msg1 = 'hello'
      data.msg2 = 'vapor'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><span>hello</span><!--]-->
        <!--[--><span>vapor</span><!--]-->
        <span></span></div>"
      `,
      )
    })

    test('consecutive slots prepend', async () => {
      const data = reactive({
        msg1: 'foo',
        msg2: 'bar',
        msg3: 'baz',
      })

      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo>
              <span>{{data.msg1}}</span>
            </template>
            <template #bar>
              <span>{{data.msg2}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template>
            <div>
              <slot name="foo"/>
              <slot name="bar"/>
              <div>{{data.msg3}}</div>
            </div>
          </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        <!--[--><span>bar</span><!--]-->
        <div>baz</div></div>"
      `,
      )

      data.msg1 = 'hello'
      data.msg2 = 'vapor'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>hello</span><!--]-->
        <!--[--><span>vapor</span><!--]-->
        <div>baz</div></div>"
      `,
      )
    })

    test('slot fallback', async () => {
      const data = reactive({
        foo: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot><span>{{data.foo}}</span></slot></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>foo</span><!--]-->
        "
      `,
      )

      data.foo = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>bar</span><!--]-->
        "
      `,
      )
    })

    test('slot fallback from empty v-if branch', async () => {
      const data = reactive({
        show: false,
        fallback: 'foo',
        slot: 'bar',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #default>
              <template v-if="data.show">
                <span>{{ data.slot }}</span>
              </template>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot><div>{{ data.fallback }}</div></slot></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>foo</div><!--]-->
        "
      `,
      )

      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.fallback = 'baz'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>baz</div><!--]-->
        "
      `,
      )

      data.show = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>bar</span><!--if--><!--]-->
        "
      `,
      )

      data.slot = 'qux'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>qux</span><!--if--><!--]-->
        "
      `,
      )
    })

    test('slot fallback leading empty branch keeps its own hydration anchor', async () => {
      const data = reactive({
        showSlot: false,
        showFallbackPrefix: false,
        fallback: 'foo',
        slot: 'bar',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #default>
              <template v-if="data.showSlot">
                <span>{{ data.slot }}</span>
              </template>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template>
            <slot>
              <i v-if="data.showFallbackPrefix">prefix</i>
              <div>{{ data.fallback }}</div>
            </slot>
          </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><!----><div>foo</div><!--]-->
        "
      `,
      )

      data.showFallbackPrefix = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><i>prefix</i><!----><div>foo</div><!--]-->
        "
      `,
      )

      data.showSlot = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>bar</span><!--if--><!--]-->
        "
      `,
      )

      data.showSlot = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><i>prefix</i><!--if--><div>foo</div><!--]-->
        "
      `,
      )
    })

    test('slot content hydrates over mismatched SSR fallback', async () => {
      const appCode = `<template>
        <components.Child>
          <template #default>
            <template v-if="data.showSlot">
              <span>{{ data.slot }}</span>
            </template>
          </template>
        </components.Child>
      </template>`
      const childCode = `<template>
        <slot>
          <div>{{ data.fallback }}</div>
          <i>suffix</i>
        </slot>
      </template>`
      const ssrData = ref({
        showSlot: false,
        fallback: 'foo',
        slot: 'bar',
      })
      const clientData = ref({
        showSlot: true,
        fallback: 'foo',
        slot: 'bar',
      })
      const ssrComponents: Record<string, any> = {}
      ssrComponents.Child = compile(childCode, ssrData, ssrComponents, {
        vapor: true,
        ssr: true,
      })
      const SSRComp = compile(appCode, ssrData, ssrComponents, {
        vapor: true,
        ssr: true,
      })
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      const clientComponents: Record<string, any> = {}
      clientComponents.Child = compile(
        childCode,
        clientData,
        clientComponents,
        {
          vapor: true,
        },
      )
      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      const clientComp = compile(appCode, clientData, clientComponents, {
        vapor: true,
      })
      const app = createVaporSSRApp(clientComp)
      app.mount(container)

      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(`Hydration children mismatch`).toHaveBeenWarned()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>bar</span><!--if--><!--]-->
        "
      `,
      )
    })

    test('slot fallback trailing empty branch keeps fallback DOM intact', async () => {
      const data = reactive({
        showSlot: false,
        showFallbackSuffix: false,
        fallback: 'foo',
        slot: 'bar',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #default>
              <template v-if="data.showSlot">
                <span>{{ data.slot }}</span>
              </template>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template>
            <slot>
              <div>{{ data.fallback }}</div>
              <i v-if="data.showFallbackSuffix">suffix</i>
            </slot>
          </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>foo</div><!----><!--]-->
        "
      `,
      )

      data.showFallbackSuffix = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>foo</div><i>suffix</i><!----><!--]-->
        "
      `,
      )

      data.showSlot = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>bar</span><!--if--><!--]-->
        "
      `,
      )
    })

    test('valid slot content keeps leading empty branch anchor before fallback', async () => {
      const data = reactive({
        showPrefix: false,
        tail: 'tail',
        fallback: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #default>
              <template v-if="data.showPrefix">
                <span>prefix</span>
              </template>
              <i>{{ data.tail }}</i>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot><div>{{ data.fallback }}</div></slot></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><!----><i>tail</i><!--]-->
        "
      `,
      )

      data.showPrefix = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>prefix</span><!----><i>tail</i><!--]-->
        "
      `,
      )
    })

    test('slot content mismatch recovery keeps leading empty branch anchor', async () => {
      const appCode = `<template>
        <components.Child>
          <template #default>
            <template v-if="data.showPrefix">
              <span>prefix</span>
            </template>
            <template v-if="data.showTail">
              <i>{{ data.tail }}</i>
            </template>
          </template>
        </components.Child>
      </template>`
      const childCode = `<template>
        <slot><div>{{ data.fallback }}</div></slot>
      </template>`
      // SSR renders fallback, but the client slot content wins. The leading
      // empty branch has no SSR content anchor to reuse, so hydration must
      // create one before the recovered content for future branch updates.
      const ssrData = ref({
        showPrefix: false,
        showTail: false,
        tail: 'tail',
        fallback: 'foo',
      })
      const clientData = ref({
        showPrefix: false,
        showTail: true,
        tail: 'tail',
        fallback: 'foo',
      })
      const ssrComponents: Record<string, any> = {}
      ssrComponents.Child = compile(childCode, ssrData, ssrComponents, {
        vapor: true,
        ssr: true,
      })
      const SSRComp = compile(appCode, ssrData, ssrComponents, {
        vapor: true,
        ssr: true,
      })
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      const clientComponents: Record<string, any> = {}
      clientComponents.Child = compile(
        childCode,
        clientData,
        clientComponents,
        {
          vapor: true,
        },
      )
      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      const clientComp = compile(appCode, clientData, clientComponents, {
        vapor: true,
      })
      const app = createVaporSSRApp(clientComp)
      app.mount(container)

      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><!--if--><i>tail</i><!--if--><!--]-->
        "
      `,
      )

      clientData.value.showPrefix = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>prefix</span><!--if--><i>tail</i><!--if--><!--]-->
        "
      `,
      )
    })

    test('slot fallback from empty v-for branch', async () => {
      const data = reactive({
        items: [] as string[],
        fallback: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #default>
              <span v-for="item in data.items" :key="item">{{ item }}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot><div>{{ data.fallback }}</div></slot></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>foo</div><!--]-->
        "
      `,
      )

      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.fallback = 'baz'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>baz</div><!--]-->
        "
      `,
      )

      data.items = ['bar', 'qux']
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>bar</span><span>qux</span><!--for--><!--]-->
        "
      `,
      )
    })

    test('slot content from empty v-for branch with trailing sibling', async () => {
      const data = reactive({
        items: [] as string[],
        tail: 'tail',
        fallback: 'fallback',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #default>
              <span v-for="item in data.items" :key="item">{{ item }}</span>
              <i>{{ data.tail }}</i>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template>
            <slot><div>{{ data.fallback }}</div></slot>
          </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><!--]-->
        <i>tail</i><!--]-->
        "
      `,
      )

      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.items = ['foo', 'bar']
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><span>foo</span><span>bar</span><!--]-->
        <i>tail</i><!--]-->
        "
      `,
      )

      data.tail = 'tail2'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><span>foo</span><span>bar</span><!--]-->
        <i>tail2</i><!--]-->
        "
      `,
      )
    })

    test('hydrate non-empty v-for over empty SSR range with trailing sibling', async () => {
      const ssrData = ref({
        items: [] as string[],
        tail: 'tail',
      })
      const clientData = ref({
        items: ['foo', 'bar'],
        tail: 'tail',
      })
      const code = `
        <div>
          <span v-for="item in data.items" :key="item">{{ item }}</span>
          <i>{{ data.tail }}</i>
        </div>
      `
      const SSRComp = compileVaporComponent(code, ssrData, undefined, true)
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )

      const { container } = await mountWithHydration(html, code, clientData)

      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(`Hydration text mismatch`).not.toHaveBeenWarned()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>\n<!--[--><span>foo</span><span>bar</span><!--]-->\n<i>tail</i></div>"`,
      )
    })

    test('slot fallback from invalid v-for branch', async () => {
      const data = reactive({
        items: [{ text: 'bar', show: false }],
        fallback: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #default>
              <template v-for="item in data.items" :key="item.text">
                <template v-if="item.show">
                  <span>{{ item.text }}</span>
                </template>
              </template>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot><div>{{ data.fallback }}</div></slot></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>foo</div><!--]-->
        "
      `,
      )

      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.fallback = 'baz'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>baz</div><!--]-->
        "
      `,
      )

      data.items[0].show = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>bar</span><!--if--><!--for--><!--]-->
        "
      `,
      )

      data.items[0].show = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>baz</div><!--]-->
        "
      `,
      )

      data.items[0].show = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>bar</span><!--if--><!--for--><!--]-->
        "
      `,
      )
    })

    test('slot content from multi-item invalid v-for branch keeps list order', async () => {
      const data = reactive({
        items: [
          { text: 'a', show: false },
          { text: 'b', show: false },
        ],
        tail: 'tail',
        fallback: 'fallback',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #default>
              <template v-for="item in data.items" :key="item.text">
                <template v-if="item.show">
                  <span>{{ item.text }}</span>
                </template>
              </template>
              <i>{{ data.tail }}</i>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template>
            <slot><div>{{ data.fallback }}</div></slot>
          </template>`,
        },
        data,
      )

      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "
        <!--[-->
        <!--[-->
        <!--[--><!----><!--]-->
        <!--[--><!----><!--]-->
        <!--]-->
        <i>tail</i><!--]-->
        "
      `)

      data.items.push({ text: 'c', show: true })
      await nextTick()

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[-->
        <!--[--><!----><!--]-->
        <!--[--><!----><!--]-->
        <span>c</span><!--if--><!--]-->
        <i>tail</i><!--]-->
        "
      `,
      )

      data.items[1].show = true
      await nextTick()

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[-->
        <!--[--><!----><!--]-->
        <!--[--><span>b</span><!----><!--]-->
        <span>c</span><!--if--><!--]-->
        <i>tail</i><!--]-->
        "
      `,
      )
    })
  })
})
