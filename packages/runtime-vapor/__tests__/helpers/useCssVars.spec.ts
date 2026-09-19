import {
  VaporTeleport,
  createComponent,
  createFor,
  createIf,
  createPlainElement,
  defineVaporComponent,
  defineVaporCustomElement,
  renderEffect,
  setStyle,
  template,
  useVaporCssVars,
  vaporInteropPlugin,
} from '@vue/runtime-vapor'
import { nextTick, onMounted, reactive, ref } from '@vue/runtime-core'
import { Suspense, createApp, defineComponent, h } from '@vue/runtime-dom'
import { createVaporApp } from '../../src'
import { VaporBlockShape } from '@vue/shared'
import { compile, ifFlags, makeRender } from '../_utils'
import type { VaporComponent } from '../../src/component'

const define = makeRender()

describe('useVaporCssVars', () => {
  async function assertCssVars(getApp: (state: any) => VaporComponent) {
    const state = reactive({ color: 'red' })
    const App = getApp(state)
    const root = document.createElement('div')

    define(App).render({}, root)
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }

    state.color = 'green'
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('green')
    }
  }

  test('basic', async () => {
    const t0 = template('<div></div>')
    await assertCssVars(state => ({
      setup() {
        useVaporCssVars(() => state)
        const n0 = t0()
        return n0
      },
    }))
  })

  test('on multiple root', async () => {
    const t0 = template('<div></div>')
    await assertCssVars(state => ({
      setup() {
        useVaporCssVars(() => state)
        const n0 = t0()
        const n1 = t0()
        return [n0, n1]
      },
    }))
  })

  test('on HOCs', async () => {
    const t0 = template('<div></div>')
    const Child = defineVaporComponent({
      setup() {
        const n0 = t0()
        return n0
      },
    })
    await assertCssVars(state => ({
      setup() {
        useVaporCssVars(() => state)
        return createComponent(Child)
      },
    }))
  })

  test.todo('on suspense root', async () => {})

  test.todo('with v-if & async component & suspense', async () => {})

  test('with subTree changes', async () => {
    const state = reactive({ color: 'red' })
    const value = ref(true)
    const root = document.createElement('div')
    const t0 = template('<div></div>')

    define({
      setup() {
        useVaporCssVars(() => state)
        const n0 = createIf(
          () => value.value,
          () => {
            const n2 = t0()
            return n2
          },
          () => {
            const n4 = t0()
            const n5 = t0()
            return [n4, n5]
          },
        )
        return n0
      },
    }).render({}, root)

    // css vars use with fallback tree
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }

    value.value = false
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  test('with subTree change inside HOC', async () => {
    const state = reactive({ color: 'red' })
    const value = ref(true)
    const root = document.createElement('div')

    const Child = defineVaporComponent({
      setup(_, { slots }) {
        return slots.default!()
      },
    })

    const t0 = template('<div></div>')
    define({
      setup() {
        useVaporCssVars(() => state)
        return createComponent(Child, null, {
          default: () => {
            return createIf(
              () => value.value,
              () => {
                const n2 = t0()
                return n2
              },
              () => {
                const n4 = t0()
                const n5 = t0()
                return [n4, n5]
              },
            )
          },
        })
      },
    }).render({}, root)

    await nextTick()
    // css vars use with fallback tree
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }

    value.value = false
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  test('with teleport', async () => {
    const state = reactive({ color: 'red' })
    const target = document.createElement('div')
    document.body.appendChild(target)

    define({
      setup() {
        useVaporCssVars(() => state)
        return createComponent(
          VaporTeleport,
          {
            to: () => target,
          },
          {
            default: () => template('<div></div>', 1)(),
          },
        )
      },
    }).render()

    await nextTick()
    for (const c of [].slice.call(target.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }

    state.color = 'green'
    await nextTick()
    for (const c of [].slice.call(target.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('green')
    }
  })

  test('with teleport in child slot', async () => {
    const state = reactive({ color: 'red' })
    const target = document.createElement('div')
    document.body.appendChild(target)

    const Child = defineVaporComponent({
      setup(_, { slots }) {
        return slots.default!()
      },
    })

    define({
      setup() {
        useVaporCssVars(() => state)
        return createComponent(Child, null, {
          default: () =>
            createComponent(
              VaporTeleport,
              { to: () => target },
              {
                default: () => template('<div></div>', 1)(),
              },
            ),
        })
      },
    }).render()

    await nextTick()
    for (const c of [].slice.call(target.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }

    state.color = 'green'
    await nextTick()
    for (const c of [].slice.call(target.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('green')
    }
  })

  test('with teleport in child slot should keep slot owner css vars across branch switches', async () => {
    const parentState = reactive({ parent: 'red' })
    const childState = reactive({ child: 'blue' })
    const target = document.createElement('div')
    document.body.appendChild(target)
    const show = ref(true)

    const Child = defineVaporComponent({
      setup(_, { slots }) {
        useVaporCssVars(() => childState)
        return slots.default!()
      },
    })

    define({
      setup() {
        useVaporCssVars(() => parentState)
        return createComponent(Child, null, {
          default: () =>
            createComponent(
              VaporTeleport,
              { to: () => target },
              {
                default: () =>
                  createIf(
                    () => show.value,
                    () => template('<div></div>', 1)(),
                    () => template('<span></span>', 1)(),
                  ),
              },
            ),
        })
      },
    }).render()

    await nextTick()
    let el = target.children[0] as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el.style.getPropertyValue(`--parent`)).toBe('red')
    expect(el.style.getPropertyValue(`--child`)).toBe('')

    show.value = false
    await nextTick()
    el = target.children[0] as HTMLElement
    expect(el.tagName).toBe('SPAN')
    expect(el.style.getPropertyValue(`--parent`)).toBe('red')
    expect(el.style.getPropertyValue(`--child`)).toBe('')

    show.value = true
    await nextTick()
    el = target.children[0] as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el.style.getPropertyValue(`--parent`)).toBe('red')
    expect(el.style.getPropertyValue(`--child`)).toBe('')
  })

  test('with teleport(change subTree)', async () => {
    const state = reactive({ color: 'red' })
    const target = document.createElement('div')
    document.body.appendChild(target)
    const toggle = ref(false)

    define({
      setup() {
        useVaporCssVars(() => state)
        return createComponent(
          VaporTeleport,
          { to: () => target },
          {
            default: () => {
              const n0 = template('<div></div>', 1)()
              const n1 = createIf(
                () => toggle.value,
                () => template('<div></div>', 1)(),
              )
              return [n0, n1]
            },
          },
        )
      },
    }).render()

    await nextTick()
    for (const c of [].slice.call(target.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }

    toggle.value = true
    await nextTick()
    expect(target.children.length).toBe(2)
    for (const c of [].slice.call(target.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  test('with teleport(disabled)', async () => {
    const state = reactive({ color: 'red' })
    const target = document.createElement('div')
    document.body.appendChild(target)

    const { host } = define({
      setup() {
        useVaporCssVars(() => state)
        return createComponent(
          VaporTeleport,
          { to: () => target, disabled: () => true },
          {
            default: () => template('<div></div>', 1)(),
          },
        )
      },
    }).render()

    await nextTick()
    expect(target.children.length).toBe(0)
    expect(
      (host.children[0] as HTMLElement).style.getPropertyValue(`--color`),
    ).toBe('red')
  })

  test('with teleport and nested fragment', async () => {
    const state = reactive({ color: 'red' })
    const target = document.createElement('div')
    document.body.appendChild(target)

    const value = ref(true)
    const Child = defineVaporComponent({
      setup(_, { slots }) {
        return slots.default!()
      },
    })

    const Comp = defineVaporComponent({
      setup() {
        return createComponent(Child, null, {
          default: () => {
            return createComponent(Child, null, {
              default: () => {
                return createIf(
                  () => value.value,
                  () => {
                    return template('<div></div>')()
                  },
                  () => {
                    return template('<span></span>')()
                  },
                )
              },
            })
          },
        })
      },
    })

    define({
      setup() {
        useVaporCssVars(() => state)
        const n1 = createComponent(
          VaporTeleport,
          { to: () => target },
          {
            default: () => createComponent(Comp),
          },
        )
        return n1
      },
    }).render()

    await nextTick()
    let el = target.children[0] as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el.style.getPropertyValue(`--color`)).toBe('red')

    value.value = false
    await nextTick()
    el = target.children[0] as HTMLElement
    expect(el.tagName).toBe('SPAN')
    expect(el.style.getPropertyValue(`--color`)).toBe('red')
  })

  test('with string style', async () => {
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    const disabled = ref(false)
    const t0 = template('<h1></h1>')

    define({
      setup() {
        useVaporCssVars(() => state)
        const n0 = t0() as any
        renderEffect(() =>
          setStyle(n0, state.color ? 'pointer-events: none' : undefined),
        )
        return n0
      },
    }).render({}, root)

    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }

    disabled.value = true
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  test('with delay mount child', async () => {
    const state = reactive({ color: 'red' })
    const value = ref(false)
    const root = document.createElement('div')

    const Child = defineVaporComponent({
      setup() {
        onMounted(() => {
          const childEl = root.children[0]
          expect(getComputedStyle(childEl!).getPropertyValue(`--color`)).toBe(
            `red`,
          )
        })
        return template('<div id="childId"></div>')()
      },
    })

    define({
      setup() {
        useVaporCssVars(() => state)
        return createIf(
          () => value.value,
          () => createComponent(Child),
          () => template('<div></div>')(),
        )
      },
    }).render({}, root)

    await nextTick()
    // css vars use with fallback tree
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }

    // mount child
    value.value = true
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }
  })

  test('with custom element', async () => {
    const state = reactive({ color: 'red' })
    const CE = defineVaporCustomElement({
      setup() {
        useVaporCssVars(() => state)
        return template('<div>hello</div>', 1)()
      },
    })

    customElements.define('css-vars-ce', CE)

    const { html } = define({
      setup() {
        return createPlainElement('css-vars-ce', null, null, true)
      },
    }).render()

    expect(html()).toBe('<css-vars-ce style="--color: red;"></css-vars-ce>')

    state.color = 'green'
    await nextTick()
    expect(html()).toBe('<css-vars-ce style="--color: green;"></css-vars-ce>')
  })

  test('should set vars before child component onMounted hook', () => {
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    let colorInOnMount

    define({
      setup() {
        useVaporCssVars(() => state)
        onMounted(() => {
          colorInOnMount = (
            root.children[0] as HTMLElement
          ).style.getPropertyValue(`--color`)
        })
        return template('<div></div>')()
      },
    }).render({}, root)

    expect(colorInOnMount).toBe(`red`)
  })

  test('work with v-if false', () => {
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')

    define({
      setup() {
        useVaporCssVars(() => state)
        return createIf(
          () => false,
          () => {
            const n2 = template('<div class="red">Hi</div>')()
            return n2
          },
          null as any,
          ifFlags(VaporBlockShape.SINGLE_ROOT, true),
        )
      },
    }).render({}, root)

    expect(root.innerHTML).toBe(`<!--if-->`)
  })

  test('work with empty v-for', () => {
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')

    define({
      setup() {
        useVaporCssVars(() => state)
        return createFor(
          // empty source
          () => [],
          item => {
            return template('<div class="red">Hi</div>')()
          },
          undefined,
          4,
        )
      },
    }).render({}, root)

    expect(root.innerHTML).toBe(`<!--for-->`)
  })

  test('with v-if initial false then update css vars', async () => {
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    const toggle = ref(false)

    define({
      setup() {
        useVaporCssVars(() => state)
        return createIf(
          () => toggle.value,
          () => template('<div></div>')(),
        )
      },
    }).render({}, root)

    await nextTick()
    expect(root.children.length).toBe(0)

    // toggle v-if to true
    toggle.value = true
    await nextTick()
    expect(root.children.length).toBe(1)
    let el = root.children[0] as HTMLElement
    expect(el.style.getPropertyValue(`--color`)).toBe('red')

    // update css vars
    state.color = 'green'
    await nextTick()
    el = root.children[0] as HTMLElement
    expect(el.style.getPropertyValue(`--color`)).toBe('green')
  })
  // `v-bind('data.color')` compiled under compile()'s fixed sfc id
  const cssVar = (el: Element | null) =>
    el ? (el as HTMLElement).style.getPropertyValue('--v51566ce1') : null

  test('teleport: nested v-if created after an outer branch switch', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const data = ref({ color: 'red', a: true, b: false, target })
    const App = compile(
      `<template>
        <Teleport :to="data.target">
          <template v-if="data.a"><span v-if="data.b" /></template>
        </Teleport>
      </template>
      <style>span { color: v-bind('data.color') }</style>`,
      data,
    )
    define(App).render()
    await nextTick()

    data.value.a = false
    await nextTick()
    data.value.a = true
    await nextTick()
    data.value.b = true
    await nextTick()
    expect(cssVar(target.querySelector('span'))).toBe('red')

    data.value.color = 'green'
    await nextTick()
    expect(cssVar(target.querySelector('span'))).toBe('green')
  })

  test('teleport: v-if inside a v-for item added after mount', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const data = ref({
      color: 'red',
      list: [{ id: 1, on: false }],
      target,
    })
    const App = compile(
      `<template>
        <Teleport :to="data.target">
          <template v-for="item in data.list" :key="item.id">
            <i v-if="item.on" :id="'on' + item.id" />
            <u v-else :id="'off' + item.id" />
          </template>
        </Teleport>
      </template>
      <style>i { color: v-bind('data.color') }</style>`,
      data,
    )
    define(App).render()
    await nextTick()

    data.value.list.push({ id: 2, on: false })
    await nextTick()
    expect(cssVar(target.querySelector('#off2'))).toBe('red')

    data.value.list[1].on = true
    await nextTick()
    expect(cssVar(target.querySelector('#on2'))).toBe('red')
  })

  test('setup error after useVaporCssVars is reported once', async () => {
    const data = ref({ color: 'red' })
    const App = compile(
      `<script vapor setup>
      const data = _data
      throw new Error('boom')
      </script>
      <template><div /></template>
      <style>div { color: v-bind('data.color') }</style>`,
      data,
    )
    const errors: string[] = []
    const { app, mount } = define(App).create()
    app.config.errorHandler = err => errors.push(String(err))
    mount()
    await nextTick()
    expect(errors).toEqual(['Error: boom'])
    expect('setup() returned non-block value').toHaveBeenWarned()
  })

  test('HOC child switching its own root: new root carries vars before its mounted hooks', async () => {
    const data = ref({ color: 'red', show: false, seen: null })
    const Leaf = compile(
      `<script vapor setup>
      import { onMounted } from 'vue'
      const data = _data
      onMounted(() => {
        data.value.seen = document
          .getElementById('leaf')
          .style.getPropertyValue('--v51566ce1')
      })
      </script>
      <template><div id="leaf" /></template>`,
      data,
    )
    const Child = compile(
      `<template><components.Leaf v-if="data.show" /><span v-else /></template>`,
      data,
      { Leaf },
    )
    const App = compile(
      `<template><components.Child /></template>
      <style>div { color: v-bind('data.color') }</style>`,
      data,
      { Child },
    )
    define(App).render()

    data.value.show = true
    await nextTick()
    expect(data.value.seen).toBe('red')
  })

  // coverage guard: the host is the only css-var target; shadow content only
  // receives it through the custom element's attribute fallthrough (VDOM same)
  test('custom element: root switch keeps vars on the host', async () => {
    const data = ref({ color: 'red', show: true })
    const CE = defineVaporCustomElement(
      compile(
        `<template><div v-if="data.show">a</div><span v-else>b</span></template>
        <style>div { color: v-bind('data.color') }</style>`,
        data,
      ),
    )
    customElements.define('css-vars-ce-root', CE)

    const { host, html } = define({
      setup() {
        return createPlainElement('css-vars-ce-root', null, null, true)
      },
    }).render()
    expect(html()).toBe(
      '<css-vars-ce-root style="--v51566ce1: red;"></css-vars-ce-root>',
    )

    data.value.show = false
    await nextTick()
    expect(host.firstElementChild!.shadowRoot!.innerHTML).toBe(
      '<span style="--v51566ce1: red;">b</span><!--if-->',
    )
    expect(html()).toBe(
      '<css-vars-ce-root style="--v51566ce1: red;"></css-vars-ce-root>',
    )
  })
  test('slot outlet root: exposed fallback and re-exposed content receive vars', async () => {
    const data = ref({ color: 'red', show: false })
    const Child = compile(
      `<template><slot><span /></slot></template>
      <style>span { color: v-bind('data.color') }</style>`,
      data,
    )
    const App = compile(
      `<template><components.Child><i v-if="data.show" /></components.Child></template>`,
      data,
      { Child },
    )
    const { host } = define(App).render()
    expect(cssVar(host.querySelector('span'))).toBe('red')

    // content becomes valid after mount: exposed through the slot resolver,
    // not through a branch render of the outlet
    data.value.show = true
    await nextTick()
    expect(host.querySelector('span')).toBe(null)
    expect(cssVar(host.querySelector('i'))).toBe('red')

    // back to a freshly rendered fallback
    data.value.show = false
    await nextTick()
    expect(cssVar(host.querySelector('span'))).toBe('red')
  })

  test('teleport outlets unregister with the scope that created them', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const data = ref({ color: 'red', show: true, target })
    // inside an element the teleport is mounted via insertion state and never
    // goes through block removal
    const App = compile(
      `<template>
        <section v-if="data.show"><Teleport :to="data.target"><div /></Teleport></section>
        <Teleport v-if="data.show" :to="data.target"><p /></Teleport>
      </template>
      <style>div, p { color: v-bind('data.color') }</style>`,
      data,
    )
    const { instance } = define(App).render()
    await nextTick()
    expect(instance!.cssVarOutlets!.length).toBe(2)

    for (let i = 0; i < 3; i++) {
      data.value.show = false
      await nextTick()
      data.value.show = true
      await nextTick()
    }
    expect(instance!.cssVarOutlets!.length).toBe(2)
    expect(cssVar(target.querySelector('div'))).toBe('red')
    expect(cssVar(target.querySelector('p'))).toBe('red')
  })

  test('async setup root child receives vars when it mounts', async () => {
    let resolve!: () => void
    const pending = new Promise<void>(r => (resolve = r))
    const data = ref({ color: 'red', pending })
    const Leaf = compile(
      `<script vapor setup>const data = _data; await data.value.pending</script>
      <template><div id="leaf" /></template>`,
      data,
    )
    const Owner = compile(
      `<template><components.Leaf /></template>
      <style>div { color: v-bind('data.color') }</style>`,
      data,
      { Leaf },
    )
    const Root = defineComponent({
      setup: () => () =>
        h(Suspense, null, {
          default: () => h(Owner as any),
          fallback: () => h('span', 'loading'),
        }),
    })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(Root)
    app.use(vaporInteropPlugin)
    app.mount(host)
    await nextTick()
    expect(host.innerHTML).toBe('<span>loading</span>')

    resolve()
    await pending
    await Promise.resolve()
    await nextTick()
    await nextTick()
    expect(cssVar(host.querySelector('#leaf'))).toBe('red')
    app.unmount()
  })

  test('vdom child rooted at a slot outlet receives its own css vars', async () => {
    const data = ref({ color: 'red', ok: false })
    const components: Record<string, any> = {}
    // a vdom component whose root is <slot/> and which owns v-bind() css vars
    components.Child = compile(
      `<script setup>const data = _data</script>
      <template><slot/></template>
      <style>div { color: v-bind('data.color') }</style>`,
      data,
      components,
      { vapor: false },
    )
    // the slot content comes from a vapor parent, with several roots and one
    // of them behind a v-if: the write has to walk the whole block, including
    // its nested fragments, not just the first node
    const App = compile(
      `<template><components.Child><div id="a" /><div v-if="data.ok" id="b" /><div id="c" /></components.Child></template>`,
      data,
      components,
    )
    const root = document.createElement('div')
    document.body.appendChild(root)
    const app = createVaporApp(App)
    app.use(vaporInteropPlugin).mount(root)
    await nextTick()
    expect(cssVar(root.querySelector('#a'))).toBe('red')
    expect(cssVar(root.querySelector('#c'))).toBe('red')

    // the toggle also creates a node that did not exist on mount
    data.value = { color: 'green', ok: true }
    await nextTick()
    for (const id of ['#a', '#b', '#c']) {
      expect(cssVar(root.querySelector(id))).toBe('green')
    }
    app.unmount()
    root.remove()
  })

  test('vdom child with a slot outlet among multiple roots', async () => {
    const data = ref({ color: 'red' })
    const components: Record<string, any> = {}
    components.Child = compile(
      `<script setup>const data = _data</script>
      <template><slot/><p id="sibling" /></template>
      <style>div { color: v-bind('data.color') }</style>`,
      data,
      components,
      { vapor: false },
    )
    const App = compile(
      `<template><components.Child><div id="content" /></components.Child></template>`,
      data,
      components,
    )
    const root = document.createElement('div')
    document.body.appendChild(root)
    const app = createVaporApp(App)
    app.use(vaporInteropPlugin).mount(root)
    await nextTick()
    expect(cssVar(root.querySelector('#sibling'))).toBe('red')
    expect(cssVar(root.querySelector('#content'))).toBe('red')

    data.value = { color: 'green' }
    await nextTick()
    expect(cssVar(root.querySelector('#content'))).toBe('green')
    app.unmount()
    root.remove()
  })
})
