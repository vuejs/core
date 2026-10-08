import {
  applyVShow,
  createComponent,
  createIf,
  defineVaporAsyncComponent,
  defineVaporComponent,
  on,
  template,
  vaporInteropPlugin,
} from '../../src'
import { type VShowElement, createApp, nextTick, ref } from 'vue'
import { describe, expect, test, vi } from 'vite-plus/test'
import { compile, makeRender, renderParity } from '../_utils'

const define = makeRender()

const createDemo = (defaultValue: boolean) =>
  define(() => {
    const visible = ref(defaultValue)
    function handleClick() {
      visible.value = !visible.value
    }
    const t0 = template(
      '<div><button>toggle</button><h1>hello world</h1></div>',
    )
    const n0 = t0()
    const n1 = n0.firstChild!
    const n2 = n1.nextSibling
    applyVShow(n2 as VShowElement, () => visible.value)
    on(n1 as HTMLElement, 'click', handleClick)
    return n0
  })

describe('directive: v-show', () => {
  test('basic', async () => {
    const { host } = createDemo(true).render()
    const btn = host.querySelector('button')
    expect(host.innerHTML).toBe(
      '<div><button>toggle</button><h1>hello world</h1></div>',
    )
    btn?.click()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div><button>toggle</button><h1 style="display: none;">hello world</h1></div>',
    )
  })
  test('should hide content when default value is false', async () => {
    const { host } = createDemo(false).render()
    const btn = host.querySelector('button')
    const h1 = host.querySelector('h1')
    expect(h1?.style.display).toBe('none')
    btn?.click()
    await nextTick()
    expect(h1?.style.display).toBe('')
  })

  test('should work on component', async () => {
    const t0 = template('<div>child</div>')
    const visible = ref(true)

    const { component: Child } = define({
      setup() {
        return t0()
      },
    })

    const { host } = define({
      setup() {
        const n1 = createComponent(Child, null, null, true)
        applyVShow(n1, () => visible.value)
        return n1
      },
    }).render()

    expect(host.innerHTML).toBe('<div>child</div>')

    visible.value = !visible.value
    await nextTick()
    expect(host.innerHTML).toBe('<div style="display: none;">child</div>')
  })

  test('warn on non-single-element-root component', () => {
    const Child = defineVaporComponent({
      setup() {
        return document.createTextNode('b')
      },
    })
    define({
      setup() {
        const n1 = createComponent(Child)
        applyVShow(n1, () => true)
        return n1
      },
    }).render()
    expect(
      'v-show used on component with non-single-element root node',
    ).toHaveBeenWarned()
  })

  test('should work on component with dynamic fragment root', async () => {
    const t0 = template('<div>child</div>')
    const t1 = template('<span>child</span>')
    const childIf = ref(true)
    const visible = ref(true)

    const { component: Child } = define({
      setup() {
        return createIf(
          () => childIf.value,
          () => t0(),
          () => t1(),
        )
      },
    })

    const { host } = define({
      setup() {
        const n1 = createComponent(Child, null, null, true)
        applyVShow(n1, () => visible.value)
        return n1
      },
    }).render()

    expect(host.innerHTML).toBe('<div>child</div><!--if-->')

    visible.value = !visible.value
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div style="display: none;">child</div><!--if-->',
    )

    childIf.value = !childIf.value
    await nextTick()
    expect(host.innerHTML).toBe(
      '<span style="display: none;">child</span><!--if-->',
    )

    visible.value = !visible.value
    await nextTick()
    expect(host.innerHTML).toBe('<span style="">child</span><!--if-->')
  })

  test('should not track v-show source in dynamic fragment effect', async () => {
    const t0 = template('<div>child</div>')
    const t1 = template('<span>child</span>')
    const childIf = ref(true)
    const visible = ref(true)
    const condition = vi.fn(() => childIf.value)

    const { component: Child } = define({
      setup() {
        return createIf(
          condition,
          () => t0(),
          () => t1(),
        )
      },
    })

    define({
      setup() {
        const child = createComponent(Child, null, null, true)
        applyVShow(child, () => visible.value)
        return child
      },
    }).render()

    childIf.value = false
    await nextTick()
    expect(condition).toHaveBeenCalledTimes(2)

    visible.value = false
    await nextTick()
    expect(condition).toHaveBeenCalledTimes(2)
  })

  test('keeps a nested dynamic root hidden when the inner branch swaps', async () => {
    const { vdom, vapor } = await renderParity(
      {
        Mid: `<template><div v-if="data.b">m</div><p v-else>p</p></template>`,
        Inner: `<template><components.Mid v-if="data.a"/><span v-else>s</span></template>`,
        App: `<template><components.Inner v-show="false"/></template>`,
      },
      () => ref({ a: true, b: true }),
      async data => {
        data.value.b = false
        await nextTick()
      },
    )
    expect(vdom.after).toBe('<p style="display: none;">p</p>')
    expect(vapor.after).toBe(
      '<p style="display: none;">p</p><!--if--><!--if-->',
    )
  })

  test('keeps a nested dynamic root hidden after outer and inner branch swaps', async () => {
    const { vdom, vapor } = await renderParity(
      {
        Mid: `<template><div v-if="data.b">m</div><p v-else>p</p></template>`,
        Inner: `<template><span v-if="data.a">s</span><components.Mid v-else/></template>`,
        App: `<template><components.Inner v-show="false"/></template>`,
      },
      () => ref({ a: true, b: true }),
      async data => {
        data.value.a = false
        await nextTick()
        data.value.b = false
        await nextTick()
      },
    )
    expect(vdom.after).toBe('<p style="display: none;">p</p>')
    expect(vapor.after).toBe(
      '<p style="display: none;">p</p><!--if--><!--if-->',
    )
  })

  test('follows the root of a resolved async component across branch swaps', async () => {
    const data = ref({ b: true, show: false })
    const Inner = compile(
      `<template><div v-if="data.b">m</div><p v-else>p</p></template>`,
      data,
    )
    let resolve!: (comp: any) => void
    const AsyncInner = defineVaporAsyncComponent(
      () => new Promise<any>(r => (resolve = r)),
    )
    const App = compile(
      `<template><components.AsyncInner v-show="data.show"/></template>`,
      data,
      { AsyncInner },
    )
    const { host } = define(App).render()

    resolve(Inner)
    await new Promise(r => setTimeout(r))
    await nextTick()
    expect(host.querySelector('div')!.style.display).toBe('none')

    data.value.b = false
    await nextTick()
    expect(host.querySelector('p')!.style.display).toBe('none')

    data.value.show = true
    await nextTick()
    expect(host.querySelector('p')!.style.display).toBe('')
  })

  test('v-once freezes the value used by later dynamic roots', async () => {
    const { vdom, vapor } = await renderParity(
      {
        Inner: `<template><div v-if="data.b">m</div><p v-else>p</p></template>`,
        App: `<template><components.Inner v-show="data.show" v-once/></template>`,
      },
      () => ref({ b: true, show: true }),
      async data => {
        data.value.show = false
        await nextTick()
        data.value.b = false
        await nextTick()
      },
    )
    expect(vdom.after).toBe('<p>p</p>')
    expect(vapor.after).toBe('<p>p</p><!--if-->')
  })

  test('ignores a slot outlet root like vdom', async () => {
    const { vdom, vapor } = await renderParity(
      {
        Child: `<template><slot/></template>`,
        App: `<template><components.Child v-show="false"><div>x</div></components.Child></template>`,
      },
      () => ref({}),
      async () => {},
    )
    expect(vdom.after).toBe('<div>x</div>')
    expect(vapor.after).toBe('<div>x</div><!--slot-->')
    expect(
      'Runtime directive used on component with non-element root node',
    ).toHaveBeenWarned()
    expect(
      'v-show used on component with non-single-element root node',
    ).toHaveBeenWarned()
  })

  test('ignores a slot outlet reached through the root chain like vdom', async () => {
    const { vdom, vapor } = await renderParity(
      {
        Child: `<template><slot/></template>`,
        Outer: `<template><components.Child v-if="data.ok"><slot/></components.Child></template>`,
        App: `<template><components.Outer v-show="false"><div>x</div></components.Outer></template>`,
      },
      () => ref({ ok: true }),
      async () => {},
    )
    expect(vdom.after).toBe('<div>x</div>')
    expect(vapor.after).toBe('<div>x</div><!--slot--><!--slot--><!--if-->')
    expect(
      'Runtime directive used on component with non-element root node',
    ).toHaveBeenWarned()
    expect(
      'v-show used on component with non-single-element root node',
    ).toHaveBeenWarned()
  })

  // #15625: v-show restores the display of the merged root style layers
  test('restores display from either root style layer', async () => {
    const shown: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Child: `<template><div :style="data.own" v-show="data.show">c</div></template>`,
        App: `<template><components.Child :style="data.par" /></template>`,
      },
      () =>
        ref({ own: { width: '1px' }, par: { display: 'flex' }, show: false }),
      async (data, root, mode) => {
        const el = root.firstElementChild as HTMLElement
        // patch the own layer while fallthrough holds display
        data.value.own = { width: '2px' }
        await nextTick()
        data.value.show = true
        await nextTick()
        shown[mode].push(el.style.display)
        // patch the fallthrough layer while own holds display
        data.value.show = false
        data.value.own = { display: 'grid' }
        data.value.par = { color: 'blue' }
        await nextTick()
        data.value.par = { color: 'red' }
        await nextTick()
        data.value.show = true
        await nextTick()
        shown[mode].push(el.style.display)
      },
    )
    expect(shown.vdom).toEqual(['flex', 'grid'])
    expect(shown.vapor).toEqual(shown.vdom)
  })

  test('restores an important display from the fallthrough style layer', async () => {
    const shown: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Child: `<template><div :style="data.own" v-show="data.show">c</div></template>`,
        App: `<template><components.Child :style="data.par" /></template>`,
      },
      () =>
        ref({
          own: { width: '1px' },
          par: { display: 'flex !important' },
          show: true,
        }),
      async (data, root, mode) => {
        const el = root.firstElementChild as HTMLElement
        data.value.own = { width: '2px' }
        await nextTick()
        data.value.show = false
        await nextTick()
        data.value.show = true
        await nextTick()
        shown[mode].push(el.getAttribute('style')!)
      },
    )
    expect(shown.vdom).toEqual(['width: 2px; display: flex !important;'])
    expect(shown.vapor).toEqual(shown.vdom)
  })

  test('applies through a Transition wrapping a slot like vdom', async () => {
    const shown: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Fade: `<template><Transition name="fade"><slot /></Transition></template>`,
        App: `<template><components.Fade v-show="data.show"><p>x</p></components.Fade></template>`,
      },
      () => ref({ show: false }),
      async (data, root, mode) => {
        const p = root.querySelector('p')!
        shown[mode].push(p.style.display)
        data.value.show = true
        await nextTick()
        shown[mode].push(p.style.display)
      },
    )
    expect(shown.vdom).toEqual(['none', ''])
    expect(shown.vapor).toEqual(shown.vdom)
  })

  test('applies through forwarding wrappers around a Transition like vdom', async () => {
    const shown: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Fade: `<template><Transition name="fade"><slot /></Transition></template>`,
        Wrap: `<template><components.Fade><slot /></components.Fade></template>`,
        App: `<template><components.Wrap v-show="data.show"><p>x</p></components.Wrap></template>`,
      },
      () => ref({ show: false }),
      async (data, root, mode) => {
        const p = root.querySelector('p')!
        shown[mode].push(p.style.display)
        data.value.show = true
        await nextTick()
        shown[mode].push(p.style.display)
      },
    )
    expect(shown.vdom).toEqual(['none', ''])
    expect(shown.vapor).toEqual(shown.vdom)
  })

  test('applies to v-show written on a Transition wrapping a slot like vdom', async () => {
    const shown: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Fade: `<template><Transition name="fade" v-show="data.show"><slot /></Transition></template>`,
        App: `<template><components.Fade><p>x</p></components.Fade></template>`,
      },
      () => ref({ show: false }),
      async (data, root, mode) => {
        const p = root.querySelector('p')!
        shown[mode].push(p.style.display)
        data.value.show = true
        await nextTick()
        shown[mode].push(p.style.display)
      },
    )
    expect(shown.vdom).toEqual(['none', ''])
    expect(shown.vapor).toEqual(shown.vdom)
  })

  test('applies through a dynamic Transition slot like vdom', async () => {
    const shown: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Fade: `<template><Transition name="fade"><template v-if="data.on" #default><slot /></template></Transition></template>`,
        App: `<template><components.Fade v-show="data.show"><p>x</p></components.Fade></template>`,
      },
      () => ref({ on: false, show: false }),
      async (data, root, mode) => {
        data.value.on = true
        await nextTick()
        shown[mode].push(root.querySelector('p')!.style.display)
        data.value.show = true
        await nextTick()
        shown[mode].push(root.querySelector('p')!.style.display)
      },
    )
    expect(shown.vdom).toEqual(['none', ''])
    expect(shown.vapor).toEqual(shown.vdom)
  })

  test('follows the fallback of a Transition slot like vdom', async () => {
    const shown: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Fade: `<template><Transition name="fade"><slot><span>fallback</span></slot></Transition></template>`,
        App: `<template><components.Fade v-show="false"><p v-if="data.has">x</p></components.Fade></template>`,
      },
      () => ref({ has: true }),
      async (data, root, mode) => {
        shown[mode].push(root.querySelector('p')!.style.display)
        data.value.has = false
        await nextTick()
        shown[mode].push(root.querySelector('span')!.style.display)
        data.value.has = true
        await nextTick()
        shown[mode].push(root.querySelector('p')!.style.display)
      },
    )
    expect(shown.vdom).toEqual(['none', 'none', 'none'])
    expect(shown.vapor).toEqual(shown.vdom)
  })

  test('still ignores the slot outlet root of a component inside a Transition like vdom', async () => {
    const { vdom, vapor } = await renderParity(
      {
        Fade: `<template><Transition name="fade"><slot /></Transition></template>`,
        Inner: `<template><slot /></template>`,
        App: `<template><components.Fade v-show="false"><components.Inner><p>x</p></components.Inner></components.Fade></template>`,
      },
      () => ref({}),
      async () => {},
    )
    expect(vdom.after).toBe('<p>x</p>')
    expect(vapor.after).toBe('<p>x</p><!--slot--><!--slot-->')
    expect(
      'Runtime directive used on component with non-element root node',
    ).toHaveBeenWarned()
    expect(
      'Component inside <Transition> renders non-element root node',
    ).toHaveBeenWarned()
    expect(
      'v-show used on component with non-single-element root node',
    ).toHaveBeenWarned()
  })

  test('keeps a slot root hidden by its own v-show under a Transition wrapper like vdom', async () => {
    const shown: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Collapse: `<template><Transition name="collapse"><slot /></Transition></template>`,
        App: `<template><components.Collapse v-show="data.enabled"><section v-show="data.open">x</section></components.Collapse></template>`,
      },
      () => ref({ enabled: true, open: false }),
      async (data, root, mode) => {
        const el = root.querySelector('section')!
        shown[mode].push(el.style.display)
        data.value.open = true
        await nextTick()
        shown[mode].push(el.style.display)
      },
    )
    expect(shown.vdom).toEqual(['none', ''])
    expect(shown.vapor).toEqual(shown.vdom)
  })

  test('keeps a swapped-in slot root hidden by its own v-show under a mounted Transition like vdom', async () => {
    const shown: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Collapse: `<template><Transition :css="false"><slot /></Transition></template>`,
        App: `<template><components.Collapse v-show="data.enabled"><section v-if="data.a" v-show="data.open">a</section><article v-else v-show="data.open">b</article></components.Collapse></template>`,
      },
      () => ref({ enabled: true, open: false, a: true }),
      async (data, root, mode) => {
        shown[mode].push(root.querySelector('section')!.style.display)
        data.value.a = false
        await nextTick()
        shown[mode].push(root.querySelector('article')!.style.display)
      },
    )
    expect(shown.vdom).toEqual(['none', 'none'])
    expect(shown.vapor).toEqual(shown.vdom)
  })

  test('applies a value flipped before the Transition mounted like vdom', async () => {
    const shown: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Child: `<script setup>
import { ref, onBeforeMount } from 'vue'
const visible = ref(false)
onBeforeMount(() => { visible.value = true })
</script>
<template><Transition :css="false"><section v-show="visible">x</section></Transition></template>`,
        App: `<template><components.Child v-if="data.mount" /></template>`,
      },
      () => ref({ mount: false }),
      async (data, root, mode) => {
        data.value.mount = true
        await nextTick()
        shown[mode].push(root.querySelector('section')!.style.display)
      },
    )
    expect(shown.vdom).toEqual([''])
    expect(shown.vapor).toEqual(shown.vdom)
  })

  test('leaves a Transition root structural under an inherited v-show like vdom', async () => {
    const counts: Record<string, number[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Fade: `<template><Transition :css="false" @leave="data.onLeave"><slot /></Transition></template>`,
        Inner: `<template><p v-if="data.a">a</p><span v-else>b</span></template>`,
        App: `<template><components.Fade v-show="true"><components.Inner /></components.Fade></template>`,
      },
      () =>
        ref({
          a: true,
          onLeave: vi.fn((_el: Element, done: () => void) => done()),
        }),
      async (data, root, mode) => {
        for (const a of [false, true, false]) {
          data.value.a = a
          await nextTick()
          counts[mode].push(data.value.onLeave.mock.calls.length)
        }
      },
    )
    expect(counts.vdom).toEqual([1, 2, 3])
    expect(counts.vapor).toEqual(counts.vdom)
  })

  test('appears a hidden Transition slot root under an inherited v-show like vdom', async () => {
    const seen: Record<string, unknown[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Fade: `<template><Transition :css="false" appear @appear="data.onAppear"><slot /></Transition></template>`,
        App: `<template><components.Fade v-show="false"><p>x</p></components.Fade></template>`,
      },
      () =>
        ref({ onAppear: vi.fn((_el: Element, done: () => void) => done()) }),
      async (data, root, mode) => {
        await nextTick()
        seen[mode].push(data.value.onAppear.mock.calls.length)
        seen[mode].push(root.querySelector('p')!.style.display)
      },
    )
    expect(seen.vdom).toEqual([1, 'none'])
    expect(seen.vapor).toEqual(seen.vdom)
  })

  test('toggles a root carrying hooks relayed from a vdom Transition', async () => {
    const data = ref({ visible: false })
    const VaporChild = compile(
      `<template><section v-show="data.visible">x</section></template>`,
      data,
    )
    const App = compile(
      `<script setup>const data = _data; const components = _components;</script>
      <template><Transition :css="false"><components.VaporChild /></Transition></template>`,
      data,
      { VaporChild },
      { vapor: false },
    )
    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)
    const el = root.querySelector('section')!
    expect(el.style.display).toBe('none')
    data.value.visible = true
    await nextTick()
    expect(el.style.display).toBe('')
  })
})
