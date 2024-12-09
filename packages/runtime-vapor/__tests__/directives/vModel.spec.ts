import { reactive, ref } from '@vue/reactivity'
import {
  delegate,
  delegateEvents,
  on,
  setClass,
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
  const event = new Event(type, { bubbles: true })
  el.dispatchEvent(event)
}

const setDOMProps = (el: any, props: Array<[key: string, value: any]>) => {
  props.forEach(prop => {
    const [key, value] = prop
    key === 'class' ? setClass(el, value) : setDOMProp(el, key, value)
  })
}

describe.todo('directive: v-model', () => {
  test('should work with text input', async () => {
    const spy = vi.fn()

    const data = ref<string | null | undefined>('')
    const { host } = define(() => {
      const t0 = template('<input />')
      delegateEvents('input')
      const n0 = t0() as HTMLInputElement
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      delegate(n0, 'input', () => () => spy(data.value))
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
    const data = ref<string | null>('')
    const { host } = define(() => {
      const t0 = template(
        '<select><option>red</option><option>green</option><option>blue</option></select>',
      )
      const n0 = t0() as HTMLInputElement
      withDirectives(n0, [[vModelSelect, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
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
    const data = ref<number | null>(null)
    const { host } = define(() => {
      const t0 = template('<input />')
      const n0 = t0() as HTMLInputElement

      setDOMProp(n0, 'type', 'number')
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
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

    const data = ref<string>('')
    const { host } = define(() => {
      const t0 = template('<input />')
      const n0 = t0() as HTMLInputElement
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      delegate(n0, 'update:modelValue', () => spy)
      return n0
    }).render()

    const input = host.querySelector('input')!

    input.value = 'foo'
    triggerEvent('input', input)
    await nextTick()
    expect(data.value).toEqual('foo')
    expect(spy).toHaveBeenCalledWith('foo')
  })

  test('should work with updated listeners', async () => {
    const spy1 = vi.fn()
    const spy2 = vi.fn()
    const toggle = ref(true)

    const data = ref<string>('')
    const { host } = define(() => {
      const t0 = template('<input />')
      const n0 = t0() as HTMLInputElement
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => (toggle.value ? spy1 : spy2))
      return n0
    }).render()

    const input = host.querySelector('input')!
    input.value = 'foo'
    triggerEvent('input', input)
    await nextTick()
    expect(spy1).toHaveBeenCalledWith('foo')

    // update listener
    toggle.value = false
    await nextTick()

    input.value = 'bar'
    triggerEvent('input', input)
    await nextTick()
    expect(spy1).not.toHaveBeenCalledWith('bar')
    expect(spy2).toHaveBeenCalledWith('bar')
  })

  test('should work with textarea', async () => {
    const data = ref<string>('')
    const { host } = define(() => {
      const t0 = template('<textarea />')
      const n0 = t0() as HTMLInputElement
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const input = host.querySelector('textarea')!

    input.value = 'foo'
    triggerEvent('input', input)
    await nextTick()
    expect(data.value).toEqual('foo')

    data.value = 'bar'
    await nextTick()
    expect(input.value).toEqual('bar')
  })

  test('should support modifiers', async () => {
    const data = reactive<{
      number: number | null
      trim: string | null
      lazy: string | null
      trimNumber: number | null
    }>({ number: null, trim: null, lazy: null, trimNumber: null })

    const { host } = define(() => {
      const t0 = template(`<div>${'<input/>'.repeat(4)}</div>`)
      const n0 = t0() as HTMLInputElement
      const [input1, input2, input3, input4] = Array.from(
        n0.children,
      ) as Array<HTMLInputElement>

      // number
      setClass(input1, 'number')
      withDirectives(input1, [
        [vModelDynamic, () => data.number, '', { number: true }],
      ])
      delegate(input1, 'update:modelValue', () => val => (data.number = val))

      // trim
      setClass(input2, 'trim')
      withDirectives(input2, [
        [vModelDynamic, () => data.trim, '', { trim: true }],
      ])
      delegate(input2, 'update:modelValue', () => val => (data.trim = val))

      // trim & number
      setClass(input3, 'trim-number')
      withDirectives(input3, [
        [
          vModelDynamic,
          () => data.trimNumber,
          '',
          { trim: true, number: true },
        ],
      ])
      delegate(
        input3,
        'update:modelValue',
        () => val => (data.trimNumber = val),
      )

      // lazy
      setClass(input4, 'lazy')
      withDirectives(input4, [
        [vModelDynamic, () => data.lazy, '', { lazy: true }],
      ])
      delegate(input4, 'update:modelValue', () => val => (data.lazy = val))

      return n0
    }).render()

    const number = host.querySelector('.number') as HTMLInputElement
    const trim = host.querySelector('.trim') as HTMLInputElement
    const trimNumber = host.querySelector('.trim-number') as HTMLInputElement
    const lazy = host.querySelector('.lazy') as HTMLInputElement

    number.value = '+01.2'
    triggerEvent('input', number)
    await nextTick()
    expect(data.number).toEqual(1.2)

    trim.value = '    hello, world    '
    triggerEvent('input', trim)
    await nextTick()
    expect(data.trim).toEqual('hello, world')

    trimNumber.value = '    1    '
    triggerEvent('input', trimNumber)
    await nextTick()
    expect(data.trimNumber).toEqual(1)

    trimNumber.value = '    +01.2    '
    triggerEvent('input', trimNumber)
    await nextTick()
    expect(data.trimNumber).toEqual(1.2)

    lazy.value = 'foo'
    triggerEvent('change', lazy)
    await nextTick()
    expect(data.lazy).toEqual('foo')
  })

  test('should work with range', async () => {
    const data = ref<number>(25)
    const { host } = define(() => {
      const t0 = template(`<div>${'<input />'.repeat(2)}</div>`)
      const n0 = t0() as HTMLInputElement
      const [n1, n2] = Array.from(n0.children) as Array<HTMLInputElement>

      setDOMProps(n1, [
        ['class', 'foo'],
        ['type', 'range'],
        ['min', 1],
        ['max', 100],
      ])
      withDirectives(n1, [
        [vModelDynamic, () => data.value, '', { number: true }],
      ])
      delegate(n1, 'update:modelValue', () => val => (data.value = val))

      setDOMProps(n2, [
        ['class', 'bar'],
        ['type', 'range'],
        ['min', 1],
        ['max', 100],
      ])

      withDirectives(n2, [
        [vModelDynamic, () => data.value, '', { lazy: true }],
      ])
      delegate(n2, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const foo = host.querySelector('.foo') as HTMLInputElement
    const bar = host.querySelector('.bar') as HTMLInputElement

    // @ts-expect-error
    foo.value = 20
    triggerEvent('input', foo)
    await nextTick()
    expect(data.value).toEqual(20)

    // @ts-expect-error
    foo.value = 200
    triggerEvent('input', foo)
    await nextTick()
    expect(data.value).toEqual(100)

    // @ts-expect-error
    foo.value = -1
    triggerEvent('input', foo)
    await nextTick()
    expect(data.value).toEqual(1)

    // @ts-expect-error
    bar.value = 30
    triggerEvent('change', bar)
    await nextTick()
    expect(data.value).toEqual('30')

    // @ts-expect-error
    bar.value = 200
    triggerEvent('change', bar)
    await nextTick()
    expect(data.value).toEqual('100')

    // @ts-expect-error
    bar.value = -1
    triggerEvent('change', bar)
    await nextTick()
    expect(data.value).toEqual('1')

    data.value = 60
    await nextTick()
    expect(foo.value).toEqual('60')
    expect(bar.value).toEqual('60')

    data.value = -1
    await nextTick()
    expect(foo.value).toEqual('1')
    expect(bar.value).toEqual('1')

    data.value = 200
    await nextTick()
    expect(foo.value).toEqual('100')
    expect(bar.value).toEqual('100')
  })

  test('should work with checkbox', async () => {
    const data = ref<boolean | null>(null)
    const { host } = define(() => {
      const t0 = template('<input />')
      const n0 = t0() as HTMLInputElement
      setDOMProp(n0, 'type', 'checkbox')
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const input = host.querySelector('input') as HTMLInputElement

    input.checked = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual(true)

    data.value = false
    await nextTick()
    expect(input.checked).toEqual(false)

    data.value = true
    await nextTick()
    expect(input.checked).toEqual(true)

    input.checked = false
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual(false)
  })

  test('should work with checkbox and true-value/false-value', async () => {
    const data = ref<string | null>('yes')
    const { host } = define(() => {
      const t0 = template('<input />')
      const n0 = t0() as HTMLInputElement
      setDOMProps(n0, [
        ['type', 'checkbox'],
        ['true-value', 'yes'],
        ['false-value', 'no'],
      ])
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const input = host.querySelector('input') as HTMLInputElement

    // DOM checked state should respect initial true-value/false-value
    expect(input.checked).toEqual(true)
    input.checked = false
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual('no')

    data.value = 'yes'
    await nextTick()
    expect(input.checked).toEqual(true)

    data.value = 'no'
    await nextTick()
    expect(input.checked).toEqual(false)

    input.checked = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual('yes')
  })

  test('should work with checkbox and true-value/false-value with object values', async () => {
    const data = ref<{ yes?: 'yes'; no?: 'no' } | null>(null)
    const { host } = define(() => {
      const t0 = template('<input />')
      const n0 = t0() as HTMLInputElement
      setDOMProps(n0, [
        ['type', 'checkbox'],
        ['true-value', { yes: 'yes' }],
        ['false-value', { no: 'no' }],
      ])
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const input = host.querySelector('input') as HTMLInputElement
    input.checked = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual({ yes: 'yes' })

    data.value = { no: 'no' }
    await nextTick()
    expect(input.checked).toEqual(false)

    data.value = { yes: 'yes' }
    await nextTick()
    expect(input.checked).toEqual(true)

    input.checked = false
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual({ no: 'no' })
  })

  test(`should support array as a checkbox model`, async () => {
    const data = ref<Array<string>>([])
    const { host } = define(() => {
      const t0 = template(`<div>${'<input />'.repeat(2)}</div>`)
      const n0 = t0() as HTMLInputElement
      const [n1, n2] = Array.from(n0.children) as Array<HTMLInputElement>
      setDOMProps(n1, [
        ['class', 'foo'],
        ['type', 'checkbox'],
        ['value', 'foo'],
      ])
      withDirectives(n1, [[vModelDynamic, () => data.value]])
      delegate(n1, 'update:modelValue', () => val => (data.value = val))

      setDOMProps(n2, [
        ['class', 'bar'],
        ['type', 'checkbox'],
        ['value', 'bar'],
      ])
      withDirectives(n2, [[vModelDynamic, () => data.value]])
      delegate(n2, 'update:modelValue', () => val => (data.value = val))

      return n0
    }).render()

    const foo = host.querySelector('.foo') as HTMLInputElement
    const bar = host.querySelector('.bar') as HTMLInputElement

    foo.checked = true
    triggerEvent('change', foo)
    await nextTick()
    expect(data.value).toMatchObject(['foo'])

    bar.checked = true
    triggerEvent('change', bar)
    await nextTick()
    expect(data.value).toMatchObject(['foo', 'bar'])

    bar.checked = false
    triggerEvent('change', bar)
    await nextTick()
    expect(data.value).toMatchObject(['foo'])

    foo.checked = false
    triggerEvent('change', foo)
    await nextTick()
    expect(data.value).toMatchObject([])

    data.value = ['foo']
    await nextTick()
    expect(bar.checked).toEqual(false)
    expect(foo.checked).toEqual(true)

    data.value = ['bar']
    await nextTick()
    expect(foo.checked).toEqual(false)
    expect(bar.checked).toEqual(true)

    data.value = []
    await nextTick()
    expect(foo.checked).toEqual(false)
    expect(bar.checked).toEqual(false)
  })

  test(`should support Set as a checkbox model`, async () => {
    const data = ref<Set<string>>(new Set())
    const { host } = define(() => {
      const t0 = template(`<div>${'<input />'.repeat(2)}</div>`)
      const n0 = t0() as HTMLInputElement
      const [n1, n2] = Array.from(n0.children) as Array<HTMLInputElement>
      setDOMProps(n1, [
        ['class', 'foo'],
        ['type', 'checkbox'],
        ['value', 'foo'],
      ])
      withDirectives(n1, [[vModelDynamic, () => data.value]])
      delegate(n1, 'update:modelValue', () => val => (data.value = val))

      setDOMProps(n2, [
        ['class', 'bar'],
        ['type', 'checkbox'],
        ['value', 'bar'],
      ])
      withDirectives(n2, [[vModelDynamic, () => data.value]])
      delegate(n2, 'update:modelValue', () => val => (data.value = val))

      return n0
    }).render()

    const foo = host.querySelector('.foo') as HTMLInputElement
    const bar = host.querySelector('.bar') as HTMLInputElement

    foo.checked = true
    triggerEvent('change', foo)
    await nextTick()
    expect(data.value).toMatchObject(new Set(['foo']))

    bar.checked = true
    triggerEvent('change', bar)
    await nextTick()
    expect(data.value).toMatchObject(new Set(['foo', 'bar']))

    bar.checked = false
    triggerEvent('change', bar)
    await nextTick()
    expect(data.value).toMatchObject(new Set(['foo']))

    foo.checked = false
    triggerEvent('change', foo)
    await nextTick()
    expect(data.value).toMatchObject(new Set())

    data.value = new Set(['foo'])
    await nextTick()
    expect(bar.checked).toEqual(false)
    expect(foo.checked).toEqual(true)

    data.value = new Set(['bar'])
    await nextTick()
    expect(foo.checked).toEqual(false)
    expect(bar.checked).toEqual(true)

    data.value = new Set()
    await nextTick()
    expect(foo.checked).toEqual(false)
    expect(bar.checked).toEqual(false)
  })

  test('should work with radio', async () => {
    const data = ref<string | null>(null)
    const { host } = define(() => {
      const t0 = template(`<div>${'<input />'.repeat(2)}</div>`)
      const n0 = t0() as HTMLInputElement
      const [n1, n2] = Array.from(n0.children) as Array<HTMLInputElement>
      setDOMProps(n1, [
        ['class', 'foo'],
        ['type', 'radio'],
        ['value', 'foo'],
      ])
      withDirectives(n1, [[vModelDynamic, () => data.value]])
      delegate(n1, 'update:modelValue', () => val => (data.value = val))

      setDOMProps(n2, [
        ['class', 'bar'],
        ['type', 'radio'],
        ['value', 'bar'],
      ])
      withDirectives(n2, [[vModelDynamic, () => data.value]])
      delegate(n2, 'update:modelValue', () => val => (data.value = val))

      return n0
    }).render()

    const foo = host.querySelector('.foo') as HTMLInputElement
    const bar = host.querySelector('.bar') as HTMLInputElement

    foo.checked = true
    triggerEvent('change', foo)
    await nextTick()
    expect(data.value).toEqual('foo')

    bar.checked = true
    triggerEvent('change', bar)
    await nextTick()
    expect(data.value).toEqual('bar')

    data.value = null
    await nextTick()
    expect(foo.checked).toEqual(false)
    expect(bar.checked).toEqual(false)

    data.value = 'foo'
    await nextTick()
    expect(foo.checked).toEqual(true)
    expect(bar.checked).toEqual(false)

    data.value = 'bar'
    await nextTick()
    expect(foo.checked).toEqual(false)
    expect(bar.checked).toEqual(true)
  })

  test('should work with single select', async () => {
    const data = ref<string | null>(null)
    const { host } = define(() => {
      const t0 = template('<select><option></option><option></option></select>')
      const n0 = t0() as HTMLSelectElement
      const [n1, n2] = Array.from(n0.childNodes) as Array<HTMLOptionElement>
      setDOMProp(n1, 'value', 'foo')
      setDOMProp(n2, 'value', 'bar')

      setDOMProp(n0, 'value', null)
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const select = host.querySelector('select') as HTMLSelectElement
    const foo = host.querySelector('option[value=foo]') as HTMLOptionElement
    const bar = host.querySelector('option[value=bar]') as HTMLOptionElement

    foo.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toEqual('foo')

    foo.selected = false
    bar.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toEqual('bar')

    foo.selected = false
    bar.selected = false
    data.value = 'foo'
    await nextTick()
    expect(select.value).toEqual('foo')
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(false)

    foo.selected = true
    bar.selected = false
    data.value = 'bar'
    await nextTick()
    expect(select.value).toEqual('bar')
    expect(foo.selected).toEqual(false)
    expect(bar.selected).toEqual(true)
  })

  test('should work wiht multiple select (model is Array)', async () => {
    const data = ref<Array<string>>([])
    const { host } = define(() => {
      const t0 = template('<select><option></option><option></option></select>')
      const n0 = t0() as HTMLSelectElement
      const [n1, n2] = Array.from(n0.childNodes) as Array<HTMLOptionElement>
      setDOMProp(n1, 'value', 'foo')
      setDOMProp(n2, 'value', 'bar')

      setDOMProps(n0, [
        ['value', null],
        ['multiple', true],
      ])
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const select = host.querySelector('select') as HTMLSelectElement
    const foo = host.querySelector('option[value=foo]') as HTMLOptionElement
    const bar = host.querySelector('option[value=bar]') as HTMLOptionElement

    foo.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject(['foo'])

    foo.selected = false
    bar.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject(['bar'])

    foo.selected = true
    bar.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject(['foo', 'bar'])

    foo.selected = false
    bar.selected = false
    data.value = ['foo']
    await nextTick()
    expect(select.value).toEqual('foo')
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(false)

    foo.selected = false
    bar.selected = false
    data.value = ['foo', 'bar']
    await nextTick()
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(true)
  })

  test('v-model.number should work with single select', async () => {
    const data = ref<string | null>(null)
    const { host } = define(() => {
      const t0 = template('<select><option></option><option></option></select>')
      const n0 = t0() as HTMLSelectElement
      const [n1, n2] = Array.from(n0.childNodes) as Array<HTMLOptionElement>
      setDOMProp(n1, 'value', '1')
      setDOMProp(n2, 'value', '2')

      setDOMProp(n0, 'value', null)
      withDirectives(n0, [
        [vModelDynamic, () => data.value, '', { number: true }],
      ])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const select = host.querySelector('select') as HTMLSelectElement
    const one = host.querySelector('option[value="1"]') as HTMLOptionElement

    one.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(typeof data.value).toEqual('number')
    expect(data.value).toEqual(1)
  })

  test('v-model.number should work with multiple select', async () => {
    const data = ref<Array<number>>([])
    const { host } = define(() => {
      const t0 = template('<select><option></option><option></option></select>')
      const n0 = t0() as HTMLSelectElement
      const [n1, n2] = Array.from(n0.childNodes) as Array<HTMLOptionElement>
      setDOMProp(n1, 'value', '1')
      setDOMProp(n2, 'value', '2')

      setDOMProps(n0, [
        ['value', null],
        ['multiple', true],
      ])
      withDirectives(n0, [
        [vModelDynamic, () => data.value, '', { number: true }],
      ])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const select = host.querySelector('select') as HTMLSelectElement
    const one = host.querySelector('option[value="1"]') as HTMLOptionElement
    const two = host.querySelector('option[value="2"]') as HTMLOptionElement

    one.selected = true
    two.selected = false
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject([1])

    one.selected = false
    two.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject([2])

    one.selected = true
    two.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject([1, 2])

    one.selected = false
    two.selected = false
    data.value = [1]
    await nextTick()
    expect(one.selected).toEqual(true)
    expect(two.selected).toEqual(false)

    one.selected = false
    two.selected = false
    data.value = [1, 2]
    await nextTick()
    expect(one.selected).toEqual(true)
    expect(two.selected).toEqual(true)
  })

  test('multiple select (model is Array, option value is object)', async () => {
    const fooValue = { foo: 1 }
    const barValue = { bar: 1 }

    const data = ref<Array<number>>([])
    const { host } = define(() => {
      const t0 = template('<select><option></option><option></option></select>')
      const n0 = t0() as HTMLSelectElement
      const [n1, n2] = Array.from(n0.childNodes) as Array<HTMLOptionElement>
      setDOMProp(n1, 'value', fooValue)
      setDOMProp(n2, 'value', barValue)

      setDOMProps(n0, [
        ['value', null],
        ['multiple', true],
      ])
      withDirectives(n0, [
        [vModelDynamic, () => data.value, '', { number: true }],
      ])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const select = host.querySelector('select') as HTMLSelectElement
    const [foo, bar] = Array.from(
      host.querySelectorAll('option'),
    ) as Array<HTMLOptionElement>

    foo.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject([fooValue])

    foo.selected = false
    bar.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject([barValue])

    foo.selected = true
    bar.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject([fooValue, barValue])

    // reset
    foo.selected = false
    bar.selected = false
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject([])

    // @ts-expect-error
    data.value = [fooValue, barValue]
    await nextTick()
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(true)

    // reset
    foo.selected = false
    bar.selected = false
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject([])

    // @ts-expect-error
    data.value = [{ foo: 1 }, { bar: 1 }]
    await nextTick()
    // looseEqual
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(true)
  })

  test('multiple select (model is Set)', async () => {
    const data = ref<Set<string>>(new Set())
    const { host } = define(() => {
      const t0 = template('<select><option></option><option></option></select>')
      const n0 = t0() as HTMLSelectElement
      const [n1, n2] = Array.from(n0.childNodes) as Array<HTMLOptionElement>
      setDOMProp(n1, 'value', 'foo')
      setDOMProp(n2, 'value', 'bar')

      setDOMProps(n0, [
        ['value', null],
        ['multiple', true],
      ])
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const select = host.querySelector('select') as HTMLSelectElement
    const foo = host.querySelector('option[value=foo]') as HTMLOptionElement
    const bar = host.querySelector('option[value=bar]') as HTMLOptionElement

    foo.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toBeInstanceOf(Set)
    expect(data.value).toMatchObject(new Set(['foo']))

    foo.selected = false
    bar.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toBeInstanceOf(Set)
    expect(data.value).toMatchObject(new Set(['bar']))

    foo.selected = true
    bar.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toBeInstanceOf(Set)
    expect(data.value).toMatchObject(new Set(['foo', 'bar']))

    foo.selected = false
    bar.selected = false
    data.value = new Set(['foo'])
    await nextTick()
    expect(select.value).toEqual('foo')
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(false)

    foo.selected = false
    bar.selected = false
    data.value = new Set(['foo', 'bar'])
    await nextTick()
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(true)
  })

  test('multiple select (model is set, option value is object)', async () => {
    const fooValue = { foo: 1 }
    const barValue = { bar: 1 }

    const data = ref<Set<string>>(new Set())
    const { host } = define(() => {
      const t0 = template('<select><option></option><option></option></select>')
      const n0 = t0() as HTMLSelectElement
      const [n1, n2] = Array.from(n0.childNodes) as Array<HTMLOptionElement>
      setDOMProp(n1, 'value', fooValue)
      setDOMProp(n2, 'value', barValue)

      setDOMProps(n0, [
        ['value', null],
        ['multiple', true],
      ])
      withDirectives(n0, [
        [vModelDynamic, () => data.value, '', { number: true }],
      ])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const select = host.querySelector('select') as HTMLSelectElement
    const [foo, bar] = Array.from(
      host.querySelectorAll('option'),
    ) as Array<HTMLOptionElement>

    foo.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject(new Set([fooValue]))

    foo.selected = false
    bar.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject(new Set([barValue]))

    foo.selected = true
    bar.selected = true
    triggerEvent('change', select)
    await nextTick()
    expect(data.value).toMatchObject(new Set([fooValue, barValue]))

    foo.selected = false
    bar.selected = false
    // @ts-expect-error
    data.value = new Set([fooValue, barValue])
    await nextTick()
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(true)

    foo.selected = false
    bar.selected = false
    // @ts-expect-error
    data.value = new Set([{ foo: 1 }, { bar: 1 }])
    await nextTick()
    // without looseEqual, here is different from Array
    expect(foo.selected).toEqual(false)
    expect(bar.selected).toEqual(false)
  })

  test('should work with composition session', async () => {
    const data = ref<string>('')
    const { host } = define(() => {
      const t0 = template('<input />')
      const n0 = t0() as HTMLInputElement
      withDirectives(n0, [[vModelDynamic, () => data.value]])
      delegate(n0, 'update:modelValue', () => val => (data.value = val))
      return n0
    }).render()

    const input = host.querySelector('input') as HTMLInputElement

    //developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event
    //compositionstart event could be fired after a user starts entering a Chinese character using a Pinyin IME
    input.value = '使用拼音'
    triggerEvent('compositionstart', input)
    await nextTick()
    expect(data.value).toEqual('')

    // input event has no effect during composition session
    input.value = '使用拼音输入'
    triggerEvent('input', input)
    await nextTick()
    expect(data.value).toEqual('')

    // After compositionend event being fired, an input event will be automatically trigger
    triggerEvent('compositionend', input)
    await nextTick()
    expect(data.value).toEqual('使用拼音输入')
  })
})
