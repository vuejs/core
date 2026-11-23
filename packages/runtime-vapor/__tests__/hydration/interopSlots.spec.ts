import { h, nextTick, reactive, ref, renderSlot } from '@vue/runtime-dom'
import {
  VueServerRenderer,
  compile,
  runtimeDom,
  runtimeVapor,
  stripAnchors,
} from '../_utils'
import { setIsHydratingEnabled } from '../../src/dom/hydration'
import {
  formatHtml,
  setupHydrationTest,
  testHydration,
  testWithVDOMApp,
  testWithVaporApp,
} from './_helpers'

setupHydrationTest()

describe('VDOM interop', () => {
  // Previous tests (e.g. createVaporSSRApp) leave isHydratingEnabled = true.
  beforeEach(() => {
    setIsHydratingEnabled(false)
  })

  test('hydrate VDOM slot content', async () => {
    const data = ref('foo')
    const { container } = await testWithVaporApp(
      `<script setup>
        const data = _data; const components = _components;
      </script>
      <template>
        <components.VdomWrapper>
          <div>{{ data }}</div>
        </components.VdomWrapper>
      </template>`,
      {
        VdomWrapper: {
          code: `<script setup>const data = _data;</script>
            <template><slot /></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--[--><div>foo</div><!--]-->
      <!--}-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--[--><div>bar</div><!--]-->
      <!--}-->
      "
    `,
    )
  })

  test('hydrate VDOM slot content with a vapor component in a vapor <slot /> root', async () => {
    const { container, html } = await testWithVDOMApp(
      `<script setup>const components = _components;</script>
      <template>
        <components.VaporProvider><components.VaporChild /></components.VaporProvider>
      </template>`,
      {
        VaporProvider: { code: `<template><slot /></template>`, vapor: true },
        VaporChild: {
          code: `<template><span>child</span></template>`,
          vapor: true,
        },
      },
      ref({}),
    )

    expect(container.innerHTML).toBe(html)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  })

  test('hydrate VDOM slot content should unmount hydrated slot child before first insert', async () => {
    const data = ref({
      unmounted: vi.fn(),
    })

    const appCode = `<script setup>
      const components = _components
    </script>
    <template>
      <components.VaporChild>
        <components.SlotChild />
      </components.VaporChild>
    </template>`

    const ssrComponents = {
      VaporChild: compile(
        `<template><slot /></template>`,
        data,
        {},
        {
          vapor: true,
          ssr: true,
        },
      ),
      SlotChild: compile(
        `<script setup>
          import { onUnmounted } from 'vue'
          const data = _data
          onUnmounted(() => data.value.unmounted())
        </script>
        <template><div>slot child</div></template>`,
        data,
        {},
        {
          vapor: false,
          ssr: true,
        },
      ),
    }

    const clientComponents = {
      VaporChild: compile(
        `<template><slot /></template>`,
        data,
        {},
        {
          vapor: true,
          ssr: false,
        },
      ),
      SlotChild: compile(
        `<script setup>
          import { onUnmounted } from 'vue'
          const data = _data
          onUnmounted(() => data.value.unmounted())
        </script>
        <template><div>slot child</div></template>`,
        data,
        {},
        {
          vapor: false,
          ssr: false,
        },
      ),
    }

    const serverComp = compile(appCode, data, ssrComponents, {
      vapor: false,
      ssr: true,
    })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
    )

    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html

    const clientComp = compile(appCode, data, clientComponents, {
      vapor: false,
      ssr: false,
    })
    const app = runtimeDom.createSSRApp(clientComp)
    app.use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    app.unmount()
    await nextTick()

    expect(data.value.unmounted).toHaveBeenCalledTimes(1)
  })

  test('hydrate VDOM slot fallback', async () => {
    const data = ref('foo')
    const { container } = await testWithVaporApp(
      `<script setup>
        const data = _data; const components = _components;
      </script>
      <template>
        <components.VdomWrapper />
      </template>`,
      {
        VdomWrapper: {
          code: `<script setup>const data = _data;</script>
            <template><slot><div>{{ data }}</div></slot></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><div>foo</div><!--)-->
      <!--}-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><div>bar</div><!--)-->
      <!--}-->
      "
    `,
    )
  })

  test('hydrate compiled VDOM slot content can switch to vapor fallback', async () => {
    const data = ref({ show: true })
    const { container } = await testWithVDOMApp(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.VaporChild>
          <div v-if="data.show">content</div>
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<template><slot><span>fallback</span></slot></template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>content</div><!--]-->
      "
    `)

    data.value.show = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><!--]-->
      <span>fallback</span>"
    `)

    data.value.show = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>content</div><!--]-->
      "
    `)
  })

  test('hydrate VDOM slot content inside Vapor Transition', async () => {
    const data = reactive({ show: true })
    const { container } = await testWithVDOMApp(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.VaporChild>
          <div v-if="data.show">content</div>
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<template>
            <Transition name="fade">
              <slot />
            </Transition>
            <span id="after">after</span>
          </template>`,
          vapor: true,
        },
      },
      data,
    )

    data.show = false
    await nextTick()

    expect(container.querySelector('div')?.className).toBe(
      'fade-leave-from fade-leave-active',
    )
    expect(container.querySelector('#after')?.previousElementSibling).toBe(
      container.querySelector('div'),
    )
  })

  test('hydrate direct v-once VDOM slot content inside Vapor Transition', async () => {
    const { container } = await testWithVDOMApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.VaporChild>
          <button>content</button>
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<template>
            <Transition>
              <slot v-once />
            </Transition>
            <span id="after">after</span>
          </template>`,
          vapor: true,
        },
      },
    )

    expect(
      '<transition> can only be used on a single element or component',
    ).not.toHaveBeenWarned()
    expect(container.querySelector('button')?.textContent).toBe('content')
    expect(container.querySelector('#after')?.previousElementSibling).toBe(
      container.querySelector('button'),
    )
  })

  test('hydrate Vapor Transition fallback in out-in mode', async () => {
    let leaveDone: (() => void) | undefined
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = reactive({
      show: false,
      onLeave,
    })
    // VDOM SSR preserves an all-comment slot inside Transition, so omit the
    // dynamic slot entirely to make the fallback the server-rendered branch.
    const { container } = await testWithVDOMApp(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.VaporChild>
          <template #default v-if="data.show">
            <div class="content">content</div>
          </template>
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<script setup>const data = _data</script>
            <template>
              <Transition
                mode="out-in"
                :css="false"
                @leave="data.onLeave"
              >
                <slot><div class="fallback">fallback</div></slot>
              </Transition>
            </template>`,
          vapor: true,
        },
      },
      data,
    )
    const fallback = container.querySelector('.fallback')

    expect(fallback).not.toBeNull()
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.show = true
    await nextTick()

    expect(onLeave).toHaveBeenCalledOnce()
    expect(container.querySelector('.fallback')).toBe(fallback)
    expect(container.querySelector('.content')).toBeNull()

    leaveDone!()
    await nextTick()

    expect(container.querySelector('.fallback')).toBeNull()
    expect(container.querySelector('.content')?.textContent).toBe('content')
  })

  test('hydrate compiled VDOM slot child keeps owner root current after branch update', async () => {
    const data = reactive({
      child: 'span',
      show: true,
    })
    const { container } = await testWithVDOMApp(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.VaporChild v-if="data.show">
          <components.VdomChild />
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<template><slot /></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data</script>
            <template>
              <span v-if="data.child === 'span'">span</span>
              <div v-else>div</div>
            </template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><span>span</span><!--]-->
      "
    `)

    data.child = 'div'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>div</div><!--]-->
      "
    `)

    data.show = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toBe('<!--v-if-->')

    data.show = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toBe('<div>div</div>')
  })

  test('hydrate VDOM slot content can mount after hydrating as empty', async () => {
    const data = reactive({
      show: false,
      text: 'foo',
    })
    const { container } = await testWithVDOMApp(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.VaporChild>
          <template v-if="data.show">
            <span>{{ data.text }}</span>
          </template>
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<template><slot /></template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.show = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>foo</span><!--]-->
      "
    `,
    )
  })

  test('hydrate VDOM slot multi-root content can mount after hydrating as empty', async () => {
    const data = reactive({
      show: false,
      text: 'foo',
    })
    const { container } = await testWithVDOMApp(
      `<script setup>
          const data = _data
          const components = _components
        </script>
        <template>
          <components.VaporChild>
            <template v-if="data.show">
              <span>{{ data.text }}</span>
              <span>{{ data.text }}</span>
            </template>
          </components.VaporChild>
        </template>`,
      {
        VaporChild: {
          code: `<template><slot /></template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.show = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
        "
        <!--[--><span>foo</span><span>foo</span><!--]-->
        "
      `,
    )
  })

  test('hydrate interop vapor slot fallback', async () => {
    const data = reactive({
      text: 'foo',
    })
    const { container } = await testWithVDOMApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.VaporChild />
      </template>`,
      {
        VaporChild: {
          code: `<template><components.VdomChild /></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data</script>
          <template><slot><span>{{ data.text }}</span></slot></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><span>foo</span><!--)-->
      <!--}-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.text = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><span>bar</span><!--)-->
      <!--}-->
      "
    `,
    )
  })

  test('hydrate interop vapor slot fallback from empty slot branch', async () => {
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
        <components.VaporChild />
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
      <!--{-->
      <!--(--><!--if--><div>foo</div><!--)-->
      <!--}-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.fallback = 'baz'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><!--if--><div>baz</div><!--)-->
      <!--}-->
      "
    `,
    )

    data.show = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><span>bar</span><!--if--><!--)-->
      <!--}-->
      "
    `,
    )

    data.slot = 'qux'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><span>qux</span><!--if--><!--)-->
      <!--}-->
      "
    `,
    )
  })

  test('hydrate interop vapor slot fallback leading empty branch', async () => {
    const data = reactive({
      showSlot: false,
      showFallbackPrefix: false,
      fallback: 'foo',
      slot: 'bar',
    })
    const { container } = await testWithVDOMApp(
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
            const components = _components
          </script>
          <template>
            <components.VdomChild>
              <template #default>
                <template v-if="data.showSlot">
                  <span>{{ data.slot }}</span>
                </template>
              </template>
            </components.VdomChild>
          </template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data</script>
          <template>
            <slot>
              <i v-if="data.showFallbackPrefix">prefix</i>
              <div>{{ data.fallback }}</div>
            </slot>
          </template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><!--if--><!----><div>foo</div><!--)-->
      <!--}-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()

    data.showFallbackPrefix = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><!--if--><i>prefix</i><div>foo</div><!--)-->
      <!--}-->
      "
    `,
    )
  })

  test('hydrate interop vapor slot falls through when vdom local fallback invalidates', async () => {
    const data = reactive({
      mode: 'local',
      local: 'local fallback',
      outlet: 'outlet fallback',
    })
    const { container } = await testWithVDOMApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.VaporBridge />
      </template>`,
      {
        VaporBridge: {
          code: `<script setup>
            const components = _components
          </script>
          <template>
            <components.VdomInnerSlot>
              <template #bar><slot name="bar" /></template>
            </components.VdomInnerSlot>
          </template>`,
          vapor: true,
        },
        VdomInnerSlot: {
          code: `<script setup>
            const data = _data
            const components = _components
          </script>
          <template>
            <components.VdomOuterSlot>
              <template #foo>
                <slot name="bar">
                  <div v-if="data.mode === 'local'">{{ data.local }}</div>
                </slot>
              </template>
            </components.VdomOuterSlot>
          </template>`,
          vapor: false,
        },
        VdomOuterSlot: {
          code: `<script setup>const data = _data</script>
          <template><slot name="foo"><section>{{ data.outlet }}</section></slot></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--[-->
      <!--(--><div>local fallback</div><!--)-->
      <!--]-->
      <!--}-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.mode = 'empty'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--[-->
      <!--(--><section>outlet fallback</section><!--)-->
      <!--]-->
      <!--}-->
      "
    `,
    )

    data.outlet = 'updated outlet fallback'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--[-->
      <!--(--><section>updated outlet fallback</section><!--)-->
      <!--]-->
      <!--}-->
      "
    `,
    )

    data.local = 'updated local fallback'
    data.mode = 'local'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--[-->
      <!--(--><div>updated local fallback</div><!--)-->
      <!--]-->
      <!--}-->
      "
    `,
    )
  })

  test('hydrate interop vapor slot with fallback should preserve valid slot branches', async () => {
    const data = reactive({
      slot: 'bar',
    })
    const { container } = await testWithVDOMApp(
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
              const components = _components
            </script>
            <template>
              <components.VdomChild>
                <template #default>
                  <div>
                    <template v-if="false">
                      <i>unused</i>
                    </template>
                    <span>{{ data.slot }}</span>
                  </div>
                </template>
              </components.VdomChild>
            </template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<template><slot><p>fallback</p></slot></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--[--><div><!----><span>bar</span></div><!--]-->
      <!--}-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.slot = 'baz'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--[--><div><!----><span>baz</span></div><!--]-->
      <!--}-->
      "
    `,
    )
  })

  test('hydrate interop vapor multi-root slot fallback from empty slot branch', async () => {
    const data = reactive({
      show: false,
      fallbackA: 'foo',
      fallbackB: 'bar',
      slot: 'baz',
    })
    const { container } = await testWithVDOMApp(
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
            <template>
              <slot>
                <div>{{ data.fallbackA }}</div>
                <p>{{ data.fallbackB }}</p>
              </slot>
            </template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><!--if--><div>foo</div><p>bar</p><!--)-->
      <!--}-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.fallbackA = 'qux'
    data.fallbackB = 'quux'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><!--if--><div>qux</div><p>quux</p><!--)-->
      <!--}-->
      "
    `,
    )

    data.show = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(--><span>baz</span><!--if--><!--)-->
      <!--}-->
      "
    `,
    )
  })

  test('hydrate interop vapor multi-root slot fallback should preserve slot anchor on updates', async () => {
    const data = reactive({
      show: false,
      extra: false,
      fallbackA: 'foo',
      fallbackB: 'bar',
      tail: 'tail',
    })
    const { container } = await testWithVDOMApp(
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
              const components = _components
            </script>
            <template>
              <components.VdomChild>
                <template #default>
                  <template v-if="data.show">
                    <span>slot</span>
                  </template>
                </template>
              </components.VdomChild>
            </template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data</script>
            <template>
              <slot>
                <div>{{ data.fallbackA }}</div>
                <p v-if="data.extra">{{ data.fallbackB }}</p>
              </slot>
              <i>{{ data.tail }}</i>
            </template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--[-->
      <!--(--><!--if--><div>foo</div><!----><!--)-->
      <i>tail</i><!--]-->
      <!--}-->
      "
    `,
    )

    data.extra = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--[-->
      <!--(--><!--if--><div>foo</div><p>bar</p><!--)-->
      <i>tail</i><!--]-->
      <!--}-->
      "
    `,
    )
  })

  test('hydrate interop vapor slot fallback should preserve nested forwarded slots', async () => {
    const data = reactive({
      fallback: 'foo',
    })
    const { container } = await testWithVDOMApp(
      `<script setup>
          const components = _components
        </script>
        <template>
          <components.VaporChild />
        </template>`,
      {
        VaporChild: {
          code: `<template><components.VdomChild /></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<template><slot><components.Forwarder /></slot></template>`,
          vapor: false,
        },
        Forwarder: {
          code: `<template><components.Receiver><slot /></components.Receiver></template>`,
          vapor: true,
        },
        Receiver: {
          code: `<script setup>const data = _data</script>
            <template><div><slot>{{ data.fallback }}</slot></div></template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(-->
      <!--{--><div>
      <!--(--><!--slot-->foo<!--)-->
      </div><!--}-->
      <!--)-->
      <!--}-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.fallback = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--{-->
      <!--(-->
      <!--{--><div>
      <!--(--><!--slot-->bar<!--)-->
      </div><!--}-->
      <!--)-->
      <!--}-->
      "
    `,
    )
  })

  // `compile()` turns a script-less SFC into a vapor one: keep the script
  const setup = `<script setup>const data = _data; const components = _components</script>`
  const visible = (container: Element) =>
    container.innerHTML.replace(/<!--[^>]*-->/g, '')
  const count = (container: Element, marker: string) =>
    container.innerHTML.split(marker).length - 1

  describe.each([
    ['in a vdom component', 'Child'],
    // the server then folds the forwarding outlet's own empty range away
    ['forwarded by a vdom component', 'Wrapper'],
  ])('hydrate empty vapor slot content %s', (_, entry) => {
    test.each([
      ['closing a vdom fragment', `<h1>t</h1><slot/>`, `<h1>t</h1><b>b</b>`],
      ['opening a vdom fragment', `<slot/><h1>t</h1>`, `<b>b</b><h1>t</h1>`],
      ['as a vdom root', `<slot/>`, `<b>b</b>`],
      ['closing an element', `<div><slot/></div>`, `<div><b>b</b></div>`],
      [
        'ahead of an element sibling',
        `<div><slot/><h1>t</h1></div>`,
        `<div><b>b</b><h1>t</h1></div>`,
      ],
    ])('%s', async (_, child, shown) => {
      const data = reactive({ show: false })
      const { container, html } = await testWithVaporApp(
        `${setup}<template>
          <components.${entry}><b v-if="data.show">b</b></components.${entry}>
        </template>`,
        {
          Child: {
            code: `${setup}<template>${child}</template>`,
            vapor: false,
          },
          Wrapper: {
            code: `${setup}<template><components.Child><slot/></components.Child></template>`,
            vapor: false,
          },
        },
        data,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      // every server-rendered fragment marker is adopted: none recreated
      expect(count(container, '<!--[-->')).toBe(
        html.split('<!--[-->').length - 1,
      )
      expect(count(container, '<!--]-->')).toBe(
        html.split('<!--]-->').length - 1,
      )

      data.show = true
      await nextTick()
      expect(visible(container)).toBe(shown)
      data.show = false
      await nextTick()
      expect(visible(container)).toBe(shown.replace('<b>b</b>', ''))
    })
  })

  // Once everything in it is empty, the server renders an outlet's fallback
  // in place of its whole content: the forwarded slot and what is around it.
  test.each([
    [
      'forwarded through two vdom components',
      `<components.Mid><slot/></components.Mid>`,
      null,
    ],
    [
      'beside a named slot the parent does not provide',
      `<components.Child><slot/><slot name="b"/></components.Child>`,
      null,
    ],
    [
      'behind a closed v-if branch',
      `<components.Child><i v-if="data.sibling">i</i><slot/></components.Child>`,
      `<i>i</i>`,
    ],
    [
      'ahead of a closed v-if branch',
      `<components.Child><slot/><i v-if="data.sibling">i</i></components.Child>`,
      `<i>i</i>`,
    ],
  ])(
    'hydrate the vdom outlet fallback of an empty forwarded vapor slot %s',
    async (_, wrapper, sibling) => {
      const data = reactive({ show: false, sibling: false })
      const { container, html } = await testWithVaporApp(
        `${setup}<template>
          <components.Wrapper><b v-if="data.show">b</b></components.Wrapper>
        </template>`,
        {
          Child: {
            code: `${setup}<template><slot><p>fallback</p></slot></template>`,
            vapor: false,
          },
          Mid: {
            code: `${setup}<template><components.Child><slot/></components.Child></template>`,
            vapor: false,
          },
          Wrapper: {
            code: `${setup}<template>${wrapper}</template>`,
            vapor: false,
          },
        },
        data,
      )

      expect(html).toBe(`<!--{--><!--(--><p>fallback</p><!--)--><!--}-->`)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      // the server's markers are adopted: none recreated
      expect(count(container, '<!--(-->')).toBe(1)
      expect(count(container, '<!--)-->')).toBe(1)
      expect(count(container, '<!--]-->')).toBe(0)
      expect(visible(container)).toBe(`<p>fallback</p>`)

      data.show = true
      await nextTick()
      expect(visible(container)).toBe(`<b>b</b>`)
      data.show = false
      await nextTick()
      expect(visible(container)).toBe(`<p>fallback</p>`)

      if (sibling) {
        data.sibling = true
        await nextTick()
        expect(visible(container)).toBe(sibling)
        data.sibling = false
        await nextTick()
        expect(visible(container)).toBe(`<p>fallback</p>`)
      }
    },
  )

  // Mounted in place of a fallback the server rendered, the slot starts on a
  // node of its own as on the client: vdom places a sibling entering ahead
  // of it before `el`.
  test.each([
    ['content, then the sibling', ['show', 'sibling']],
    ['the sibling, then content', ['sibling', 'show']],
  ])(
    'a vdom sibling entering before a vapor slot mounted over its outlet fallback: %s',
    async (_, steps) => {
      const data = reactive({ show: false, sibling: false })
      const { container, html } = await testWithVaporApp(
        `${setup}<template>
          <components.Wrapper><b v-if="data.show">b</b></components.Wrapper>
        </template>`,
        {
          Child: {
            code: `${setup}<template>
              <div><slot><p>fallback</p></slot></div>
            </template>`,
            vapor: false,
          },
          Wrapper: {
            code: `${setup}<template>
              <components.Child>
                <i v-if="data.sibling">i</i>
                <slot />
              </components.Child>
            </template>`,
            vapor: false,
          },
        },
        data,
      )
      expect(html).toBe(
        `<!--{--><div><!--(--><p>fallback</p><!--)--></div><!--}-->`,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      for (const key of steps) {
        ;(data as any)[key] = true
        await nextTick()
      }
      expect(visible(container)).toBe(`<div><i>i</i><b>b</b></div>`)
    },
  )

  // content the server did render, however it differs from the client's, is
  // not a fallback to adopt
  test.each([
    ['an empty slot', false, `<p>fallback</p>`],
    ['slot content', true, `<b>b</b>`],
  ])(
    'leave a mismatching sibling of a forwarded vapor slot to vdom, beside %s',
    async (_, show, shown) => {
      const data = reactive({ show, sibling: false })
      const { container, app } = await testWithVaporApp(
        `${setup}<template>
          <components.Wrapper><b v-if="data.show">b</b></components.Wrapper>
        </template>`,
        {
          Child: {
            code: `${setup}<template><slot><p>fallback</p></slot></template>`,
            vapor: false,
          },
          Wrapper: {
            code: `${setup}<template><components.Child><i v-if="data.sibling">i</i><slot/></components.Child></template>`,
            vapor: false,
          },
        },
        data,
        reactive({ show, sibling: true }),
      )
      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(visible(container)).toBe(shown)

      data.show = !show
      await nextTick()
      data.show = show
      await nextTick()
      expect(visible(container)).toBe(shown)

      app.unmount()
      expect(container.innerHTML).toBe('<!--{--><!--}-->')
    },
  )

  test('hydrate a vdom outlet that renders its own fallback inside the one it forwards to', async () => {
    const data = reactive({ show: false })
    const { container, html } = await testWithVaporApp(
      `${setup}<template>
        <components.Wrapper><b v-if="data.show">b</b></components.Wrapper>
      </template>`,
      {
        Child: {
          code: `${setup}<template><slot><p>fallback</p></slot></template>`,
          vapor: false,
        },
        Mid: {
          code: `${setup}<template><components.Child><slot><u>mid</u></slot></components.Child></template>`,
          vapor: false,
        },
        Wrapper: {
          code: `${setup}<template><components.Mid><slot/></components.Mid></template>`,
          vapor: false,
        },
      },
      data,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    expect(html).toBe(
      `<!--{--><!--[--><!--(--><u>mid</u><!--)--><!--]--><!--}-->`,
    )
    expect(count(container, '<!--]-->')).toBe(1)
    expect(count(container, '<!--)-->')).toBe(1)
    expect(visible(container)).toBe(`<u>mid</u>`)

    data.show = true
    await nextTick()
    expect(visible(container)).toBe(`<b>b</b>`)
    data.show = false
    await nextTick()
    expect(visible(container)).toBe(`<u>mid</u>`)
  })

  // a range under the cursor is the fallback's then: the slot has none
  test.each([
    [
      'forwarded through two vdom components',
      `<components.Mid><slot/></components.Mid>`,
    ],
    ['forwarded by one', `<components.Child><slot/></components.Child>`],
  ])(
    'hydrate a vdom outlet fallback that starts with a fragment of its own, %s',
    async (_, wrapper) => {
      const data = reactive({ show: false })
      const { container, html } = await testWithVaporApp(
        `${setup}<template>
          <components.Wrapper><b v-if="data.show">b</b></components.Wrapper>
        </template>`,
        {
          Child: {
            code: `${setup}<template><slot><p v-for="i in 2">fallback</p><em>tail</em></slot></template>`,
            vapor: false,
          },
          Mid: {
            code: `${setup}<template><components.Child><slot/></components.Child></template>`,
            vapor: false,
          },
          Wrapper: {
            code: `${setup}<template>${wrapper}</template>`,
            vapor: false,
          },
        },
        data,
      )
      const fallback = `<p>fallback</p><p>fallback</p><em>tail</em>`

      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      for (const marker of ['<!--(-->', '<!--)-->', '<!--[-->', '<!--]-->']) {
        expect(count(container, marker)).toBe(html.split(marker).length - 1)
      }
      expect(visible(container)).toBe(fallback)

      data.show = true
      await nextTick()
      expect(visible(container)).toBe(`<b>b</b>`)
      data.show = false
      await nextTick()
      expect(visible(container)).toBe(fallback)
    },
  )

  test('hydrate forwarded slot fallback with nested component before parent close marker', async () => {
    const data = ref('foo')
    const { container } = await testWithVaporApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.Child>
          <template #foo><slot name="foo" /></template>
        </components.Child>
      </template>`,
      {
        Child: {
          code: `<script setup>
              const components = _components
              const data = _data
            </script>
            <template>
              <div>
                <slot name="foo">
                  <components.GrandChild
                    v-if="data"
                    :text="data"
                  />
                </slot>
              </div>
            </template>`,
          vapor: true,
        },
        GrandChild: {
          code: `<script setup>
              defineProps(['text'])
            </script>
            <template>
              <template v-if="text">
                <span v-if="text">{{ text }}</span>
              </template>
            </template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--{--><div>
      <!--(--><!--slot-->
      <!--[--><span>foo</span><!--if--><!--]-->
      <!--if--><!--)-->
      </div><!--}-->
      "
    `)
  })

  test('hydrate forwarded slot fallback with empty v-for before becoming valid', async () => {
    const items = ref<string[]>([])
    const { container } = await testWithVaporApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.Child>
          <template #foo><slot name="foo" /></template>
        </components.Child>
      </template>`,
      {
        Child: {
          code: `<script setup>
              const items = _data
            </script>
            <template>
              <div>
                <slot name="foo">
                  <span v-for="item in items" :key="item">{{ item }}</span>
                </slot>
              </div>
            </template>`,
          vapor: true,
        },
      },
      items,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--{--><div>
      <!--(--><!--slot-->
      <!--[--><!--]-->
      <!--)-->
      </div><!--}-->
      "
    `)

    items.value = ['foo']
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--{--><div>
      <!--(--><!--slot-->
      <!--[--><span>foo</span><!--]-->
      <!--)-->
      </div><!--}-->
      "
    `)

    items.value = ['bar']
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--{--><div>
      <!--(--><!--slot-->
      <!--[--><span>bar</span><!--]-->
      <!--)-->
      </div><!--}-->
      "
    `)
  })

  test('hydrate forwarded slot content with empty v-for before nested invalid slot', async () => {
    const data = reactive({
      items: [] as string[],
      tail: 'tail',
    })
    const { container } = await testWithVaporApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.Outer />
      </template>`,
      {
        Outer: {
          code: `<script setup>
            const components = _components
            const data = _data
          </script>
          <template>
            <components.Child>
              <template #foo>
                <span v-for="item in data.items" :key="item">{{ item }}</span>
                <slot name="bar" />
                <b>{{ data.tail }}</b>
              </template>
            </components.Child>
          </template>`,
          vapor: true,
        },
        Child: {
          code: `<template>
            <div>
              <slot name="foo">
                <i>outer fallback</i>
              </slot>
            </div>
          </template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--{-->
      <!--{--><div>
      <!--[-->
      <!--[--><!--]-->
      <!--[--><!--]-->
      <b>tail</b><!--]-->
      </div><!--}-->
      <!--}-->
      "
    `)

    data.items = ['foo']
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--{-->
      <!--{--><div>
      <!--[-->
      <!--[--><span>foo</span><!--]-->
      <!--[--><!--]-->
      <b>tail</b><!--]-->
      </div><!--}-->
      <!--}-->
      "
    `)
  })

  test('preserves hydrated slot boundaries when keyed vdom rows reorder', async () => {
    const data = ref({ list: [1, 2] })
    const { container, app } = await testWithVaporApp(
      `<template><div><components.VDomChild v-for="i in data.list" :key="i"><p>{{ i }}</p></components.VDomChild></div></template>`,
      {
        VDomChild: {
          code: `<script setup>const data = _data</script><template><slot /></template>`,
          vapor: false,
        },
      },
      data,
    )
    try {
      expect('Hydration node mismatch').not.toHaveBeenWarned()
      expect('Hydration children mismatch').not.toHaveBeenWarned()
      const root = container.firstElementChild!
      expect(root.innerHTML).toBe(
        '<!--[--><!--[--><p>1</p><!--]--><!--[--><p>2</p><!--]--><!--]-->',
      )
      const [p1, p2] = root.querySelectorAll('p')
      const start1 = p1.previousSibling
      const end1 = p1.nextSibling
      const start2 = p2.previousSibling
      const end2 = p2.nextSibling

      data.value.list = [2, 1]
      await nextTick()
      expect(root.textContent).toBe('21')
      expect(root.innerHTML).toBe(
        '<!--[--><!--[--><p>2</p><!--]--><!--[--><p>1</p><!--]--><!--]-->',
      )
      expect(p1.previousSibling).toBe(start1)
      expect(p1.nextSibling).toBe(end1)
      expect(p2.previousSibling).toBe(start2)
      expect(p2.nextSibling).toBe(end2)
    } finally {
      app.unmount()
    }
  })

  test('removes hydrated slot fallbacks on replacement and enclosing fragment unmount', async () => {
    const data = ref({
      show: true,
      content: false,
      count: 0,
      connected: [] as boolean[],
      unmounted: vi.fn(),
      watched: vi.fn(),
    })
    const { container, app } = await testWithVDOMApp(
      `<template>
        <template v-if="data.show">
          <components.Panel><i v-if="data.content">content</i></components.Panel>
          <b>tail</b>
        </template>
      </template>`,
      {
        Fallback: {
          code: `<script setup>
            import { getCurrentInstance, onBeforeUnmount, onUnmounted, watch } from 'vue'
            const data = _data
            const instance = getCurrentInstance()
            onBeforeUnmount(() => data.value.connected.push(instance.subTree.el.isConnected))
            onUnmounted(() => data.value.unmounted())
            watch(() => data.value.count, () => data.value.watched())
          </script>
          <template><p>fallback</p></template>`,
          vapor: false,
        },
        Panel: {
          code: `<template><slot><components.Fallback /></slot></template>`,
          vapor: true,
        },
      },
      data,
    )
    try {
      expect('Hydration node mismatch').not.toHaveBeenWarned()
      expect('Hydration children mismatch').not.toHaveBeenWarned()
      const hydratedFallback = container.querySelector('p')!
      expect(container.textContent).toBe('fallbacktail')

      data.value.content = true
      data.value.count++
      await nextTick()
      expect(hydratedFallback.isConnected).toBe(false)
      expect(container.textContent).toBe('contenttail')
      expect(data.value.unmounted).toHaveBeenCalledOnce()
      expect(data.value.connected).toEqual([true])
      expect(data.value.watched).not.toHaveBeenCalled()

      data.value.content = false
      await nextTick()
      const fallback = container.querySelector('p')!
      expect(container.textContent).toBe('fallbacktail')

      data.value.show = false
      data.value.count++
      await nextTick()
      expect(fallback.isConnected).toBe(false)
      expect(container.textContent).toBe('')
      expect(data.value.unmounted).toHaveBeenCalledTimes(2)
      expect(data.value.connected).toEqual([true, true])
      expect(data.value.watched).not.toHaveBeenCalled()
    } finally {
      app.unmount()
    }
  })

  // `<!--(-->`…`<!--)-->` wraps a slot fallback the server rendered: the
  // markup is written by hand.
  test.each([
    ['a vdom outlet that renders a vapor slot', false, true],
    ['a vapor outlet that renders a vdom slot', true, false],
  ])(
    'hydrate the slot fallback range of %s',
    async (_, vaporChild, vaporApp) => {
      const data: any = reactive({ show: false, msg: 'fallback' })
      const setup = `<script setup>const data = _data; const components = _components</script>`
      const container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = `<div><!--(--><p>fallback</p><!--)--></div>`
      const p = container.querySelector('p')!

      const Child = compile(
        `${setup}<template><div><slot><p>{{ data.msg }}</p></slot></div></template>`,
        data,
        {},
        { vapor: vaporChild },
      )
      const App = compile(
        `${setup}<template><components.Child><b v-if="data.show">b</b></components.Child></template>`,
        data,
        { Child },
        { vapor: vaporApp },
      )
      const app = (
        vaporApp
          ? runtimeVapor.createVaporSSRApp(App)
          : runtimeDom.createSSRApp(App)
      ).use(runtimeVapor.vaporInteropPlugin)
      app.mount(container)
      const visible = () => container.innerHTML.replace(/<!--[^>]*-->/g, '')

      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      data.msg = 'updated'
      await nextTick()
      expect(container.querySelector('p')).toBe(p)
      expect(visible()).toBe(`<div><p>updated</p></div>`)

      data.show = true
      await nextTick()
      expect(visible()).toBe(`<div><b>b</b></div>`)
      data.show = false
      await nextTick()
      expect(visible()).toBe(`<div><p>updated</p></div>`)

      app.unmount()
      expect(container.innerHTML).toBe('')
    },
  )

  // jsdom shows no trace of a node taken out and put back: watch the inserts.
  // Only the invalid content's own anchors move, ahead of the fallback.
  test.each([
    ['a vapor outlet', true, true, false],
    ['a vapor outlet, forwarded', true, true, true],
    ['a vdom outlet that renders a vapor slot', true, false, false],
    ['a vdom outlet, forwarded by a vdom component', true, false, true],
    ['a vapor outlet that renders a vdom slot', false, true, false],
  ])(
    'adopt the fallback the server rendered where it is: %s',
    async (_, vaporApp, vaporChild, forwarded) => {
      const data = reactive({ show: false, msg: 'fallback' })
      const moved: string[] = []
      const watch = (name: 'insertBefore' | 'appendChild') => {
        const original = Node.prototype[name] as any
        ;(Node.prototype as any)[name] = function (this: Node, node: Node) {
          if (node.isConnected && node.nodeType === 1) moved.push(node.nodeName)
          return original.apply(this, arguments)
        }
        return () => ((Node.prototype as any)[name] = original)
      }
      const restore = [watch('insertBefore'), watch('appendChild')]
      let container: Element
      try {
        ;({ container } = await (vaporApp ? testWithVaporApp : testWithVDOMApp)(
          `${setup}<template>
            <components.${forwarded ? 'Wrapper' : 'Child'}><b v-if="data.show">b</b></components.${forwarded ? 'Wrapper' : 'Child'}>
          </template>`,
          {
            Child: {
              code: `${setup}<template><div><slot><p>{{ data.msg }}</p><i>tail</i></slot></div></template>`,
              vapor: vaporChild,
            },
            Wrapper: {
              code: `${setup}<template><components.Child><slot/></components.Child></template>`,
              vapor: vaporChild,
            },
          },
          data,
        ))
      } finally {
        restore.forEach(fn => fn())
      }

      expect(visible(container)).toBe(`<div><p>fallback</p><i>tail</i></div>`)
      expect(moved).toEqual([])

      data.show = true
      await nextTick()
      expect(visible(container)).toBe(`<div><b>b</b></div>`)
      data.show = false
      await nextTick()
      expect(visible(container)).toBe(`<div><p>fallback</p><i>tail</i></div>`)
    },
  )

  // the server renders `[]` for the whole chain: nothing to adopt
  test.each([
    ['no content', ``],
    ['content that renders nothing', `<b v-if="data.show">b</b>`],
  ])(
    'hydrate an empty vdom slot forwarded by vapor components without a fallback: %s',
    async (_, content) => {
      const data = reactive({ show: false })
      const { container, html } = await testWithVDOMApp(
        `${setup}<template>
          <components.Wrapper>${content}</components.Wrapper>
        </template>`,
        {
          Child: {
            code: `${setup}<template><div><slot /></div></template>`,
            vapor: true,
          },
          Wrapper: {
            code: `${setup}<template><components.Child><slot /></components.Child></template>`,
            vapor: true,
          },
        },
        data,
      )
      expect(html).toBe(`<!--{--><div><!--[--><!--]--></div><!--}-->`)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(visible(container)).toBe(`<div></div>`)

      data.show = true
      await nextTick()
      expect(visible(container)).toBe(
        content ? `<div><b>b</b></div>` : `<div></div>`,
      )
    },
  )

  // the slot's own outlet comes first among its outlets, and is no fragment
  // of the fallback range the server rendered further out
  test('hydrate the fallback of an outer vdom outlet when the outlet of the slot has one that renders nothing', async () => {
    const data = reactive({ show: false, items: [] as number[] })
    const { container, html } = await testWithVaporApp(
      `${setup}<template>
        <components.Wrapper><b v-if="data.show">b</b></components.Wrapper>
      </template>`,
      {
        Child: {
          code: `${setup}<template><slot><p>fallback</p></slot></template>`,
          vapor: false,
        },
        Mid: {
          code: `${setup}<template><components.Child><slot><u>mid</u></slot></components.Child></template>`,
          vapor: false,
        },
        Wrapper: {
          code: `${setup}<template><components.Mid><slot><p v-for="i in data.items" :key="i">x</p></slot></components.Mid></template>`,
          vapor: false,
        },
      },
      data,
    )
    expect(html).toBe(
      `<!--{--><!--[--><!--(--><u>mid</u><!--)--><!--]--><!--}-->`,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    expect(visible(container)).toBe(`<u>mid</u>`)

    data.show = true
    await nextTick()
    expect(visible(container)).toBe(`<b>b</b>`)
    data.show = false
    await nextTick()
    expect(visible(container)).toBe(`<u>mid</u>`)
  })

  // a component with a client render only (a library component) forwards
  // the vapor slot as vnodes into a template outlet
  test('hydrate the fallback of a template outlet a vnode slot forwards an empty vapor slot into', async () => {
    const data = reactive({ show: false })
    const App = (ssr: boolean) => {
      const Child = compile(
        `${setup}<template><div><slot><p>fallback</p></slot></div></template>`,
        data as any,
        {},
        { vapor: false, ssr },
      )
      const Forward = compile(
        `${setup}<template><components.Child><slot /></components.Child></template>`,
        data as any,
        { Child },
        { vapor: false, ssr: false },
      )
      return compile(
        `${setup}<template>
          <components.Forward><b v-if="data.show">b</b></components.Forward>
        </template>`,
        data as any,
        { Forward },
        { vapor: true, ssr },
      )
    }
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(App(true)),
    )
    expect(html).toBe(
      `<!--{--><div><!--(--><p>fallback</p><!--)--></div><!--}-->`,
    )

    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    const p = container.querySelector('p')
    const app = runtimeVapor
      .createVaporSSRApp(App(false))
      .use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    expect(container.querySelector('p')).toBe(p)

    data.show = true
    await nextTick()
    expect(visible(container)).toBe(`<div><b>b</b></div>`)
    data.show = false
    await nextTick()
    expect(visible(container)).toBe(`<div><p>fallback</p></div>`)

    app.unmount()
    expect(container.innerHTML).toBe('<!--{--><!--}-->')
  })

  // the slot renders the first fallback on its chain that renders something:
  // the server has to pick the same one
  test('hydrate the outer fallback of a vdom outlet rendered as a vnode when the inner one renders nothing', async () => {
    const data = reactive({ show: false, local: false })
    const App = (ssr: boolean) => {
      const Child = {
        render(this: any) {
          return h('div', [
            renderSlot(this.$slots, 'default', {}, () => [
              h('p', 'outer fallback'),
            ]),
          ])
        },
      }
      const Forward = compile(
        `${setup}<template><components.Child><slot><i v-if="data.local">local fallback</i></slot></components.Child></template>`,
        data as any,
        { Child },
        { vapor: false, ssr },
      )
      return compile(
        `${setup}<template>
          <components.Forward><b v-if="data.show">b</b></components.Forward>
        </template>`,
        data as any,
        { Forward },
        { vapor: true, ssr },
      )
    }
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(App(true)),
    )
    expect(html).toBe(
      `<!--{--><div><!--(--><p>outer fallback</p><!--)--></div><!--}-->`,
    )

    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    const p = container.querySelector('p')
    const app = runtimeVapor
      .createVaporSSRApp(App(false))
      .use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    expect(container.querySelector('p')).toBe(p)

    data.local = true
    await nextTick()
    expect(visible(container)).toBe(`<div><i>local fallback</i></div>`)
    data.show = true
    await nextTick()
    expect(visible(container)).toBe(`<div><b>b</b></div>`)
    data.show = false
    data.local = false
    await nextTick()
    expect(visible(container)).toBe(`<div><p>outer fallback</p></div>`)

    app.unmount()
    expect(container.innerHTML).toBe('<!--{--><!--}-->')
  })

  // without `ssrRender` (a render function, or a client-compiled library
  // component) the server renders the outlet as a vnode; the fallback is
  // marked however the vapor slot reached it: `h(Child, null, slots)` renders
  // no outlet in between, a template's does
  test.each([
    ['given', 'render function'],
    ['passed on as it is', 'template'],
    ['passed on as it is', 'render function'],
    ['forwarded by a template', 'render function'],
  ])(
    'hydrate the fallback of a vdom outlet a vapor slot was %s (%s child)',
    async (forward, kind) => {
      const data = reactive({ show: false })
      const App = (ssr: boolean) => {
        const Child =
          kind === 'template'
            ? compile(
                `${setup}<template><div><slot><p>fallback</p></slot></div></template>`,
                data as any,
                {},
                { vapor: false, ssr },
              )
            : {
                render(this: any) {
                  return h('div', [
                    renderSlot(this.$slots, 'default', {}, () => [
                      h('p', 'fallback'),
                    ]),
                  ])
                },
              }
        const Forward =
          forward === 'given'
            ? Child
            : forward === 'forwarded by a template'
              ? compile(
                  `${setup}<template><components.Child><slot /></components.Child></template>`,
                  data as any,
                  { Child },
                  { vapor: false, ssr },
                )
              : {
                  setup(_: any, { slots }: any) {
                    return () => h(Child, null, slots)
                  },
                }
        return compile(
          `${setup}<template>
            <components.Forward><b v-if="data.show">b</b></components.Forward>
          </template>`,
          data as any,
          { Forward },
          { vapor: true, ssr },
        )
      }
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(App(true)),
      )
      expect(html).toBe(
        `<!--{--><div><!--(--><p>fallback</p><!--)--></div><!--}-->`,
      )

      const container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = html
      const p = container.querySelector('p')
      const app = runtimeVapor
        .createVaporSSRApp(App(false))
        .use(runtimeVapor.vaporInteropPlugin)
      app.mount(container)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(container.querySelector('p')).toBe(p)

      data.show = true
      await nextTick()
      expect(visible(container)).toBe(`<div><b>b</b></div>`)
      data.show = false
      await nextTick()
      expect(visible(container)).toBe(`<div><p>fallback</p></div>`)

      app.unmount()
      expect(container.innerHTML).toBe('<!--{--><!--}-->')
    },
  )

  // a vdom outlet keeps its fragment around a vapor slot, however little that
  // one renders: the server has to keep its range too
  test.each([
    ['one vdom component', 1, `<b v-if="data.show">b</b>`, 'template'],
    ['two vdom components', 2, `<b v-if="data.show">b</b>`, 'template'],
    [
      'two vdom components (v-for)',
      2,
      `<b v-for="i in data.show ? 1 : 0" :key="i">b</b>`,
      'template',
    ],
    // a render function renders its outlet as a vnode
    [
      'two vdom components into a render function',
      2,
      `<b v-if="data.show">b</b>`,
      'render function',
    ],
    [
      'two vdom components into a render function (v-for)',
      2,
      `<b v-for="i in data.show ? 1 : 0" :key="i">b</b>`,
      'render function',
    ],
  ])(
    'hydrate an empty vapor slot forwarded by %s without a fallback',
    async (_, levels, content, kind) => {
      const data = reactive({ show: false })
      const App = (ssr: boolean) => {
        const components: any = {}
        const vdom = (code: string) =>
          compile(
            `${setup}<template>${code}</template>`,
            data as any,
            components,
            {
              vapor: false,
              ssr,
            },
          )
        components.Child =
          kind === 'template'
            ? vdom(`<div><slot /></div>`)
            : {
                render(this: any) {
                  return h('div', [renderSlot(this.$slots, 'default')])
                },
              }
        components.W1 = vdom(`<components.Child><slot /></components.Child>`)
        components.W2 = vdom(`<components.W1><slot /></components.W1>`)
        return compile(
          `${setup}<template>
            <components.W${levels}>${content}</components.W${levels}>
          </template>`,
          data as any,
          components,
          { vapor: true, ssr },
        )
      }
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(App(true)),
      )
      const container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = html
      const div = container.querySelector('div')
      const app = runtimeVapor
        .createVaporSSRApp(App(false))
        .use(runtimeVapor.vaporInteropPlugin)
      app.mount(container)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(container.querySelector('div')).toBe(div)

      data.show = true
      await nextTick()
      expect(visible(container)).toBe(`<div><b>b</b></div>`)
      data.show = false
      await nextTick()
      expect(visible(container)).toBe(`<div></div>`)

      app.unmount()
      expect(container.innerHTML).toBe('<!--{--><!--}-->')
    },
  )

  // A vdom render function calling a vapor slot itself (vue-router's
  // RouterView, Suspense) gets one vapor slot vnode on the server too, as from
  // the client's slots proxy: the slot has its range however it is called
  describe('hydrate a vapor slot called directly', () => {
    const multiRoot = `<h1>a</h1><p>{{ data.list[0] }}</p>`
    const mount = (slot: string, call: string, page = `<p/>`, vapor = true) => {
      const data = reactive({
        show: true,
        no: false,
        list: [1],
        empty: [] as number[],
      })
      const update = () => {
        data.show = false
        data.no = true
        data.list = [2]
        data.empty = [3]
        return nextTick()
      }
      return testWithVaporApp(
        `${setup}<template>
          <components.RouterView v-slot="{ Component }">${slot}</components.RouterView>
          <footer>f</footer>
        </template>`,
        {
          Page: { code: `${setup}<template>${page}</template>`, vapor },
          RouterView: {
            code: `<script>
              import { h } from 'vue'
              export default {
                setup(_, { slots }) {
                  return () => ${call}
                },
              }
            </script>`,
            vapor: false,
          },
        },
        data,
      ).then(({ container, html }) => ({
        container,
        ssr: html.replace(/<!--[^>]*-->/g, ''),
        update,
      }))
    }
    const page = `{ Component: _components.Page }`

    test.each([
      ['a multi-root page', multiRoot, true, `<h1>a</h1><p>2</p>`],
      ['a multi-root vdom page', multiRoot, false, `<h1>a</h1><p>2</p>`],
      [
        'a page with a leading v-if branch',
        `<template v-if="data.show"><i>a</i></template><p>{{ data.list[0] }}</p>`,
        true,
        `<p>2</p>`,
      ],
      [
        'a slot fallback page',
        `<slot><p>{{ data.list[0] }}</p></slot>`,
        true,
        `<p>2</p>`,
      ],
    ])('under Suspense with %s', async (_, code, vapor, updated) => {
      const { container, ssr, update } = await mount(
        `<Suspense><component :is="Component" /></Suspense>`,
        `slots.default(${page})[0]`,
        code,
        vapor,
      )
      expect(visible(container)).toBe(ssr)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      await update()
      expect(visible(container)).toBe(`${updated}<footer>f</footer>`)
    })

    // Nuxt's NuxtPage passes the slot vnode on through `h(vnode)`, a clone
    test.each([
      ['a multi-root vdom page', multiRoot, false, `<h1>a</h1><p>2</p>`],
      [
        'a slot fallback page',
        `<slot><p>{{ data.list[0] }}</p></slot>`,
        true,
        `<p>2</p>`,
      ],
    ])('cloned with %s', async (_, code, vapor, updated) => {
      const { container, ssr, update } = await mount(
        `<component :is="Component" />`,
        `h(slots.default(${page})[0])`,
        code,
        vapor,
      )
      expect(visible(container)).toBe(ssr)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      await update()
      expect(visible(container)).toBe(`${updated}<footer>f</footer>`)
    })

    test.each([
      ['a multi-root page', multiRoot, `<h1>a</h1><p>2</p>`],
      [
        'a page rendering nothing',
        `<p v-if="data.no">{{ data.list[0] }}</p>`,
        `<p>2</p>`,
      ],
      [
        'a page with a leading empty list',
        `<p v-for="i in data.empty" :key="i">{{ i }}</p><b>{{ data.list[0] }}</b>`,
        `<p>3</p><b>2</b>`,
      ],
    ])('among the children of an element with %s', async (_, code, updated) => {
      const { container, ssr, update } = await mount(
        `<component :is="Component" />`,
        `h('div', [slots.default(${page}), h('span', 's')])`,
        code,
      )
      expect(visible(container)).toBe(ssr)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      await update()
      expect(visible(container)).toBe(
        `<div>${updated}<span>s</span></div><footer>f</footer>`,
      )
    })

    // the slot is one vnode whatever it renders, not the first of its roots
    test('for its first vnode with several roots', async () => {
      const { container, ssr, update } = await mount(
        multiRoot,
        `slots.default()[0]`,
      )
      expect(ssr).toBe(`<h1>a</h1><p>1</p><footer>f</footer>`)
      expect(visible(container)).toBe(`<h1>a</h1><p>1</p><footer>f</footer>`)
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      await update()
      expect(visible(container)).toBe(`<h1>a</h1><p>2</p><footer>f</footer>`)
    })

    // element-plus `ElOnlyChild`: a clone of the slot with a directive
    test('with directives on a clone of it', async () => {
      const data = reactive({ value: 1, log: [] as string[] })
      await testWithVaporApp(
        `${setup}<template>
          <components.OnlyChild :value="data.value">
            <button>b</button>
          </components.OnlyChild>
        </template>`,
        {
          OnlyChild: {
            code: `<script>
              import { cloneVNode, withDirectives } from 'vue'
              const record = name => (el, { value }) =>
                _data.log.push(name + ' ' + el.tagName.toLowerCase() + ' ' + value)
              const dir = {
                created: record('created'),
                mounted: record('mounted'),
                updated: record('updated'),
              }
              export default {
                props: ['value'],
                setup(props, { slots }) {
                  return () =>
                    withDirectives(cloneVNode(slots.default()[0]), [
                      [dir, props.value],
                    ])
                },
              }
            </script>`,
            vapor: false,
          },
        },
        data,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      await nextTick()
      expect(data.log).toEqual(['created button 1', 'mounted button 1'])

      data.value++
      await nextTick()
      expect(data.log).toEqual([
        'created button 1',
        'mounted button 1',
        'updated button 2',
      ])
    })
  })

  // slots a vapor component hands over with `h()` are vdom slots: the server
  // leaves them as they are, called directly or not
  test('hydrate vnode slots created in a vapor component', async () => {
    const data = reactive({ list: [1] })
    const { container, html } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const data = _data; const components = _components
        const view = () =>
          h(components.Child, null, {
            default: () => [h('h1', 'a'), h('p', data.list[0])],
          })
      </script>
      <template><component :is="view()" /><footer>f</footer></template>`,
      {
        Child: {
          code: `<script>
            import { h } from 'vue'
            export default {
              setup(_, { slots }) {
                return () => h('div', slots.default())
              },
            }
          </script>`,
          vapor: false,
        },
      },
      data,
    )
    expect(html).toContain(`<div><h1>a</h1><p>1</p></div>`)
    expect(visible(container)).toBe(
      `<div><h1>a</h1><p>1</p></div><footer>f</footer>`,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.list = [2]
    await nextTick()
    expect(visible(container)).toBe(
      `<div><h1>a</h1><p>2</p></div><footer>f</footer>`,
    )
  })

  test('hydrate VDOM slot content injecting from the component rendering the outlet', async () => {
    const { container } = await testWithVDOMApp(
      `<script setup>
        const components = _components
      </script>
      <template>
        <components.Wrapper name="outer">
          <components.Consumer />
        </components.Wrapper>
      </template>`,
      {
        Consumer: {
          code: `<script setup>
            import { inject } from 'vue'
            const k = inject('k', 'none')
          </script>
          <template><b>{{ k }}</b></template>`,
          vapor: false,
        },
        Provider: {
          code: `<script setup>
            import { provide } from 'vue'
            const props = defineProps(['name'])
            provide('k', props.name)
          </script>
          <template><slot /></template>`,
          vapor: true,
        },
        Wrapper: {
          code: `<script setup>
            const props = defineProps(['name'])
            const components = _components
          </script>
          <template>
            <components.Provider :name="props.name"><slot /></components.Provider>
          </template>`,
          vapor: true,
        },
      },
    )

    expect(container.textContent).toBe('outer')
    expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  })

  test('hydrate VDOM Transition root preserves keyed out-in and fallback switches', async () => {
    let leaveDone: () => void
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const onEnter = vi.fn()
    const data = reactive({
      show: true,
      key: 1,
      text: 'first',
      onLeave,
      onEnter,
    })
    const { container } = await testWithVDOMApp(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Child>
          <template #default v-if="data.show">
            <button :key="data.key">{{ data.text }}</button>
          </template>
        </components.Child>
      </template>`,
      {
        Child: `<script setup vapor>const data = _data</script>
        <template>
          <Transition mode="out-in" :css="false" @leave="data.onLeave" @enter="data.onEnter">
            <slot><p>fallback</p></slot>
          </Transition>
          <span>after</span>
        </template>`,
      },
      data,
    )
    const first = container.querySelector('button')!
    const after = container.querySelector('span')!
    expect(container.textContent).toBe('firstafter')
    expect(onEnter).not.toHaveBeenCalled()

    data.text = 'updated'
    await nextTick()
    expect(container.querySelector('button')).toBe(first)
    expect(first.textContent).toBe('updated')
    expect(onLeave).not.toHaveBeenCalled()

    data.key = 2
    data.text = 'second'
    await nextTick()
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(onLeave.mock.calls[0][0]).toBe(first)
    expect(container.textContent).toBe('updatedafter')
    expect(container.querySelector('button')).toBe(first)
    expect(onEnter).not.toHaveBeenCalled()

    leaveDone!()
    await nextTick()
    const second = container.querySelector('button')!
    expect(second).not.toBe(first)
    expect(first.isConnected).toBe(false)
    expect(container.textContent).toBe('secondafter')
    expect(onEnter).toHaveBeenCalledTimes(1)
    expect(onEnter.mock.calls[0][0]).toBe(second)

    data.show = false
    await nextTick()
    expect(onLeave).toHaveBeenCalledTimes(2)
    expect(onLeave.mock.calls[1][0]).toBe(second)
    expect(container.querySelector('p')).toBeNull()
    expect(container.textContent).toBe('secondafter')

    leaveDone!()
    await nextTick()
    const fallback = container.querySelector('p')!
    expect(second.isConnected).toBe(false)
    expect(container.textContent).toBe('fallbackafter')
    expect(onEnter).toHaveBeenCalledTimes(2)
    expect(onEnter.mock.calls[1][0]).toBe(fallback)

    data.show = true
    data.key = 3
    data.text = 'third'
    await nextTick()
    expect(onLeave).toHaveBeenCalledTimes(3)
    expect(onLeave.mock.calls[2][0]).toBe(fallback)
    expect(container.querySelector('button')).toBeNull()
    expect(container.textContent).toBe('fallbackafter')

    leaveDone!()
    await nextTick()
    expect(fallback.isConnected).toBe(false)
    expect(container.textContent).toBe('thirdafter')
    expect(onEnter).toHaveBeenCalledTimes(3)
    expect(onEnter.mock.calls[2][0]).toBe(container.querySelector('button'))
    expect(container.querySelector('span')).toBe(after)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  })

  test('hydrate VDOM Transition root delays its first in-out leave until enter completes', async () => {
    let enterDone: () => void
    let leaveDone: () => void
    const onEnter = vi.fn((_el: Element, done: () => void) => {
      enterDone = done
    })
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = reactive({ key: 1, onEnter, onLeave })
    const { container } = await testWithVDOMApp(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Child><button :key="data.key">{{ data.key }}</button></components.Child>
      </template>`,
      {
        Child: `<script setup vapor>const data = _data</script>
        <template>
          <Transition mode="in-out" :css="false" @enter="data.onEnter" @leave="data.onLeave">
            <slot />
          </Transition>
          <span>after</span>
        </template>`,
      },
      data,
    )
    const first = container.querySelector('button')!
    const after = container.querySelector('span')!
    expect(container.textContent).toBe('1after')
    expect(onEnter).not.toHaveBeenCalled()

    data.key = 2
    await nextTick()
    const second = container.querySelectorAll('button')[1]
    expect(container.textContent).toBe('12after')
    expect(container.querySelector('button')).toBe(first)
    expect(onEnter).toHaveBeenCalledOnce()
    expect(onEnter.mock.calls[0][0]).toBe(second)
    expect(onLeave).not.toHaveBeenCalled()

    enterDone!()
    expect(onLeave).toHaveBeenCalledOnce()
    expect(onLeave.mock.calls[0][0]).toBe(first)
    expect(first.isConnected).toBe(true)

    leaveDone!()
    await nextTick()
    expect(first.isConnected).toBe(false)
    expect(container.querySelector('button')).toBe(second)
    expect(container.textContent).toBe('2after')
    expect(container.querySelector('span')).toBe(after)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  })

  test('hydrate an empty VDOM Transition slot before its default slot appears', async () => {
    const data = reactive({ show: false })
    const { container, app } = await testWithVDOMApp(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Child>
          <template #default v-if="data.show"><button>content</button></template>
        </components.Child>
      </template>`,
      {
        Child: `<template>
          <section>
            <Transition :css="false"><slot /></Transition>
            <i>after</i>
          </section>
        </template>`,
      },
      data,
    )
    const after = container.querySelector('i')!
    data.show = true
    await nextTick()
    expect(container.querySelector('button')).not.toBeNull()
    expect(container.querySelector('i')).toBe(after)
    expect(container.textContent).toBe('contentafter')
    app.unmount()
    expect(container.innerHTML).toBe('')
    expect('Hydration node mismatch').not.toHaveBeenWarned()
    expect('Hydration children mismatch').not.toHaveBeenWarned()
  })

  test('hydrate nested keyed Transition slot wrappers with a local fallback', async () => {
    const data = reactive({ items: [1], label: 'first', mounted: true })
    const { container, app } = await testWithVDOMApp(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <main>
          <components.Child v-if="data.mounted">
            <template v-for="item in data.items" :key="item">
              <button>{{ data.label }}</button>
            </template>
          </components.Child>
          <i>after</i>
        </main>
      </template>`,
      {
        Child: `<template>
          <Transition :css="false"><slot><p>fallback</p></slot></Transition>
        </template>`,
      },
      data,
    )
    const main = container.querySelector('main')!
    const first = main.querySelector('button')!
    const after = main.querySelector('i')!
    data.label = 'updated'
    await nextTick()
    expect(main.querySelector('button')).toBe(first)
    expect(main.textContent).toBe('updatedafter')
    data.items = []
    await nextTick()
    expect(main.textContent).toBe('fallbackafter')
    data.items = [2]
    await nextTick()
    expect(main.textContent).toBe('updatedafter')
    expect(main.querySelector('button')).not.toBe(first)
    data.mounted = false
    await nextTick()
    // the hydrated child's range markers stay behind
    expect(main.childNodes.length).toBe(4)
    expect(main.querySelector('i')).toBe(after)
    app.unmount()
    expect(container.innerHTML).toBe('')
    expect('Hydration node mismatch').not.toHaveBeenWarned()
    expect('Hydration children mismatch').not.toHaveBeenWarned()
  })

  test.each(['update', 'unmount'])(
    'hydrate empty VDOM component slot content and %s it',
    async action => {
      const data = ref({ show: true })
      const { container, html, app } = await testWithVaporApp(
        `<script setup>
          const data = _data
          const components = _components
        </script>
        <template>
          <components.Consumer>
            <components.Relay v-if="data.show" />
          </components.Consumer>
        </template>`,
        {
          Empty: `<template><i v-if="false">empty</i></template>`,
          Relay: {
            code: `<script setup>const components = _components</script>
              <template><components.Empty /></template>`,
            vapor: false,
          },
          Consumer: `<template><slot><b>fallback</b></slot></template>`,
        },
        data,
      )

      expect(html).not.toContain('fallback')
      expect(container.querySelector('b')).toBeNull()
      expect(container.textContent).toBe('')

      if (action === 'update') {
        data.value.show = false
        await nextTick()
        expect(container.innerHTML).toContain('<b>fallback</b>')

        data.value.show = true
        await nextTick()
        expect(container.querySelector('b')).toBeNull()
        expect(container.textContent).toBe('')
      }

      expect(() => app.unmount()).not.toThrow()
      expect(container.children).toHaveLength(0)
      expect(container.textContent).toBe('')
      expect('Hydration node mismatch').not.toHaveBeenWarned()
      expect('Hydration children mismatch').not.toHaveBeenWarned()
    },
  )

  // a vdom outlet rendered by its client render function on the server, as
  // a component library ships it
  test('the branch key of a keyed <template v-for> vdom outlet is not a vapor slot prop in ssr', async () => {
    const setup = `<script setup>const data = _data; const components = _components</script>`
    const data = reactive({ list: [1, 2] })
    const App = (ssr: boolean) => {
      const List = compile(
        `${setup}<template>
          <div>
            <template v-for="it in data.list" :key="it">
              <slot :it="it" />
            </template>
          </div>
        </template>`,
        data as any,
        {},
        { vapor: false },
      )
      return compile(
        `${setup}<template>
          <components.List v-slot="p"><i>{{ Object.keys(p).join() }}</i></components.List>
        </template>`,
        data as any,
        { List },
        { vapor: true, ssr },
      )
    }
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(App(true)),
    )
    expect(html.replace(/<!--[^>]*-->/g, '')).toBe(
      '<div><i>it</i><i>it</i></div>',
    )

    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    const app = runtimeVapor
      .createVaporSSRApp(App(false))
      .use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)
    expect(`Hydration text mismatch`).not.toHaveBeenWarned()
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    app.unmount()
    expect(container.innerHTML).toBe('<!--{--><!--}-->')
  })

  test('preserves array slot props of a keyed vdom outlet in ssr and hydration', async () => {
    const data = runtimeDom.shallowRef(['foo', 'bar'])
    const Child = compile(
      `<script setup>const data = _data</script>
      <template><div><slot v-if="true" v-bind="data" /></div></template>`,
      data,
      {},
      { vapor: false },
    )
    const App = (ssr: boolean) =>
      compile(
        `<script setup>const components = _components</script>
        <template>
          <components.Child v-slot="p"><i>{{ p.length }}:{{ [...p].join() }}</i></components.Child>
        </template>`,
        data,
        { Child },
        { vapor: true, ssr },
      )
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(App(true)),
    )
    expect(html.replace(/<!--[^>]*-->/g, '')).toBe(
      '<div><i>2:foo,bar</i></div>',
    )

    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    const app = runtimeVapor
      .createVaporSSRApp(App(false))
      .use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)
    expect(`Hydration text mismatch`).not.toHaveBeenWarned()
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()

    data.value = ['baz']
    await nextTick()
    expect(container.innerHTML.replace(/<!--[^>]*-->/g, '')).toBe(
      '<div><i>1:baz</i></div>',
    )
    app.unmount()
    expect(container.innerHTML).toBe('<!--{--><!--}-->')
  })

  // Rendered bare by the server inside a vdom Transition, the slot has no range
  // of its own: the anchor hydration creates at its end is where a fallback
  // committed later goes, as on mount.
  test('a vapor slot hydrated bare inside a vdom Transition commits its outlet fallback at its own anchor', async () => {
    const data = reactive({ show: true })
    const { container } = await testWithVaporApp(
      `${setup}<template>
        <components.Child><b v-if="data.show">b</b></components.Child>
      </template>`,
      {
        Child: {
          code: `${setup}<template>
            <div><Transition><slot><p>fallback</p></slot></Transition></div>
          </template>`,
          vapor: false,
        },
      },
      data,
    )
    expect(visible(container)).toBe('<div><b>b</b></div>')
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.show = false
    await nextTick()
    // the leave never ends in jsdom
    expect(visible(container)).toBe(
      '<div><b class="v-leave-from v-leave-active">b</b><p class="v-enter-from v-enter-active">fallback</p></div>',
    )
  })

  // valid content over a fallback the server rendered: it is placed once,
  // under its hooks
  test('a vapor slot with content enters once over the outlet fallback the server rendered', async () => {
    const data = reactive({ show: true, hooks: [] as string[] })
    const { container } = await testWithVaporApp(
      `${setup}<template>
        <components.Child>
          <Transition
            v-if="data.show"
            appear
            :css="false"
            @before-enter="data.hooks.push('beforeEnter')"
            @enter="data.hooks.push('enter')"
          >
            <b>b</b>
          </Transition>
        </components.Child>
      </template>`,
      {
        Child: {
          code: `${setup}<template>
            <div><slot><p>fallback</p></slot></div>
          </template>`,
          vapor: false,
        },
      },
      data,
      reactive({ show: false }),
    )
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    expect(visible(container)).toBe('<div><b>b</b></div>')
    expect(data.hooks).toEqual(['beforeEnter', 'enter'])
  })

  // a bare slot (under a vdom Transition) has no range of its own: a range its
  // content opens, and the close the cursor rests on after the content, are
  // not the slot's
  test.each([
    [
      'a v-if chain ranging its branch',
      `<template>
        <span>s</span>
        <components.Wrapper>
          <b v-if="data.show">b</b>
          <b v-else-if="data.alt">c</b>
        </components.Wrapper>
      </template>`,
      {},
    ],
    [
      'a component',
      `<template>
        <components.Wrapper>
          <components.Deep v-if="data.show" />
        </components.Wrapper>
      </template>`,
      {
        Deep: `<template><components.Leaf /></template>`,
        Leaf: `<template><b>b</b></template>`,
      },
    ],
    [
      'a component at the end of the page',
      `<template>
        <main>
          <components.Wrapper>
            <components.Deep v-if="data.show" />
          </components.Wrapper>
        </main>
      </template>`,
      {
        Deep: `<template><components.Leaf /></template>`,
        Leaf: `<template><b>b</b></template>`,
      },
    ],
  ])(
    'a bare vapor slot whose content opens with %s keeps its fallback in its host',
    async (_, app, components) => {
      const data = reactive({ show: true, alt: false })
      const { container } = await testWithVaporApp(
        app,
        {
          Wrapper: {
            code: `<script setup>const data = _data</script>
              <template>
                <div>
                  <Transition :css="false"><slot><p>fallback</p></slot></Transition>
                </div>
              </template>`,
            vapor: false,
          },
          ...components,
        },
        data,
      )
      const div = container.querySelector('div')!
      expect(div.textContent).toBe('b')
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.show = false
      await nextTick()
      expect(div.textContent).toBe('fallback')
      expect(div.nextElementSibling).toBeNull()

      data.show = true
      await nextTick()
      expect(div.textContent).toBe('b')
    },
  )

  // called by hand, a forwarded slot comes as its outlet fragment, a direct
  // one as the content, on the server as on the client
  test('hydrate vapor slots a vdom component calls by hand', async () => {
    const data = reactive({ n: 0 })
    const { container } = await testWithVaporApp(
      `<script setup>
        const data = _data; const components = _components
      </script>
      <template>
        <components.Fwd><button id="a">{{ data.n }}</button></components.Fwd>
        <components.Direct><b>{{ data.n }}</b></components.Direct>
      </template>`,
      {
        First: {
          code: `<script>
            import { cloneVNode } from 'vue'
            export default {
              setup(_, { slots }) {
                return () => cloneVNode(slots.default()[0], { id: 'b' })
              },
            }
          </script>`,
          vapor: false,
        },
        Fwd: {
          code: `<script setup>const components = _components</script>
            <template><components.First><slot /></components.First></template>`,
          vapor: false,
        },
        Direct: {
          code: `<script>
            import { h } from 'vue'
            const Div = {
              setup(_, { slots }) {
                return () => h('div', slots.default())
              },
            }
            export default {
              setup(_, { slots }) {
                return () => h(Div, null, { default: () => slots.default() })
              },
            }
          </script>`,
          vapor: false,
        },
      },
      data,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

    data.n++
    await nextTick()
    expect(container.querySelector('#a')!.textContent).toBe('1')
    expect(container.querySelector('div > b')!.textContent).toBe('1')
  })

  test('keeps a ref on hydrated vapor slot content in sync with its root', async () => {
    const data = ref({ show: true, onRef: vi.fn() })
    const Presence = {
      props: ['onRef'],
      setup(props: any, { slots }: any) {
        return () => h(slots.default()[0], { ref: props.onRef })
      },
    }
    const code = `<script setup>
        const data = _data; const components = _components
      </script>
      <template>
        <components.Presence :on-ref="data.onRef">
          <button v-if="data.show">a</button><a v-else>b</a>
        </components.Presence>
      </template>`
    const server = compile(code, data, { Presence }, { vapor: true, ssr: true })
    const client = compile(code, data, { Presence }, { vapor: true })
    const root = document.createElement('div')
    root.innerHTML = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(server),
    )
    const button = root.querySelector('button')!
    const app = runtimeVapor.createVaporSSRApp(client)
    app.use(runtimeVapor.vaporInteropPlugin).mount(root)
    expect(root.querySelector('button')).toBe(button)
    expect(data.value.onRef.mock.calls.map(([el]) => el)).toEqual([button])
    data.value.show = false
    await nextTick()
    const link = root.querySelector('a')!
    expect(data.value.onRef.mock.calls.map(([el]) => el)).toEqual([
      button,
      null,
      link,
    ])
    app.unmount()
    expect(data.value.onRef).toHaveBeenLastCalledWith(null, {})
    expect('Hydration node mismatch').not.toHaveBeenWarned()
    expect('Hydration children mismatch').not.toHaveBeenWarned()
  })

  test.each([
    // the control
    ['in a vdom app', false, false],
    ['a vdom one', true, false],
    ['a vapor one', true, true],
  ])(
    'sets a ref on an async component root once it has hydrated: %s',
    async (_, isVaporApp, vaporAsync) => {
      const log: any[] = []
      let load!: () => void
      const data = ref({
        vaporAsync,
        loading: new Promise<void>(r => (load = r)),
        onRef: (v: any) => log.push(v && v.name),
      })
      const { container } = await testHydration(
        `<script setup>
          import { defineAsyncComponent, defineVaporAsyncComponent } from 'vue'
          const data = _data; const components = _components
          const define = data.value.vaporAsync
            ? defineVaporAsyncComponent
            : defineAsyncComponent
          const Async = define(
            () => data.value.loading.then(() => components.Child),
          )
        </script>
        <template>
          <components.Presence :on-ref="data.onRef">
            <Async />
          </components.Presence>
        </template>`,
        {
          Presence: {
            code: `<script>
              import { h } from 'vue'
              export default {
                props: ['onRef'],
                setup(props, { slots }) {
                  return () => h(slots.default()[0], { ref: props.onRef })
                },
              }
            </script>`,
            vapor: false,
          },
          Child: {
            code: `<script setup>
              defineExpose({ name: 'child' })
            </script>
            <template>
              <button>ready</button>
            </template>`,
            vapor: vaporAsync,
          },
        },
        data,
        {
          isVaporApp,
          interop: true,
          // as the `vue` server entry: `defineAsyncComponent` either way
          serverData: ref({
            vaporAsync: false,
            loading: Promise.resolve(),
            onRef: () => {},
          }),
        },
      )
      const button = container.querySelector('button')!
      // the server's button is not what the ref resolves to
      expect(log).toEqual([])
      load()
      await new Promise(r => setTimeout(r))
      expect(container.querySelector('button')).toBe(button)
      expect(log).toEqual(['child'])
      expect('Hydration node mismatch').not.toHaveBeenWarned()
      expect('Hydration children mismatch').not.toHaveBeenWarned()
    },
  )

  // a vdom component cloning the content of a vapor slot it called by hand
  // (Reka UI `asChild`): what the clone adds is on the content root in the
  // server's html, as the client applies it
  describe('cloneVNode attrs on vapor slot content', () => {
    const AsChild = {
      code: `<script>
        import { cloneVNode } from 'vue'
        const data = _data
        export default {
          setup(_, { slots }) {
            return () => cloneVNode(slots.default()[0], data.value.attrs)
          },
        }
      </script>`,
      vapor: false,
    }
    const mount = (
      slot: string,
      init: Record<string, any> = {},
      components: Record<string, any> = {},
    ) => {
      const data = ref<Record<string, any>>({
        attrs: {
          class: 'trigger',
          style: { color: 'red' },
          'aria-expanded': 'false',
        },
        ...init,
      })
      return testWithVaporApp(
        `${setup}
        <template>
          <components.AsChild>
            ${slot}
          </components.AsChild>
        </template>`,
        { ...components, AsChild },
        data,
      )
    }

    test('on an element root', async () => {
      const { container, html, data } = await mount(
        `<button class="base">open</button>`,
      )
      expect(stripAnchors(html)).toBe(
        `<button class="base trigger" style="color:red;" aria-expanded="false">open</button>`,
      )
      const button = container.querySelector('button')!

      data.value.attrs = { class: 'other', 'aria-expanded': 'true' }
      await nextTick()
      expect(container.querySelector('button')).toBe(button)
      expect(button.outerHTML).toBe(
        `<button class="base other" style="" aria-expanded="true">open</button>`,
      )

      data.value.attrs = {}
      await nextTick()
      expect(button.outerHTML).toBe(
        `<button class="base" style="">open</button>`,
      )
    })

    // however the clone writes them: they reach the content normalized
    test('with a class array and a style string', async () => {
      const { container, html, data } = await mount(
        `<button class="base" style="font-size: 12px">open</button>`,
        {
          attrs: {
            class: ['trigger', { on: true }],
            style: 'color: red; --gap: 1px',
          },
        },
      )
      expect(stripAnchors(html)).toBe(
        `<button class="base trigger on" style="font-size:12px;color:red;--gap:1px;">open</button>`,
      )
      const button = container.querySelector('button')!

      data.value.attrs = {}
      await nextTick()
      expect(button.className).toBe('base')
      expect(button.style.cssText).toBe('font-size: 12px;')
    })

    test('on an element root with bindings of its own', async () => {
      const { container, html, data } = await mount(
        `<button
          :class="data.cls"
          :style="data.sty"
          :title="data.title"
        >
          open
        </button>`,
        {
          cls: 'own',
          sty: { fontSize: '12px' },
          title: 't',
          attrs: { 'aria-expanded': 'false' },
        },
      )
      expect(stripAnchors(html)).toBe(
        `<button class="own" style="font-size:12px;" title="t" aria-expanded="false"> open </button>`,
      )
      const button = container.querySelector('button')!

      data.value.cls = 'changed'
      data.value.attrs = { class: 'trigger', 'aria-expanded': 'true' }
      await nextTick()
      expect(button.outerHTML).toBe(
        `<button class="changed trigger" style="font-size:12px;" title="t" aria-expanded="true"> open </button>`,
      )

      data.value.attrs = {}
      await nextTick()
      expect(button.outerHTML).toBe(
        `<button class="changed" style="font-size:12px;" title="t"> open </button>`,
      )
    })

    // the server merged the clone's class and style into the root's own: no
    // mismatch, though the root's bindings render before it is known as one
    test('merged with the class and style an element root binds', async () => {
      const { container, html, data } = await mount(
        `<button
          :class="data.cls"
          :style="data.sty"
        >
          open
        </button>`,
        { cls: 'own', sty: { fontSize: '12px' } },
      )
      expect(stripAnchors(html)).toBe(
        `<button class="own trigger" style="font-size:12px;color:red;" aria-expanded="false"> open </button>`,
      )
      const button = container.querySelector('button')!
      await nextTick()
      expect(`Hydration class mismatch`).not.toHaveBeenWarned()
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()

      data.value.cls = 'changed'
      data.value.attrs = { class: 'other' }
      await nextTick()
      expect(button.className).toBe('changed other')
      expect(button.style.cssText).toBe('font-size: 12px;')

      data.value.attrs = {}
      await nextTick()
      expect(button.className).toBe('changed')
    })

    // what the template gives the root stays its own once the clone drops
    // the same class or style property
    test.each([
      [
        'class',
        `<button class="base">x</button>`,
        { class: 'base trigger' },
        `<button class="base">x</button>`,
      ],
      [
        'style property',
        `<button style="color: red; font-size: 12px">x</button>`,
        { style: { color: 'blue' } },
        `<button style="color: red; font-size: 12px;">x</button>`,
      ],
    ])('overlapping a static %s of the root', async (_, slot, attrs, after) => {
      const { container, data } = await mount(slot, { attrs })
      const button = container.querySelector('button')!

      data.value.attrs = {}
      await nextTick()
      expect(button.outerHTML).toBe(after)
    })

    test('overlapping the static display of a v-show root', async () => {
      const { container, data } = await mount(
        `<button
          v-show="data.show"
          style="display: inline-flex; color: red"
        >
          x
        </button>`,
        { show: true, attrs: { style: { display: 'flex', color: 'blue' } } },
      )
      const button = container.querySelector('button')!
      expect(button.style.cssText).toBe('display: flex; color: blue;')

      data.value.attrs = {}
      await nextTick()
      expect(button.style.cssText).toBe('display: inline-flex; color: red;')

      data.value.show = false
      await nextTick()
      expect(button.style.display).toBe('none')
      data.value.show = true
      await nextTick()
      expect(button.style.display).toBe('inline-flex')
    })

    // the clone's style wins over the same property of the root's own, on
    // the server as on the client
    test('overriding a style the element root binds', async () => {
      const { container, html, data } = await mount(
        `<button :style="data.sty">open</button>`,
        { sty: { color: 'red' }, attrs: { style: { color: 'blue' } } },
      )
      expect(stripAnchors(html)).toBe(
        `<button style="color:blue;">open</button>`,
      )
      const button = container.querySelector('button')!
      await nextTick()
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()

      data.value.attrs = {}
      await nextTick()
      expect(button.style.cssText).toBe('color: red;')
    })

    test.each([
      ['class', 'the root', `<button :class="data.cls">open</button>`],
      [
        'class',
        'an element below the root',
        `<div>
          <button :class="data.cls">open</button>
        </div>`,
      ],
      ['style', 'the root', `<button :style="data.sty">open</button>`],
    ])('still warns of a %s mismatch on %s', async (kind, _, slot) => {
      const attrs = { class: 'trigger', style: { color: 'red' } }
      await testWithVaporApp(
        `${setup}
        <template>
          <components.AsChild>
            ${slot}
          </components.AsChild>
        </template>`,
        { AsChild },
        ref({ attrs, cls: 'client', sty: { fontSize: '12px' } }),
        ref({ attrs, cls: 'server', sty: { fontSize: '14px' } }),
      )
      await nextTick()
      expect(`Hydration ${kind} mismatch`).toHaveBeenWarned()
    })

    test.each([
      [
        'a v-if chain',
        `<button v-if="data.ok">a</button>
        <span v-else class="base">b</span>`,
      ],
      [
        'a v-if chain in a template v-if',
        `<template v-if="data.a">
          <button v-if="data.ok">a</button>
          <span v-else class="base">b</span>
        </template>`,
      ],
      [
        'a template v-if with a comment',
        `<template v-if="data.a">
          <!-- lead -->
          <button v-if="data.ok">a</button>
          <span v-else class="base">b</span>
        </template>`,
      ],
    ])('on the branch of %s', async (_, slot) => {
      const { container, html, data } = await mount(slot, {
        a: true,
        ok: true,
        attrs: { class: 'trigger', id: 'x' },
      })
      expect(stripAnchors(html)).toBe(
        `<button class="trigger" id="x">a</button>`,
      )
      const button = container.querySelector('button')!

      data.value.attrs = { class: 'other' }
      await nextTick()
      expect(container.querySelector('button')).toBe(button)
      expect(button.outerHTML).toBe(`<button class="other">a</button>`)

      data.value.ok = false
      await nextTick()
      expect(container.querySelector('span')!.outerHTML).toBe(
        `<span class="base other">b</span>`,
      )
    })

    test('on the only element of a template v-if, past a comment', async () => {
      const { container, html, data } = await mount(
        `<template v-if="data.a">
          <!-- lead -->
          <button class="base">a</button>
        </template>`,
        { a: true, attrs: { class: 'trigger', id: 'x' } },
      )
      expect(stripAnchors(html)).toBe(
        `<button class="base trigger" id="x">a</button>`,
      )
      const button = container.querySelector('button')!

      data.value.attrs = {}
      await nextTick()
      expect(button.outerHTML).toBe(`<button class="base">a</button>`)
    })

    test('on the else branch of a v-if chain', async () => {
      const { html } = await mount(
        `<button v-if="data.ok">a</button>
        <span v-else class="base">b</span>`,
        { ok: false, attrs: { class: 'trigger', id: 'x' } },
      )
      expect(stripAnchors(html)).toBe(
        `<span class="base trigger" id="x">b</span>`,
      )
    })

    test.each([
      ['vapor', true],
      ['vdom', false],
    ])('on a %s component root, before it renders', async (_, vapor) => {
      const { container, html, data } = await mount(
        `<components.Btn class="base" />`,
        { attrs: { class: 'trigger', label: 'open', id: 'x' } },
        {
          Btn: {
            code: `<script setup>
              defineProps(['label'])
              defineOptions({ inheritAttrs: false })
            </script>
            <template>
              <div>
                <button v-bind="$attrs">{{ label }}</button>
              </div>
            </template>`,
            vapor,
          },
        },
      )
      expect(stripAnchors(html)).toBe(
        `<div><button class="base trigger" id="x">open</button></div>`,
      )
      const button = container.querySelector('button')!

      data.value.attrs = { label: 'close' }
      await nextTick()
      expect(container.querySelector('button')).toBe(button)
      expect(visible(container)).toBe(
        `<div><button class="base">close</button></div>`,
      )
    })

    test('along with the fallthrough attrs of the cloning component', async () => {
      const data = ref<Record<string, any>>({
        attrs: { class: 'trigger' },
        cls: 'own',
      })
      const { container, html } = await testWithVaporApp(
        `${setup}
        <template>
          <components.AsChild :class="data.cls" id="x">
            <button class="base">open</button>
          </components.AsChild>
        </template>`,
        { AsChild },
        data,
      )
      expect(stripAnchors(html)).toBe(
        `<button class="base trigger own" id="x">open</button>`,
      )
      const button = container.querySelector('button')!

      data.value.cls = 'changed'
      data.value.attrs = {}
      await nextTick()
      expect(button.outerHTML).toBe(
        `<button class="base changed" id="x">open</button>`,
      )
    })

    // the content keeps the server render of a vapor template: a `<select>`
    // its selected option, a Transition no range of its own
    test('with a v-model select and a Transition below the root', async () => {
      const { container, html, data } = await mount(
        `<div>
          <select v-model="data.selected">
            <option value="a">A</option>
            <option value="b">B</option>
          </select>
          <Transition :css="false">
            <span v-if="data.show">{{ data.selected }}</span>
          </Transition>
        </div>`,
        { selected: 'b', show: true, attrs: { class: 'trigger' } },
      )
      expect(html.replace(/<!--[[\]{}]-->/g, '')).toBe(
        `<div class="trigger">` +
          `<select><option value="a">A</option><option value="b" selected>B</option></select>` +
          `<span>b</span>` +
          `</div>`,
      )
      const span = container.querySelector('span')!
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.value.selected = 'a'
      await nextTick()
      expect(container.querySelector('span')).toBe(span)
      expect(span.textContent).toBe('a')
      expect(container.querySelector('select')!.value).toBe('a')
    })

    test.each([
      [
        'select',
        `<select v-model="data.model" class="base">
          <option value="a">A</option>
          <option value="b">B</option>
        </select>`,
        `<select class="base trigger"><option value="a">A</option><option value="b" selected>B</option></select>`,
      ],
      [
        'input',
        `<input v-model="data.model" class="base">`,
        `<input class="base trigger" value="b">`,
      ],
    ])('on a v-model %s root', async (tag, slot, expected) => {
      const { container, html, data } = await mount(slot, {
        model: 'b',
        attrs: { class: 'trigger' },
      })
      expect(stripAnchors(html)).toBe(expected)
      const el = container.querySelector(tag) as HTMLInputElement
      expect(el.value).toBe('b')

      data.value.model = 'a'
      data.value.attrs = {}
      await nextTick()
      expect(el.value).toBe('a')
      expect(el.className).toBe('base')
    })

    // its content comes off the attrs, or off its own when there are none
    test.each([
      ['with content', `<textarea>hello</textarea>`, 'hello'],
      ['without content', `<textarea />`, ''],
      [
        'with a listener',
        `<textarea @input="() => {}">hello</textarea>`,
        'hello',
      ],
    ])('a textarea root %s, not cloned', async (_, slot, value) => {
      const { container, html } = await testWithVaporApp(
        `${setup}
        <template>
          <components.Outlet>
            ${slot}
          </components.Outlet>
        </template>`,
        {
          Outlet: {
            code: `<script setup>const one = 1</script>
              <template>
                <slot />
              </template>`,
            vapor: false,
          },
        },
        ref({}),
      )
      expect(stripAnchors(html)).toBe(`<textarea>${value}</textarea>`)
      expect(container.querySelector('textarea')!.value).toBe(value)
    })

    test('on a textarea root', async () => {
      const { container, html, data } = await mount(
        `<textarea>hello</textarea>`,
        { attrs: { class: 'trigger' } },
      )
      expect(stripAnchors(html)).toBe(
        `<textarea class="trigger">hello</textarea>`,
      )
      const textarea = container.querySelector('textarea')!

      data.value.attrs = {}
      await nextTick()
      expect(textarea.className).toBe('')
      expect(textarea.value).toBe('hello')
    })

    test('on the branches of a Transition root', async () => {
      const { container, html, data } = await mount(
        `<Transition :css="false">
          <button v-if="data.ok">a</button>
          <span v-else>b</span>
        </Transition>`,
        { ok: true, attrs: { id: 'x' } },
      )
      expect(stripAnchors(html)).toBe(`<button id="x">a</button>`)
      const button = container.querySelector('button')!
      expect(button.id).toBe('x')

      data.value.ok = false
      await nextTick()
      expect(container.querySelector('span')!.outerHTML).toBe(
        `<span id="x">b</span>`,
      )
    })

    test('on the child of a Transition root', async () => {
      const { container, html, data } = await mount(
        `<Transition :css="false">
          <button v-if="data.show" class="base">open</button>
        </Transition>`,
        { show: true, attrs: { class: 'trigger', id: 'x' } },
      )
      expect(stripAnchors(html)).toBe(
        `<button class="base trigger" id="x">open</button>`,
      )
      const button = container.querySelector('button')!

      data.value.attrs = { id: 'y' }
      await nextTick()
      expect(container.querySelector('button')).toBe(button)
      expect(button.outerHTML).toBe(`<button class="base" id="y">open</button>`)
    })

    test('on the root of a named scoped slot', async () => {
      const data = ref<Record<string, any>>({
        attrs: { class: 'trigger' },
        label: 'open',
      })
      const { container, html } = await testWithVaporApp(
        `${setup}
        <template>
          <components.Menu>
            <template #trigger="{ id }">
              <button :id="id">{{ data.label }}</button>
            </template>
          </components.Menu>
        </template>`,
        {
          Menu: {
            code: `<script>
              import { cloneVNode } from 'vue'
              const data = _data
              export default {
                setup(_, { slots }) {
                  return () =>
                    cloneVNode(slots.trigger({ id: 'x' })[0], data.value.attrs)
                },
              }
            </script>`,
            vapor: false,
          },
        },
        data,
      )
      expect(stripAnchors(html)).toBe(
        `<button id="x" class="trigger">open</button>`,
      )
      const button = container.querySelector('button')!

      data.value.label = 'close'
      data.value.attrs = {}
      await nextTick()
      expect(button.outerHTML).toBe(`<button id="x" class="">close</button>`)
    })

    // Reka UI in a component library: a vdom component forwards the slot to
    // the one flattening the outlet's fragment and cloning its first child
    const Slot = {
      code: `<script>
        import { Fragment, cloneVNode } from 'vue'
        const data = _data
        const flatten = children =>
          children.flatMap(child =>
            child.type === Fragment ? flatten(child.children) : [child],
          )
        export default {
          setup(_, { slots }) {
            return () =>
              cloneVNode(flatten(slots.default())[0], data.value.attrs)
          },
        }
      </script>`,
      vapor: false,
    }
    const Menu = (fallback = '') => ({
      code: `<script setup>const components = _components</script>
        <template>
          <components.Slot>
            <slot>${fallback}</slot>
          </components.Slot>
        </template>`,
      vapor: false,
    })

    test('through a vdom component forwarding the slot', async () => {
      const data = ref<Record<string, any>>({
        attrs: { class: 'trigger', 'aria-expanded': 'false' },
        label: 'open',
      })
      const { container, html } = await testWithVaporApp(
        `${setup}
        <template>
          <components.Menu>
            <button class="base">{{ data.label }}</button>
          </components.Menu>
        </template>`,
        { Slot, Menu: Menu() },
        data,
      )
      expect(stripAnchors(html)).toBe(
        `<button class="base trigger" aria-expanded="false">open</button>`,
      )
      const button = container.querySelector('button')!

      data.value.label = 'close'
      data.value.attrs = { 'aria-expanded': 'true' }
      await nextTick()
      expect(container.querySelector('button')).toBe(button)
      expect(button.outerHTML).toBe(
        `<button class="base" aria-expanded="true">close</button>`,
      )
    })

    test('on the fallback a forwarding vdom outlet shows', async () => {
      const data = ref<Record<string, any>>({
        attrs: { class: 'trigger', 'aria-expanded': 'false' },
        show: false,
      })
      const { container, html } = await testWithVaporApp(
        `${setup}
        <template>
          <components.Menu>
            <button v-if="data.show" class="custom">custom</button>
          </components.Menu>
        </template>`,
        { Slot, Menu: Menu(`<button class="base">fallback</button>`) },
        data,
      )
      expect(stripAnchors(html)).toBe(
        `<button class="base trigger" aria-expanded="false">fallback</button>`,
      )
      const button = container.querySelector('button')!

      data.value.attrs = { 'aria-expanded': 'true' }
      await nextTick()
      expect(container.querySelector('button')).toBe(button)
      expect(button.outerHTML).toBe(
        `<button class="base" aria-expanded="true">fallback</button>`,
      )

      data.value.show = true
      await nextTick()
      expect(container.querySelector('button')!.outerHTML).toBe(
        `<button class="custom" aria-expanded="true">custom</button>`,
      )
    })

    test('not on a fallback of several roots', async () => {
      const data = ref<Record<string, any>>({ attrs: { id: 'x' } })
      const { html } = await testWithVaporApp(
        `${setup}
        <template>
          <components.Menu>
            <button v-if="data.show">custom</button>
          </components.Menu>
        </template>`,
        { Slot, Menu: Menu(`<i>a</i><b>b</b>`) },
        data,
      )
      expect(stripAnchors(html)).toBe(`<i>a</i><b>b</b>`)
    })

    // whichever node of the slot body renders as its only root, as the vnode
    // a vdom parent hands the same component
    describe.each([
      ['vdom', false],
      ['vapor', true],
    ])('root positions of a %s parent', (_, isVaporApp) => {
      // as Reka UI: the first child that is not a comment
      const FirstChild = {
        code: `<script>
          import { Comment, cloneVNode } from 'vue'
          const data = _data
          export default {
            setup(_, { slots }) {
              return () =>
                cloneVNode(
                  (slots.a || slots.default)().find(c => c.type !== Comment),
                  data.value.attrs,
                )
            },
          }
        </script>`,
        vapor: false,
      }

      test.each([
        [
          'the else branch in a slot template',
          `<template #a>
            <button v-if="data.ok">a</button>
            <span v-else>b</span>
          </template>`,
          `<span class="trigger" id="x">b</span>`,
        ],
        [
          'an element past a comment in a slot template',
          `<template #a>
            <!-- lead -->
            <button>a</button>
          </template>`,
          `<button class="trigger" id="x">a</button>`,
        ],
        // a fragment to vdom, which a clone adds nothing to
        [
          'a template v-if in a template v-if',
          `<template v-if="data.show">
            <template v-if="!data.ok">
              <button>a</button>
            </template>
          </template>`,
          isVaporApp
            ? `<button class="trigger" id="x">a</button>`
            : `<button>a</button>`,
        ],
      ])('%s', async (_, slot, expected) => {
        const { container, html } = await testHydration(
          `${setup}
          <template>
            <components.FirstChild>
              ${slot}
            </components.FirstChild>
          </template>`,
          { FirstChild },
          ref({ attrs: { class: 'trigger', id: 'x' }, ok: false, show: true }),
          { isVaporApp, interop: true },
        )
        expect(stripAnchors(html)).toBe(expected)
        expect(visible(container)).toBe(expected)
      })
    })

    // nothing to inherit them: as on the client
    test.each([
      ['several roots', `<i>a</i><b>b</b>`, `<i>a</i><b>b</b>`, true],
      [
        'the rows of a v-for',
        `<i v-for="n in 2" :key="n">{{ n }}</i>`,
        `<i>1</i><i>2</i>`,
        false,
      ],
    ])('not on %s', async (_, slot, expected, warns) => {
      const { container, html } = await mount(slot, {
        attrs: { id: 'x' },
      })
      expect(stripAnchors(html)).toBe(expected)
      expect(visible(container)).toBe(expected)
      if (warns) {
        expect(`Extraneous non-props attributes`).toHaveBeenWarned()
      }
    })
  })

  describe('Vapor slot in a dynamic VDOM element', () => {
    const part = `<components.Part as="span"><input value="server" /></components.Part>`

    test.each([
      {
        name: 'a VDOM slot',
        template: `<components.Wrapper>${part}</components.Wrapper>`,
      },
      {
        name: 'a conditional VDOM slot',
        template: `<components.Wrapper>
          <template v-if="data.show" #default>${part}</template>
        </components.Wrapper>`,
      },
      {
        name: 'a dynamic Vapor element',
        template: `<component :is="data.tag">${part}</component>`,
      },
      {
        name: 'a VDOM component compiled only for the client',
        template: part,
        clientOnly: true,
      },
    ])(
      'preserves the input during hydration with $name',
      async ({ template, clientOnly }) => {
        const data = ref({ show: true, tag: 'section' })
        const App = (ssr: boolean) =>
          compile(
            `${setup}<template>${template}</template>`,
            data,
            {
              Wrapper: compile(
                `${setup}<template><div><slot /></div></template>`,
                data,
                {},
                { vapor: false, ssr },
              ),
              Part: compile(
                `<script setup>defineProps(['as'])</script>
              <template><component :is="as"><slot /></component></template>`,
                data,
                {},
                { vapor: false, ssr: ssr && !clientOnly },
              ),
            },
            { vapor: true, ssr },
          )

        const container = document.createElement('div')
        container.innerHTML = await VueServerRenderer.renderToString(
          runtimeDom.createSSRApp(App(true)),
        )
        expect(container.querySelector('span')!.innerHTML).toBe(
          '<!--[--><input value="server"><!--]-->',
        )
        const input = container.querySelector('input')!
        input.value = 'typed before hydration'

        runtimeVapor
          .createVaporSSRApp(App(false))
          .use(runtimeVapor.vaporInteropPlugin)
          .mount(container)
        expect(container.querySelector('input')).toBe(input)
        expect(input.value).toBe('typed before hydration')
        expect('Hydration node mismatch').not.toHaveBeenWarned()
      },
    )
  })
})
