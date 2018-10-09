import {
  h,
  render,
  nextTick,
  Component,
  createComponentInstance
} from '@vue/renderer-dom'

// Note: typing for this is intentionally loose, as it will be using 2.x types.
class Vue extends Component {
  static h = h
  static render = render
  static nextTick = nextTick

  constructor(options: any) {
    super()
    if (!options) {
      return
    }

    // in compat mode, h() can take an options object and will convert it
    // to a 3.x class-based component.
    const vnode = h(options)
    // the component class is cached on the options object as ._normalized
    const instance = createComponentInstance(vnode, options._normalized, null)
    // set the instance on the vnode before mounting.
    // the mount function will skip creating a new instance if it finds an
    // existing one.
    vnode.children = instance

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
export * from '@vue/renderer-dom'
