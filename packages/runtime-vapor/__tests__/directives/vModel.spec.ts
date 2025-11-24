import { reactive, ref } from '@vue/reactivity'
import {
  applyCheckboxModel,
  applyRadioModel,
  applySelectModel,
  applyTextModel,
  delegate,
  delegateEvents,
  on,
  setClass,
  setProp,
  setValue,
  template,
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
    key === 'class' ? setClass(el, value) : setProp(el, key, value)
  })
}

describe('directive: v-model', () => {
  test('should work with text input', async () => {
    const spy = vi.fn()

    const data = ref<string | null | undefined>('')
    const { host } = define(() => {
      const t0 = template('<input />')
      delegateEvents('input')
      const n0 = t0() as HTMLInputElement
      applyTextModel(
        n0,
        () => data.value,
        val => (data.value = val),
      )
      delegate(n0, 'input', () => spy(data.value))
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
      const n0 = t0() as HTMLSelectElement
      applySelectModel(
        n0,
        () => data.value,
        val => (data.value = val),
      )
      on(n0, 'change', () => spy(data.value))
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
      applyTextModel(
        n0,
        () => data.value,
        val => (data.value = val),
      )
      n0.type = 'number'
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

  test('should work with textarea', async () => {
    const data = ref<string>('')
    const { host } = define(() => {
      const t0 = template('<textarea />')
      const n0 = t0() as HTMLInputElement
      applyTextModel(
        n0,
        () => data.value,
        val => (data.value = val),
      )
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
      applyTextModel(
        input1,
        () => data.number,
        val => (data.number = val),
        { number: true },
      )

      // trim
      setClass(input2, 'trim')
      applyTextModel(
        input2,
        () => data.trim,
        val => (data.trim = val),
        { trim: true },
      )

      // trim & number
      setClass(input3, 'trim-number')
      applyTextModel(
        input3,
        () => data.trimNumber,
        val => (data.trimNumber = val),
        { trim: true, number: true },
      )

      // lazy
      setClass(input4, 'lazy')
      applyTextModel(
        input4,
        () => data.lazy,
        val => (data.lazy = val),
        { lazy: true },
      )

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
    let n1: HTMLInputElement, n2: HTMLInputElement
    define(() => {
      const t0 = template(
        `<div>` +
          `<input type="range" min="1" max="100">` +
          `<input type="range" min="1" max="100">` +
          `</div>`,
      )
      const n0 = t0() as HTMLInputElement
      ;[n1, n2] = Array.from(n0.children) as Array<HTMLInputElement>

      applyTextModel(
        n1,
        () => data.value,
        val => (data.value = val),
        { number: true },
      )

      applyTextModel(
        n2,
        () => data.value,
        val => (data.value = val),
        {
          lazy: true,
        },
      )

      return n0
    }).render()

    // @ts-expect-error
    n1.value = 20
    triggerEvent('input', n1!)
    await nextTick()
    expect(data.value).toEqual(20)

    // @ts-expect-error
    n1.value = 200
    triggerEvent('input', n1!)
    await nextTick()
    expect(data.value).toEqual(100)

    // @ts-expect-error
    n1.value = -1
    triggerEvent('input', n1!)
    await nextTick()
    expect(data.value).toEqual(1)

    // @ts-expect-error
    n2.value = 30
    triggerEvent('change', n2!)
    await nextTick()
    expect(data.value).toEqual('30')

    // @ts-expect-error
    n2.value = 200
    triggerEvent('change', n2!)
    await nextTick()
    expect(data.value).toEqual('100')

    // @ts-expect-error
    n2.value = -1
    triggerEvent('change', n2!)
    await nextTick()
    expect(data.value).toEqual('1')

    data.value = 60
    await nextTick()
    expect(n1!.value).toEqual('60')
    expect(n2!.value).toEqual('60')

    data.value = -1
    await nextTick()
    expect(n1!.value).toEqual('1')
    expect(n2!.value).toEqual('1')

    data.value = 200
    await nextTick()
    expect(n1!.value).toEqual('100')
    expect(n2!.value).toEqual('100')
  })

  test('should work with checkbox', async () => {
    const data = ref<boolean | null>(null)
    const { host } = define(() => {
      const t0 = template('<input type="checkbox" />')
      const n0 = t0() as HTMLInputElement
      applyCheckboxModel(
        n0,
        () => data.value,
        val => (data.value = val),
      )
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
      const t0 = template(
        '<input type="checkbox" true-value="yes" false-value="no" />',
      )
      const n0 = t0() as HTMLInputElement
      applyCheckboxModel(
        n0,
        () => data.value,
        val => (data.value = val),
      )
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
      const t0 = template('<input type="checkbox" />')
      const n0 = t0() as HTMLInputElement
      setDOMProps(n0, [
        ['true-value', { yes: 'yes' }],
        ['false-value', { no: 'no' }],
      ])
      applyCheckboxModel(
        n0,
        () => data.value,
        val => (data.value = val),
      )
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
    let n1: HTMLInputElement, n2: HTMLInputElement
    define(() => {
      const t0 = template(
        `<div>` +
          `<input type="checkbox" value="foo">` +
          `<input type="checkbox" value="bar">` +
          `</div>`,
      )
      const n0 = t0() as HTMLInputElement
      ;[n1, n2] = Array.from(n0.children) as Array<HTMLInputElement>

      applyCheckboxModel(
        n1,
        () => data.value,
        val => (data.value = val),
      )
      applyCheckboxModel(
        n2,
        () => data.value,
        val => (data.value = val),
      )
      return n0
    }).render()

    n1!.checked = true
    triggerEvent('change', n1!)
    await nextTick()
    expect(data.value).toMatchObject(['foo'])

    n2!.checked = true
    triggerEvent('change', n2!)
    await nextTick()
    expect(data.value).toMatchObject(['foo', 'bar'])

    n2!.checked = false
    triggerEvent('change', n2!)
    await nextTick()
    expect(data.value).toMatchObject(['foo'])

    n1!.checked = false
    triggerEvent('change', n1!)
    await nextTick()
    expect(data.value).toMatchObject([])

    data.value = ['foo']
    await nextTick()
    expect(n2!.checked).toEqual(false)
    expect(n1!.checked).toEqual(true)

    data.value = ['bar']
    await nextTick()
    expect(n1!.checked).toEqual(false)
    expect(n2!.checked).toEqual(true)

    data.value = []
    await nextTick()
    expect(n1!.checked).toEqual(false)
    expect(n2!.checked).toEqual(false)
  })

  test(`should support Set as a checkbox model`, async () => {
    const data = ref<Set<string>>(new Set())
    let n1: HTMLInputElement, n2: HTMLInputElement
    define(() => {
      const t0 = template(
        `<div>` +
          `<input type="checkbox" value="foo">` +
          `<input type="checkbox" value="bar">` +
          `</div>`,
      )
      const n0 = t0() as HTMLInputElement
      ;[n1, n2] = Array.from(n0.children) as Array<HTMLInputElement>

      applyCheckboxModel(
        n1,
        () => data.value,
        val => (data.value = val),
      )
      applyCheckboxModel(
        n2,
        () => data.value,
        val => (data.value = val),
      )

      return n0
    }).render()

    n1!.checked = true
    triggerEvent('change', n1!)
    await nextTick()
    expect(data.value).toMatchObject(new Set(['foo']))

    n2!.checked = true
    triggerEvent('change', n2!)
    await nextTick()
    expect(data.value).toMatchObject(new Set(['foo', 'bar']))

    n2!.checked = false
    triggerEvent('change', n2!)
    await nextTick()
    expect(data.value).toMatchObject(new Set(['foo']))

    n1!.checked = false
    triggerEvent('change', n1!)
    await nextTick()
    expect(data.value).toMatchObject(new Set())

    data.value = new Set(['foo'])
    await nextTick()
    expect(n2!.checked).toEqual(false)
    expect(n1!.checked).toEqual(true)

    data.value = new Set(['bar'])
    await nextTick()
    expect(n1!.checked).toEqual(false)
    expect(n2!.checked).toEqual(true)

    data.value = new Set()
    await nextTick()
    expect(n1!.checked).toEqual(false)
    expect(n2!.checked).toEqual(false)
  })

  test('should work with radio', async () => {
    const data = ref<string | null>(null)
    let n1: HTMLInputElement, n2: HTMLInputElement
    define(() => {
      const t0 = template(
        `<div>` +
          `<input type="radio" value="foo">` +
          `<input type="radio" value="bar">` +
          `</div>`,
      )
      const n0 = t0() as HTMLInputElement
      ;[n1, n2] = Array.from(n0.children) as Array<HTMLInputElement>

      applyRadioModel(
        n1,
        () => data.value,
        val => (data.value = val),
      )
      applyRadioModel(
        n2,
        () => data.value,
        val => (data.value = val),
      )
      return n0
    }).render()

    n1!.checked = true
    triggerEvent('change', n1!)
    await nextTick()
    expect(data.value).toEqual('foo')

    n2!.checked = true
    triggerEvent('change', n2!)
    await nextTick()
    expect(data.value).toEqual('bar')

    data.value = null
    await nextTick()
    expect(n1!.checked).toEqual(false)
    expect(n2!.checked).toEqual(false)

    data.value = 'foo'
    await nextTick()
    expect(n1!.checked).toEqual(true)
    expect(n2!.checked).toEqual(false)

    data.value = 'bar'
    await nextTick()
    expect(n1!.checked).toEqual(false)
    expect(n2!.checked).toEqual(true)
  })

  test('should work with single select', async () => {
    const data = ref<string | null>(null)
    let select: HTMLSelectElement, n1: HTMLOptionElement, n2: HTMLOptionElement
    define(() => {
      const t0 = template(
        '<select><option value="foo"></option><option value="bar"></option></select>',
      )
      select = t0() as HTMLSelectElement
      ;[n1, n2] = Array.from(select.childNodes) as Array<HTMLOptionElement>

      applySelectModel(
        select,
        () => data.value,
        val => (data.value = val),
      )
      return select
    }).render()

    n1!.selected = true
    triggerEvent('change', select!)
    await nextTick()
    expect(data.value).toEqual('foo')

    n1!.selected = false
    n2!.selected = true
    triggerEvent('change', select!)
    await nextTick()
    expect(data.value).toEqual('bar')

    n1!.selected = false
    n2!.selected = false
    data.value = 'foo'
    await nextTick()
    expect(select!.value).toEqual('foo')
    expect(n1!.selected).toEqual(true)
    expect(n2!.selected).toEqual(false)

    n1!.selected = true
    n2!.selected = false
    data.value = 'bar'
    await nextTick()
    expect(select!.value).toEqual('bar')
    expect(n1!.selected).toEqual(false)
    expect(n2!.selected).toEqual(true)
  })

  test('should work with multiple select (model is Array)', async () => {
    const data = ref<Array<string>>([])
    let select: HTMLSelectElement, n1: HTMLOptionElement, n2: HTMLOptionElement
    define(() => {
      const t0 = template(
        '<select multiple>' +
          '<option value="foo"></option><option value="bar"></option>' +
          '</select>',
      )
      select = t0() as HTMLSelectElement
      ;[n1, n2] = Array.from(select.childNodes) as Array<HTMLOptionElement>

      applySelectModel(
        select,
        () => data.value,
        val => (data.value = val),
      )
      return select
    }).render()

    n1!.selected = true
    triggerEvent('change', select!)
    await nextTick()
    expect(data.value).toMatchObject(['foo'])

    n1!.selected = false
    n2!.selected = true
    triggerEvent('change', select!)
    await nextTick()
    expect(data.value).toMatchObject(['bar'])

    n1!.selected = true
    n2!.selected = true
    triggerEvent('change', select!)
    await nextTick()
    expect(data.value).toMatchObject(['foo', 'bar'])

    n1!.selected = false
    n2!.selected = false
    data.value = ['foo']
    await nextTick()
    expect(select!.value).toEqual('foo')
    expect(n1!.selected).toEqual(true)
    expect(n2!.selected).toEqual(false)

    n1!.selected = false
    n2!.selected = false
    data.value = ['foo', 'bar']
    await nextTick()
    expect(n1!.selected).toEqual(true)
    expect(n2!.selected).toEqual(true)
  })

  test('v-model.number should work with single select', async () => {
    const data = ref<string | null>(null)
    let select: HTMLSelectElement, n1: HTMLOptionElement
    define(() => {
      const t0 = template(
        '<select><option value="1"></option><option value="2"></option></select>',
      )
      select = t0() as HTMLSelectElement
      n1 = select.childNodes[0] as HTMLOptionElement
      applySelectModel(
        select,
        () => data.value,
        val => (data.value = val),
        { number: true },
      )
      return select
    }).render()

    n1!.selected = true
    triggerEvent('change', select!)
    await nextTick()
    expect(typeof data.value).toEqual('number')
    expect(data.value).toEqual(1)
  })

  test('v-model.number should work with multiple select', async () => {
    const data = ref<Array<number>>([])
    let select: HTMLSelectElement
    const { host } = define(() => {
      const t0 = template(
        '<select multiple>' +
          '<option value="1"></option><option value="2"></option>' +
          '</select>',
      )
      select = t0() as HTMLSelectElement
      applySelectModel(
        select,
        () => data.value,
        val => (data.value = val),
        { number: true },
      )
      return select
    }).render()

    const one = host.querySelector('option[value="1"]') as HTMLOptionElement
    const two = host.querySelector('option[value="2"]') as HTMLOptionElement

    one.selected = true
    two.selected = false
    triggerEvent('change', select!)
    await nextTick()
    expect(data.value).toMatchObject([1])

    one.selected = false
    two.selected = true
    triggerEvent('change', select!)
    await nextTick()
    expect(data.value).toMatchObject([2])

    one.selected = true
    two.selected = true
    triggerEvent('change', select!)
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

    let select: HTMLSelectElement
    const { host } = define(() => {
      const t0 = template(
        '<select multiple><option></option><option></option></select>',
      )
      select = t0() as HTMLSelectElement
      const [n1, n2] = Array.from(select.childNodes) as Array<HTMLOptionElement>
      setValue(n1, fooValue)
      setValue(n2, barValue)
      applySelectModel(
        select,
        () => data.value,
        val => (data.value = val),
      )
      return select
    }).render()

    const [foo, bar] = Array.from(
      host.querySelectorAll('option'),
    ) as Array<HTMLOptionElement>

    foo.selected = true
    triggerEvent('change', select!)
    await nextTick()
    expect(data.value).toMatchObject([fooValue])

    foo.selected = false
    bar.selected = true
    triggerEvent('change', select!)
    await nextTick()
    expect(data.value).toMatchObject([barValue])

    foo.selected = true
    bar.selected = true
    triggerEvent('change', select!)
    await nextTick()
    expect(data.value).toMatchObject([fooValue, barValue])

    // reset
    foo.selected = false
    bar.selected = false
    triggerEvent('change', select!)
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
    triggerEvent('change', select!)
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
      const t0 = template(
        '<select multiple><option value="foo"></option><option value="bar"></option></select>',
      )
      const n0 = t0() as HTMLSelectElement
      applySelectModel(
        n0,
        () => data.value,
        val => (data.value = val),
      )
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
      const t0 = template(
        '<select multiple><option></option><option></option></select>',
      )
      const n0 = t0() as HTMLSelectElement
      const [n1, n2] = Array.from(n0.childNodes) as Array<HTMLOptionElement>
      setValue(n1, fooValue)
      setValue(n2, barValue)
      applySelectModel(
        n0,
        () => data.value,
        val => (data.value = val),
      )
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
      applyTextModel(
        n0,
        () => data.value,
        val => (data.value = val),
      )
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
