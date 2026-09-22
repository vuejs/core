import { createVaporSSRApp } from '../../src'
import { nextTick, ref } from '@vue/runtime-dom'
import {
  compileVaporComponent,
  setupHydrationTest,
  testHydration,
} from './_helpers'
import { VueServerRenderer, runtimeDom } from '../_utils'

setupHydrationTest()

const collectCached = (root: Node) => {
  const out: Node[] = []
  const walk = (n: Node) => {
    if ((n as any).$llc) out.push(n)
    n.childNodes.forEach(walk)
  }
  walk(root)
  return out
}

describe('hydration locator cache lifecycle', () => {
  test('no $llc survives the hydration pass', async () => {
    const { container } = await testHydration(
      `<template>
        <div><span/><section v-if="data.show">{{ data.text }}</section><p/></div>
      </template>`,
      {},
      ref({ show: true, text: 'a' }),
    )
    expect(collectCached(container)).toEqual([])
  })

  test('unmounted subtree is not retained through $llc', async () => {
    const data = ref({ show: true, text: 'a' })
    const { container } = await testHydration(
      `<template>
        <div><section v-if="data.show">{{ data.text }}</section></div>
      </template>`,
      {},
      data,
    )
    const div = container.querySelector('div')!
    const section = container.querySelector('section')!
    data.value.show = false
    await nextTick()
    expect(section.isConnected).toBe(false)
    expect((div as any).$llc).not.toBe(section)
  })

  test('re-hydrating a container after unmount binds the new DOM', async () => {
    const data = ref('a')
    const code = `<div><span>{{ data }}</span></div>`
    const { container, html, app } = await testHydration(
      `<template>${code}</template>`,
      {},
      data,
    )
    app.unmount()
    expect(container.innerHTML).toBe('')

    container.innerHTML = html
    const app2 = createVaporSSRApp(compileVaporComponent(code, data))
    app2.mount(container)
    expect(`Hydration`).not.toHaveBeenWarned()

    data.value = 'b'
    await nextTick()
    expect(container.innerHTML).toBe('<div><span>b</span></div>')
    expect(() => app2.unmount()).not.toThrow()
    expect(container.innerHTML).toBe('')
  })

  test('re-hydrating a container with different markup', async () => {
    const data = ref('a')
    const code1 = `<template><div><span>{{ data }}</span></div></template>`
    const { container, app } = await testHydration(code1, {}, data)
    app.unmount()

    const code2 = `<p><i/><b>{{ data }}</b></p>`
    const html2 = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(compileVaporComponent(code2, data, {}, true)),
    )
    container.innerHTML = html2
    const app2 = createVaporSSRApp(compileVaporComponent(code2, data))
    app2.mount(container)
    expect(`Hydration`).not.toHaveBeenWarned()

    data.value = 'b'
    await nextTick()
    expect(container.innerHTML).toBe('<p><i></i><b>b</b></p>')
    app2.unmount()
  })
})
