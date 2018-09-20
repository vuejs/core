import { h, render, ComponentOptions } from '@vue/renderer-dom'

function Vue(options: ComponentOptions & { el: any }) {
  const { el, render: r } = options

  if (r) {
    options.render = function(props, slots) {
      return r.call(this, h, props, slots)
    }
  }

  function mount(el: any) {
    const dom = document.querySelector(el)
    render(h(options), dom)
    return (dom as any).vnode.children.$proxy
  }

  if (el) {
    return mount(el)
  } else {
    return {
      $mount: mount
    }
  }
}

export default Vue
