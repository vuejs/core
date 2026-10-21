import {
  type EffectScope,
  createApp,
  defineComponent,
  getCurrentScope,
  h,
  nextTick,
  ref,
  watch,
} from '@vue/runtime-dom'
import { createVaporApp, vaporInteropPlugin } from '../src'
import { compile, makeRender } from './_utils'

const define = makeRender()

const script = (body: string) =>
  `<script setup vapor>\nimport { watch, getCurrentScope } from 'vue'\nconst data = _data; const components = _components\n${body}\n</script>`

// renders `data.src` and logs its sync watcher runs under `name` + prop `i`
const leaf = (name: string) =>
  script(`
    const props = defineProps(['i'])
    watch(() => data.value.src, () => components.log('${name}' + (props.i === undefined ? '' : props.i)), { flush: 'sync' })`) +
  `<template><i>${name}{{ data.src }}</i></template>`

describe('pausing a component scope pauses the components under it', () => {
  test('v-if branch, v-for rows, slot content and a static wrapper', async () => {
    const data = ref({ src: 0, show: true, items: [1, 2] })
    const log: string[] = []
    const components: any = { log: (s: string) => log.push(s) }
    components.Leaf = compile(leaf('L'), data, components)
    // no reactive bindings of its own, so it has no render effect
    components.Static = compile(
      `<template><div><components.Leaf i="static"/></div></template>`,
      data,
      components,
    )
    components.Slotted = compile(
      `<template><section><slot/></section></template>`,
      data,
      components,
    )
    const Parent = compile(
      script(`components.scope = getCurrentScope()`) +
        `<template><div>
          <components.Leaf v-if="data.show" i="if"/>
          <components.Leaf v-for="i in data.items" :key="i" :i="i"/>
          <components.Static/>
          <components.Slotted><components.Leaf i="slot"/></components.Slotted>
        </div></template>`,
      data,
      components,
    )
    const { host } = define(Parent).render()
    expect(host.innerHTML.match(/<i>L0<\/i>/g)!.length).toBe(5)
    const scope: EffectScope = components.scope

    scope.pause()
    data.value.src++
    expect(log).toEqual([])
    await nextTick()
    expect(host.innerHTML).not.toContain('L1')

    scope.resume()
    expect(log.sort()).toEqual(['L1', 'L2', 'Lif', 'Lslot', 'Lstatic'])
    await nextTick()
    expect(host.innerHTML.match(/<i>L1<\/i>/g)!.length).toBe(5)
  })

  test('a component without reactive bindings of its own still reaches them', async () => {
    const data = ref({ src: 0 })
    const log: string[] = []
    const components: any = { log: (s: string) => log.push(s) }
    components.Leaf = compile(leaf('L'), data, components)
    // no render effect to find the instance by
    const Parent = compile(
      script(`components.scope = getCurrentScope()`) +
        `<template><div><components.Leaf/></div></template>`,
      data,
      components,
    )
    const { host } = define(Parent).render()
    const scope: EffectScope = components.scope

    scope.pause()
    data.value.src++
    expect(log).toEqual([])
    await nextTick()
    expect(host.innerHTML).toBe('<div><i>L0</i></div>')

    scope.resume()
    expect(log).toEqual(['L'])
    await nextTick()
    expect(host.innerHTML).toBe('<div><i>L1</i></div>')
  })

  test('a vdom ancestor reaches vapor components and their children', async () => {
    const data = ref({ src: 0 })
    const log: string[] = []
    const components: any = { log: (s: string) => log.push(s) }
    components.Leaf = compile(leaf('L'), data, components)
    const VaporMid = compile(
      script(
        `watch(() => data.value.src, () => components.log('M'), { flush: 'sync' })`,
      ) + `<template><components.Leaf/></template>`,
      data,
      components,
    )
    let scope!: EffectScope
    const Root = defineComponent({
      setup() {
        scope = getCurrentScope()!
        return () => h('div', [h(VaporMid)])
      },
    })
    const host = document.createElement('div')
    const app = createApp(Root).use(vaporInteropPlugin)
    app.mount(host)
    expect(host.innerHTML).toBe('<div><i>L0</i></div>')

    scope.pause()
    data.value.src++
    expect(log).toEqual([])
    await nextTick()
    expect(host.innerHTML).toBe('<div><i>L0</i></div>')

    scope.resume()
    expect(log.sort()).toEqual(['L', 'M'])
    await nextTick()
    expect(host.innerHTML).toBe('<div><i>L1</i></div>')
    app.unmount()
  })

  test('a vapor ancestor reaches a vdom component and its vapor children', async () => {
    const data = ref({ src: 0 })
    const log: string[] = []
    const components: any = { log: (s: string) => log.push(s) }
    components.Leaf = compile(leaf('L'), data, components)
    components.VdomMid = defineComponent({
      setup() {
        watch(
          () => data.value.src,
          () => log.push('M'),
          { flush: 'sync' },
        )
        return () => h('div', [data.value.src, h(components.Leaf)])
      },
    })
    const App = compile(
      script(`components.scope = getCurrentScope()`) +
        `<template><components.VdomMid/></template>`,
      data,
      components,
    )
    const host = document.createElement('div')
    const app = createVaporApp(App).use(vaporInteropPlugin)
    app.mount(host)
    expect(host.innerHTML).toContain('<div>0<i>L0</i></div>')
    const scope: EffectScope = components.scope

    scope.pause()
    data.value.src++
    expect(log).toEqual([])
    await nextTick()
    expect(host.innerHTML).toContain('<div>0<i>L0</i></div>')

    scope.resume()
    expect(log.sort()).toEqual(['L', 'M'])
    await nextTick()
    expect(host.innerHTML).toContain('<div>1<i>L1</i></div>')
    app.unmount()
  })
})
