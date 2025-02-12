import { shallowRef } from '@vue/reactivity'
import { nextTick } from '@vue/runtime-dom'
import { createDynamicComponent } from '../src'
import { makeRender } from './_utils'

const define = makeRender()

describe('api: createDynamicComponent', () => {
  const A = () => document.createTextNode('AAA')
  const B = () => document.createTextNode('BBB')

  test('direct value', async () => {
    const val = shallowRef<any>(A)

    const { html } = define({
      setup() {
        return createDynamicComponent(() => val.value)
      },
    }).render()

    expect(html()).toBe('AAA<!--dynamic-component-->')

    val.value = B
    await nextTick()
    expect(html()).toBe('BBB<!--dynamic-component-->')

    // fallback
    val.value = 'foo'
    await nextTick()
    expect(html()).toBe('<foo></foo><!--dynamic-component-->')
  })

  test('global registration', async () => {
    const val = shallowRef('foo')

    const { app, html, mount } = define({
      setup() {
        return createDynamicComponent(() => val.value)
      },
    }).create()

    app.component('foo', A)
    app.component('bar', B)

    mount()
    expect(html()).toBe('AAA<!--dynamic-component-->')

    val.value = 'bar'
    await nextTick()
    expect(html()).toBe('BBB<!--dynamic-component-->')

    // fallback
    val.value = 'baz'
    await nextTick()
    expect(html()).toBe('<baz></baz><!--dynamic-component-->')
  })
})
