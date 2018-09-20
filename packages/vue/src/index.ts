import {
  h,
  render,
  Component,
  ComponentOptions,
  createComponentInstance
} from '@vue/renderer-dom'

class Vue extends Component {
  static h = h
  static render = render

  constructor(options: ComponentOptions & { el: any }) {
    super()
    if (!options) {
      return
    }

    const vnode = h(options)
    const instance = createComponentInstance(vnode, options._normalized, null)
    vnode.children = instance

    function mount(el: any) {
      const dom = document.querySelector(el)
      render(vnode, dom)
      return instance.$proxy
    }

    if (options.el) {
      return mount(options.el)
    } else {
      ;(instance as any).$mount = mount
      return instance.$proxy
    }
  }
}

export default Vue
