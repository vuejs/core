import { createVaporSSRApp } from '../../src'
import { defineAsyncComponent, nextTick, ref } from '@vue/runtime-dom'
import { VueServerRenderer, compile, runtimeDom, runtimeVapor } from '../_utils'
import { setIsHydratingEnabled } from '../../src/dom/hydration'
import {
  compileVaporComponent,
  formatHtml,
  mountWithHydration,
  setupHydrationTest,
  testWithVaporApp,
  triggerEvent,
} from './_helpers'

setupHydrationTest()

describe('VDOM interop', () => {
  // Previous tests (e.g. createVaporSSRApp) leave isHydratingEnabled = true.
  beforeEach(() => {
    setIsHydratingEnabled(false)
  })

  test('hydrate empty createDynamicComponent should fill before trailing sibling', async () => {
    const data = ref({
      show: false,
      msg: 'late',
      tail: 'tail',
    })
    const { container } = await mountWithHydration(
      '<!--[--><!--dynamic-component--><span>tail</span><!--]-->',
      `<script setup>
        const data = _data
      </script>
      <template>
        <component :is="data.show ? 'div' : null">{{ data.msg }}</component>
        <span>{{ data.tail }}</span>
      </template>`,
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(container.innerHTML).toBe(
      '<!--[--><!--dynamic-component--><span>tail</span><!--]-->',
    )

    data.value.show = true
    await nextTick()
    expect(container.innerHTML).toBe(
      '<!--[--><div>late</div><!--dynamic-component--><span>tail</span><!--]-->',
    )

    data.value.msg = 'late-updated'
    data.value.tail = 'tail-updated'
    await nextTick()

    expect(container.innerHTML).toBe(
      '<!--[--><div>late-updated</div><!--dynamic-component--><span>tail-updated</span><!--]-->',
    )
  })

  test('hydrate empty createDynamicComponent under keyed Transition should fill before trailing sibling', async () => {
    const data = ref({
      show: false,
      key: 'empty',
      msg: 'late',
      tail: 'tail',
    })
    const { container } = await mountWithHydration(
      '<!--[--><!----><span>tail</span><!--]-->',
      `<script setup>
        const data = _data
      </script>
      <template>
        <Transition :css="false">
          <component :is="data.show ? 'div' : null" :key="data.key">
            {{ data.msg }}
          </component>
        </Transition>
        <span>{{ data.tail }}</span>
      </template>`,
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(container.innerHTML).toBe(
      '<!--[--><!----><!--keyed--><span>tail</span><!--]-->',
    )

    data.value.show = true
    data.value.key = 'filled'
    await nextTick()
    expect(container.innerHTML).toBe(
      '<!--[--><div>late</div><!--dynamic-component--><!--keyed--><span>tail</span><!--]-->',
    )

    data.value.msg = 'late-updated'
    data.value.tail = 'tail-updated'
    await nextTick()
    expect(container.innerHTML).toBe(
      '<!--[--><div>late-updated</div><!--dynamic-component--><!--keyed--><span>tail-updated</span><!--]-->',
    )
  })

  test('hydrate createDynamicComponent to null branch should remove stale branch before trailing sibling', async () => {
    const data = ref({
      show: false,
      msg: 'late',
      tail: 'tail',
    })
    const { container } = await mountWithHydration(
      '<!--[--><div>late</div><!--dynamic-component--><span>tail</span><!--]-->',
      `<script setup>
        const data = _data
      </script>
      <template>
        <component :is="data.show ? 'div' : null">{{ data.msg }}</component>
        <span>{{ data.tail }}</span>
      </template>`,
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).toHaveBeenWarned()
    expect(container.innerHTML).toBe(
      '<!--[--><!--dynamic-component--><span>tail</span><!--]-->',
    )

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(container.innerHTML).toBe(
      '<!--[--><!--dynamic-component--><span>tail-updated</span><!--]-->',
    )
  })

  test('hydrate null dynamic component should not break following component hydration', async () => {
    const code = `<div>
      <component :is="data.show ? 'p' : null">{{ data.msg }}</component>
      <components.Second />
    </div>`
    const ssrData = ref({ show: true, msg: 'initial' })
    const ssrComponents = {
      Second: compileVaporComponent(
        `<i>{{ data.msg }}</i>`,
        ssrData,
        undefined,
        true,
      ),
    }
    const SSRComp = compileVaporComponent(code, ssrData, ssrComponents, true)
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(SSRComp),
    )
    expect(html).toBe('<div><p>initial</p><i>initial</i></div>')

    const clientData = ref({ show: false, msg: 'initial' })
    const clientComponents = {
      Second: compileVaporComponent(`<i>{{ data.msg }}</i>`, clientData),
    }
    const { container } = await mountWithHydration(
      html,
      code,
      clientData,
      clientComponents,
    )

    expect(container.innerHTML).toBe(
      '<div><!--dynamic-component--><i>initial</i></div>',
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).toHaveBeenWarned()

    clientData.value.msg = 'updated'
    await nextTick()
    expect(container.innerHTML).toBe(
      '<div><!--dynamic-component--><i>updated</i></div>',
    )

    clientData.value.show = true
    await nextTick()
    expect(container.innerHTML).toBe(
      '<div><p>updated</p><!--dynamic-component--><i>updated</i></div>',
    )
  })

  test('hydrate createDynamicComponent to null branch at end of container', async () => {
    const data = ref({
      show: true,
      msg: 'late',
    })
    const code = `<script setup>
        const data = _data
      </script>
      <template>
        <component :is="data.show ? 'div' : null">{{ data.msg }}</component>
      </template>`

    const serverComp = compile(code, data, {}, { vapor: true, ssr: true })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
    )

    data.value.show = false

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const clientComp = compile(code, data, {}, { vapor: true, ssr: false })
    createVaporSSRApp(clientComp).mount(container)

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).toHaveBeenWarned()
    expect(container.innerHTML).toBe('<!--dynamic-component-->')

    data.value.show = true
    await nextTick()
    expect(container.innerHTML).toBe('<div>late</div><!--dynamic-component-->')

    data.value.msg = 'late-updated'
    await nextTick()
    expect(container.innerHTML).toBe(
      '<div>late-updated</div><!--dynamic-component-->',
    )
  })

  test('hydrate createDynamicComponent to null branch at end of allowed-mismatch container', async () => {
    const data = ref({
      show: true,
      msg: 'late',
    })
    const code = `<script setup>
        const data = _data
      </script>
      <template>
        <div data-allow-mismatch="children">
          <component :is="data.show ? 'div' : null">{{ data.msg }}</component>
        </div>
      </template>`

    const serverComp = compile(code, data, {}, { vapor: true, ssr: true })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
    )

    data.value.show = false

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const clientComp = compile(code, data, {}, { vapor: true, ssr: false })
    createVaporSSRApp(clientComp).mount(container)

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="children"><!--dynamic-component--></div>',
    )
  })

  test('hydrate Fragment dynamic component to null branch at end of container', async () => {
    const data = ref({
      showMulti: true,
    })
    const code = `<script setup>
        import { Fragment, computed, h } from 'vue'
        const data = _data
        const vnode = computed(() =>
          data.value.showMulti
            ? h(Fragment, null, [
                h('div', null, 'first fragment'),
                h('div', null, 'second fragment'),
              ])
            : null
        )
      </script>
      <template>
        <component :is="vnode" />
      </template>`

    const serverComp = compile(code, data, {}, { vapor: true, ssr: true })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
    )

    data.value.showMulti = false

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const clientComp = compile(code, data, {}, { vapor: true, ssr: false })
    const app = createVaporSSRApp(clientComp)
    app.use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).toHaveBeenWarned()
    expect(container.innerHTML).toBe('<!--dynamic-component-->')

    data.value.showMulti = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "<div>first fragment</div><div>second fragment</div><!--dynamic-component-->"
    `)
  })

  test('hydrate Fragment dynamic component to null branch at end of allowed-mismatch container', async () => {
    const data = ref({
      showMulti: true,
    })
    const code = `<script setup>
        import { Fragment, computed, h } from 'vue'
        const data = _data
        const vnode = computed(() =>
          data.value.showMulti
            ? h(Fragment, null, [
                h('div', null, 'first fragment'),
                h('div', null, 'second fragment'),
              ])
            : null
        )
      </script>
      <template>
        <div data-allow-mismatch="children">
          <component :is="vnode" />
        </div>
      </template>`

    const serverComp = compile(code, data, {}, { vapor: true, ssr: true })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
    )

    data.value.showMulti = false

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const clientComp = compile(code, data, {}, { vapor: true, ssr: false })
    const app = createVaporSSRApp(clientComp)
    app.use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="children"><!--dynamic-component--></div>',
    )
  })

  test('hydrate Teleport VNode dynamic component to null branch at end of container', async () => {
    const data = ref({
      showTeleport: true,
    })
    const code = `<script setup>
        import { Teleport, computed, h } from 'vue'
        const data = _data
        const vnode = computed(() =>
          data.value.showTeleport
            ? h(Teleport, { to: '#target', disabled: true }, [
                h('div', null, 'teleported'),
              ])
            : null
        )
      </script>
      <template>
        <component :is="vnode" />
      </template>`

    const serverComp = compile(code, data, {}, { vapor: true, ssr: true })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
    )

    data.value.showTeleport = false

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const clientComp = compile(code, data, {}, { vapor: true, ssr: false })
    const app = createVaporSSRApp(clientComp)
    app.use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).toHaveBeenWarned()
    expect(container.innerHTML).toBe('<!--dynamic-component-->')

    data.value.showTeleport = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--teleport start-->
      <div>teleported</div>
      <!--teleport end-->
      <!--dynamic-component-->"
    `)
  })

  test('hydrate Teleport VNode dynamic component to null branch at end of allowed-mismatch container', async () => {
    const data = ref({
      showTeleport: true,
    })
    const code = `<script setup>
        import { Teleport, computed, h } from 'vue'
        const data = _data
        const vnode = computed(() =>
          data.value.showTeleport
            ? h(Teleport, { to: '#target', disabled: true }, [
                h('div', null, 'teleported'),
              ])
            : null
        )
      </script>
      <template>
        <div data-allow-mismatch="children">
          <component :is="vnode" />
        </div>
      </template>`

    const serverComp = compile(code, data, {}, { vapor: true, ssr: true })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
    )

    data.value.showTeleport = false

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const clientComp = compile(code, data, {}, { vapor: true, ssr: false })
    const app = createVaporSSRApp(clientComp)
    app.use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="children"><!--dynamic-component--></div>',
    )
  })

  test('hydrate vapor slot in vdom component with empty slot and sibling nodes', async () => {
    const msg = ref('Hello World!')
    const { container } = await testWithVaporApp(
      `<script setup vapor>
        const msg = _data
        const components = _components
      </script>
      <template>
        <components.Comp />
        <h1>{{ msg }}</h1>
      </template>`,
      {
        Comp: {
          code: `
          <template>
            <div>
              <slot />
            </div>
          </template>`,
          vapor: false,
        },
      },
      msg,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>
      <!--[--><!--]-->
      </div><h1>Hello World!</h1><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    msg.value = 'Hi Vapor'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>
      <!--[--><!--]-->
      </div><h1>Hi Vapor</h1><!--]-->
      "
    `,
    )
  })

  test('hydrate static/fragment VNode via createDynamicComponent and switch type', async () => {
    const data = ref({
      useStatic: true,
      tail: 'tail',
    })
    const { container } = await testWithVaporApp(
      `<script setup>
        import { Fragment, computed, createStaticVNode, h } from 'vue'
        const data = _data
        const vnode = computed(() =>
          data.value.useStatic
            ? createStaticVNode(
                '<div>first static</div><div>second static</div>',
                2,
              )
            : h(Fragment, null, [
                h('div', null, 'first fragment'),
                h('div', null, 'second fragment'),
              ])
        )
      </script>
      <template>
        <component :is="vnode" />
        <span>{{ data.tail }}</span>
      </template>`,
      undefined,
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>first static</div><div>second static</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value.useStatic = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>first fragment</div><div>second fragment</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    data.value.useStatic = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>first static</div><div>second static</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>first static</div><div>second static</div><!--dynamic-component--><span>tail-updated</span><!--]-->
      "
    `)
  })

  test('hydrate Teleport VNode via createDynamicComponent and switch branch', async () => {
    const data = ref({
      showTeleport: true,
      tail: 'tail',
    })
    const { container } = await testWithVaporApp(
      `<script setup>
        import { Teleport, computed, h } from 'vue'
        const data = _data
        const vnode = computed(() =>
          data.value.showTeleport
            ? h(Teleport, { to: '#target', disabled: true }, [
                h('div', null, 'teleported'),
              ])
            : h('p', null, 'fallback')
        )
      </script>
      <template>
        <component :is="vnode" />
        <span>{{ data.tail }}</span>
      </template>`,
      undefined,
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[-->
      <!--teleport start-->
      <div>teleported</div>
      <!--teleport end-->
      <!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    data.value.showTeleport = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><p>fallback</p><!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    data.value.showTeleport = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[-->
      <!--teleport start-->
      <div>teleported</div>
      <!--teleport end-->
      <!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[-->
      <!--teleport start-->
      <div>teleported</div>
      <!--teleport end-->
      <!--dynamic-component--><span>tail-updated</span><!--]-->
      "
    `)
  })

  test('hydrate Teleport dynamic component to null branch should remove teleport range and preserve trailing sibling', async () => {
    const data = ref({
      showTeleport: true,
      tail: 'tail',
    })

    const code = `<script setup>
        import { Teleport } from 'vue'
        const data = _data
      </script>
      <template>
        <component
          :is="data.showTeleport ? Teleport : null"
          to="#target"
          :disabled="true"
        >
          <div>teleported</div>
        </component>
        <span>{{ data.tail }}</span>
      </template>`

    const serverComp = compile(code, data, {}, { vapor: true, ssr: true })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
    )

    data.value.showTeleport = false

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const clientComp = compile(code, data, {}, { vapor: true, ssr: false })
    createVaporSSRApp(clientComp).mount(container)

    expect(`Hydration children mismatch`).toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><!--dynamic-component--><span>tail-updated</span><!--]-->
      "
    `)
  })

  test('hydrate enabled Teleport VNode via createDynamicComponent and switch branch', async () => {
    const data = ref({
      showTeleport: true,
      tail: 'tail',
    })
    const code = `<script setup>
        import { Teleport, computed, h } from 'vue'
        const data = _data
        const vnode = computed(() =>
          data.value.showTeleport
            ? h(Teleport, { to: '#target' }, [h('div', null, 'teleported')])
            : h('p', null, 'fallback')
        )
      </script>
      <template>
        <component :is="vnode" />
        <span>{{ data.tail }}</span>
      </template>`
    const serverComp = compile(code, data, {}, { vapor: true, ssr: true })
    const ssrCtx: Record<string, any> = {}
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
      ssrCtx,
    )

    const target = document.createElement('div')
    target.id = 'target'
    target.innerHTML = ssrCtx.teleports['#target']
    document.body.appendChild(target)

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const clientComp = compile(code, data, {}, { vapor: true, ssr: false })
    const app = createVaporSSRApp(clientComp)
    app.use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--teleport start-->
      <!--teleport end-->
      <!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )
    expect(formatHtml(target.innerHTML)).toMatchInlineSnapshot(
      `"<!--teleport start anchor--><div>teleported</div><!--teleport anchor-->"`,
    )

    data.value.showTeleport = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><p>fallback</p><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )
    expect(formatHtml(target.innerHTML)).toMatchInlineSnapshot(`""`)

    data.value.showTeleport = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--teleport start-->
      <!--teleport end-->
      <!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )
    expect(formatHtml(target.innerHTML)).toMatchInlineSnapshot(
      `"<div>teleported</div>"`,
    )

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[-->
      <!--teleport start-->
      <!--teleport end-->
      <!--dynamic-component--><span>tail-updated</span><!--]-->
      "
    `)
  })

  test('hydrate VDOM Teleport slot content and switch vapor branch', async () => {
    const targetId = 'interop-vdom-teleport-slot-hydration-target'
    const data = ref({
      show: true,
      target: targetId,
      tail: 'tail',
    })
    const portalCode = `<script setup>
        defineOptions({ name: 'VDomPortal' })
        defineProps({ to: String })
      </script>
      <template>
        <Teleport :to="to">
          <slot />
        </Teleport>
      </template>`
    const rootCode = `<script setup vapor>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Portal v-if="data.show" :to="'#' + data.target">
          <span>teleported</span>
        </components.Portal>
        <p v-else>next</p>
        <span>{{ data.tail }}</span>
      </template>`

    const ssrComponents = {
      Portal: compile(portalCode, data, {}, { vapor: false, ssr: true }),
    }
    const clientComponents = {
      Portal: compile(portalCode, data, {}, { vapor: false, ssr: false }),
    }
    const serverComp = compile(rootCode, data, ssrComponents, {
      vapor: true,
      ssr: true,
    })
    const ssrCtx: Record<string, any> = {}
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
      ssrCtx,
    )

    const target = document.createElement('div')
    target.id = targetId
    target.innerHTML = ssrCtx.teleports[`#${targetId}`]
    const nextTarget = document.createElement('div')
    nextTarget.id = `${targetId}-next`
    document.body.appendChild(target)
    document.body.appendChild(nextTarget)

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const clientComp = compile(rootCode, data, clientComponents, {
      vapor: true,
      ssr: false,
    })
    const app = createVaporSSRApp(clientComp)
    app.use(runtimeVapor.vaporInteropPlugin)
    try {
      app.mount(container)

      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(formatHtml(target.innerHTML)).toBe(
        '<!--teleport start anchor-->\n' +
          '<!--[--><span>teleported</span><!--]-->\n' +
          '<!--teleport anchor-->',
      )

      data.value.target = `${targetId}-next`
      await nextTick()

      expect(target.innerHTML).not.toContain('<!--[-->')
      expect(nextTarget.innerHTML).toContain(
        '<!--[--><span>teleported</span><!--]-->',
      )

      data.value.show = false
      await nextTick()

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "
        <!--[--><p>next</p><!--if--><span>tail</span><!--]-->
        "
      `)
      expect(target.innerHTML).toBe('')
      expect(nextTarget.innerHTML).toBe('')
    } finally {
      app.unmount()
      container.remove()
      target.remove()
      nextTarget.remove()
    }
  })

  test('hydrate client-mounted VDOM Teleport slot content and switch vapor branch', async () => {
    const targetId = 'interop-vdom-mounted-teleport-slot-hydration-target'
    const data = ref({
      show: true,
      tail: 'tail',
    })
    const mountedPortalCode = `<script setup>
        import { onMounted, ref } from 'vue'
        defineOptions({ name: 'VDomMountedPortal' })
        defineProps({ to: String })
        const mounted = ref(false)
        onMounted(() => {
          mounted.value = true
        })
      </script>
      <template>
        <Teleport v-if="mounted" :to="to">
          <slot />
        </Teleport>
      </template>`
    const portalCode = `<script setup>
        defineOptions({ name: 'VDomPortalForwarder' })
        defineProps({ to: String })
        const components = _components
      </script>
      <template>
        <components.MountedPortal :to="to">
          <slot />
        </components.MountedPortal>
      </template>`
    const rootCode = `<script setup vapor>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Portal v-if="data.show" :to="'#${targetId}'">
          <span>teleported</span>
        </components.Portal>
        <p v-else>next</p>
        <span>{{ data.tail }}</span>
      </template>`

    const ssrComponents: any = {}
    ssrComponents.MountedPortal = compile(
      mountedPortalCode,
      data,
      ssrComponents,
      {
        vapor: false,
        ssr: true,
      },
    )
    ssrComponents.Portal = compile(portalCode, data, ssrComponents, {
      vapor: false,
      ssr: true,
    })
    const clientComponents: any = {}
    clientComponents.MountedPortal = compile(
      mountedPortalCode,
      data,
      clientComponents,
      {
        vapor: false,
        ssr: false,
      },
    )
    clientComponents.Portal = compile(portalCode, data, clientComponents, {
      vapor: false,
      ssr: false,
    })
    const serverComp = compile(rootCode, data, ssrComponents, {
      vapor: true,
      ssr: true,
    })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(serverComp),
    )

    const target = document.createElement('div')
    target.id = targetId
    document.body.appendChild(target)

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const clientComp = compile(rootCode, data, clientComponents, {
      vapor: true,
      ssr: false,
    })
    const app = createVaporSSRApp(clientComp)
    app.use(runtimeVapor.vaporInteropPlugin)
    try {
      app.mount(container)
      await nextTick()

      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(formatHtml(target.innerHTML)).toBe('<span>teleported</span>')

      data.value.show = false
      await nextTick()

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "
        <!--[--><p>next</p><!--if--><span>tail</span><!--]-->
        "
      `)
      expect(target.innerHTML).toBe('')
    } finally {
      app.unmount()
      container.remove()
      target.remove()
    }
  })

  test('hydrate Suspense VNode via createDynamicComponent and switch branch', async () => {
    const data = ref({
      showSuspense: true,
      msg: 'foo',
      tail: 'tail',
    })
    const { container } = await testWithVaporApp(
      `<script setup>
        import { Suspense, computed, h } from 'vue'
        const data = _data
        const vnode = computed(() =>
          data.value.showSuspense
            ? h(Suspense, null, {
                default: () => h('div', null, data.value.msg),
                fallback: () => h('div', null, 'pending'),
              })
            : h('p', null, 'fallback')
        )
      </script>
      <template>
        <component :is="vnode" />
        <span>{{ data.tail }}</span>
      </template>`,
      undefined,
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>foo</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value.msg = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>bar</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    data.value.showSuspense = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><p>fallback</p><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    data.value.showSuspense = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>bar</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>bar</div><!--dynamic-component--><span>tail-updated</span><!--]-->
      "
    `)
  })

  test('hydrate static Suspense with vapor child before trailing sibling', async () => {
    const serverData = ref({
      tail: 'tail',
    })
    const clientData = ref({
      html: '',
      tail: 'tail',
    })
    const appCode = `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <div>
          <p>before</p>
          <Suspense>
            <components.Child />
            <template #fallback></template>
          </Suspense>
          <span>{{ data.tail }}</span>
        </div>
      </template>`
    const serverChildCode = `<div id="dmermaid"><svg></svg></div>`
    const clientChildCode = `<script setup>
            const data = _data
          </script>
          <template><div v-html="data.html"></div></template>`

    const SSRChild = compileVaporComponent(
      serverChildCode,
      serverData,
      undefined,
      true,
    )
    const SSRApp = compileVaporComponent(
      appCode,
      serverData,
      { Child: SSRChild },
      true,
    )
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(SSRApp),
    )

    const ClientChild = compileVaporComponent(clientChildCode, clientData)
    const ClientApp = compileVaporComponent(appCode, clientData, {
      Child: ClientChild,
    })
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const app = createVaporSSRApp(ClientApp)
    app.use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "<div><p>before</p><div id="dmermaid"><svg></svg></div><span>tail</span></div>"
    `)

    clientData.value.html = '<svg data-updated="true"></svg>'
    clientData.value.tail = 'tail-updated'
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "<div><p>before</p><div id="dmermaid"><svg data-updated="true"></svg></div><span>tail-updated</span></div>"
    `)
  })

  test('hydrate async Suspense VNode via createDynamicComponent and show fallback', async () => {
    const data = ref({
      showSuspense: true,
      tail: 'tail',
    })

    const appCode = `<script setup>
      import { Suspense, computed, h } from 'vue'
      const data = _data
      const components = _components
      const vnode = computed(() =>
        data.value.showSuspense
          ? h(Suspense, { timeout: 0 }, {
              default: () => h(components.AsyncComp),
              fallback: () => h('div', null, 'pending'),
            })
          : h('p', null, 'fallback')
      )
    </script>
    <template>
      <component :is="vnode" />
      <span>{{ data.tail }}</span>
    </template>`

    const AsyncResolvedComp = {
      render: () => runtimeDom.h('div', null, 'async resolved'),
    }

    let serverResolve: (comp: any) => void
    const ServerAsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          serverResolve = r
        }),
    )

    const SSRApp = compile(
      appCode,
      data,
      { AsyncComp: ServerAsyncComp },
      {
        vapor: true,
        ssr: true,
      },
    )

    const htmlPromise = VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(SSRApp),
    )
    serverResolve!(AsyncResolvedComp)
    const html = await htmlPromise

    let clientResolve: (comp: any) => void
    const ClientAsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          clientResolve = r
        }),
    )
    const App = compile(
      appCode,
      data,
      { AsyncComp: ClientAsyncComp },
      {
        vapor: true,
        ssr: false,
      },
    )

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const app = createVaporSSRApp(App)
    app.use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>async resolved</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    data.value.showSuspense = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><p>fallback</p><!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    data.value.showSuspense = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>pending</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    clientResolve!(AsyncResolvedComp)
    await new Promise(r => setTimeout(r))
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>async resolved</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>async resolved</div><!--dynamic-component--><span>tail-updated</span><!--]-->
      "
    `)
  })

  test('hydrate Suspense VNode via createDynamicComponent under KeepAlive', async () => {
    const data = ref({
      msg: 'foo',
      tail: 'tail',
    })
    const { container } = await testWithVaporApp(
      `<script setup>
        import { KeepAlive, Suspense, computed, h } from 'vue'
        const data = _data
        const vnode = computed(() =>
          h(Suspense, null, {
            default: () => h('div', null, data.value.msg),
            fallback: () => h('div', null, 'pending'),
          })
        )
      </script>
      <template>
        <KeepAlive>
          <component :is="vnode" />
        </KeepAlive>
        <span>{{ data.tail }}</span>
      </template>`,
      undefined,
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>foo</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><div>foo</div><!--dynamic-component--><span>tail-updated</span><!--]-->
      "
    `)
  })

  test('hydrate Teleport VNode via createDynamicComponent under Transition', async () => {
    const data = ref({
      showTeleport: true,
      tail: 'tail',
    })
    const { container } = await testWithVaporApp(
      `<script setup>
        import { Teleport, Transition, computed, h } from 'vue'
        const data = _data
        const vnode = computed(() =>
          data.value.showTeleport
            ? h(Teleport, { to: '#target', disabled: true }, [
                h('div', null, 'teleported'),
              ])
            : h('p', null, 'fallback')
        )
      </script>
      <template>
        <Transition>
          <component :is="vnode" />
        </Transition>
        <span>{{ data.tail }}</span>
      </template>`,
      undefined,
      data,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[-->
      <!--teleport start-->
      <div>teleported</div>
      <!--teleport end-->
      <!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    data.value.showTeleport = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><p class="v-enter-from v-enter-active">fallback</p><!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    data.value.showTeleport = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><p class="v-enter-from v-leave-from v-leave-active">fallback</p>
      <!--teleport start-->
      <div>teleported</div>
      <!--teleport end-->
      <!--dynamic-component--><span>tail</span><!--]-->
      "
    `)

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><p class="v-enter-from v-leave-from v-leave-active">fallback</p>
      <!--teleport start-->
      <div>teleported</div>
      <!--teleport end-->
      <!--dynamic-component--><span>tail-updated</span><!--]-->
      "
    `)
  })

  test('hydrate interop dynamic component under KeepAlive', async () => {
    const data = ref({
      show: true,
      tail: 'tail',
    })
    const { container } = await testWithVaporApp(
      `<script setup>
        import { KeepAlive, computed, h } from 'vue'
        const data = _data
        const components = _components
        const vnode = computed(() => h(components.Counter))
      </script>
      <template>
        <KeepAlive>
          <component v-if="data.show" :is="vnode" />
        </KeepAlive>
        <span>{{ data.tail }}</span>
      </template>`,
      {
        Counter: {
          code: `<script setup>
            import { ref } from 'vue'
            const count = ref(0)
          </script>
          <template><button @click="count++">{{ count }}</button></template>`,
          vapor: false,
        },
      },
      data,
    )

    const getButton = () =>
      container.querySelector('button') as HTMLButtonElement

    expect(getButton().textContent).toBe('0')
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    triggerEvent('click', getButton())
    await nextTick()
    expect(getButton().textContent).toBe('1')

    data.value.show = false
    await nextTick()
    expect(container.querySelector('button')).toBeNull()

    data.value.show = true
    await nextTick()
    expect(getButton().textContent).toBe('1')

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[--><button>1</button><!--dynamic-component--><!--if--><span>tail-updated</span><!--]-->
      "
    `)
  })
})
