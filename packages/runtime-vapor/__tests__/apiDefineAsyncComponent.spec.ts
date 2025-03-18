import { nextTick, ref } from '@vue/runtime-dom'
import { type VaporComponent, createComponent } from '../src/component'
import { defineVaporAsyncComponent } from '../src/apiDefineAsyncComponent'
import { makeRender } from './_utils'
import { createIf, template } from '@vue/runtime-vapor'

const timeout = (n: number = 0) => new Promise(r => setTimeout(r, n))

const define = makeRender()

describe('api: defineAsyncComponent', () => {
  test('simple usage', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const toggle = ref(true)
    const { html } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () => {
            return createComponent(Foo)
          },
        )
      },
    }).render()

    expect(html()).toBe('<!--async component--><!--if-->')
    resolve!(() => template('resolved')())

    await timeout()
    expect(html()).toBe('resolved<!--async component--><!--if-->')

    toggle.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')

    // already resolved component should update on nextTick
    toggle.value = true
    await nextTick()
    expect(html()).toBe('resolved<!--async component--><!--if-->')
  })
})
