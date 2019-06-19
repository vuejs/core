import { ComponentInstance } from './component'

export const RenderProxyHandlers = {
  get(target: ComponentInstance, key: string) {
    const { state, props } = target
    if (state.hasOwnProperty(key)) {
      return state[key]
    } else if (props.hasOwnProperty(key)) {
      return props[key]
    } else {
      switch (key) {
        case '$state':
          return target.state
        case '$props':
          return target.props
        case '$attrs':
          return target.attrs
        case '$slots':
          return target.slots
        case '$refs':
          return target.refs
        case '$parent':
          return target.parent
        case '$root':
          return target.root
        case '$el':
          return target.vnode && target.vnode.el
        case '$emit':
          return target.emit
        default:
          break
      }
    }
  },
  set(target: ComponentInstance, key: string, value: any): boolean {
    const { state } = target
    if (state.hasOwnProperty(key)) {
      state[key] = value
      return true
    } else {
      if (__DEV__) {
        if (key[0] === '$') {
          // TODO warn attempt of mutating public property
        } else if (target.props.hasOwnProperty(key)) {
          // TODO warn attempt of mutating prop
        }
      }
    }
    return false
  }
}
