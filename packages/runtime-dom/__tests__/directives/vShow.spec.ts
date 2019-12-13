import {
  withDirectives,
  createComponent,
  h,
  nextTick,
  VNode
} from '@vue/runtime-core'
import { createApp, vShow } from '@vue/runtime-dom'

const withVShow = (node: VNode, exp: any) =>
  withDirectives(node, [[vShow, exp]])

let app: any, root: any

beforeEach(() => {
  app = createApp()
  root = document.createElement('div') as any
})

describe('runtime-dom: v-show directive', () => {
  test('should check show value is truthy', async () => {
    const component = createComponent({
      data() {
        return { value: true }
      },
      render() {
        return [withVShow(h('div'), this.value)]
      }
    })
    app.mount(component, root)

    const $div = root.querySelector('div')

    expect($div.style.display).toEqual('')
  })

  test('should check show value is falsy', async () => {
    const component = createComponent({
      data() {
        return { value: false }
      },
      render() {
        return [withVShow(h('div'), this.value)]
      }
    })
    app.mount(component, root)

    const $div = root.querySelector('div')

    expect($div.style.display).toEqual('none')
  })

  it('should update show value changed', async () => {
    const component = createComponent({
      data() {
        return { value: true }
      },
      render() {
        return [withVShow(h('div'), this.value)]
      }
    })
    app.mount(component, root)

    const $div = root.querySelector('div')
    const data = root._vnode.component.data

    expect($div.style.display).toEqual('')

    data.value = false
    await nextTick()
    expect($div.style.display).toEqual('none')

    data.value = {}
    await nextTick()
    expect($div.style.display).toEqual('')

    data.value = 0
    await nextTick()
    expect($div.style.display).toEqual('none')

    data.value = []
    await nextTick()
    expect($div.style.display).toEqual('')

    data.value = null
    await nextTick()
    expect($div.style.display).toEqual('none')

    data.value = '0'
    await nextTick()
    expect($div.style.display).toEqual('')

    data.value = undefined
    await nextTick()
    expect($div.style.display).toEqual('none')

    data.value = 1
    await nextTick()
    expect($div.style.display).toEqual('')
  })

  test('should respect display value in style attribute', async () => {
    const component = createComponent({
      data() {
        return { value: true }
      },
      render() {
        return [
          withVShow(h('div', { style: { display: 'block' } }), this.value)
        ]
      }
    })
    app.mount(component, root)

    const $div = root.querySelector('div')
    const data = root._vnode.component.data

    expect($div.style.display).toEqual('block')

    data.value = false
    await nextTick()
    expect($div.style.display).toEqual('none')

    data.value = true
    await nextTick()
    expect($div.style.display).toEqual('block')
  })
})
