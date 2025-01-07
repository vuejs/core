import {
  type VNode,
  defineComponent,
  h,
  nextTick,
  ref,
  render,
  vModelDynamic,
  withDirectives,
} from '@vue/runtime-dom'

const triggerEvent = (type: string, el: Element) => {
  const event = new Event(type)
  el.dispatchEvent(event)
}

const withVModel = (node: VNode, arg: any, mods?: any) =>
  withDirectives(node, [[vModelDynamic, arg, '', mods]])

const setValue = function (this: any, value: any) {
  this.value = value
}

let root: any

beforeEach(() => {
  root = document.createElement('div') as any
})

describe('vModel', () => {
  it('should work with text input', async () => {
    const manualListener = vi.fn()
    const component = defineComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h('input', {
              'onUpdate:modelValue': setValue.bind(this),
              onInput: () => {
                manualListener(data.value)
              },
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('input')!
    const data = root._vnode.component.data
    expect(input.value).toEqual('')

    input.value = 'foo'
    triggerEvent('input', input)
    await nextTick()
    expect(data.value).toEqual('foo')
    // #1931
    expect(manualListener).toHaveBeenCalledWith('foo')

    data.value = 'bar'
    await nextTick()
    expect(input.value).toEqual('bar')

    data.value = undefined
    await nextTick()
    expect(input.value).toEqual('')
  })

  it('should work with number input', async () => {
    const component = defineComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'number',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('input')!
    const data = root._vnode.component.data
    expect(input.value).toEqual('')
    expect(input.type).toEqual('number')

    input.value = 1
    triggerEvent('input', input)
    await nextTick()
    expect(typeof data.value).toEqual('number')
    expect(data.value).toEqual(1)
  })

  // #7003
  it('should work with number input and be able to update rendering correctly', async () => {
    const setValue1 = function (this: any, value: any) {
      this.value1 = value
    }
    const setValue2 = function (this: any, value: any) {
      this.value2 = value
    }
    const component = defineComponent({
      data() {
        return { value1: 1.002, value2: 1.002 }
      },
      render() {
        return [
          withVModel(
            h('input', {
              id: 'input_num1',
              type: 'number',
              'onUpdate:modelValue': setValue1.bind(this),
            }),
            this.value1,
          ),
          withVModel(
            h('input', {
              id: 'input_num2',
              type: 'number',
              'onUpdate:modelValue': setValue2.bind(this),
            }),
            this.value2,
          ),
        ]
      },
    })
    render(h(component), root)
    const data = root._vnode.component.data

    const inputNum1 = root.querySelector('#input_num1')!
    expect(inputNum1.value).toBe('1.002')

    const inputNum2 = root.querySelector('#input_num2')!
    expect(inputNum2.value).toBe('1.002')

    inputNum1.value = '1.00'
    triggerEvent('input', inputNum1)
    await nextTick()
    expect(data.value1).toBe(1)

    inputNum2.value = '1.00'
    triggerEvent('input', inputNum2)
    await nextTick()
    expect(data.value2).toBe(1)

    expect(inputNum1.value).toBe('1.00')
  })

  it('should work with multiple listeners', async () => {
    const spy = vi.fn()
    const component = defineComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h('input', {
              'onUpdate:modelValue': [setValue.bind(this), spy],
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('input')!
    const data = root._vnode.component.data

    input.value = 'foo'
    triggerEvent('input', input)
    await nextTick()
    expect(data.value).toEqual('foo')
    expect(spy).toHaveBeenCalledWith('foo')
  })

  it('should work with updated listeners', async () => {
    const spy1 = vi.fn()
    const spy2 = vi.fn()
    const toggle = ref(true)

    const component = defineComponent({
      render() {
        return [
          withVModel(
            h('input', {
              'onUpdate:modelValue': toggle.value ? spy1 : spy2,
            }),
            'foo',
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('input')!

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

  it('should work with textarea', async () => {
    const component = defineComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h('textarea', {
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('textarea')
    const data = root._vnode.component.data

    input.value = 'foo'
    triggerEvent('input', input)
    await nextTick()
    expect(data.value).toEqual('foo')

    data.value = 'bar'
    await nextTick()
    expect(input.value).toEqual('bar')
  })

  it('should support modifiers', async () => {
    const component = defineComponent({
      data() {
        return {
          number: null,
          trim: null,
          lazy: null,
          trimNumber: null,
          trimLazy: null,
        }
      },
      render() {
        return [
          withVModel(
            h('input', {
              class: 'number',
              'onUpdate:modelValue': (val: any) => {
                this.number = val
              },
            }),
            this.number,
            {
              number: true,
            },
          ),
          withVModel(
            h('input', {
              class: 'trim',
              'onUpdate:modelValue': (val: any) => {
                this.trim = val
              },
            }),
            this.trim,
            {
              trim: true,
            },
          ),
          withVModel(
            h('input', {
              class: 'trim-lazy',
              'onUpdate:modelValue': (val: any) => {
                this.trimLazy = val
              },
            }),
            this.trim,
            {
              trim: true,
              lazy: true,
            },
          ),
          withVModel(
            h('input', {
              class: 'trim-number',
              'onUpdate:modelValue': (val: any) => {
                this.trimNumber = val
              },
            }),
            this.trimNumber,
            {
              trim: true,
              number: true,
            },
          ),
          withVModel(
            h('input', {
              class: 'lazy',
              'onUpdate:modelValue': (val: any) => {
                this.lazy = val
              },
            }),
            this.lazy,
            {
              lazy: true,
            },
          ),
        ]
      },
    })
    render(h(component), root)

    const number = root.querySelector('.number')
    const trim = root.querySelector('.trim')
    const trimNumber = root.querySelector('.trim-number')
    const trimLazy = root.querySelector('.trim-lazy')
    const lazy = root.querySelector('.lazy')
    const data = root._vnode.component.data

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

    trimLazy.value = '   ddd    '
    triggerEvent('change', trimLazy)
    await nextTick()
    expect(data.trimLazy).toEqual('ddd')

    lazy.value = 'foo'
    triggerEvent('change', lazy)
    await nextTick()
    expect(data.lazy).toEqual('foo')
  })

  it('should work with range', async () => {
    const component = defineComponent({
      data() {
        return { value: 25 }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'range',
              min: 1,
              max: 100,
              class: 'foo',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
            {
              number: true,
            },
          ),
          withVModel(
            h('input', {
              type: 'range',
              min: 1,
              max: 100,
              class: 'bar',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
            {
              lazy: true,
            },
          ),
        ]
      },
    })
    render(h(component), root)

    const foo = root.querySelector('.foo')
    const bar = root.querySelector('.bar')
    const data = root._vnode.component.data

    foo.value = 20
    triggerEvent('input', foo)
    await nextTick()
    expect(data.value).toEqual(20)

    foo.value = 200
    triggerEvent('input', foo)
    await nextTick()
    expect(data.value).toEqual(100)

    foo.value = -1
    triggerEvent('input', foo)
    await nextTick()
    expect(data.value).toEqual(1)

    bar.value = 30
    triggerEvent('change', bar)
    await nextTick()
    expect(data.value).toEqual('30')

    bar.value = 200
    triggerEvent('change', bar)
    await nextTick()
    expect(data.value).toEqual('100')

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

  it('should work with checkbox', async () => {
    const component = defineComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'checkbox',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('input')
    const data = root._vnode.component.data

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

  it('should work with checkbox and true-value/false-value', async () => {
    const component = defineComponent({
      data() {
        return { value: 'yes' }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'checkbox',
              'true-value': 'yes',
              'false-value': 'no',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('input')
    const data = root._vnode.component.data

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

  it('should work with checkbox and true-value/false-value with object values', async () => {
    const component = defineComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'checkbox',
              'true-value': { yes: 'yes' },
              'false-value': { no: 'no' },
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('input')
    const data = root._vnode.component.data

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

  it(`should support array as a checkbox model`, async () => {
    const component = defineComponent({
      data() {
        return { value: [] }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'checkbox',
              class: 'foo',
              value: 'foo',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
          withVModel(
            h('input', {
              type: 'checkbox',
              class: 'bar',
              value: 'bar',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const foo = root.querySelector('.foo')
    const bar = root.querySelector('.bar')
    const data = root._vnode.component.data

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

  it(`should support Set as a checkbox model`, async () => {
    const component = defineComponent({
      data() {
        return { value: new Set() }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'checkbox',
              class: 'foo',
              value: 'foo',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
          withVModel(
            h('input', {
              type: 'checkbox',
              class: 'bar',
              value: 'bar',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const foo = root.querySelector('.foo')
    const bar = root.querySelector('.bar')
    const data = root._vnode.component.data

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

  it('should not update DOM unnecessarily', async () => {
    const component = defineComponent({
      data() {
        return { value: true }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'checkbox',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('input')
    const data = root._vnode.component.data

    const setCheckedSpy = vi.spyOn(input, 'checked', 'set')

    // Trigger a change event without actually changing the value
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual(true)
    expect(setCheckedSpy).not.toHaveBeenCalled()

    // Change the value and trigger a change event
    input.checked = false
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual(false)
    expect(setCheckedSpy).toHaveBeenCalledTimes(1)

    setCheckedSpy.mockClear()

    data.value = false
    await nextTick()
    expect(input.checked).toEqual(false)
    expect(setCheckedSpy).not.toHaveBeenCalled()

    data.value = true
    await nextTick()
    expect(input.checked).toEqual(true)
    expect(setCheckedSpy).toHaveBeenCalledTimes(1)
  })

  it('should handle array values correctly without unnecessary updates', async () => {
    const component = defineComponent({
      data() {
        return { value: ['foo'] }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'checkbox',
              value: 'foo',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
          withVModel(
            h('input', {
              type: 'checkbox',
              value: 'bar',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const [foo, bar] = root.querySelectorAll('input')
    const data = root._vnode.component.data

    const setCheckedSpyFoo = vi.spyOn(foo, 'checked', 'set')
    const setCheckedSpyBar = vi.spyOn(bar, 'checked', 'set')

    expect(foo.checked).toEqual(true)
    expect(bar.checked).toEqual(false)

    triggerEvent('change', foo)
    await nextTick()
    expect(data.value).toEqual(['foo'])
    expect(setCheckedSpyFoo).not.toHaveBeenCalled()

    bar.checked = true
    triggerEvent('change', bar)
    await nextTick()
    expect(data.value).toEqual(['foo', 'bar'])
    expect(setCheckedSpyBar).toHaveBeenCalledTimes(1)

    setCheckedSpyFoo.mockClear()
    setCheckedSpyBar.mockClear()

    data.value = ['foo', 'bar']
    await nextTick()
    expect(setCheckedSpyFoo).not.toHaveBeenCalled()
    expect(setCheckedSpyBar).not.toHaveBeenCalled()

    data.value = ['bar']
    await nextTick()
    expect(setCheckedSpyFoo).toHaveBeenCalledTimes(1)
    expect(setCheckedSpyBar).not.toHaveBeenCalled()
    expect(foo.checked).toEqual(false)
    expect(bar.checked).toEqual(true)
  })

  it('should work with radio', async () => {
    const component = defineComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'radio',
              class: 'foo',
              value: 'foo',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
          withVModel(
            h('input', {
              type: 'radio',
              class: 'bar',
              value: 'bar',
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const foo = root.querySelector('.foo')
    const bar = root.querySelector('.bar')
    const data = root._vnode.component.data

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

  it('should work with single select', async () => {
    const component = defineComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h(
              'select',
              {
                value: null,
                'onUpdate:modelValue': setValue.bind(this),
              },
              [h('option', { value: 'foo' }), h('option', { value: 'bar' })],
            ),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('select')
    const foo = root.querySelector('option[value=foo]')
    const bar = root.querySelector('option[value=bar]')
    const data = root._vnode.component.data

    foo.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual('foo')

    foo.selected = false
    bar.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual('bar')

    foo.selected = false
    bar.selected = false
    data.value = 'foo'
    await nextTick()
    expect(input.value).toEqual('foo')
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(false)

    foo.selected = true
    bar.selected = false
    data.value = 'bar'
    await nextTick()
    expect(input.value).toEqual('bar')
    expect(foo.selected).toEqual(false)
    expect(bar.selected).toEqual(true)
  })

  it('multiple select (model is Array)', async () => {
    const component = defineComponent({
      data() {
        return { value: [] }
      },
      render() {
        return [
          withVModel(
            h(
              'select',
              {
                value: null,
                multiple: true,
                'onUpdate:modelValue': setValue.bind(this),
              },
              [h('option', { value: 'foo' }), h('option', { value: 'bar' })],
            ),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('select')
    const foo = root.querySelector('option[value=foo]')
    const bar = root.querySelector('option[value=bar]')
    const data = root._vnode.component.data

    foo.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject(['foo'])

    foo.selected = false
    bar.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject(['bar'])

    foo.selected = true
    bar.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject(['foo', 'bar'])

    foo.selected = false
    bar.selected = false
    data.value = ['foo']
    await nextTick()
    expect(input.value).toEqual('foo')
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(false)

    foo.selected = false
    bar.selected = false
    data.value = ['foo', 'bar']
    await nextTick()
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(true)
  })

  it('v-model.number should work with select tag', async () => {
    const component = defineComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h(
              'select',
              {
                value: null,
                'onUpdate:modelValue': setValue.bind(this),
              },
              [h('option', { value: '1' }), h('option', { value: '2' })],
            ),
            this.value,
            {
              number: true,
            },
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('select')
    const one = root.querySelector('option[value="1"]')
    const data = root._vnode.component.data

    one.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(typeof data.value).toEqual('number')
    expect(data.value).toEqual(1)
  })

  it('v-model.number should work with multiple select', async () => {
    const component = defineComponent({
      data() {
        return { value: [] }
      },
      render() {
        return [
          withVModel(
            h(
              'select',
              {
                value: null,
                multiple: true,
                'onUpdate:modelValue': setValue.bind(this),
              },
              [h('option', { value: '1' }), h('option', { value: '2' })],
            ),
            this.value,
            {
              number: true,
            },
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('select')
    const one = root.querySelector('option[value="1"]')
    const two = root.querySelector('option[value="2"]')
    const data = root._vnode.component.data

    one.selected = true
    two.selected = false
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject([1])

    one.selected = false
    two.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject([2])

    one.selected = true
    two.selected = true
    triggerEvent('change', input)
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

  it('multiple select (model is Array, option value is object)', async () => {
    const fooValue = { foo: 1 }
    const barValue = { bar: 1 }

    const component = defineComponent({
      data() {
        return { value: [] }
      },
      render() {
        return [
          withVModel(
            h(
              'select',
              {
                value: null,
                multiple: true,
                'onUpdate:modelValue': setValue.bind(this),
              },
              [
                h('option', { value: fooValue }),
                h('option', { value: barValue }),
              ],
            ),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    await nextTick()

    const input = root.querySelector('select')
    const [foo, bar] = root.querySelectorAll('option')
    const data = root._vnode.component.data

    foo.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject([fooValue])

    foo.selected = false
    bar.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject([barValue])

    foo.selected = true
    bar.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject([fooValue, barValue])

    // reset
    foo.selected = false
    bar.selected = false
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject([])

    data.value = [fooValue, barValue]
    await nextTick()
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(true)

    // reset
    foo.selected = false
    bar.selected = false
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject([])

    data.value = [{ foo: 1 }, { bar: 1 }]
    await nextTick()
    // looseEqual
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(true)
  })

  it('multiple select (model is Set)', async () => {
    const component = defineComponent({
      data() {
        return { value: new Set() }
      },
      render() {
        return [
          withVModel(
            h(
              'select',
              {
                value: null,
                multiple: true,
                'onUpdate:modelValue': setValue.bind(this),
              },
              [h('option', { value: 'foo' }), h('option', { value: 'bar' })],
            ),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('select')
    const foo = root.querySelector('option[value=foo]')
    const bar = root.querySelector('option[value=bar]')
    const data = root._vnode.component.data

    foo.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toBeInstanceOf(Set)
    expect(data.value).toMatchObject(new Set(['foo']))

    foo.selected = false
    bar.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toBeInstanceOf(Set)
    expect(data.value).toMatchObject(new Set(['bar']))

    foo.selected = true
    bar.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toBeInstanceOf(Set)
    expect(data.value).toMatchObject(new Set(['foo', 'bar']))

    foo.selected = false
    bar.selected = false
    data.value = new Set(['foo'])
    await nextTick()
    expect(input.value).toEqual('foo')
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(false)

    foo.selected = false
    bar.selected = false
    data.value = new Set(['foo', 'bar'])
    await nextTick()
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(true)
  })

  it('multiple select (model is Set, option value is object)', async () => {
    const fooValue = { foo: 1 }
    const barValue = { bar: 1 }

    const component = defineComponent({
      data() {
        return { value: new Set() }
      },
      render() {
        return [
          withVModel(
            h(
              'select',
              {
                value: null,
                multiple: true,
                'onUpdate:modelValue': setValue.bind(this),
              },
              [
                h('option', { value: fooValue }),
                h('option', { value: barValue }),
              ],
            ),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    await nextTick()

    const input = root.querySelector('select')
    const [foo, bar] = root.querySelectorAll('option')
    const data = root._vnode.component.data

    foo.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject(new Set([fooValue]))

    foo.selected = false
    bar.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject(new Set([barValue]))

    foo.selected = true
    bar.selected = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toMatchObject(new Set([fooValue, barValue]))

    foo.selected = false
    bar.selected = false
    data.value = new Set([fooValue, barValue])
    await nextTick()
    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(true)

    foo.selected = false
    bar.selected = false
    data.value = new Set([{ foo: 1 }, { bar: 1 }])
    await nextTick()
    // without looseEqual, here is different from Array
    expect(foo.selected).toEqual(false)
    expect(bar.selected).toEqual(false)
  })

  it('should work with composition session', async () => {
    const component = defineComponent({
      data() {
        return { value: '' }
      },
      render() {
        return [
          withVModel(
            h('input', {
              'onUpdate:modelValue': setValue.bind(this),
            }),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    const input = root.querySelector('input')!
    const data = root._vnode.component.data
    expect(input.value).toEqual('')

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

  it('multiple select (model is number, option value is string)', async () => {
    const component = defineComponent({
      data() {
        return {
          value: [1, 2],
        }
      },
      render() {
        return [
          withVModel(
            h(
              'select',
              {
                multiple: true,
                'onUpdate:modelValue': setValue.bind(this),
              },
              [h('option', { value: '1' }), h('option', { value: '2' })],
            ),
            this.value,
          ),
        ]
      },
    })
    render(h(component), root)

    await nextTick()
    const [foo, bar] = root.querySelectorAll('option')

    expect(foo.selected).toEqual(true)
    expect(bar.selected).toEqual(true)
  })

  // #10503
  test('equal value with a leading 0 should trigger update.', async () => {
    const setNum = function (this: any, value: any) {
      this.num = value
    }
    const component = defineComponent({
      data() {
        return { num: 0 }
      },
      render() {
        return [
          withVModel(
            h('input', {
              id: 'input_num1',
              type: 'number',
              'onUpdate:modelValue': setNum.bind(this),
            }),
            this.num,
          ),
        ]
      },
    })

    render(h(component), root)
    const data = root._vnode.component.data

    const inputNum1 = root.querySelector('#input_num1')!
    expect(inputNum1.value).toBe('0')

    inputNum1.value = '01'
    triggerEvent('input', inputNum1)
    await nextTick()
    expect(data.num).toBe(1)

    expect(inputNum1.value).toBe('1')
  })
})
