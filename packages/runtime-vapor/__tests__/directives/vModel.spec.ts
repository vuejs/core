import { type Ref, effectScope, reactive, ref } from '@vue/reactivity'
import {
  applyCheckboxModel,
  applyDynamicModel,
  applyRadioModel,
  applySelectModel,
  applyTextModel,
  delegate,
  delegateEvents,
  on,
  renderEffect,
  setClass,
  setProp,
  setValue,
  template,
} from '../../src'
import { makeRender, renderParity } from '../_utils'
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

  describe('applyDynamicModel', () => {
    test('input + dynamic type', async () => {
      const spy = vi.fn()
      const inputType = ref<string>('text')

      const data = ref<string | null | undefined>('')
      const { host } = define(() => {
        const n0 = template('<input />')() as HTMLInputElement
        delegateEvents('input')
        renderEffect(() => setProp(n0, 'type', inputType.value))
        applyDynamicModel(
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

    test('should work with textarea', async () => {
      const data = ref<string>('')
      const { host } = define(() => {
        const t0 = template('<textarea />')
        const n0 = t0() as HTMLInputElement
        applyDynamicModel(
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

    test('should work with select', async () => {
      const spy = vi.fn()
      const data = ref<string | null>('')
      const { host } = define(() => {
        const t0 = template(
          '<select><option>red</option><option>green</option><option>blue</option></select>',
        )
        const n0 = t0() as HTMLSelectElement
        applyDynamicModel(
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

    test('should work with checkbox', async () => {
      const data = ref<boolean | null>(null)
      const { host } = define(() => {
        const t0 = template('<input type="checkbox" />')
        const n0 = t0() as HTMLInputElement
        applyDynamicModel(
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

        applyDynamicModel(
          n1,
          () => data.value,
          val => (data.value = val),
        )
        applyDynamicModel(
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
  })

  describe('literal values written by the template', () => {
    // the type the template wrote has to survive into the dom and the model,
    // so these go through the compiler instead of calling the directives
    // directly
    const parity = async <T>(
      template: string,
      makeInitial: () => any,
      probe: (root: HTMLElement, data: Ref<any>) => T | Promise<T>,
    ): Promise<{ vdom: T; vapor: T }> => {
      const probed = {} as { vdom: T; vapor: T }
      await renderParity(
        { App: `<template>${template}</template>` },
        () => ref(makeInitial()),
        async (data, root, mode) => {
          probed[mode] = await probe(root, data)
        },
      )
      return probed
    }

    const modelParity = (
      template: string,
      makeInitial: () => any,
      act: (root: HTMLElement) => void,
    ) =>
      parity(template, makeInitial, async (root, data) => {
        act(root)
        await nextTick()
        return data.value
      })

    const pickOption = (root: HTMLElement, index: number) => {
      const select = root.querySelector('select')!
      if (select.multiple) {
        for (let i = 0; i <= index; i++) select.options[i].selected = true
      } else {
        select.selectedIndex = index
      }
      triggerEvent('change', select)
    }

    const check = (root: HTMLElement, index: number, checked: boolean) => {
      const input = root.querySelectorAll('input')[index]
      input.checked = checked
      triggerEvent('change', input)
    }

    test('select keeps number option values', async () => {
      const { vdom, vapor } = await modelParity(
        `<select v-model="data"><option :value="1">a</option><option :value="2">b</option></select>`,
        () => 1,
        root => pickOption(root, 1),
      )

      expect(vdom).toBe(2)
      expect(vapor).toBe(2)
    })

    test('select multiple keeps number option values', async () => {
      const { vdom, vapor } = await modelParity(
        `<select multiple v-model="data"><option :value="1">a</option><option :value="2">b</option></select>`,
        () => [],
        root => pickOption(root, 1),
      )

      expect(vdom).toEqual([1, 2])
      expect(vapor).toEqual([1, 2])
    })

    test('radio keeps number values', async () => {
      const { vdom, vapor } = await modelParity(
        `<input type="radio" :value="1" v-model="data"><input type="radio" :value="2" v-model="data">`,
        () => 1,
        root => check(root, 1, true),
      )

      expect(vdom).toBe(2)
      expect(vapor).toBe(2)
    })

    test('checkbox array keeps number values', async () => {
      const { vdom, vapor } = await modelParity(
        `<input type="checkbox" :value="1" v-model="data"><input type="checkbox" :value="2" v-model="data">`,
        () => [1],
        root => check(root, 1, true),
      )

      expect(vdom).toEqual([1, 2])
      expect(vapor).toEqual([1, 2])
    })

    test('checkbox keeps number true-value and false-value', async () => {
      const { vdom, vapor } = await modelParity(
        `<input type="checkbox" :true-value="1" :false-value="0" v-model="data">`,
        () => 1,
        root => check(root, 0, false),
      )

      expect(vdom).toBe(0)
      expect(vapor).toBe(0)
    })

    // taken out of the template string, they have to be put back on the
    // element by `setAttr` - which is also what stores the raw value
    // `getCheckboxValue` prefers over the attribute
    test('checkbox keeps static true-value and false-value in the dom', async () => {
      const { vdom, vapor } = await parity(
        `<input type="checkbox" true-value="yes" false-value="no" v-model="data">`,
        () => 'yes',
        root => {
          const input = root.querySelector('input')!
          return {
            trueValue: input.getAttribute('true-value'),
            falseValue: input.getAttribute('false-value'),
            rawTrueValue: (input as any)._trueValue,
            rawFalseValue: (input as any)._falseValue,
            checked: input.checked,
          }
        },
      )

      expect(vapor).toEqual({
        trueValue: 'yes',
        falseValue: 'no',
        rawTrueValue: 'yes',
        rawFalseValue: 'no',
        checked: true,
      })
      expect(vapor).toEqual(vdom)
    })

    // a dynamic key never reaches the template string, so the value stays raw
    // and a boolean attribute is read as the number it was written as
    test('dynamic key keeps number values', async () => {
      const { vdom, vapor } = await parity(
        `<input :[data]="0">`,
        () => 'disabled',
        root => root.querySelector('input')!.disabled,
      )

      expect(vdom).toBe(false)
      expect(vapor).toBe(false)
    })

    test('boolean attribute keeps number values', async () => {
      const { vdom, vapor } = await parity(
        `<input :disabled="0"><input :disabled="1"><div :hidden="0"></div>`,
        () => null,
        root => [
          root.querySelectorAll('input')[0].disabled,
          root.querySelectorAll('input')[1].disabled,
          root.querySelector('div')!.hidden,
        ],
      )

      expect(vdom).toEqual([false, true, false])
      expect(vapor).toEqual([false, true, false])
    })

    // `<textarea>` / `<select>` ignore a `value` content attribute, so it only
    // takes effect when it is assigned as a dom property
    test('textarea value is assigned as a dom property', async () => {
      const { vdom, vapor } = await parity(
        `<textarea :value="1"></textarea><textarea value="x"></textarea>`,
        () => null,
        root => [...root.querySelectorAll('textarea')].map(el => el.value),
      )

      expect(vdom).toEqual(['1', 'x'])
      expect(vapor).toEqual(['1', 'x'])
    })

    test('select value is assigned as a dom property', async () => {
      const { vdom, vapor } = await parity(
        `<select :value="'b'"><option value="a">a</option><option value="b">b</option></select>`,
        () => null,
        root => root.querySelector('select')!.selectedIndex,
      )

      expect(vdom).toBe(1)
      expect(vapor).toBe(1)
    })

    test.each([true, false])(
      'checkbox keeps number true-value and false-value with .attr when checked is %s',
      async checked => {
        const { vdom, vapor } = await modelParity(
          `<input type="checkbox" v-model="data" :true-value.attr="1" :false-value.attr="0">`,
          () => (checked ? 0 : 1),
          root => check(root, 0, checked),
        )

        expect(vdom).toBe(checked ? 1 : 0)
        expect(vapor).toBe(vdom)
      },
    )

    test.each([0, 1])('readonly.attr keeps number value %i', async value => {
      const { vdom, vapor } = await parity(
        `<input :readonly.attr="${value}">`,
        () => null,
        root => {
          const input = root.querySelector('input')!
          return {
            readOnly: input.readOnly,
            attribute: input.getAttribute('readonly'),
          }
        },
      )

      expect(vdom).toEqual({
        readOnly: !!value,
        attribute: value ? '' : null,
      })
      expect(vapor).toEqual(vdom)
    })

    test('disabled.attr stringifies number values', async () => {
      const { vdom, vapor } = await parity(
        `<input :disabled.attr="0">`,
        () => null,
        root => {
          const input = root.querySelector('input')!
          return {
            disabled: input.disabled,
            attribute: input.getAttribute('disabled'),
          }
        },
      )

      expect(vdom).toEqual({ disabled: true, attribute: '0' })
      expect(vapor).toEqual(vdom)
    })
  })

  describe('select re-syncs when its options change', () => {
    // selection state and serialized model after `act`, checked for parity
    async function selectionAfter(
      srcs: Record<string, string>,
      initial: () => any,
      act: (data: any, root: HTMLElement) => void | Promise<void>,
    ) {
      const seen = {} as Record<'vdom' | 'vapor', [number | boolean[], string]>
      await renderParity(
        srcs,
        () => ref(initial()),
        async (data, root, mode) => {
          await act(data.value, root)
          await nextTick()
          const select = root.querySelector('select')!
          seen[mode] = [
            select.multiple
              ? Array.from(select.options, o => o.selected)
              : select.selectedIndex,
            JSON.stringify(data.value.v),
          ]
        },
      )
      expect(seen.vapor).toEqual(seen.vdom)
      return seen.vdom
    }

    test('options rendered after the model is set', async () => {
      expect(
        await selectionAfter(
          {
            App: `<template><select v-model="data.v"><option v-for="o in data.opts" :value="o">{{ o }}</option></select></template>`,
          },
          () => ({ v: 'b', opts: [] }),
          data => {
            data.opts = ['a', 'b', 'c']
          },
        ),
      ).toEqual([1, '"b"'])
    })

    test('option added by v-if', async () => {
      expect(
        await selectionAfter(
          {
            App: `<template><select v-model="data.v"><option value="a">a</option><option v-if="data.show" value="b">b</option></select></template>`,
          },
          () => ({ v: 'b', show: false }),
          data => {
            data.show = true
          },
        ),
      ).toEqual([1, '"b"'])
    })

    test('option value changed to match the model', async () => {
      expect(
        await selectionAfter(
          {
            App: `<template><select v-model="data.v"><option :value="data.a">a</option><option :value="{ id: 9 }">z</option></select></template>`,
          },
          () => ({ v: { id: 1 }, a: { id: 0 } }),
          data => {
            data.a = { id: 1 }
          },
        ),
      ).toEqual([0, '{"id":1}'])
    })

    test('optgroups rendered inside v-if', async () => {
      expect(
        await selectionAfter(
          {
            App: `<template><select v-model="data.v"><option value="">-</option><template v-if="data.groups.length"><optgroup v-for="g in data.groups" :label="g.label"><option v-for="o in g.opts" :value="o">{{ o }}</option></optgroup></template></select></template>`,
          },
          () => ({ v: 'y', groups: [] }),
          data => {
            data.groups = [
              { label: 'A', opts: ['w', 'x'] },
              { label: 'B', opts: ['y', 'z'] },
            ]
          },
        ),
      ).toEqual([3, '"y"'])
    })

    test('options passed through a slot', async () => {
      expect(
        await selectionAfter(
          {
            Child: `<template><select v-model="data.v"><slot /></select></template>`,
            App: `<template><components.Child><option v-for="o in data.opts" :value="o">{{ o }}</option></components.Child></template>`,
          },
          () => ({ v: 'b', opts: [] }),
          data => {
            data.opts = ['a', 'b', 'c']
          },
        ),
      ).toEqual([1, '"b"'])
    })

    test('multiple select keeps an object value when options load later', async () => {
      expect(
        await selectionAfter(
          {
            App: `<template><select multiple v-model="data.v"><option v-for="o in data.opts" :key="o.id" :value="o">{{ o.id }}</option></select></template>`,
          },
          () => ({ v: [{ id: 2 }], opts: [] }),
          async (data, root) => {
            data.opts = [{ id: 1 }, { id: 2 }, { id: 3 }]
            await nextTick()
            const select = root.querySelector('select')!
            select.options[0].selected = true
            triggerEvent('change', select)
          },
        ),
      ).toEqual([[true, true, false], '[{"id":1},{"id":2}]'])
    })

    test('multiple select with a Set model', async () => {
      expect(
        await selectionAfter(
          {
            App: `<template><select multiple v-model="data.v"><option v-for="o in data.opts" :value="o">{{ o }}</option></select></template>`,
          },
          () => ({ v: new Set(['b', 'c']), opts: [] }),
          data => {
            data.opts = ['a', 'b', 'c']
          },
        ),
      ).toEqual([[false, true, true], '{}'])
    })

    test('unrelated owner update keeps the picked option', async () => {
      expect(
        await selectionAfter(
          {
            App: `<template><p>{{ data.n }}</p><select v-model="data.v"><option value="a">a</option><option value="b">b</option></select></template>`,
          },
          () => ({ v: 'a', n: 0 }),
          async (data, root) => {
            const select = root.querySelector('select')!
            select.selectedIndex = 1
            triggerEvent('change', select)
            await nextTick()
            data.n++
          },
        ),
      ).toEqual([1, '"b"'])
    })

    test('v-once select is not re-synced by owner updates', async () => {
      expect(
        await selectionAfter(
          {
            App: `<template><p>{{ data.n }}</p><div v-once><select v-model="data.v"><option value="a">a</option><option value="b">b</option></select></div></template>`,
          },
          () => ({ v: 'a', n: 0 }),
          data => {
            data.v = 'b'
            data.n++
          },
        ),
      ).toEqual([0, '"b"'])
    })

    test('removed selects stop re-syncing', async () => {
      const reads = {} as Record<'vdom' | 'vapor', number[]>
      let count = 0
      await renderParity(
        {
          App: `<template><p>{{ data.n }}</p><select v-if="data.show" v-model="data.v"><option value="a">a</option></select><div v-for="r in data.rows" :key="r"><select v-model="data.v"><option value="a">a</option></select></div></template>`,
        },
        () =>
          ref({
            get v() {
              count++
              return 'a'
            },
            set v(_: string) {},
            n: 0,
            show: true,
            rows: [1, 2, 3],
          }),
        async (data, _root, mode) => {
          const readsPerUpdate = async () => {
            count = 0
            data.value.n++
            await nextTick()
            return count
          }
          const initial = await readsPerUpdate()
          data.value.show = false
          data.value.rows = [4]
          await nextTick()
          const afterRemoval = await readsPerUpdate()
          data.value.show = true
          await nextTick()
          reads[mode] = [initial, afterRemoval, await readsPerUpdate()]
        },
      )
      // one model read per mounted select
      expect(reads.vdom).toEqual([4, 1, 2])
      expect(reads.vapor).toEqual(reads.vdom)
    })

    test('re-syncs before the owner updated hooks run', async () => {
      const seen = {} as Record<'vdom' | 'vapor', number[]>
      let log: number[]
      await renderParity(
        {
          App: `<script setup>
            import { onUpdated, useTemplateRef } from 'vue'
            const data = _data
            const components = _components
            const select = useTemplateRef('select')
            onUpdated(() => components.log(select.value.selectedIndex))
          </script>
          <template><select ref="select" v-model="data.v"><option v-for="o in data.opts" :value="o">{{ o }}</option></select></template>`,
        },
        () => ref({ v: 'b', opts: [] }),
        async (data, _root, mode) => {
          log = seen[mode] = []
          data.value.opts = ['a', 'b']
          await nextTick()
        },
        { log: (i: number) => log.push(i) },
      )
      expect(seen.vdom).toEqual([1])
      expect(seen.vapor).toEqual(seen.vdom)
    })

    // coverage guard: the re-sync must not undo the #10014 skip after a
    // change event, which already left the dom in the model's state
    test('a user change is not re-applied to a multiple select', async () => {
      const writes = {} as Record<'vdom' | 'vapor', number>
      await renderParity(
        {
          App: `<template><select multiple v-model="data.v"><option v-for="o in data.opts" :value="o">{{ o }}</option></select></template>`,
        },
        () => ref({ v: ['b'], opts: ['a', 'b', 'c', 'd'] }),
        async (data, root, mode) => {
          const select = root.querySelector('select')!
          const selected = Object.getOwnPropertyDescriptor(
            HTMLOptionElement.prototype,
            'selected',
          )!
          let count = 0
          for (const option of select.options) {
            Object.defineProperty(option, 'selected', {
              configurable: true,
              get: selected.get,
              set(value) {
                count++
                selected.set!.call(this, value)
              },
            })
          }
          select.options[0].selected = true
          triggerEvent('change', select)
          await nextTick()
          expect(data.value.v).toEqual(['a', 'b'])
          writes[mode] = count
        },
      )
      // only the write made above: the model already matches the dom
      expect(writes.vdom).toBe(1)
      expect(writes.vapor).toBe(writes.vdom)
    })
  })

  describe('listeners on the same element', () => {
    const typeText = (root: HTMLElement, value: string, type = 'input') => {
      const el = root.querySelector('input, textarea') as HTMLInputElement
      el.value = value
      triggerEvent(type, el)
    }

    const check = (root: HTMLElement, index: number) => {
      const input = root.querySelectorAll('input')[index]
      input.checked = true
      triggerEvent('change', input)
    }

    const pickOption = (root: HTMLElement, index: number) => {
      const select = root.querySelector('select')!
      if (select.multiple) {
        for (let i = 0; i <= index; i++) select.options[i].selected = true
      } else {
        select.selectedIndex = index
      }
      triggerEvent('change', select)
    }

    // records what a handler on the same element sees when it runs
    const seenParity = async (
      template: string,
      makeInitial: () => any,
      act: (root: HTMLElement) => void,
      evt = 'input',
    ) => {
      const seen = {} as { vdom: any[]; vapor: any[] }
      let current: any[] = []
      await renderParity(
        {
          App:
            `<script setup>const data = _data; const log = _components.log; ` +
            `const type = _components.type; const evt = _components.evt; ` +
            `const vFoo = _components.vFoo</script>` +
            `<template>${template}</template>`,
        },
        () => ref(makeInitial()),
        async (_, root, mode) => {
          // vdom skips a listener attached in the same ms as the event fired
          await new Promise(r => setTimeout(r, 5))
          seen[mode] = current = []
          act(root)
        },
        {
          log: (v: any) => current.push(Array.isArray(v) ? [...v] : v),
          type: 'checkbox',
          evt,
          // a function directive: vdom runs it on mount, after the props
          vFoo: (el: any) => {
            if (!el._foo) {
              el._foo = true
              el.addEventListener('input', () => current.push('dir'))
            }
          },
        },
      )
      return seen
    }

    const selectTemplate = (attrs: string) =>
      `<select ${attrs}><option value="us">us</option><option value="de">de</option></select>`

    test.each([
      [
        'text',
        `<input v-model="data" @input="log(data)">`,
        () => '',
        (root: HTMLElement) => typeText(root, 'vue'),
        ['vue'],
      ],
      [
        'text with the listener first',
        `<input @input="log(data)" v-model="data">`,
        () => '',
        (root: HTMLElement) => typeText(root, 'vue'),
        ['vue'],
      ],
      [
        'textarea',
        `<textarea v-model="data" @input="log(data)"></textarea>`,
        () => '',
        (root: HTMLElement) => typeText(root, 'vue'),
        ['vue'],
      ],
      [
        '.trim',
        `<input v-model.trim="data" @input="log(data)">`,
        () => '',
        (root: HTMLElement) => typeText(root, '  vue  '),
        ['vue'],
      ],
      [
        '.number',
        `<input v-model.number="data" @input="log(data)">`,
        () => 0,
        (root: HTMLElement) => typeText(root, '42'),
        [42],
      ],
      [
        '.lazy',
        `<input v-model.lazy="data" @change="log(data)">`,
        () => '',
        (root: HTMLElement) => typeText(root, 'vue', 'change'),
        ['vue'],
      ],
      [
        'checkbox',
        `<input type="checkbox" v-model="data" @change="log(data)">`,
        () => false,
        (root: HTMLElement) => check(root, 0),
        [true],
      ],
      [
        'checkbox array',
        `<input type="checkbox" value="a" v-model="data" @change="log(data)">`,
        () => [],
        (root: HTMLElement) => check(root, 0),
        [['a']],
      ],
      [
        'radio',
        `<input type="radio" value="a" v-model="data" @change="log(data)">` +
          `<input type="radio" value="b" v-model="data" @change="log(data)">`,
        () => 'a',
        (root: HTMLElement) => check(root, 1),
        ['b'],
      ],
      [
        'select',
        selectTemplate(`v-model="data" @change="log(data)"`),
        () => 'us',
        (root: HTMLElement) => pickOption(root, 1),
        ['de'],
      ],
      [
        'select multiple',
        selectTemplate(`multiple v-model="data" @change="log(data)"`),
        () => [],
        (root: HTMLElement) => pickOption(root, 1),
        [['us', 'de']],
      ],
      [
        'dynamic type',
        `<input :type="type" v-model="data" @change="log(data)">`,
        () => false,
        (root: HTMLElement) => check(root, 0),
        [true],
      ],
      [
        'several listeners and modifiers',
        `<input v-model="data" @input="log('a:' + data)" @input.once="log('b:' + data)" @keyup.enter="log('c:' + data)">`,
        () => '',
        (root: HTMLElement) => typeText(root, 'vue'),
        ['a:vue', 'b:vue'],
      ],
      [
        'dynamic event name',
        `<input v-model="data" @[evt]="log(data)">`,
        () => '',
        (root: HTMLElement) => typeText(root, 'vue'),
        ['vue'],
      ],
      [
        'key-only event name in keyed v-for',
        `<input v-for="field in data" :key="field.event" v-model="field.value" @[field.event]="log(field.value)">`,
        () => [{ event: 'input', value: '' }],
        (root: HTMLElement) => typeText(root, 'vue'),
        ['vue'],
      ],
      // Keep the selector handler local; the nested event reads the model
      // without adding another binding to the selector expression.
      [
        'selector listeners with dynamic type in keyed v-for',
        `<input v-for="field in data" :key="field.event" :type="field.event === evt ? 'checkbox' : 'text'" v-model="field.value" ` +
          `v-on="field.event === evt ? { change: e => e.target.dispatchEvent(new e.constructor('read')) } : {}" @read="log(field.value)">`,
        () => [{ event: 'input', value: false }],
        (root: HTMLElement) => check(root, 0),
        [true],
      ],
      [
        'static listener with an empty v-on object',
        `<input v-model="data" @input="log(data)" v-on="{}">`,
        () => '',
        (root: HTMLElement) => typeText(root, 'vue'),
        ['vue'],
      ],
      [
        'merged static and object listeners',
        `<input class="base" :class="data" :type="type" v-model="data" @change="log('a:' + data)" v-on="{ change: () => log('b:' + data) }">`,
        () => false,
        (root: HTMLElement) => check(root, 0),
        ['a:true', 'b:true'],
      ],
      [
        'merged object and static listeners',
        `<input class="base" :class="data" :type="type" v-model="data" v-on="{ change: () => log('a:' + data) }" @change="log('b:' + data)">`,
        () => false,
        (root: HTMLElement) => check(root, 0),
        ['a:true', 'b:true'],
      ],
      [
        'v-on object',
        `<input v-model="data" v-on="{ input: () => log(data) }">`,
        () => '',
        (root: HTMLElement) => typeText(root, 'vue'),
        ['vue'],
      ],
    ])(
      'a same-event handler sees the updated model: %s',
      async (_, template, makeInitial, act, expected) => {
        const { vdom, vapor } = await seenParity(template, makeInitial, act)
        expect(vdom).toEqual(expected)
        expect(vapor).toEqual(vdom)
      },
    )

    test.each([
      ['onInput', false, false],
      ['onChange', false, false],
      ['onInput', true, false],
      ['onChange', true, false],
      ['onInput', false, true],
      ['onChange', false, true],
    ])(
      'bound %s listener sees the updated model (reactive handler: %s, v-once: %s)',
      async (listener, reactiveHandler, once) => {
        const seen = {} as Record<'vdom' | 'vapor', string[]>
        let log: string[]
        const attrs = `v-model="data" :${listener}="handler"${once ? ' v-once' : ''}`
        const template =
          listener === 'onInput' ? `<input ${attrs}>` : selectTemplate(attrs)
        await renderParity(
          {
            App: `<script setup>
              import { ref } from 'vue'
              const data = _data
              const log = _components.log
              ${
                reactiveHandler
                  ? `const handler = ref(() => log('initial:' + data.value))
                     function replaceHandler() {
                       handler.value = () => log('replacement:' + data.value)
                     }`
                  : `function handler() { log('initial:' + data.value) }`
              }
            </script>
            <template>${template}${
              reactiveHandler
                ? '<button @click="replaceHandler">replace</button>'
                : ''
            }</template>`,
          },
          () => ref('us'),
          async (_, root, mode) => {
            log = seen[mode] = []
            await new Promise(r => setTimeout(r, 5))
            if (listener === 'onInput') typeText(root, 'de')
            else pickOption(root, 1)
            if (reactiveHandler) {
              triggerEvent('click', root.querySelector('button')!)
              await nextTick()
              if (listener === 'onInput') typeText(root, 'us')
              else pickOption(root, 0)
            }
          },
          { log: (value: string) => log.push(value) },
        )
        expect(seen.vdom).toEqual(
          reactiveHandler ? ['initial:de', 'replacement:us'] : ['initial:de'],
        )
        expect(seen.vapor).toEqual(seen.vdom)
      },
    )

    test('merged listeners stay registered when DOM props update', async () => {
      const seen = {} as Record<'vdom' | 'vapor', string[]>
      let log: string[]
      await renderParity(
        {
          App: `<script setup>
            const data = _data
            const log = _components.log
          </script>
          <template>
            <input class="base" :class="data.class" v-model="data.value"
              @input="log('a:' + data.value)"
              v-on="{ input: () => log('b:' + data.value) }">
          </template>`,
        },
        () => ref({ value: '', class: 'before' }),
        async (data, root, mode) => {
          log = seen[mode] = []
          const input = root.querySelector('input')!
          expect(input.className).toBe('base before')
          data.value.class = 'after'
          await nextTick()
          expect(input.className).toBe('base after')
          await new Promise(r => setTimeout(r, 5))
          typeText(root, 'vue')
        },
        { log: (value: string) => log.push(value) },
      )
      expect(seen.vdom).toEqual(['a:vue', 'b:vue'])
      expect(seen.vapor).toEqual(seen.vdom)
    })

    test('listeners stay before a custom directive on the same element', async () => {
      const { vdom, vapor } = await seenParity(
        `<input v-foo @input="log(data)" v-model="data">`,
        () => '',
        root => typeText(root, 'vue'),
      )
      expect(vdom).toEqual(['vue', 'dir'])
      expect(vapor).toEqual(vdom)
    })

    // capture listeners on the target run before non-capture ones, so this
    // handler runs before v-model's own and still sees the old value
    test('capture listener on the same element runs before v-model', async () => {
      const { vdom, vapor } = await seenParity(
        `<input v-model="data" @input.capture="log(data)">`,
        () => '',
        root => typeText(root, 'vue'),
      )
      expect(vdom).toEqual([''])
      expect(vapor).toEqual(vdom)
    })
  })

  describe('checkbox with a changing value', () => {
    test.each(['Array', 'Set'])('%s model', async modelType => {
      const checked = {} as Record<'vdom' | 'vapor', boolean[]>
      const selected = {} as Record<'vdom' | 'vapor', number[]>
      await renderParity(
        {
          App: `<template><input type="checkbox" v-model="data.selected" :value="data.value"></template>`,
        },
        () =>
          ref({
            value: 1,
            selected: modelType === 'Array' ? [1] : new Set([1]),
          }),
        async (data, root, mode) => {
          const input = root.querySelector('input')!
          const states = (checked[mode] = [input.checked])
          data.value.value = 2
          await nextTick()
          states.push(input.checked)
          await new Promise(r => setTimeout(r, 5))
          input.checked = true
          triggerEvent('change', input)
          await nextTick()
          states.push(input.checked)
          selected[mode] = Array.from(data.value.selected)
          data.value.value = 3
          await nextTick()
          states.push(input.checked)
          data.value.value = 1
          await nextTick()
          states.push(input.checked)
        },
      )
      expect(checked.vdom).toEqual([true, false, true, false, true])
      expect(selected.vdom).toEqual([1, 2])
      expect(checked.vapor).toEqual(checked.vdom)
      expect(selected.vapor).toEqual(selected.vdom)
    })

    test('updates checked before post watchers', async () => {
      const seen = {} as Record<'vdom' | 'vapor', boolean[]>
      await renderParity(
        {
          App: `<script setup>
            import { ref, watch } from 'vue'
            const data = _data
            const input = ref()
            watch(
              () => data.value.value,
              () => data.value.observed.push(input.value.checked),
              { flush: 'post' },
            )
          </script>
          <template><input ref="input" type="checkbox" v-model="data.selected" :value="data.value"></template>`,
        },
        () => ref({ value: 1, selected: [1], observed: [] as boolean[] }),
        async (data, _root, mode) => {
          await nextTick()
          data.value.value = 2
          await nextTick()
          seen[mode] = data.value.observed.slice()
        },
      )
      expect(seen.vdom).toEqual([false])
      expect(seen.vapor).toEqual(seen.vdom)
    })

    test('tracks fields of a replacement object value', async () => {
      const checked = {} as Record<'vdom' | 'vapor', boolean[]>
      await renderParity(
        {
          App: `<template><input type="checkbox" v-model="data.selected" :value="data.option" :title="data.option.id"></template>`,
        },
        () => ref({ option: { id: 0 }, selected: [{ id: 1 }] }),
        async (data, root, mode) => {
          const input = root.querySelector('input')!
          const states = (checked[mode] = [input.checked])
          data.value.option = { id: 1 }
          await nextTick()
          states.push(input.checked)
          data.value.option.id = 2
          await nextTick()
          states.push(input.checked)
        },
      )
      expect(checked.vdom).toEqual([false, true, false])
      expect(checked.vapor).toEqual(checked.vdom)
    })

    test('matches Set values without DOM string coercion', async () => {
      await renderParity(
        {
          App: `<template><input type="checkbox" v-model="data.selected" :value="data.option"></template>`,
        },
        () => ref({ selected: new Set([1]), option: 1 as number | string }),
        async (data, root) => {
          const input = root.querySelector('input')!
          expect(input.checked).toBe(true)
          data.value.option = '1'
          await nextTick()
          expect(input.value).toBe('1')
          expect(input.checked).toBe(false)
          data.value.option = 1
          await nextTick()
          expect(input.value).toBe('1')
          expect(input.checked).toBe(true)
        },
      )
    })
  })

  test.each(['text', 'checkbox', 'radio', 'select'])(
    'stops %s model effects when their conditional branch is removed',
    async type => {
      const makeForm = () => ({ selected: type === 'checkbox' ? [1] : 1 })
      const element =
        type === 'select'
          ? `<select v-if="data.form" v-model="data.form.selected"><option :value="1">one</option></select>`
          : `<input v-if="data.form" type="${type}" v-model="data.form.selected"${type === 'text' ? '' : ' :value="1"'}>`
      await renderParity(
        { App: `<template><div>${element}</div></template>` },
        () => ref({ form: makeForm() }),
        async (data, root) => {
          await nextTick()
          for (let i = 0; i < 2; i++) {
            expect(root.querySelector('input, select')).not.toBe(null)
            data.value.form = null
            await nextTick()
            expect(root.querySelector('input, select')).toBe(null)
            data.value.form = makeForm()
            await nextTick()
          }
        },
      )
    },
  )

  test('skips model initialization when its scope is disposed before mount', () => {
    const get = vi.fn(() => 'foo')
    const { host } = define(() => {
      const input = template('<input>')() as HTMLInputElement
      const scope = effectScope()
      scope.run(() => applyTextModel(input, get, () => {}))
      scope.stop()
      return input
    }).render()
    expect(get).not.toHaveBeenCalled()
    expect(host.querySelector('input')!.value).toBe('')
  })

  // #10598
  test('checkbox array with symbol values', async () => {
    const a = Symbol('a')
    const b = Symbol('b')
    await renderParity(
      {
        App: `<template><input v-for="v in data.values" type="checkbox" v-model="data.model" :value="v"></template>`,
      },
      () => ref({ values: [a, b], model: [] as symbol[] }),
      async (data, root) => {
        const input = root.querySelectorAll('input')[1]
        expect(input.value).toBe(b.toString())
        input.checked = true
        triggerEvent('change', input)
        await nextTick()
        expect(data.value.model).toEqual([b])
      },
    )
  })
})
