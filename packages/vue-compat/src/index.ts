import {
  h,
  render,
  nextTick,
  createComponentInstance,
  createComponentClassFromOptions
} from '@vue/runtime-dom'

// Note: typing for this is intentionally loose, as it will be using 2.x types.

class Vue {
  static h: any = h
  static render: any = render
  static nextTick: any = nextTick

  constructor(options: any) {
    // convert it to a class
    const Component = createComponentClassFromOptions(options || {})
    const vnode = h(Component)
    const instance = (vnode.children = createComponentInstance(vnode))

    function mount(el: any) {
      const dom = typeof el === 'string' ? document.querySelector(el) : el
      render(vnode, dom)
      return instance.$proxy
    }

    if (options.el) {
      return mount(options.el) as any
    } else {
      ;(instance as any).$mount = mount
      return instance.$proxy as any
    }
  }
}

interface Vue {
  $mount(el: any): any
}

export default Vue
