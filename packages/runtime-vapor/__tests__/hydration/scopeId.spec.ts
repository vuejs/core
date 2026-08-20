import {
  createComponent,
  createPlainElement,
  createVaporSSRApp,
  defineVaporComponent,
} from '../../src'
import {
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  ref,
  renderSlot,
} from '@vue/runtime-dom'
import { BindingTypes } from '@vue/compiler-dom'
import {
  VueServerRenderer,
  compile,
  compileToVaporRender,
  runtimeDom,
  runtimeVapor,
} from '../_utils'
import { isHydrating } from '../../src/dom/hydration'
import { compileVaporComponent, setupHydrationTest } from './_helpers'

setupHydrationTest()

describe('scopeId hydration writes', () => {
  test('writes inherited scopeId to a recreated hydration root', () => {
    const msg = ref('base')
    const Child = defineVaporComponent({
      __scopeId: 'child',
      render: compileToVaporRender(`<div>{{ msg }}</div>`, {
        bindingMetadata: {
          msg: BindingTypes.SETUP_REF,
        },
        scopeId: 'child',
      }),
      setup() {
        return { msg }
      },
    })
    const Parent = defineVaporComponent({
      __scopeId: 'parent',
      setup() {
        return createComponent(Child)
      },
    })
    const container = document.createElement('div')
    container.innerHTML = `<span child="" parent="">base</span>`
    document.body.appendChild(container)

    const app = createVaporSSRApp(Parent)
    app.mount(container)

    expect(container.innerHTML).toBe(`<div child="" parent="">base</div>`)
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    app.unmount()
    container.remove()
  })

  test('writes recreated plain element scopeId without breaking hydration', () => {
    let restored: boolean | undefined
    const App = defineVaporComponent({
      __scopeId: 'parent',
      setup() {
        const element = createPlainElement('div')
        // scope id writes on a recreated element must not knock the runtime
        // out of hydration mode for subsequent siblings
        restored = isHydrating
        return element
      },
    })
    const container = document.createElement('div')
    container.innerHTML = `<span parent=""></span>`
    document.body.appendChild(container)

    const app = createVaporSSRApp(App)
    app.mount(container)

    expect(container.innerHTML).toBe(`<div parent=""></div>`)
    expect(restored).toBe(true)
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    app.unmount()
    container.remove()
  })

  // renders App with interop on the "server", then rebuilds the markup in a
  // fresh container ready for client hydration
  function renderToHydrationContainer(App: any): HTMLElement {
    const serverContainer = document.createElement('div')
    const serverApp = runtimeDom
      .createApp(App)
      .use(runtimeVapor.vaporInteropPlugin)
    serverApp.mount(serverContainer)
    const html = serverContainer.innerHTML
    serverApp.unmount()
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    return container
  }

  test('applies slotted scopeId before hydrating recreated VDOM content', () => {
    const useDiv = ref(false)
    const Receiver = compileVaporComponent(`<slot />`, useDiv)
    Receiver.__scopeId = 'receiver'
    const App = compile(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Receiver>
          <div v-if="data">content</div>
          <span v-else>content</span>
        </components.Receiver>
      </template>`,
      useDiv,
      { Receiver },
      { vapor: false },
    )
    App.__scopeId = 'owner'

    const container = renderToHydrationContainer(App)

    useDiv.value = true
    const clientApp = createSSRApp(App).use(runtimeVapor.vaporInteropPlugin)
    clientApp.mount(container)

    expect(container.querySelector('div')!.hasAttribute('owner')).toBe(true)
    expect(container.querySelector('div')!.hasAttribute('receiver-s')).toBe(
      true,
    )
    expect(container.querySelector('div')!.hasAttribute('receiver')).toBe(false)
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    clientApp.unmount()
    container.remove()
  })

  test('does not hydrate root-only component scopeId through a slot outlet', async () => {
    const hasContent = ref(true)
    const useDiv = ref(false)
    const VDOMChild = defineComponent({
      setup(_: unknown, { slots }) {
        return () =>
          renderSlot(slots, 'default', {}, () => [h('em', 'fallback')])
      },
    })
    const VaporChild = compileVaporComponent(`<slot><em>fallback</em></slot>`)
    const createParent = (Child: any) =>
      defineComponent({
        setup() {
          return () => {
            const child = h(Child, null, {
              default: () =>
                hasContent.value
                  ? h(useDiv.value ? 'div' : 'span', 'content')
                  : [],
            })
            child.scopeId = 'external'
            return child
          }
        },
      })

    const VDOMApp = createParent(VDOMChild)
    const VaporApp = createParent(VaporChild)
    const vdomContainer = renderToHydrationContainer(VDOMApp)
    const vaporContainer = renderToHydrationContainer(VaporApp)

    useDiv.value = true
    const vdomApp = createSSRApp(VDOMApp)
    const vaporApp = createSSRApp(VaporApp).use(runtimeVapor.vaporInteropPlugin)
    vdomApp.mount(vdomContainer)
    vaporApp.mount(vaporContainer)
    await nextTick()

    expect(vdomContainer.innerHTML).toBe(`<div>content</div>`)
    expect(vaporContainer.innerHTML).toBe(vdomContainer.innerHTML)
    expect(vaporContainer.firstElementChild!.hasAttribute('external')).toBe(
      false,
    )

    hasContent.value = false
    await nextTick()
    expect(vdomContainer.innerHTML).toBe(`<em>fallback</em>`)
    expect(vaporContainer.innerHTML).toBe(vdomContainer.innerHTML)
    expect(vaporContainer.firstElementChild!.hasAttribute('external')).toBe(
      false,
    )
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    vdomApp.unmount()
    vaporApp.unmount()
    vdomContainer.remove()
    vaporContainer.remove()
  })

  test('recreated mismatch nodes in a VDOM outlet fallback carry both slotted ids', async () => {
    const data = ref(false)

    const makeComponents = (ssr: boolean, fallbackTag: string) => {
      const components: any = {}
      const Outlet = compile(
        `<script setup>const data = _data; const components = _components;</script>` +
          `<template><slot><${fallbackTag}>fallback</${fallbackTag}></slot></template>`,
        data,
        components,
        { vapor: false, ssr },
      )
      Outlet.__scopeId = 'outlet'
      const Child = compile(
        `<template><components.Outlet><slot/></components.Outlet></template>`,
        data,
        { Outlet },
        { vapor: true, ssr },
      )
      ;(Child as any).__scopeId = 'child'
      return { Child }
    }

    const appCode =
      `<script setup>const data = _data; const components = _components;</script>` +
      `<template><components.Child><b v-if="data">content</b></components.Child></template>`

    // server renders the fallback as <b>, client expects <span> → mismatch
    const ServerApp = compile(appCode, data, makeComponents(true, 'b'), {
      vapor: false,
      ssr: true,
    })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(ServerApp).use(runtimeVapor.vaporInteropPlugin),
    )

    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html

    const ClientApp = compile(appCode, data, makeComponents(false, 'span'), {
      vapor: false,
      ssr: false,
    })
    const app = runtimeDom
      .createSSRApp(ClientApp)
      .use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    // the recreated node gets both the requesting outlet's and the providing
    // outlet's slotted ids as part of its creation context (CSR control:
    // <span child-s outlet-s>fallback</span>)
    const span = container.querySelector('span')!
    expect(span).toBeTruthy()
    expect(span.hasAttribute('child-s')).toBe(true)
    expect(span.hasAttribute('outlet-s')).toBe(true)
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    app.unmount()
    container.remove()
  })

  test('does not propagate slotted ids through an adopted VDOM fallback component', async () => {
    const data = ref(false)

    const makeApp = (ssr: boolean) => {
      const Fallback = compile(
        `<template><span><i>inside</i></span></template>`,
        data,
        {},
        { vapor: false, ssr },
      )
      Fallback.__scopeId = 'fallback'
      const Outlet = compile(
        `<script setup>const components = _components;</script>` +
          `<template><slot><components.Fallback /></slot></template>`,
        data,
        { Fallback },
        { vapor: false, ssr },
      )
      Outlet.__scopeId = 'outlet'
      const Child = compile(
        `<template><components.Outlet><slot/></components.Outlet></template>`,
        data,
        { Outlet },
        { vapor: true, ssr },
      )
      ;(Child as any).__scopeId = 'child'
      return compile(
        `<script setup>const components = _components;</script>` +
          `<template><components.Child /></template>`,
        data,
        { Child },
        { vapor: false, ssr },
      )
    }

    const html = await VueServerRenderer.renderToString(
      runtimeDom
        .createSSRApp(makeApp(true))
        .use(runtimeVapor.vaporInteropPlugin),
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    const serverRoot = container.querySelector('span')!
    // __scopeId is assigned after compilation in this test helper, so stamp
    // the attributes that a real scoped SSR build would emit.
    serverRoot.setAttribute('child-s', '')
    serverRoot.setAttribute('outlet-s', '')

    const setAttribute = vi.spyOn(Element.prototype, 'setAttribute')
    const app = runtimeDom
      .createSSRApp(makeApp(false))
      .use(runtimeVapor.vaporInteropPlugin)
    try {
      app.mount(container)

      const span = container.querySelector('span')!
      expect(span).toBe(serverRoot)
      expect(setAttribute).not.toHaveBeenCalledWith('child-s', '')
      expect(setAttribute).not.toHaveBeenCalledWith('outlet-s', '')
      expect(span.hasAttribute('child-s')).toBe(true)
      expect(span.hasAttribute('outlet-s')).toBe(true)
      expect(span.querySelector('i')!.hasAttribute('child-s')).toBe(false)
      expect(span.querySelector('i')!.hasAttribute('outlet-s')).toBe(false)
      app.unmount()
    } finally {
      setAttribute.mockRestore()
      container.remove()
    }
  })

  test('applies slotted id to recovered teleport children when the target has no markers', async () => {
    const data = ref(0)

    const Child = compile(`<template><slot/></template>`, data, {}, {})
    ;(Child as any).__scopeId = 'c'
    const App = compile(
      `<template><components.Child><Teleport to="#hydration-scope-modal"><div>x</div></Teleport></components.Child></template>`,
      data,
      { Child },
    )

    // client-side teleport target exists but carries no SSR markers, so the
    // teleport takes the hydration recovery path and creates its children
    const target = document.createElement('div')
    target.id = 'hydration-scope-modal'
    document.body.appendChild(target)

    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML =
      '<!--[--><!--teleport start--><!--teleport end--><!--]-->'

    const app = createVaporSSRApp(App)
    app.mount(container)

    try {
      const div = target.querySelector('div')!
      expect(div).toBeTruthy()
      expect(div.hasAttribute('c-s')).toBe(true)
      expect(`Hydration children mismatch`).toHaveBeenWarned()
    } finally {
      app.unmount()
      target.remove()
      container.remove()
    }
  })

  test('hydrated vdom component in vapor slot content keeps the slot context', async () => {
    const show = ref(false)
    const makeApp = (ssr: boolean) => {
      const VdomInner = compile(
        `<script setup>const data = _data</script>` +
          `<template><b v-if="data">out</b><i v-else>in</i></template>`,
        show,
        {},
        { vapor: false, ssr },
      )
      const Receiver = compile(
        `<template><slot/></template>`,
        show,
        {},
        {
          vapor: true,
          ssr,
        },
      )
      ;(Receiver as any).__scopeId = 'child'
      const Parent = compile(
        `<template><components.Receiver><components.VdomInner/></components.Receiver></template>`,
        show,
        { Receiver, VdomInner },
        { vapor: true, ssr },
      )
      return compile(
        `<script setup>const components = _components</script>` +
          `<template><components.Parent/></template>`,
        show,
        { Parent },
        { vapor: false, ssr },
      )
    }
    const html = await VueServerRenderer.renderToString(
      runtimeDom
        .createSSRApp(makeApp(true))
        .use(runtimeVapor.vaporInteropPlugin),
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    const app = runtimeDom
      .createSSRApp(makeApp(false))
      .use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    // a branch mounted after hydration must observe the creation-time slot
    // context — core hydration overwrites vnode.slotScopeIds, so the interop
    // fragment has to hand its captured cell back in
    show.value = true
    await nextTick()
    const b = container.querySelector('b')!
    expect(b).toBeTruthy()
    expect(b.hasAttribute('child-s')).toBe(true)
    app.unmount()
    container.remove()
  })

  test('hydrated forwarded vapor slot keeps the outer vdom slot context', async () => {
    const show = ref(false)
    const makeApp = (ssr: boolean) => {
      const Outer = compile(
        `<template><div><slot/></div></template>`,
        show,
        {},
        { vapor: false, ssr },
      )
      ;(Outer as any).__scopeId = 'outer'
      const Middle = compile(
        `<template><components.Outer><slot/></components.Outer></template>`,
        show,
        { Outer },
        { vapor: false, ssr },
      )
      const Sender = compile(
        `<template><components.Middle><b v-if="data">on</b><i v-else>off</i></components.Middle></template>`,
        show,
        { Middle },
        { vapor: true, ssr },
      )
      return compile(
        `<script setup>const components = _components</script>` +
          `<template><components.Sender/></template>`,
        show,
        { Sender },
        { vapor: false, ssr },
      )
    }
    const html = await VueServerRenderer.renderToString(
      runtimeDom
        .createSSRApp(makeApp(true))
        .use(runtimeVapor.vaporInteropPlugin),
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    const app = runtimeDom
      .createSSRApp(makeApp(false))
      .use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    // the outer vdom outlet's ambient context must survive the VaporSlot
    // hydration dispatch so client-mounted branches inside the forwarded
    // vapor content still carry it
    show.value = true
    await nextTick()
    const b = container.querySelector('b')!
    expect(b).toBeTruthy()
    expect(b.hasAttribute('outer-s')).toBe(true)
    app.unmount()
    container.remove()
  })
})
