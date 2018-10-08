import {
  h,
  render,
  nextTick,
  Component,
  ComponentOptions,
  createComponentInstance
} from '@vue/renderer-dom'
import { MergedComponent } from '../../core/src/component'

class Vue<
  P extends object = {},
  D extends object = {},
  M extends object = {},
  C extends object = {}
> extends Component {
  static h = h
  static render = render
  static nextTick = nextTick

  constructor(options: ComponentOptions<P, D, M, C> & { el?: any }) {
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

interface Vue<P, D, M, C> {
  $mount(el: any): MergedComponent<P, D> & M & C
}

export default Vue
export * from '@vue/renderer-dom'
