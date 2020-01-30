import { DirectiveBinding, VNode, FunctionDirective } from 'vue'

export const vShow: FunctionDirective = (
  el,
  dir: DirectiveBinding,
  vnode: VNode
) => {
  if (!dir.value) {
    let { props } = vnode
    if (props === null) {
      vnode.props = props = {}
    }
    const style = props.style || (props.style = {})
    if (Array.isArray(style)) {
      style.push({ display: 'none' })
    } else {
      style.display = 'none'
    }
  }
}
