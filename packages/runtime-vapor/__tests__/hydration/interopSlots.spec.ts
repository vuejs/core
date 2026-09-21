import { nextTick, reactive, ref } from '@vue/runtime-dom'
import { VueServerRenderer, compile, runtimeDom, runtimeVapor } from '../_utils'
import { setIsHydratingEnabled } from '../../src/dom/hydration'
import {
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
      <!--[--><div>foo</div><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>bar</div><!--]-->
      "
    `,
    )
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
      <!--[--><div>foo</div><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>bar</div><!--]-->
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
    expect(formatHtml(container.innerHTML)).toBe('<span>fallback</span>')

    data.value.show = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toBe('<div>content</div>')
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
      <!--[--><span>foo</span><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.text = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>bar</span><!--]-->
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
      <!--(--><div>foo</div><!--)-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.fallback = 'baz'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--(--><div>baz</div><!--)-->
      "
    `,
    )

    data.show = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--(--><span>bar</span><!--if--><!--)-->
      "
    `,
    )

    data.slot = 'qux'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--(--><span>qux</span><!--if--><!--)-->
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
      <!--(--><!----><div>foo</div><!--)-->
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
      <!--(--><i>prefix</i><div>foo</div><!--)-->
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
      <!--[-->
      <!--(--><div>local fallback</div><!--)-->
      <!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.mode = 'empty'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--(--><section>outlet fallback</section><!--)-->
      <!--]-->
      "
    `,
    )

    data.outlet = 'updated outlet fallback'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--(--><section>updated outlet fallback</section><!--)-->
      <!--]-->
      "
    `,
    )

    data.local = 'updated local fallback'
    data.mode = 'local'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--(--><div>updated local fallback</div><!--)-->
      <!--]-->
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
        <!--[--><div><!----><span>bar</span></div><!--]-->
        "
      `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.slot = 'baz'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
        "
        <!--[--><div><!----><span>baz</span></div><!--]-->
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
      <!--(--><div>foo</div><p>bar</p><!--)-->
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
      <!--(--><div>qux</div><p>quux</p><!--)-->
      "
    `,
    )

    data.show = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--(--><span>baz</span><!--if--><!--)-->
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
      <!--[-->
      <!--(--><div>foo</div><!----><!--)-->
      <i>tail</i><!--]-->
      "
    `,
    )

    data.extra = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--(--><div>foo</div><p>bar</p><!--)-->
      <i>tail</i><!--]-->
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
      <!--(--><div>
      <!--(-->foo<!--slot--><!--)-->
      </div><!--)-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.fallback = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--(--><div>
      <!--(-->bar<!--slot--><!--)-->
      </div><!--)-->
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

      expect(html).toBe(`<!--(--><p>fallback</p><!--)-->`)
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
      expect(container.innerHTML).toBe('')
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
    expect(html).toBe(`<!--[--><!--(--><u>mid</u><!--)--><!--]-->`)
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
      "<div>
      <!--(-->
      <!--[--><span>foo</span><!--if--><!--if--><!--if--><!--]-->
      <!--slot--><!--)-->
      </div>"
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
      "<div>
      <!--(-->
      <!--[--><!--]-->
      <!--slot--><!--)-->
      </div>"
    `)

    items.value = ['foo']
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "<div>
      <!--(-->
      <!--[--><span>foo</span><!--]-->
      <!--slot--><!--)-->
      </div>"
    `)

    items.value = ['bar']
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "<div>
      <!--(-->
      <!--[--><span>bar</span><!--]-->
      <!--slot--><!--)-->
      </div>"
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
      "<div>
      <!--[-->
      <!--[--><!--]-->
      <!--[--><!--]-->
      <b>tail</b><!--]-->
      </div>"
    `)

    data.items = ['foo']
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "<div>
      <!--[-->
      <!--[--><span>foo</span><!--]-->
      <!--[--><!--]-->
      <b>tail</b><!--]-->
      </div>"
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

  // `<!--(-->`…`<!--)-->` wraps a slot fallback the server rendered. The server
  // does not emit it yet: the markup is written by hand.
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
})
