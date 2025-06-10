import { ref, shallowRef } from '@vue/reactivity'
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

  test('with v-once', async () => {
    const val = shallowRef<any>(A)

    const { html } = define({
      setup() {
        return createDynamicComponent(() => val.value, null, null, true, true)
      },
    }).render()

    expect(html()).toBe('AAA<!--dynamic-component-->')

    val.value = B
    await nextTick()
    expect(html()).toBe('AAA<!--dynamic-component-->') // still AAA
  })

  test('fallback with v-once', async () => {
    const val = shallowRef<any>('button')
    const id = ref(0)
    const { html } = define({
      setup() {
        return createDynamicComponent(
          () => val.value,
          { id: () => id.value },
          null,
          true,
          true,
        )
      },
    }).render()

    expect(html()).toBe('<button id="0"></button><!--dynamic-component-->')

    id.value++
    await nextTick()
    expect(html()).toBe('<button id="0"></button><!--dynamic-component-->')
  })
})
