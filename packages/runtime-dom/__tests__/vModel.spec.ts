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

const withVModel = (node: VNode) => applyDirectives(node, [[vModelDynamic]])

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
              vModel: this.value,
              'onUpdate:modelValue': (val: any) => {
                this.value = val
              }
            })
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
              vModel: this.value,
              'onUpdate:modelValue': (val: any) => {
                this.value = val
              }
            })
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
              vModel: this.value,
              'onUpdate:modelValue': (val: any) => {
                this.value = val
              }
            })
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
              vModel: this.value,
              'onUpdate:modelValue': (val: any) => {
                this.value = val
              }
            })
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
})
