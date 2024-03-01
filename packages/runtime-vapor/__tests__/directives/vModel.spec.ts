import { ref } from '@vue/reactivity'
import {
  on,
  setDOMProp,
  template,
  vModelDynamic,
  vModelSelect,
  withDirectives,
} from '../../src'
import { makeRender } from '../_utils'
import { nextTick } from '@vue/runtime-dom'

const define = makeRender()

const triggerEvent = (type: string, el: Element) => {
  const event = new Event(type)
  el.dispatchEvent(event)
}

describe('directive: v-model', () => {
  test('should work with text input', async () => {
    const spy = vi.fn()

    const data = ref<string | null | undefined>('')
    const { host } = define(() => {
      const t0 = template('<input />')
      const n0 = t0() as HTMLInputElement
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      on(n0, 'update:modelValue', () => val => (data.value = val))
      on(n0, 'input', () => () => spy(data.value))
      return n0
    }).render()

    const input = host.querySelector('input')!
    expect(input.value).toEqual('')

    input.value = 'foo'
    triggerEvent('input', input)
    await nextTick()
    expect(data.value).toEqual('foo')
    expect(spy).toHaveBeenCalledWith('foo')

    data.value = 'bar'
    await nextTick()
    expect(input.value).toEqual('bar')

    data.value = undefined
    await nextTick()
    expect(input.value).toEqual('')
  })

  test('should work with select', async () => {
    const spy = vi.fn()
    const data = ref<string | null | undefined>('')
    const { host } = define(() => {
      const t0 = template(
        '<select><option>red</option><option>green</option><option>blue</option></select>',
      )
      const n0 = t0() as HTMLInputElement
      withDirectives(n0, [[vModelSelect, () => data.value]])
      on(n0, 'update:modelValue', () => val => (data.value = val))
      on(n0, 'change', () => () => spy(data.value))
      return n0
    }).render()

    const select = host.querySelector('select')!
    expect(select.value).toEqual('')

    select.value = 'red'
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toEqual('red')
    expect(spy).toHaveBeenCalledWith('red')

    data.value = 'blue'
    await nextTick()
    expect(select.value).toEqual('blue')
  })

  test('should work with number input', async () => {
    const data = ref<number | null | undefined>(null)
    const { host } = define(() => {
      const t0 = template('<input />')
      const n0 = t0() as HTMLInputElement

      setDOMProp(n0, 'type', 'number')
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      on(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const input = host.querySelector('input')!
    expect(input.value).toEqual('')
    expect(input.type).toEqual('number')

    // @ts-expect-error
    input.value = 1
    triggerEvent('input', input)
    await nextTick()
    expect(typeof data.value).toEqual('number')
    expect(data.value).toEqual(1)
  })

  test('should work with multiple listeners', async () => {
    const spy = vi.fn()

    const data = ref<string | null | undefined>('')
    const { host } = define(() => {
      const t0 = template('<input />')
      const n0 = t0() as HTMLInputElement
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      on(n0, 'update:modelValue', () => val => (data.value = val))
      on(n0, 'update:modelValue', () => spy)
      return n0
    }).render()

    const input = host.querySelector('input')!

    input.value = 'foo'
    triggerEvent('input', input)
    await nextTick()
    expect(data.value).toEqual('foo')
    expect(spy).toHaveBeenCalledWith('foo')
  })
})
