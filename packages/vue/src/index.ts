import {
  h,
  render,
  nextTick,
  createComponentInstance,
  createComponentClassFromOptions
} from '@vue/renderer-dom'

class Vue {
  static h = h
  static render = render
  static nextTick = nextTick

  // Note: typing for this is intentionally loose, as it will be using 2.x types.
  constructor(options: any) {
    // convert it to a class
    const Component = createComponentClassFromOptions(options || {})
    const vnode = h(Component)
    const instance = createComponentInstance(vnode, Component, null)

    function mount(el: any) {
      const dom = typeof el === 'string' ? document.querySelector(el) : el
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

interface Vue {
  $mount(el: any): any
}

export default Vue
