import { createVaporApp, createVaporSSRApp } from '../../src'
import { defineComponent, h, nextTick, reactive, ref } from '@vue/runtime-dom'
import { VueServerRenderer, compile, runtimeDom, runtimeVapor } from '../_utils'
import { setIsHydratingEnabled } from '../../src/dom/hydration'
import {
  compileVaporComponent,
  formatHtml,
  setupHydrationTest,
  testWithVDOMApp,
  testWithVaporApp,
} from './_helpers'

setupHydrationTest()

describe('VDOM interop', () => {
  // Previous tests (e.g. createVaporSSRApp) leave isHydratingEnabled = true.
  beforeEach(() => {
    setIsHydratingEnabled(false)
  })

  test('hydrate VDOM component returning Fragment', async () => {
    const data = ref('foo')
    const { container } = await testWithVaporApp(
      `<script setup>
        const data = _data; const components = _components;
      </script>
      <template>
        <components.VdomFragmentComp />
      </template>`,
      {
        // VDOM component that returns a Fragment (multiple root nodes)
        VdomFragmentComp: {
          code: `<script setup>const data = _data;</script>
            <template><div>first {{ data }}</div><div>second {{ data }}</div></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>first foo</div><div>second foo</div><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>first bar</div><div>second bar</div><!--]-->
      "
    `,
    )
  })

  test('hydrate handwritten multi-root VDOM component inside multi-root Vapor component', async () => {
    const first = ref('Hello')
    const second = ref('World')

    // Handwritten VDOM component that returns a Fragment (multi-root)
    const MultiRootVDOM = {
      setup() {
        return () => [
          runtimeDom.h('span', first.value),
          runtimeDom.h('span', second.value),
        ]
      },
    }

    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const MultiRootVDOM = _data.MultiRootVDOM
      </script>
      <template>
        <div>Before</div>
        <MultiRootVDOM />
        <div>After</div>
      </template>`,
      {},
      { MultiRootVDOM },
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[--><span>Hello</span><span>World</span><!--]-->
      <div>After</div><!--]-->
      "
    `,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    first.value = 'Updated'
    second.value = 'Again'
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[--><span>Updated</span><span>Again</span><!--]-->
      <div>After</div><!--]-->
      "
    `,
    )
  })

  test('hydrate handwritten multi-root VDOM component as first child in multi-root Vapor', async () => {
    const MultiRootVDOM = {
      setup() {
        return () => [
          runtimeDom.h('span', 'Hello'),
          runtimeDom.h('span', 'World'),
        ]
      },
    }

    const { container } = await testWithVaporApp(
      `<script setup>
        const MultiRootVDOM = _data.MultiRootVDOM
      </script>
      <template>
        <MultiRootVDOM />
        <div>After</div>
      </template>`,
      {},
      { MultiRootVDOM },
    )
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--[--><span>Hello</span><span>World</span><!--]-->
      <div>After</div><!--]-->
      "
    `,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  test('hydrate SFC multi-root VDOM component inside multi-root Vapor', async () => {
    const data = ref('foo')
    const { container } = await testWithVaporApp(
      `<script setup>
        const data = _data; const components = _components;
      </script>
      <template>
        <div>Before</div>
        <components.VdomMultiRoot />
        <div>After</div>
      </template>`,
      {
        VdomMultiRoot: {
          code: `<script setup>const data = _data;</script><template><div>first {{ data }}</div><div>second {{ data }}</div></template>`,
          vapor: false,
        },
      },
      data,
    )
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[--><div>first foo</div><div>second foo</div><!--]-->
      <div>After</div><!--]-->
      "
    `,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[--><div>first bar</div><div>second bar</div><!--]-->
      <div>After</div><!--]-->
      "
    `,
    )
  })

  test('hydrate handwritten multi-root VDOM via createDynamicComponent with siblings', async () => {
    const MultiRootVDOM = {
      setup() {
        return () => [
          runtimeDom.h('span', 'Hello'),
          runtimeDom.h('span', 'World'),
        ]
      },
    }

    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const MultiRootVDOM = _data.MultiRootVDOM
        const vnode = h(MultiRootVDOM)
      </script>
      <template>
        <component :is="vnode" />
        <div>After</div>
      </template>`,
      {},
      { MultiRootVDOM },
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--[--><span>Hello</span><span>World</span><!--]-->
      <!--dynamic-component--><div>After</div><!--]-->
      "
    `,
    )
  })

  test('hydrate handwritten multi-root VDOM via createDynamicComponent as first child of nested multi-root Vapor', async () => {
    const first = ref('Hello')
    const second = ref('World')
    const after = ref('After')

    const MultiRootVDOM = {
      setup() {
        return () => [
          runtimeDom.h('span', first.value),
          runtimeDom.h('span', second.value),
        ]
      },
    }

    const { container } = await testWithVDOMApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <p>before</p>
        <components.VaporChild />
      </template>`,
      {
        VaporChild: {
          code: `<script setup>
            import { h } from 'vue'
            const MultiRootVDOM = _data.MultiRootVDOM
            const after = _data.after
            const vnode = h(MultiRootVDOM)
          </script>
          <template>
            <component :is="vnode" />
            <div>{{ after }}</div>
          </template>`,
          vapor: true,
        },
      },
      { MultiRootVDOM, after },
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><p>before</p>
      <!--[-->
      <!--[--><span>Hello</span><span>World</span><!--]-->
      <!--dynamic-component--><div>After</div><!--]-->
      <!--]-->
      "
    `,
    )

    first.value = 'Updated'
    second.value = 'Again'
    after.value = 'After updated'
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><p>before</p>
      <!--[-->
      <!--[--><span>Updated</span><span>Again</span><!--]-->
      <!--dynamic-component--><div>After updated</div><!--]-->
      <!--]-->
      "
    `,
    )
  })

  test('hydrate multi-root VDOM slot as first child of nested multi-root Vapor', async () => {
    const msg = ref('Hello')
    const after = ref('After')
    const { container } = await testWithVDOMApp(
      `<script setup>
        const components = _components
        const msg = _data.msg
      </script>
      <template>
        <p>before</p>
        <components.VaporChild>
          <components.VdomChild />
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<script setup>
            const after = _data.after
          </script>
          <template>
            <slot />
            <div>{{ after }}</div>
          </template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const msg = _data.msg</script>
            <template><span>{{ msg }}</span><span>{{ msg }}</span></template>`,
          vapor: false,
        },
      },
      { msg, after },
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><p>before</p>
      <!--[-->
      <!--[-->
      <!--[--><span>Hello</span><span>Hello</span><!--]-->
      <!--]-->
      <div>After</div><!--]-->
      <!--]-->
      "
    `,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    msg.value = 'Updated'
    after.value = 'After updated'
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><p>before</p>
      <!--[-->
      <!--[-->
      <!--[--><span>Updated</span><span>Updated</span><!--]-->
      <!--]-->
      <div>After updated</div><!--]-->
      <!--]-->
      "
    `,
    )
  })

  test('hydrate slot Fragment as first child of DynamicFragment with trailing sibling', async () => {
    const msg = ref('2')
    const tail = ref('1')

    const { container } = await testWithVDOMApp(
      `<script setup>
        const components = _components
        const msg = _data.msg
      </script>
      <template>
        <components.Comp>{{ msg }}</components.Comp>
      </template>`,
      {
        Comp: {
          code: `<script setup>
            const tail = _data.tail
          </script>
          <template>
            <template v-if="true">
              <slot />
              <span>{{ tail }}</span>
            </template>
          </template>`,
          vapor: true,
        },
      },
      { msg, tail },
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--[-->2<!--]-->
      <span>1</span><!--]-->
      "
    `,
    )

    msg.value = '3'
    tail.value = '4'
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--[-->3<!--]-->
      <span>4</span><!--]-->
      "
    `,
    )
  })

  test('hydrate VDOM component as first child of DynamicFragment with preceding sibling', async () => {
    const data = ref({
      show: true,
      msg: 'Hello',
      tail: 'Tail',
    })

    const { container } = await testWithVaporApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.VaporChild />
      </template>`,
      {
        VaporChild: {
          code: `<script setup>
            const components = _components
            const data = _data
          </script>
          <template>
            <div>Before</div>
            <template v-if="data.show">
              <components.VdomChild />
              <span>{{ data.tail }}</span>
            </template>
          </template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data</script>
            <template><span>{{ data.msg }}</span><span>{{ data.msg }}</span></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[-->
      <!--[--><span>Hello</span><span>Hello</span><!--]-->
      <span>Tail</span><!--]-->
      <!--]-->
      "
    `,
    )

    data.value.msg = 'Updated'
    data.value.tail = 'Tail updated'
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[-->
      <!--[--><span>Updated</span><span>Updated</span><!--]-->
      <span>Tail updated</span><!--]-->
      <!--]-->
      "
    `,
    )
  })

  test('hydrate empty slot as first child of DynamicFragment with preceding sibling', async () => {
    const data = ref({
      show: true,
      tail: 'Tail',
    })

    const { container } = await testWithVaporApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.VaporChild />
      </template>`,
      {
        VaporChild: {
          code: `<script setup>
            const data = _data
          </script>
          <template>
            <div>Before</div>
            <template v-if="data.show">
              <slot />
              <span>{{ data.tail }}</span>
            </template>
          </template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[-->
      <!--[--><!--]-->
      <span>Tail</span><!--]-->
      <!--]-->
      "
    `,
    )

    data.value.tail = 'Tail updated'
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[-->
      <!--[--><!--]-->
      <span>Tail updated</span><!--]-->
      <!--]-->
      "
    `,
    )
  })

  test('hydrate empty multi-root if with preceding sibling', async () => {
    const data = ref({
      show: false,
      msg: 'Hello',
      tail: 'Tail',
    })

    const { container } = await testWithVaporApp(
      `<script setup>
        const data = _data
      </script>
      <template>
        <div>Before</div>
        <template v-if="data.show">
          <span>{{ data.msg }}</span>
          <span>{{ data.msg }}</span>
        </template>
        <span>{{ data.tail }}</span>
      </template>`,
      undefined,
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
    	"
    	<!--[--><div>Before</div><!----><span>Tail</span><!--]-->
    	"
    `,
    )

    data.value.show = true
    data.value.msg = 'Updated'
    data.value.tail = 'Tail updated'
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
    	"
    	<!--[--><div>Before</div><span>Updated</span><span>Updated</span><!----><span>Tail updated</span><!--]-->
    	"
    `,
    )

    data.value.show = false
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
    	"
    	<!--[--><div>Before</div><!----><span>Tail updated</span><!--]-->
    	"
    `,
    )
  })

  test('hydrate multi-root VDOM component as first child of v-for boundary with sibling', async () => {
    const first = ref('Hello')
    const second = ref('World')
    const items = ref([1])

    const MultiRootVDOM = {
      setup() {
        return () => [
          runtimeDom.h('span', first.value),
          runtimeDom.h('span', second.value),
        ]
      },
    }

    const { container } = await testWithVaporApp(
      `<script setup>
        const items = _data.items
        const MultiRootVDOM = _data.MultiRootVDOM
      </script>
      <template>
        <div>Before</div>
        <MultiRootVDOM v-for="item in items" :key="item" />
        <div>After</div>
      </template>`,
      {},
      { items, MultiRootVDOM },
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[-->
      <!--[--><span>Hello</span><span>World</span><!--]-->
      <!--]-->
      <div>After</div><!--]-->
      "
    `,
    )

    first.value = 'Updated'
    second.value = 'Again'
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[-->
      <!--[--><span>Updated</span><span>Again</span><!--]-->
      <!--]-->
      <div>After</div><!--]-->
      "
    `,
    )
  })

  test('hydrate multi-root Vapor component should preserve close marker when client renders extra child', async () => {
    const data = ref({
      msg: 'Hello',
      extra: '',
    })

    const childCode = `<script setup>
        const data = _data
      </script>
      <template>
        <span>{{ data.msg }}</span>{{ data.extra }}
      </template>`

    const appCode = `<script setup>
        const components = _components
      </script>
      <template>
        <div>Before</div>
        <components.Child />
        <div>After</div>
      </template>`

    const SSRChild = compileVaporComponent(childCode, data, undefined, true)
    const SSRApp = compileVaporComponent(
      appCode,
      data,
      { Child: SSRChild },
      true,
    )
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(SSRApp),
    )

    data.value.extra = 'Tail'

    const ClientChild = compileVaporComponent(childCode, data)
    const ClientApp = compileVaporComponent(appCode, data, {
      Child: ClientChild,
    })

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    createVaporSSRApp(ClientApp).mount(container)

    expect(`Hydration node mismatch`).toHaveBeenWarned()
    expect(`Hydration text mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[--><span>Hello</span>Tail<!--]-->
      <div>After</div><!--]-->
      "
    `,
    )

    data.value.extra = 'Tail updated'
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[--><span>Hello</span>Tail updated<!--]-->
      <div>After</div><!--]-->
      "
    `,
    )
  })

  test('hydrate multi-root Vapor component should cleanup extra SSR text without crossing trailing sibling', async () => {
    const data = ref({
      msg: 'Hello',
      extra: 'Tail',
      after: 'After',
    })

    const childCode = `<script setup>
        const data = _data
      </script>
      <template>
        <span>{{ data.msg }}</span>{{ data.extra }}
      </template>`

    const appCode = `<script setup>
        const components = _components
        const data = _data
      </script>
      <template>
        <div data-test="wrapper">
          <components.Child />
          <span>{{ data.after }}</span>
        </div>
      </template>`

    const SSRChild = compileVaporComponent(childCode, data, undefined, true)
    const SSRApp = compileVaporComponent(
      appCode,
      data,
      { Child: SSRChild },
      true,
    )
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(SSRApp),
    )

    data.value.extra = ''

    const ClientChild = compileVaporComponent(childCode, data)
    const ClientApp = compileVaporComponent(appCode, data, {
      Child: ClientChild,
    })

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    createVaporSSRApp(ClientApp).mount(container)

    expect(`Hydration text mismatch`).toHaveBeenWarned()
    expect(container.innerHTML).toBe(
      '<div data-test="wrapper"><!--[--><span>Hello</span><!--]--><span>After</span></div>',
    )

    data.value.extra = 'Updated'
    data.value.after = 'After updated'
    await nextTick()

    expect(container.innerHTML).toBe(
      '<div data-test="wrapper"><!--[--><span>Hello</span>Updated<!--]--><span>After updated</span></div>',
    )
  })

  test('hydrate multi-root Vapor component should cleanup extra SSR text within allow-mismatch wrapper', async () => {
    const data = ref({
      msg: 'Hello',
      extra: 'Tail',
      after: 'After',
    })

    const childCode = `<script setup>
        const data = _data
      </script>
      <template>
        <span>{{ data.msg }}</span>{{ data.extra }}
      </template>`

    const appCode = `<script setup>
        const components = _components
        const data = _data
      </script>
      <template>
        <div data-allow-mismatch="text">
          <components.Child />
          <span>{{ data.after }}</span>
        </div>
      </template>`

    const SSRChild = compileVaporComponent(childCode, data, undefined, true)
    const SSRApp = compileVaporComponent(
      appCode,
      data,
      { Child: SSRChild },
      true,
    )
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(SSRApp),
    )

    data.value.extra = ''

    const ClientChild = compileVaporComponent(childCode, data)
    const ClientApp = compileVaporComponent(appCode, data, {
      Child: ClientChild,
    })

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    createVaporSSRApp(ClientApp).mount(container)

    expect(`Hydration text mismatch`).not.toHaveBeenWarned()
    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="text"><!--[--><span>Hello</span><!--]--><span>After</span></div>',
    )

    data.value.extra = 'Updated'
    data.value.after = 'After updated'
    await nextTick()

    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="text"><!--[--><span>Hello</span>Updated<!--]--><span>After updated</span></div>',
    )
  })

  test('hydrate multi-root VDOM via mountVNode as non-first child', async () => {
    const MultiRootVDOM = {
      setup() {
        return () => [
          runtimeDom.h('span', 'Hello'),
          runtimeDom.h('span', 'World'),
        ]
      },
    }

    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const MultiRootVDOM = _data.MultiRootVDOM
        const vnode = h(MultiRootVDOM)
      </script>
      <template>
        <div>Before</div>
        <component :is="vnode" />
        <div>After</div>
      </template>`,
      {},
      { MultiRootVDOM },
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>Before</div>
      <!--[--><span>Hello</span><span>World</span><!--]-->
      <!--dynamic-component--><div>After</div><!--]-->
      "
    `,
    )
  })

  test('hydrate Fragment VNode as first child of multi-root Vapor via createDynamicComponent', async () => {
    const { container } = await testWithVaporApp(
      `<script setup>
        import { Fragment, h } from 'vue'
        const FragmentChunk = h(Fragment, null, [
          h('div', null, 'first fragment'),
          h('div', null, 'second fragment'),
        ])
      </script>
      <template>
        <component :is="FragmentChunk" />
        <div>After</div>
      </template>`,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--[--><div>first fragment</div><div>second fragment</div><!--]-->
      <!--dynamic-component--><div>After</div><!--]-->
      "
    `,
    )
  })

  test('hydrate Element VNode as first child of multi-root Vapor via createDynamicComponent', async () => {
    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const elementVNode = h('span', null, 'hello')
      </script>
      <template>
        <component :is="elementVNode" />
        <div>After</div>
      </template>`,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>hello</span><!--dynamic-component--><div>After</div><!--]-->
      "
    `,
    )
  })

  test('hydrate interop vapor slot fallback from empty slot branch under Suspense', async () => {
    const data = reactive({
      show: false,
      fallback: 'foo',
      slot: 'bar',
    })
    const { container } = await testWithVDOMApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <Suspense>
          <components.VaporChild />
          <template #fallback>
            <i>pending</i>
          </template>
        </Suspense>
      </template>`,
      {
        VaporChild: {
          code: `<script setup>
            const data = _data
            const components = _components
          </script>
          <template>
            <components.VdomChild>
              <template #default>
                <template v-if="data.show">
                  <span>{{ data.slot }}</span>
                </template>
              </template>
            </components.VdomChild>
          </template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data</script>
          <template><slot><div>{{ data.fallback }}</div></slot></template>`,
          vapor: false,
        },
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

  test('hydrate interop vapor forwarded empty named slot with multi-root fallback', async () => {
    const data = reactive({
      banner: 'banner',
      title: 'Vue.js',
    })
    const { container } = await testWithVDOMApp(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Layout>
          <template #banner>
            <div>{{ data.banner }}</div>
          </template>
        </components.Layout>
      </template>`,
      {
        Layout: {
          code: `<script setup>
            const components = _components
          </script>
          <template>
            <div>
              <slot name="banner" />
              <components.Nav>
                <template #navbar-title>
                  <slot name="navbar-title" />
                </template>
              </components.Nav>
            </div>
          </template>`,
          vapor: true,
        },
        Nav: {
          code: `<script setup>
            const components = _components
          </script>
          <template>
            <header>
              <components.NavBar>
                <template #navbar-title>
                  <slot name="navbar-title" />
                </template>
              </components.NavBar>
            </header>
          </template>`,
          vapor: true,
        },
        NavBar: {
          code: `<script setup>
            const components = _components
          </script>
          <template>
            <div>
              <components.NavBarTitle>
                <template #navbar-title>
                  <slot name="navbar-title" />
                </template>
              </components.NavBarTitle>
            </div>
          </template>`,
          vapor: true,
        },
        NavBarTitle: {
          code: `<script setup>
            const data = _data
          </script>
          <template>
            <a>
              <slot name="navbar-title">
                <svg><path /></svg>
                <span>{{ data.title }}</span>
              </slot>
            </a>
          </template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toContain(
      '<!--[--><div>banner</div><!--]-->',
    )
    expect(formatHtml(container.innerHTML)).toContain(
      '<!--[--><svg><path></path></svg><span>Vue.js</span><!--]-->',
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.title = 'Vapor'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toContain(
      '<!--[--><svg><path></path></svg><span>Vapor</span><!--]-->',
    )
  })

  test('ssr output for forwarded empty named VDOM slot with trailing sibling nodes', async () => {
    const data = ref({})
    const ssrComponents: Record<string, any> = {}

    ssrComponents.Page = compile(
      `<template>
        <div>
          <main><span>content</span></main>
          <slot name="footer-before" />
          <p>footer</p>
        </div>
      </template>`,
      data,
      ssrComponents,
      { vapor: false, ssr: true },
    )
    ssrComponents.Layout = compile(
      `<script setup>
        const components = _components
      </script>
      <template>
        <div>
          <slot name="banner" />
          <components.Page>
            <template #footer-before>
              <slot name="footer-before" />
            </template>
          </components.Page>
        </div>
      </template>`,
      data,
      ssrComponents,
      { vapor: false, ssr: true },
    )

    const ServerApp = compile(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.Layout>
          <template #banner>
            <div>banner</div>
          </template>
          <template #footer-before>
            <slot name="footer-before" />
          </template>
        </components.Layout>
      </template>`,
      data,
      ssrComponents,
      { vapor: true, ssr: true },
    )
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(ServerApp),
    )

    expect(formatHtml(html)).toMatchInlineSnapshot(`
    	"<div>
    	<!--[--><div>banner</div><!--]-->
    	<div><main><span>content</span></main>
    	<!--[--><!--]-->
    	<p>footer</p></div></div>"
    `)
  })

  test('hydrate prepended multi-root component with trailing empty if should restore outer cursor', async () => {
    const { container } = await testWithVaporApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <div>
          <components.Child />
          <span>inside</span>
        </div>
        <p>after</p>
      </template>`,
      {
        Child: {
          code: `<template>
            <span>child</span>
            <template v-if="false"></template>
          </template>`,
          vapor: true,
        },
      },
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>
      <!--[--><span>child</span><!----><!--]-->
      <span>inside</span></div><p>after</p><!--]-->
      "
      `,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  test('hydrate useId in parent template before child setup', async () => {
    const { container } = await testWithVaporApp(
      `<script setup>
        import { useId } from 'vue'
        const components = _components
      </script>
      <template>
        <div>parent: {{ useId() }}</div>
        <components.Child />
      </template>`,
      {
        Child: `<script setup>
          import { useId } from 'vue'
          const id = useId()
        </script>
        <template>
          <div>child: {{ id }}</div>
        </template>`,
      },
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>parent: v-0</div><div>child: v-1</div><!--]-->
      "
    `)
    expect(`Hydration text mismatch`).not.toHaveBeenWarned()
  })

  test('hydrate forwarded empty named VDOM slot with trailing sibling nodes', async () => {
    const { container } = await testWithVaporApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.Layout>
          <template #banner>
            <div>banner</div>
          </template>
          <template #footer-before>
            <slot name="footer-before" />
          </template>
        </components.Layout>
      </template>`,
      {
        Layout: {
          code: `<script setup>
            const components = _components
          </script>
          <template>
            <div>
              <slot name="banner" />
              <components.Page>
                <template #footer-before>
                  <slot name="footer-before" />
                </template>
              </components.Page>
            </div>
          </template>`,
          vapor: false,
        },
        Page: {
          code: `<template>
            <div>
              <main><span>content</span></main>
              <slot name="footer-before" />
              <p>footer</p>
            </div>
          </template>`,
          vapor: false,
        },
      },
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "<div>
      <!--[--><div>banner</div><!--]-->
      <div><main><span>content</span></main>
      <!--[--><!--slot--><!--]-->
      <p>footer</p></div></div>"
      `,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  test('hydrate dynamically forwarded empty Vapor slots with trailing sibling nodes', async () => {
    const data = reactive({
      msg: 'late',
    })
    const { container } = await testWithVDOMApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.Theme />
      </template>`,
      {
        Theme: {
          code: `<script>
            import { h } from 'vue'

            export default {
              setup() {
                const components = _components
                return () => h(components.Forward, null, {
                  late: () => h(components.Late)
                })
              }
            }
          </script>`,
          vapor: false,
        },
        Forward: `<script setup>
          import { useSlots } from 'vue'

          const components = _components
          const slots = useSlots()
        </script>
        <template>
          <components.Inner>
            <template v-for="(_, name) in slots" #[name]="slotData">
              <slot :name="name" v-bind="slotData || {}" />
            </template>
          </components.Inner>
        </template>`,
        Inner: `<template>
          <div>
            <slot name="empty" />
            <slot name="late" />
            <p>after</p>
          </div>
        </template>`,
        Late: `<template>
          <span>{{ data.msg }}</span>
          <template v-if="false"></template>
        </template>`,
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "<div>
      <!--[--><!--]-->
      <!--[-->
      <!--[-->
      <!--[--><span>late</span><!----><!--]-->
      <!--]-->
      <!--]-->
      <p>after</p></div>"
    `)
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()

    data.msg = 'updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "<div>
      <!--[--><!--]-->
      <!--[-->
      <!--[-->
      <!--[--><span>updated</span><!----><!--]-->
      <!--]-->
      <!--]-->
      <p>after</p></div>"
    `)
  })

  test('hydrate vapor slot passed to render function vdom child', async () => {
    const data = ref('foo')
    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const data = _data
        const VdomLink = {
          props: ['to'],
          setup(props, { slots }) {
            return () => h('a', { href: props.to }, slots.default && slots.default())
          }
        }
      </script>
      <template>
        <div><VdomLink to="/about">{{ data }}</VdomLink></div>
      </template>`,
      {},
      data,
    )

    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><a href="/about">foo</a></div>"`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><a href="/about">bar</a></div>"`,
    )
  })

  test('hydrate vapor slot passed to render function vdom child with trailing sibling', async () => {
    const data = ref('foo')
    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const data = _data
        const VdomLink = {
          setup(_, { slots }) {
            return () => h('a', null, [slots.default && slots.default(), h('span', 'after')])
          }
        }
      </script>
      <template>
        <div><VdomLink>{{ data }}</VdomLink></div>
      </template>`,
      {},
      data,
    )

    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><a><!--[-->foo<!--]--><span>after</span></a></div>"`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><a><!--[-->bar<!--]--><span>after</span></a></div>"`,
    )
  })

  test('hydrate vapor slot passed to render function vdom child in vdom app', async () => {
    const data = ref('foo')
    const { container } = await testWithVDOMApp(
      `<script setup>const components = _components;</script>
      <template>
        <div><components.VaporPage/></div>
      </template>`,
      {
        VaporPage: {
          code: `<script setup>
            import { h } from 'vue'
            const data = _data
            const VdomLink = {
              props: ['to'],
              setup(props, { slots }) {
                return () => h('a', { href: props.to }, slots.default && slots.default())
              }
            }
          </script>
          <template>
            <div><VdomLink to="/about">{{ data }}</VdomLink></div>
          </template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><div><a href="/about">foo</a></div></div>"`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><div><a href="/about">bar</a></div></div>"`,
    )
  })

  test('hydrate dynamic vapor slot passed to render function vdom child', async () => {
    const data = reactive({ items: [0, 1] })
    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const data = _data
        const VdomLink = {
          setup(_, { slots }) {
            return () => h('a', null, slots.default && slots.default())
          }
        }
      </script>
      <template>
        <div>
          <VdomLink>
            <template v-for="item in data.items" #default>
              <span>{{ item }}</span>
            </template>
          </VdomLink>
        </div>
      </template>`,
      {},
      data,
    )

    expect(container.innerHTML).toBe('<div><a><span>1</span></a></div>')

    data.items.push(2)
    await nextTick()
    expect(container.innerHTML).toBe('<div><a><span>2</span></a></div>')
  })

  test('hydrate flattened vapor slot before persistent vdom sibling', async () => {
    const show = ref(true)
    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const show = _data
        const VdomLink = {
          setup(_, { slots }) {
            return () => h('a', null, [
              ...(show.value && slots.default ? slots.default() : []),
              h('span', { key: 'after' }, 'after')
            ])
          }
        }
      </script>
      <template>
        <div><VdomLink><b>slot</b></VdomLink></div>
      </template>`,
      {},
      show,
    )

    expect(container.innerHTML).toBe(
      '<div><a><b>slot</b><span>after</span></a></div>',
    )

    show.value = false
    await nextTick()
    expect(container.innerHTML).toBe('<div><a><span>after</span></a></div>')
  })

  test('does not leak concurrent async hydration context', async () => {
    const resolvers: Array<() => void> = []
    const mountedHtml: string[] = []
    const Fresh = compileVaporComponent('<strong>fresh</strong>')
    const mountFresh = () => {
      const container = document.createElement('div')
      createVaporApp(Fresh).mount(container)
      return container.innerHTML
    }
    const serverData = ref({
      waits: [Promise.resolve(), Promise.resolve()],
      afterAwait: () => {},
    })
    const clientData = ref({
      waits: [
        new Promise<void>(resolve => resolvers.push(resolve)),
        new Promise<void>(resolve => resolvers.push(resolve)),
      ],
      afterAwait: () => mountedHtml.push(mountFresh()),
    })
    const childCode = `
      <script vapor>
        const data = _data
        const props = defineProps(['id'])
        await data.value.waits[props.id]
        Promise.resolve().then(data.value.afterAwait)
      </script>
      <template><span>{{ props.id }}</span></template>
    `

    let AsyncChild = compileVaporComponent(
      childCode,
      serverData,
      undefined,
      true,
    )
    const App = defineComponent({
      setup: () => () =>
        h(runtimeDom.Suspense, null, {
          default: () =>
            h('div', [h(AsyncChild, { id: 0 }), h(AsyncChild, { id: 1 })]),
        }),
    })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(App),
    )

    AsyncChild = compileVaporComponent(childCode, clientData)
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const app = runtimeDom.createSSRApp(App)
    app.use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    resolvers.forEach(resolve => resolve())
    await new Promise(resolve => setTimeout(resolve))
    expect(container.textContent).toBe('01')
    expect(mountedHtml).toEqual([
      '<strong>fresh</strong>',
      '<strong>fresh</strong>',
    ])
    expect(mountFresh()).toBe('<strong>fresh</strong>')
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    app.unmount()
  })
})
