import {
  createComponent,
  createVaporSSRApp,
  defineVaporComponent,
} from '../../src'
import { nextTick, reactive, ref } from '@vue/runtime-dom'
import { BindingTypes } from '@vue/compiler-dom'
import {
  VueServerRenderer,
  compile,
  compileToVaporRender,
  runtimeDom,
} from '../_utils'
import {
  formatHtml,
  mountWithHydration,
  setupHydrationTest,
  testHydration,
  triggerEvent,
} from './_helpers'

setupHydrationTest()

describe('Vapor Mode hydration', () => {
  describe('component', () => {
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
        <!--[--><div>foo</div>-foo-<!--]-->
        </div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar-<!--]-->
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
        <!--[--><div>foo</div>-foo-<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div>bar</div>-bar-<!--]-->
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
        <!--[--><div></div>
        <!--[--><div>foo</div>-foo-<!--]-->
        <div></div><!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div></div>
        <!--[--><div>bar</div>-bar-<!--]-->
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
        <!--[--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar<!--]-->
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
        <!--[--><div>foo</div>-foo-<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar-<!--]-->
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
        <!--[--><div>foo</div>-foo-<!--]-->
        <span></span></div><span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span><div><span></span>
        <!--[--><div>bar</div>-bar-<!--]-->
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
        <!--[--><div>foo</div>-foo<!--]-->
        <!--[--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar<!--]-->
        <!--[--><div>bar</div>-bar<!--]-->
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
        <!--[--><div>foo</div>-foo-<!--]-->
        <!--[--><div>foo</div>-foo-<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar-<!--]-->
        <!--[--><div>bar</div>-bar-<!--]-->
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
        <!--[--><div>foo</div>-foo-<!--]-->
        <!--[--><div>foo</div>-foo-<!--]-->
        <span></span></div><span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span><div><span></span>
        <!--[--><div>bar</div>-bar-<!--]-->
        <!--[--><div>bar</div>-bar-<!--]-->
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
        <!--[-->
        <!--[--><div>foo</div>-foo-<!--]-->
        <!--[--><div>foo</div>-foo-<!--]-->
        <!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[-->
        <!--[--><div>bar</div>-bar-<!--]-->
        <!--[--><div>bar</div>-bar-<!--]-->
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
        <!--[--><div>foo</div>-foo<!--]-->
        <span></span>
        <!--[--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar<!--]-->
        <span></span>
        <!--[--><div>bar</div>-bar<!--]-->
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
        <!--[--><div>foo</div>-foo<!--]-->
         foo 
        <!--[--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar<!--]-->
         bar 
        <!--[--><div>bar</div>-bar<!--]-->
        <span></span></div>"
      `,
      )
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
  })
})
