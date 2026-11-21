import {
  createComponent,
  createDynamicComponent,
  createSlot,
  createVaporSSRApp,
  defineVaporAsyncComponent,
  defineVaporComponent,
  template,
} from '../../src'
import {
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  reactive,
  ref,
} from '@vue/runtime-dom'
import { VaporDynamicComponentFlags } from '@vue/shared'
import { vi } from 'vite-plus/test'
import { BindingTypes } from '@vue/compiler-dom'
import {
  VueServerRenderer,
  compile,
  compileToVaporRender,
  runtimeDom,
  stripAnchors,
} from '../_utils'
import {
  compileVaporComponent,
  formatHtml,
  mountWithHydration,
  setupHydrationTest,
  testHydration,
  triggerEvent,
} from './_helpers'

setupHydrationTest()

describe('Vapor Mode hydration', () => {
  describe('component', () => {
    // a component with `onServerPrefetch` is the `useId` boundary of the
    // components that it renders; its own ids come before the boundary
    test('ids below a component with onServerPrefetch match the server', async () => {
      const { container, html } = await testHydration(
        `<template><components.Group><components.Item/><components.Item/></components.Group><components.Item/></template>`,
        {
          Group: `<script setup>
            import { onServerPrefetch, useId } from 'vue'
            onServerPrefetch(() => {})
            const id = useId()
          </script>
          <template><div :id="id"><slot/></div></template>`,
          Item: `<script setup>
            import { useId } from 'vue'
            const id = useId()
          </script>
          <template><p :id="id"/></template>`,
        },
      )
      const ids = (root: ParentNode) =>
        [...root.querySelectorAll('[id]')].map(el => el.id)
      const server = document.createElement('div')
      server.innerHTML = html
      expect(ids(server)).toEqual(['v-0', 'v-0-0', 'v-0-1', 'v-1'])
      expect(ids(container)).toEqual(['v-0', 'v-0-0', 'v-0-1', 'v-1'])
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })
    test('root component should not enter beforeMount twice during hydration', async () => {
      const beforeMount = vi.fn()
      await testHydration(
        `
          <script vapor>
            import { onBeforeMount } from 'vue'
            const data = _data
            onBeforeMount(() => data.value.beforeMount())
          </script>
          <template><div>root</div></template>
        `,
        {},
        ref({ beforeMount }),
      )
      expect(beforeMount).toHaveBeenCalledTimes(1)
    })

    test('@vue:xxx lifecycle events of a hydrated child component', async () => {
      const log: string[] = []
      const { container } = await testHydration(
        `<template>
          <components.Child
            @vue:before-mount="data.log('vnode:bm')"
            @vue:mounted="data.log('vnode:m')"
          />
        </template>`,
        {
          Child: `<script vapor>
            import { onBeforeMount, onMounted } from 'vue'
            const data = _data
            onBeforeMount(() => data.value.log('own:bm'))
            onMounted(() => data.value.log('own:m'))
          </script>
          <template>
            <div>child</div>
          </template>`,
        },
        ref({ log: (entry: string) => log.push(entry) }),
      )
      await nextTick()
      expect(container.innerHTML).toContain('<div>child</div>')
      expect(log).toEqual(['own:bm', 'vnode:bm', 'own:m', 'vnode:m'])
    })

    test('dynamic child component root preserves inherited scopeId after hydration update', async () => {
      const showAlt = ref(false)
      const Child = defineVaporComponent({
        __scopeId: 'child',
        render: compileToVaporRender(
          `<section v-if="showAlt">alt</section><div v-else>base</div>`,
          {
            bindingMetadata: {
              showAlt: BindingTypes.SETUP_REF,
            },
            scopeId: 'child',
          },
        ),
        setup() {
          return { showAlt }
        },
      })

      const Parent = defineVaporComponent({
        __scopeId: 'parent',
        setup() {
          return createComponent(Child)
        },
      })

      const container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = `<div child="" parent="">base</div>`

      createVaporSSRApp(Parent).mount(container)

      expect(container.innerHTML).toBe(
        `<div child="" parent="">base</div><!--if-->`,
      )

      showAlt.value = true
      await nextTick()

      expect(container.innerHTML).toBe(
        `<section child="" parent="">alt</section><!--if-->`,
      )
    })

    test('basic component', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Child/></div></template>
      `,
        { Child: `<template>{{ data }}</template>` },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>foo</div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>bar</div>"`,
      )
    })

    test('fragment component', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Child/></div></template>
      `,
        { Child: `<template><div>{{ data }}</div>-{{ data }}-</template>` },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>foo</div>-foo-<!--]-->
        </div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>bar</div>-bar-<!--]-->
        </div>"
      `,
      )
    })

    test('fragment component with prepend', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><components.Child/><span></span></div></template>
      `,
        { Child: `<template><div>{{ data }}</div>-{{ data }}-</template>` },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[$--><div>foo</div>-foo-<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[$--><div>bar</div>-bar-<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('nested fragment components', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><components.Parent/><span></span></div></template>
      `,
        {
          Parent: `<template><div/><components.Child/><div/></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[$--><div></div>
        <!--[$--><div>foo</div>-foo-<!--]-->
        <div></div><!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[$--><div></div>
        <!--[$--><div>bar</div>-bar-<!--]-->
        <div></div><!--]-->
        <span></span></div>"
      `,
      )
    })

    test('component with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
        <div>
          <span/>
          <components.Child/>
          <span/>
        </div>
      </template>
      `,
        {
          Child: `<template>{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>foo<span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>bar<span></span></div>"`,
      )
    })

    test('nested components with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `
      <template><components.Parent/></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>foo</div><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>bar</div><span></span></div>"`,
      )
    })

    test('nested components with multi level anchor insertion', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Parent/><span></span></div></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div><span></span><div>foo</div><span></span></div><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div><span></span><div>bar</div><span></span></div><span></span></div>"`,
      )
    })

    test('consecutive components with insertion parent', async () => {
      const data = reactive({ foo: 'foo', bar: 'bar' })
      const { container } = await testHydration(
        `<template>
        <div>
          <components.Child1/>
          <components.Child2/>
        </div>
      </template>
      `,
        {
          Child1: `<template><span>{{ data.foo }}</span></template>`,
          Child2: `<template><span>{{ data.bar }}</span></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>foo</span><span>bar</span></div>"`,
      )

      data.foo = 'foo1'
      data.bar = 'bar1'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>foo1</span><span>bar1</span></div>"`,
      )
    })

    test('nested consecutive components with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `
      <template><components.Parent/></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>foo</div><div>foo</div><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>bar</div><div>bar</div><span></span></div>"`,
      )
    })

    test('nested consecutive components with multi level anchor insertion', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Parent/><span></span></div></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div><span></span><div>foo</div><div>foo</div><span></span></div><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div><span></span><div>bar</div><div>bar</div><span></span></div><span></span></div>"`,
      )
    })

    test('mixed component and element with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
        <div>
          <span/>
          <components.Child/>
          <span/>
          <components.Child/>
          <span/>
        </div>
      </template>
      `,
        {
          Child: `<template>{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>foo<span></span>foo<span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>bar<span></span>bar<span></span></div>"`,
      )
    })

    test('fragment component with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
        <div>
          <span/>
          <components.Child/>
          <span/>
        </div>
      </template>
      `,
        {
          Child: `<template><div>{{ data }}</div>-{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>bar</div>-bar<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('nested fragment component with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `
      <template><components.Parent/></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>foo</div>-foo-<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>bar</div>-bar-<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('nested fragment component with multi level anchor insertion', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span/><components.Parent/><span/></div></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span><div><span></span>
        <!--[$--><div>foo</div>-foo-<!--]-->
        <span></span></div><span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span><div><span></span>
        <!--[$--><div>bar</div>-bar-<!--]-->
        <span></span></div><span></span></div>"
      `,
      )
    })

    test('consecutive fragment components with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span/>
            <components.Child/>
            <components.Child/>
            <span/>
          </div>
        </template>
      `,
        {
          Child: `<template><div>{{ data }}</div>-{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>foo</div>-foo<!--]-->
        <!--[$--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>bar</div>-bar<!--]-->
        <!--[$--><div>bar</div>-bar<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('nested consecutive fragment components with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `
      <template><components.Parent/></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>foo</div>-foo-<!--]-->
        <!--[$--><div>foo</div>-foo-<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>bar</div>-bar-<!--]-->
        <!--[$--><div>bar</div>-bar-<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('nested consecutive fragment components with multi level anchor insertion', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Parent/><span></span></div></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span><div><span></span>
        <!--[$--><div>foo</div>-foo-<!--]-->
        <!--[$--><div>foo</div>-foo-<!--]-->
        <span></span></div><span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span><div><span></span>
        <!--[$--><div>bar</div>-bar-<!--]-->
        <!--[$--><div>bar</div>-bar-<!--]-->
        <span></span></div><span></span></div>"
      `,
      )
    })

    test('nested consecutive fragment components with root level anchor insertion', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Parent/><span></span></div></template>
      `,
        {
          Parent: `<template><components.Child/><components.Child/></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$-->
        <!--[$--><div>foo</div>-foo-<!--]-->
        <!--[$--><div>foo</div>-foo-<!--]-->
        <!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$-->
        <!--[$--><div>bar</div>-bar-<!--]-->
        <!--[$--><div>bar</div>-bar-<!--]-->
        <!--]-->
        <span></span></div>"
      `,
      )
    })

    test('mixed fragment component and element with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
        <div>
          <span/>
          <components.Child/>
          <span/>
          <components.Child/>
          <span/>
        </div>
      </template>
      `,
        {
          Child: `<template><div>{{ data }}</div>-{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>foo</div>-foo<!--]-->
        <span></span>
        <!--[$--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>bar</div>-bar<!--]-->
        <span></span>
        <!--[$--><div>bar</div>-bar<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('mixed fragment component and text with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
        <div>
          <span/>
          <components.Child/>
          {{ data }}
          <components.Child/>
          <span/>
        </div>
      </template>
      `,
        {
          Child: `<template><div>{{ data }}</div>-{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>foo</div>-foo<!--]-->
         foo 
        <!--[$--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[$--><div>bar</div>-bar<!--]-->
         bar 
        <!--[$--><div>bar</div>-bar<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('a static root template clones from its html, not from the hydrated node', async () => {
      const data = ref({ cls: 'shared extra', more: false })
      const { container } = await testHydration(
        `<template>
          <components.Child :class="data.cls" id="first" />
          <components.Child v-if="data.more" />
        </template>`,
        { Child: '<template><div class="shared">x</div></template>' },
        data,
      )

      // a later client instance must not inherit the SSR fallthrough attrs
      data.value.more = true
      await nextTick()
      const second = container.children[1] as HTMLElement
      expect(second.className).toBe('shared')
      expect(second.hasAttribute('id')).toBe(false)
    })

    // #15625
    test('keeps the template class when an overlapping fallthrough class is removed after hydration', async () => {
      const data = ref({ cls: 'shared extra' })
      const { container } = await testHydration(
        `<template><components.Child :class="data.cls" /></template>`,
        { Child: `<template><div class="shared">x</div></template>` },
        data,
      )
      const el = container.firstElementChild!
      expect(el.className).toBe('shared shared extra')

      data.value.cls = ''
      await nextTick()
      expect(el.className).toBe('shared')
    })

    test('keeps a root v-bind class when an overlapping fallthrough class is removed after hydration', async () => {
      const data = ref({ obj: { class: 'o s' }, cls: 's p' })
      const { container } = await testHydration(
        `<template><components.Child :class="data.cls" /></template>`,
        { Child: `<template><div v-bind="data.obj">x</div></template>` },
        data,
      )
      const el = container.firstElementChild!
      expect(el.className).toBe('o s s p')

      data.value.cls = ''
      await nextTick()
      expect(el.className).toBe('o s')
    })

    test('restores the template style when an overlapping fallthrough style is removed after hydration', async () => {
      const data = ref({ sty: 'color: blue; background-color: lightblue' })
      const { container } = await testHydration(
        `<template><components.Child :style="data.sty" /></template>`,
        {
          Child: `<template><div style="color: red; font-weight: bold">x</div></template>`,
        },
        data,
      )
      const el = container.firstElementChild as HTMLElement
      expect(el.getAttribute('style')).toBe(
        'color:blue;font-weight:bold;background-color:lightblue;',
      )

      data.value.sty = ''
      await nextTick()
      expect(el.getAttribute('style')).toBe('color: red; font-weight: bold;')
    })

    test('lets the fallthrough style win over the root binding after hydration without a mismatch', async () => {
      const data = ref({ obj: { style: { color: 'red' } }, sty: 'color: blue' })
      const { container } = await testHydration(
        `<template><components.Child :style="data.sty" /></template>`,
        { Child: `<template><div v-bind="data.obj">x</div></template>` },
        data,
      )
      const el = container.firstElementChild as HTMLElement
      expect(el.getAttribute('style')).toBe('color:blue;')

      data.value.obj = { style: { color: 'green' } }
      await nextTick()
      expect(el.style.color).toBe('blue')

      data.value.sty = ''
      await nextTick()
      expect(el.style.color).toBe('green')
    })

    // coverage guard: the first client patch must not diff against the
    // hydrated style, which holds the server-rendered css vars
    test('keeps the root css vars across a fallthrough style change after hydration', async () => {
      const data = ref({ sty: 'color: blue', color: 'red' })
      const { container } = await testHydration(
        `<template><components.Child :style="data.sty" /></template>`,
        {
          Child: `<script vapor>const data = _data</script>
            <template><div>x</div></template>
            <style>div { color: v-bind('data.color') }</style>`,
        },
        data,
      )
      const el = container.firstElementChild as HTMLElement
      expect(el.getAttribute('style')).toBe('color:blue;--v51566ce1:red;')

      data.value.sty = 'color: green'
      await nextTick()
      expect(el.getAttribute('style')).toBe('color: green; --v51566ce1: red;')
    })

    // coverage guard: the template's own class / style is only parsed when a
    // fallthrough write needs it, never just to hydrate
    test('does not parse a root template while hydrating it', async () => {
      const data = ref({ cls: 'x' })
      const parse = vi.spyOn(HTMLTemplateElement.prototype, 'innerHTML', 'set')
      const { container } = await testHydration(
        `<template><components.Child :class="data.cls" /></template>`,
        {
          Child: `<template><div class="own"><span class="label">x</span></div></template>`,
        },
        data,
      )
      expect(parse).not.toHaveBeenCalled()

      // removing the overlapping fallthrough class is what needs the template
      data.value.cls = ''
      await nextTick()
      expect(parse).toHaveBeenCalledTimes(1)
      expect(container.firstElementChild!.className).toBe('own')
      parse.mockRestore()
    })

    test('restores an important fallthrough display through v-show after hydration', async () => {
      const data = ref({ show: true, sty: 'display: flex !important' })
      const { container } = await testHydration(
        `<template><components.Child :style="data.sty" /></template>`,
        { Child: `<template><div v-show="data.show">x</div></template>` },
        data,
      )
      const el = container.firstElementChild as HTMLElement

      data.value.show = false
      await nextTick()
      expect(el.style.display).toBe('none')

      data.value.show = true
      await nextTick()
      expect(el.style.display).toBe('flex')
    })

    // hand-written: hydration goes by the server's markers alone, `<!--[$-->`
    // telling the component's range from the `[` of the outlet inside
    test('hand-written multi-root component', async () => {
      const data = ref('foo')
      const Child = defineVaporComponent({
        setup() {
          return [
            template('<p>a</p>')(),
            createSlot('default'),
            template('<p>b</p>')(),
          ]
        },
      })
      const html =
        '<!--[$--><!--[$--><p>a</p><!--[--><span>foo</span><!--]--><p>b</p><!--]--><i>after</i><!--]-->'
      const { container } = await mountWithHydration(
        html,
        `<components.Child><span>{{ data }}</span></components.Child>
         <i>after</i>`,
        data,
        { Child },
      )
      const span = container.querySelector('span')
      expect(container.innerHTML).toBe(html)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.value = 'bar'
      await nextTick()
      expect(container.querySelector('span')).toBe(span)
      expect(container.innerHTML).toBe(html.replace('foo', 'bar'))
    })

    // the ranges of nested components open back to back: each component
    // takes its own
    describe('multi-root components under single-root ones', () => {
      test('multi-root first root of a multi-root component', async () => {
        const data = ref('x')
        const { container, html } = await testHydration(
          `<template><components.C /></template>`,
          {
            C: `<template><components.D /><span>{{ data }}</span></template>`,
            D: `<template><p>d1</p><p>d2</p></template>`,
          },
          data,
        )
        const span = container.querySelector('span')
        expect(container.innerHTML).toBe(html)
        expect(`Hydration node mismatch`).not.toHaveBeenWarned()
        expect(`Hydration children mismatch`).not.toHaveBeenWarned()

        data.value = 'y'
        await nextTick()
        expect(container.querySelector('span')).toBe(span)
        expect(span!.textContent).toBe('y')
      })

      test('empty component before a sibling', async () => {
        const data = ref('x')
        const { container, html } = await testHydration(
          `<template><components.Empty /><i>{{ data }}</i></template>`,
          { Empty: `<template></template>` },
          data,
        )
        const i = container.querySelector('i')
        expect(container.innerHTML).toBe(html)
        expect(`Hydration node mismatch`).not.toHaveBeenWarned()
        expect(`Hydration children mismatch`).not.toHaveBeenWarned()

        data.value = 'y'
        await nextTick()
        expect(container.querySelector('i')).toBe(i)
        expect(i!.textContent).toBe('y')
      })

      // a comment root counts for the server's range, not for the sole
      // root that inherits fallthrough attrs
      test('component root followed by a preserved comment', async () => {
        const data = ref('x')
        const { container, html } = await testHydration(
          `<template><components.Child /><!-- trailing --></template>`,
          { Child: `<template><p>{{ data }}</p></template>` },
          data,
          { compilerOptions: { comments: true } },
        )
        const p = container.querySelector('p')
        expect(container.innerHTML).toBe(html)
        expect(`Hydration node mismatch`).not.toHaveBeenWarned()
        expect(`Hydration children mismatch`).not.toHaveBeenWarned()

        data.value = 'y'
        await nextTick()
        expect(container.querySelector('p')).toBe(p)
        expect(p!.textContent).toBe('y')
      })

      // the comment makes the child's output two nodes: one unit for the
      // parent's locator only inside a range
      test('component with a preserved comment root among siblings', async () => {
        const data = ref('x')
        const { container, html } = await testHydration(
          `<template><div><components.Child /><i>{{ data }}</i></div></template>`,
          { Child: `<template><b>{{ data }}</b><!-- tail --></template>` },
          data,
          { compilerOptions: { comments: true } },
        )
        const i = container.querySelector('i')
        expect(container.innerHTML).toBe(html)
        expect(`Hydration node mismatch`).not.toHaveBeenWarned()
        expect(`Hydration children mismatch`).not.toHaveBeenWarned()

        data.value = 'y'
        await nextTick()
        expect(container.querySelector('i')).toBe(i)
        expect(i!.textContent).toBe('y')
      })

      test('page over layout over header', async () => {
        const data = ref('x')
        const { container, html } = await testHydration(
          `<template><components.Page /><i>after</i></template>`,
          {
            Header: `<template><nav>n</nav><div>d</div></template>`,
            Layout: `<template><components.Header /><main>{{ data }}</main></template>`,
            Page: `<template><components.Layout /></template>`,
          },
          data,
        )
        const main = container.querySelector('main')
        expect(container.innerHTML).toBe(html)
        expect(`Hydration node mismatch`).not.toHaveBeenWarned()
        expect(`Hydration children mismatch`).not.toHaveBeenWarned()

        data.value = 'y'
        await nextTick()
        expect(container.querySelector('main')).toBe(main)
        expect(main!.textContent).toBe('y')
      })
    })
  })

  describe('dynamic component', () => {
    test('basic dynamic component', async () => {
      const { container, data } = await testHydration(
        `<template>
          <component :is="components[data]"/>
        </template>`,
        {
          foo: `<template><div>foo</div></template>`,
          bar: `<template><div>bar</div></template>`,
        },
        ref('foo'),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!--dynamic-component-->"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>bar</div><!--dynamic-component-->"`,
      )
    })

    test('dynamic component with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span/>
            <component :is="components[data]"/>
            <span/>
          </div>
        </template>`,
        {
          foo: `<template><div>foo</div></template>`,
          bar: `<template><div>bar</div></template>`,
        },
        ref('foo'),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>foo</div><!--dynamic-component--><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>bar</div><!--dynamic-component--><span></span></div>"`,
      )
    })

    // the keep-alive root hydrates before the KeepAlive marks it, so its
    // activated hooks are queued by the mark; content below an element root is
    // not kept alive and never sees them (vdom)
    test.each([
      [
        'component root',
        `<KeepAlive><components.Child v-if="data.ok" /></KeepAlive>`,
        ['mounted', 'activated'],
      ],
      [
        'direct component',
        `<KeepAlive><components.Child /></KeepAlive>`,
        ['mounted', 'activated'],
      ],
      [
        'element root',
        `<KeepAlive><div><components.Child v-if="data.ok" /></div></KeepAlive>`,
        ['mounted'],
      ],
    ])('activated on hydration: %s', async (_, inner, expected) => {
      const calls: string[] = []
      const data = ref<any>({ ok: true, log: (s: string) => calls.push(s) })
      await testHydration(
        `<template>${inner}</template>`,
        {
          Child: `<script setup>
            import { onActivated, onMounted } from 'vue'
            const data = _data
            onMounted(() => data.value.log('mounted'))
            onActivated(() => data.value.log('activated'))
          </script>
          <template><span>child</span></template>`,
        },
        data,
      )
      await nextTick()
      expect(calls).toEqual(expected)
    })

    test('fallthrough attrs through a KeepAlive root', async () => {
      const data = ref({ ok: true, title: 'one' })
      const { container, html } = await testHydration(
        `<template><components.Child class="outer" :title="data.title" /></template>`,
        {
          A: `<template><div class="box">A</div></template>`,
          Child: `<template><KeepAlive><components.A v-if="data.ok" /></KeepAlive></template>`,
        },
        data,
      )
      expect(html).toBe('<div class="box outer" title="one">A</div>')
      const el = () => container.querySelector('div')!
      expect(el().outerHTML).toBe('<div class="box outer" title="one">A</div>')

      data.value.title = 'two'
      await nextTick()
      expect(el().getAttribute('title')).toBe('two')

      data.value.ok = false
      await nextTick()
      data.value.ok = true
      await nextTick()
      expect(el().outerHTML).toBe('<div class="box outer" title="two">A</div>')
    })

    test('v-if KeepAlive with dynamic component should preserve cached branches', async () => {
      const data = ref({
        current: 'CompA',
        useKeepAlive: true,
      })
      const { container } = await testHydration(
        `<script setup>
          import { KeepAlive, computed } from 'vue'
          const data = _data
          const components = _components
          const current = computed(() => components[data.value.current])
        </script>
        <template>
          <KeepAlive v-if="data.useKeepAlive">
            <component :is="current" />
          </KeepAlive>
          <component v-else :is="current" />
        </template>`,
        {
          CompA: `<script setup>
            import { ref } from 'vue'
            const count = ref(0)
          </script>
          <template>
            <button @click="count++">A {{ count }}</button>
          </template>`,
          CompB: `<script setup>
            import { ref } from 'vue'
            const msg = ref('')
          </script>
          <template>
            <input v-model="msg">
            <p>B {{ msg }}</p>
          </template>`,
        },
        data,
      )

      const getButton = () =>
        container.querySelector('button') as HTMLButtonElement
      const getInput = () =>
        container.querySelector('input') as HTMLInputElement
      const getText = () => container.querySelector('p')!.textContent

      expect(getButton().textContent).toBe('A 0')
      triggerEvent('click', getButton())
      await nextTick()
      expect(getButton().textContent).toBe('A 1')

      data.value.current = 'CompB'
      await nextTick()
      getInput().value = 'hello'
      triggerEvent('input', getInput())
      await nextTick()
      expect(getText()).toBe('B hello')

      data.value.current = 'CompA'
      await nextTick()
      expect(getButton().textContent).toBe('A 1')

      data.value.current = 'CompB'
      await nextTick()
      expect(getInput().value).toBe('hello')
      expect(getText()).toBe('B hello')
    })

    test('consecutive dynamic components with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span/>
            <component :is="components[data]"/>
            <component :is="components[data]"/>
            <span/>
          </div>
        </template>`,
        {
          foo: `<template><div>foo</div></template>`,
          bar: `<template><div>bar</div></template>`,
        },
        ref('foo'),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>foo</div><!--dynamic-component--><div>foo</div><!--dynamic-component--><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>bar</div><!--dynamic-component--><div>bar</div><!--dynamic-component--><span></span></div>"`,
      )
    })

    test('dynamic component with v-once', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span/>
            <component :is="components[data]" v-once/>
            <span/>
          </div>
        </template>`,
        {
          foo: `<template><div>foo</div></template>`,
          bar: `<template><div>bar</div></template>`,
        },
        ref('foo'),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>foo</div><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>foo</div><span></span></div>"`,
      )
    })

    test('null dynamic component with v-once', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span/>
            <component :is="components[data]" v-once/>
            <span/>
          </div>
        </template>`,
        {
          foo: `<template><div>foo</div></template>`,
        },
        ref('missing'),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><!----><span></span></div>"`,
      )

      data.value = 'foo'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><!----><span></span></div>"`,
      )
    })

    test('dynamic component fallback', async () => {
      const { container, data } = await testHydration(
        `<template>
            <component :is="'button'">
              <span>{{ data }}</span>
            </component>
          </template>`,
        {},
        ref('foo'),
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<button><span>foo</span></button><!--dynamic-component-->"`,
      )
      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<button><span>bar</span></button><!--dynamic-component-->"`,
      )
    })

    test('dynamic native element with empty v-if child', async () => {
      const { container, data, html } = await testHydration(
        `<template>
          <component :is="data ? 'section' : 'div'">
            <span v-if="data" class="badge">named</span>
          </component>
        </template>`,
        {},
        ref(false),
      )

      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(html).toBe(`<div><!----></div>`)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><!----></div><!--dynamic-component-->"`,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<section><span class="badge">named</span><!--if--></section><!--dynamic-component-->"`,
      )
    })

    test('in ssr slot vnode fallback', async () => {
      const { container, data } = await testHydration(
        `<template>
            <components.Child>
              <span>{{ data }}</span>
            </components.Child>
          </template>`,
        {
          Child: `
          <template>
            <component :is="'div'">
              <slot />
            </component>
          </template>`,
        },
        ref('foo'),
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        </div><!--dynamic-component-->"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>bar</span><!--]-->
        </div><!--dynamic-component-->"
      `,
      )
    })

    test('dynamic component fallback with dynamic slots', async () => {
      const data = ref({
        name: 'default',
        msg: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <component :is="'div'">
            <template v-slot:[data.name]>
              <span>{{ data.msg }}</span>
            </template>
          </component>
        </template>`,
        {},
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>foo</span><!----></div><!--dynamic-component-->"`,
      )

      data.value.msg = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>bar</span><!----></div><!--dynamic-component-->"`,
      )
    })

    test('dynamic component fallback with non-default dynamic slot hydrates empty native children', async () => {
      const data = ref({
        name: 'other',
        msg: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <component :is="'div'">
            <template v-slot:[data.name]>
              <span>{{ data.msg }}</span>
            </template>
          </component>
        </template>`,
        {},
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><!----></div><!--dynamic-component-->"`,
      )
    })

    test('dynamic component fallback with dynamic slot removes stale default native children', async () => {
      const code = `<script setup>
        const data = _data
      </script>
      <template>
        <component :is="'div'">
          <template v-slot:[data.name]>
            <span>{{ data.msg }}</span>
            <em>stale</em>
          </template>
        </component>
      </template>`
      const serverData = ref({
        name: 'default',
        msg: 'foo',
      })
      const clientData = ref({
        name: 'other',
        msg: 'foo',
      })
      const serverComp = compile(
        code,
        serverData,
        {},
        { vapor: true, ssr: true },
      )
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(serverComp),
      )

      const { container } = await mountWithHydration(html, code, clientData)

      expect(`Hydration children mismatch`).toHaveBeenWarned()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><!----></div><!--dynamic-component-->"`,
      )
    })

    test('dynamic component fallback with dynamic slot mounts default native children over empty SSR children', async () => {
      const code = `<script setup>
        const data = _data
      </script>
      <template>
        <component :is="'div'">
          <template v-slot:[data.name]>
            <span>{{ data.msg }}</span>
          </template>
        </component>
      </template>`
      const serverData = ref({
        name: 'other',
        msg: 'foo',
      })
      const clientData = ref({
        name: 'default',
        msg: 'foo',
      })
      const serverComp = compile(
        code,
        serverData,
        {},
        { vapor: true, ssr: true },
      )
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(serverComp),
      )

      const { container } = await mountWithHydration(html, code, clientData)

      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>foo</span><!----></div><!--dynamic-component-->"`,
      )
    })

    test('dynamic component fallback with empty text children', async () => {
      const data = ref('')
      const { container } = await testHydration(
        `<template><component :is="'p'">{{ data }}</component></template>`,
        {},
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<p></p><!--dynamic-component-->"`,
      )

      data.value = 'foo'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<p>foo</p><!--dynamic-component-->"`,
      )
    })

    test('dynamic component fallback with trailing empty text children', async () => {
      const data = ref('')
      const { container } = await testHydration(
        `<template><div><component :is="'button'"><i/>{{ data }}</component><b/></div></template>`,
        {},
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><button><i></i></button><!--dynamic-component--><b></b></div>"`,
      )

      data.value = 'foo'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><button><i></i>foo</button><!--dynamic-component--><b></b></div>"`,
      )
    })

    test.each([true, false])(
      'dynamic native element removes stale SSR v-if children (dev: %s)',
      async dev => {
        const prevDev = __DEV__
        __DEV__ = dev
        try {
          const data = ref(false)
          const { container } = await testHydration(
            `<template>
              <component :is="'div'">
                <span v-if="data">stale</span>
              </component>
            </template>`,
            {},
            data,
            { serverData: ref(true) },
          )

          expect(container.querySelector('span')).toBeNull()
          if (__DEV__) {
            expect(`Hydration children mismatch`).toHaveBeenWarned()
          }

          data.value = true
          await nextTick()
          expect(container.querySelectorAll('span')).toHaveLength(1)

          data.value = false
          await nextTick()
          expect(container.querySelector('span')).toBeNull()
        } finally {
          __DEV__ = prevDev
        }
      },
    )

    test('TransitionGroup in a dynamic native element', async () => {
      const { container, data, html } = await testHydration(
        `<template>
          <component :is="'section'">
            <ol>
              <TransitionGroup>
                <li v-for="i in data" :key="i">{{ i }}</li>
              </TransitionGroup>
            </ol>
          </component>
        </template>`,
        {},
        ref([1, 2]),
      )

      expect(`children must be keyed`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(html).toBe(
        `<section><ol><!--[--><!--[--><li>1</li><li>2</li><!--]--><!--]--></ol></section>`,
      )

      data.value.push(3)
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<section><ol>
        <!--[-->
        <!--[--><li>1</li><li>2</li><li class="v-enter-from v-enter-active">3</li><!--]-->
        <!--]-->
        </ol></section><!--dynamic-component-->"
      `)
    })

    test('TransitionGroup with a tag and two lists in a dynamic native element', async () => {
      const { container, data, html } = await testHydration(
        `<template>
          <component :is="'section'">
            <TransitionGroup tag="ul">
              <li v-for="i in data" :key="i">a{{ i }}</li>
              <li v-for="i in data" :key="'b' + i">b{{ i }}</li>
            </TransitionGroup>
          </component>
        </template>`,
        {},
        ref([1]),
      )

      expect(`children must be keyed`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(html).toBe(
        `<section><ul><!--[--><li>a1</li><!--]--><!--[--><li>b1</li><!--]--></ul></section>`,
      )

      data.value.push(2)
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<section><ul>
        <!--[--><li>a1</li><li class="v-enter-from v-enter-active">a2</li><!--]-->
        <!--[--><li>b1</li><li class="v-enter-from v-enter-active">b2</li><!--]-->
        </ul></section><!--dynamic-component-->"
      `)
    })

    test('Transition with a false v-if in a dynamic native element', async () => {
      const { container, data, html } = await testHydration(
        `<template>
          <component :is="'div'">
            <Transition>
              <p v-if="data">a</p>
            </Transition>
            <span>s</span>
          </component>
        </template>`,
        {},
        ref(false),
      )

      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(html).toBe(`<div><!----><span>s</span></div>`)

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><p class="v-enter-from v-enter-active">a</p><!----><span>s</span></div><!--dynamic-component-->"`,
      )
    })

    test('dynamic native element slot props keep their default', async () => {
      const { container, html } = await testHydration(
        `<template>
          <component :is="'section'" v-slot="p = { msg: 'fallback' }">
            <b>{{ p.msg }}</b>
          </component>
        </template>`,
      )

      expect(html).toBe(`<section><b>fallback</b></section>`)
      expect(container.querySelector('b')!.textContent).toBe('fallback')
    })

    test('normalizes slot style before hydration and subsequent updates', async () => {
      const { container, html, data, app } = await testHydration(
        `<template><components.Child v-slot="p"><span>{{ p.style.color }}</span></components.Child></template>`,
        {
          Child: `<template><slot :style="data.s" v-bind="{ title: 't' }" /></template>`,
        },
        ref({ s: 'color: red' }),
      )
      expect(html).toContain('<span>red</span>')
      const span = container.querySelector('span')!
      expect(span.textContent).toBe('red')
      data.value.s = 'color: blue'
      await nextTick()
      expect(container.querySelector('span')).toBe(span)
      expect(span.textContent).toBe('blue')
      app.unmount()
    })

    test('empty string dynamic component', async () => {
      const { container, data, html } = await testHydration(
        `<template>
          <div>
            <component :is="data" />
            <i>tail</i>
          </div>
        </template>`,
        {},
        ref(''),
      )

      expect(`Invalid vnode type when creating vnode`).toHaveBeenWarned()
      expect(`Invalid dynamic component type`).toHaveBeenWarned()
      expect(html).toBe(`<div><!----><i>tail</i></div>`)

      data.value = 'section'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><section></section><!----><i>tail</i></div>"`,
      )
    })

    test('dynamic component that renders nothing, in a component root element', async () => {
      const { container, data } = await testHydration(
        `<template><components.Card /></template>`,
        {
          empty: `<template><b v-if="false">empty</b></template>`,
          full: `<template><b>full</b></template>`,
          Card: `<template><div class="card"><component :is="components[data]" /></div></template>`,
        },
        ref('empty'),
      )
      data.value = 'full'
      await nextTick()
      expect(container.querySelector('.card')!.innerHTML).toContain(
        '<b>full</b>',
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div class="card"><b>full</b><!--dynamic-component--></div>"`,
      )
    })

    test.each([false, true])(
      'dynamic component with a dynamic slot name keeps its children in the element (show: %s)',
      async show => {
        const { container, data } = await testHydration(
          `<template>
            <component :is="'div'">
              <template #[data.name]><b v-if="data.show">full</b></template>
            </component>
          </template>`,
          {},
          ref({ name: 'default', show }),
        )
        data.value.name = 'other'
        await nextTick()
        data.value.show = true
        data.value.name = 'default'
        await nextTick()
        expect(container.innerHTML).toBe(
          '<div><b>full</b><!--if--><!----></div><!--dynamic-component-->',
        )
      },
    )
  })

  // The sole root of a component renders in the range the component claimed:
  // the server opens one range for the chain, around the roots at its end.
  describe('sole root sharing the range of its parent', () => {
    const pages = {
      Single: `<p>single</p>`,
      Multi: `<h1>multi</h1><p>page</p>`,
      Layout: `<h2>layout</h2><components.View name="page" />`,
    }

    // vue-router's vapor RouterView: hand-written, so the server renders a
    // vdom stand-in whose output is the route component's own. The client
    // creates the route component as a compiled sole root is created.
    const mountView = async (
      app: string,
      data: Record<string, string>,
      create: (
        get: () => any,
      ) => ReturnType<typeof createDynamicComponent> = get =>
        createDynamicComponent(
          get,
          null,
          null,
          VaporDynamicComponentFlags.SINGLE_ROOT,
        ),
    ) => {
      const route = ref(data)
      const server: Record<string, any> = {
        View: defineComponent({
          props: { name: String },
          setup: props => () => h(server[route.value[props.name!]]),
        }),
      }
      const client: Record<string, any> = {
        View: defineVaporComponent({
          props: { name: String },
          setup: props => create(() => client[route.value[props.name!]]),
        }),
      }
      for (const name in pages) {
        const page = (pages as any)[name]
        server[name] = compileVaporComponent(page, route, server, true)
        client[name] = compileVaporComponent(page, route, client)
      }
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(
          compileVaporComponent(app, route, server, true),
        ),
      )
      const { container } = await mountWithHydration(html, app, route, client)
      return { container, route, html }
    }

    test('a hand-written wrapper of a multi-root page', async () => {
      const { container, route, html } = await mountView(
        `<components.View name="page" />`,
        { page: 'Multi' },
      )
      expect(html).toBe(`<!--[$--><h1>multi</h1><p>page</p><!--]-->`)
      expect(container.innerHTML).toBe(
        `<!--[$--><h1>multi</h1><p>page</p><!--dynamic-component--><!--]-->`,
      )

      route.value = { page: 'Single' }
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--[$--><p>single</p><!--dynamic-component--><!--]-->`,
      )
    })

    test('a hand-written wrapper before a sibling', async () => {
      const { container, route, html } = await mountView(
        `<div>
          <components.View name="page" />
          <footer>f</footer>
        </div>`,
        { page: 'Multi' },
      )
      expect(html).toBe(
        `<div><!--[$--><h1>multi</h1><p>page</p><!--]--><footer>f</footer></div>`,
      )
      expect(container.innerHTML).toBe(
        `<div><!--[$--><h1>multi</h1><p>page</p><!--dynamic-component--><!--]-->` +
          `<footer>f</footer></div>`,
      )

      route.value = { page: 'Single' }
      await nextTick()
      expect(container.innerHTML).toBe(
        `<div><!--[$--><p>single</p><!--dynamic-component--><!--]-->` +
          `<footer>f</footer></div>`,
      )
    })

    test('a hand-written wrapper in a multi-root layout', async () => {
      const { container, route, html } = await mountView(
        `<components.View name="layout" />`,
        { layout: 'Layout', page: 'Multi' },
      )
      expect(html).toBe(
        `<!--[$--><h2>layout</h2>` +
          `<!--[$--><h1>multi</h1><p>page</p><!--]-->` +
          `<!--]-->`,
      )
      expect(container.innerHTML).toBe(
        `<!--[$--><h2>layout</h2>` +
          `<!--[$--><h1>multi</h1><p>page</p><!--dynamic-component--><!--]-->` +
          `<!--]-->`,
      )

      route.value = { layout: 'Layout', page: 'Single' }
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--[$--><h2>layout</h2>` +
          `<!--[$--><p>single</p><!--dynamic-component--><!--]-->` +
          `<!--]-->`,
      )
    })

    // the route component is created where it is read, and rendered as a block
    test('a hand-written wrapper creating its root itself', async () => {
      const { container, html } = await mountView(
        `<div>
          <components.View name="page" />
          <footer>f</footer>
        </div>`,
        { page: 'Multi' },
        get => {
          let view: any
          return createDynamicComponent(() =>
            view && view.type === get()
              ? view
              : (view = createComponent(get(), null, null, true)),
          )
        },
      )
      expect(container.innerHTML).toBe(
        html.replace('<!--]-->', '<!--dynamic-component--><!--]-->'),
      )
    })

    // a comment is a root for the server's range. The component next to it
    // is a single root only for fallthrough attrs: the range is the parent's,
    // which shares it when it is a sole root itself
    test.each([
      ['after', `<components.Multi /><!-- c -->`, 'Parent'],
      ['before', `<!-- c --><components.Multi />`, 'Parent'],
      ['after', `<components.Multi /><!-- c -->`, 'Wrapper'],
      ['before', `<!-- c --><components.Multi />`, 'Wrapper'],
    ])(
      'a multi-root single root with a comment %s it (%s, %s)',
      async (_, parent, root) => {
        const data = ref('x')
        const { container, html } = await testHydration(
          `<template>
            <div>
              <components.${root} />
              <b>{{ data }}</b>
            </div>
          </template>`,
          {
            Multi: `<template><i>a</i><span>{{ data }}</span></template>`,
            Parent: `<template>${parent}</template>`,
            Wrapper: `<template><components.Parent /></template>`,
          },
          data,
        )
        expect(container.innerHTML).toBe(html)

        data.value = 'y'
        await nextTick()
        expect(container.querySelector('span')!.textContent).toBe('y')
        expect(container.querySelector('b')!.textContent).toBe('y')
      },
    )

    // the comment after it is the parent's root: an async component, which
    // holds its server nodes until it hydrates, holds its own only
    test.each([
      ['resolved', true],
      ['unresolved', false],
    ])(
      'an async sole root with a comment after it (%s)',
      async (_, resolved) => {
        const data = ref('x')
        const inner = `<i>{{ data }}</i>`
        const parent = `<components.Async /><!-- c -->`
        const app = `<div>
          <components.Parent />
          <b>after</b>
        </div>`
        const server: Record<string, any> = {
          Async: defineAsyncComponent(() =>
            Promise.resolve(compileVaporComponent(inner, data, {}, true)),
          ),
        }
        server.Parent = compileVaporComponent(parent, data, server, true)
        const html = await VueServerRenderer.renderToString(
          runtimeDom.createSSRApp(
            compileVaporComponent(app, data, server, true),
          ),
        )

        let resolve!: () => void
        const Inner = compileVaporComponent(inner, data)
        const Async = defineVaporAsyncComponent(
          () => new Promise<any>(r => (resolve = () => r(Inner))),
        )
        if (resolved) {
          const loaded = (Async as any).__asyncLoader()
          resolve()
          await loaded
        }
        const client: Record<string, any> = { Async }
        client.Parent = compileVaporComponent(parent, data, client)
        const { container } = await mountWithHydration(html, app, data, client)
        const i = container.querySelector('i')
        if (!resolved) {
          expect(container.innerHTML).toBe(html)
          resolve()
          await new Promise(r => setTimeout(r))
        }
        expect(container.innerHTML).toBe(
          html.replace('</i>', '</i><!--async component-->'),
        )

        data.value = 'y'
        await nextTick()
        expect(container.querySelector('i')).toBe(i)
        expect(i!.textContent).toBe('y')
      },
    )

    // server and client render components of other root counts
    const roots = {
      One: `<template><i>x</i></template>`,
      Two: `<template><i>x</i><span>y</span></template>`,
      Mid: `<template><component :is="components[data.c]" /></template>`,
      Top: `<template><components.Mid /></template>`,
      First: `<template>
        <component :is="components[data.c]" />
        <span>sibling</span>
      </template>`,
      Kept: `<template>
        <KeepAlive><component :is="components[data.c]" /></KeepAlive>
        <span>sibling</span>
      </template>`,
    }

    // the range a chain shares is the one of the roots the server rendered
    test.each([
      ['fewer', 'Two', 'One', `<i>x</i>`, 'children'],
      ['more', 'One', 'Two', `<i>x</i><span>y</span>`, 'node'],
    ])(
      'a chain of sole roots rendering %s roots than the server',
      async (_, server, client, html, warning) => {
        const { container } = await testHydration(
          `<template>
            <div>
              <components.Top />
              <b>after</b>
            </div>
          </template>`,
          roots,
          ref({ c: client }),
          { serverData: ref({ c: server }) },
        )
        expect(stripAnchors(container.innerHTML)).toBe(
          `<div>${html}<b>after</b></div>`,
        )
        expect(`Hydration ${warning} mismatch`).toHaveBeenWarned()
      },
    )

    // a root next to another shares no range: the one around is the parent's
    test.each(['First', 'Kept'])(
      'a first root rendering more roots than the server (%s)',
      async parent => {
        const { container } = await testHydration(
          `<template><components.${parent} /></template>`,
          roots,
          ref({ c: 'Two' }),
          { serverData: ref({ c: 'One' }) },
        )
        expect(stripAnchors(container.innerHTML)).toBe(
          `<i>x</i><span>y</span><span>sibling</span>`,
        )
        expect(`Hydration node mismatch`).toHaveBeenWarned()
      },
    )
  })
})
