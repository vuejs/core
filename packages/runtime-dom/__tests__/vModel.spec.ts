import {
  createApp,
  h,
  nextTick,
  createComponent,
  vModelDynamic,
  applyDirectives,
  VNode
} from '@vue/runtime-dom'

const triggerEvent = (type: string, el: Element) => {
  const event = new Event(type, { bubbles: true })
  el.dispatchEvent(event)
}

const withVModel = (node: VNode, arg: any, mods?: any) =>
  applyDirectives(node, [[vModelDynamic, arg, '', mods]])

let app: any, root: any

beforeEach(() => {
  app = createApp()
  root = document.createElement('div') as any
})

describe('vModel', () => {
  it('should work with text input', async () => {
    const component = createComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h('input', {
              'onUpdate:modelValue': (val: any) => {
                this.value = val
              }
            }),
            this.value
          )
        ]
      }
    })
    app.mount(component, root)

    const input = root.querySelector('input')
    const data = root._vnode.component.data

    input.value = 'foo'
    triggerEvent('input', input)
    await nextTick()
    expect(data.value).toEqual('foo')

    data.value = 'bar'
    await nextTick()
    expect(input.value).toEqual('bar')
  })

  it('should work with textarea', async () => {
    const component = createComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h('textarea', {
              'onUpdate:modelValue': (val: any) => {
                this.value = val
              }
            }),
            this.value
          )
        ]
      }
    })
    app.mount(component, root)

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

  it('should work with checkbox', async () => {
    const component = createComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'checkbox',
              'onUpdate:modelValue': (val: any) => {
                this.value = val
              }
            }),
            this.value
          )
        ]
      }
    })
    app.mount(component, root)

    const input = root.querySelector('input')
    const data = root._vnode.component.data

    input.checked = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual(true)

    data.value = false
    await nextTick()
    expect(input.checked).toEqual(false)
  })

  it(`should support array as a checkbox model`, async () => {
    const component = createComponent({
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
              'onUpdate:modelValue': () => {
                this.value.push('foo' as never)
              }
            }),
            this.value
          ),
          withVModel(
            h('input', {
              type: 'checkbox',
              class: 'bar',
              value: 'bar',
              'onUpdate:modelValue': () => {
                this.value.push('bar' as never)
              }
            }),
            this.value
          )
        ]
      }
    })
    app.mount(component, root)

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

  it('should work with radio', async () => {
    const component = createComponent({
      data() {
        return { value: null }
      },
      render() {
        return [
          withVModel(
            h('input', {
              type: 'radio',
              value: 'foo',
              'onUpdate:modelValue': (val: any) => {
                this.value = val
              }
            }),
            this.value
          )
        ]
      }
    })
    app.mount(component, root)

    const input = root.querySelector('input')
    const data = root._vnode.component.data

    input.checked = true
    triggerEvent('change', input)
    await nextTick()
    expect(data.value).toEqual('foo')

    data.value = false
    await nextTick()
    expect(input.checked).toEqual(false)
  })
})
