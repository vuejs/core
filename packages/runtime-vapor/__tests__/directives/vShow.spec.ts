import {
  applyVShow,
  createComponent,
  createIf,
  defineVaporAsyncComponent,
  defineVaporComponent,
  on,
  template,
} from '../../src'
import { type VShowElement, nextTick, ref } from 'vue'
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
})
