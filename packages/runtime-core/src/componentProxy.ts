import { ComponentInstance } from './component'
import { isObservable, unwrap } from '@vue/observer'

// TODO use proper implementation
function isValue(binding: any) {
  return isObservable(binding) && unwrap(binding).hasOwnProperty('value')
}

export const RenderProxyHandlers = {
  get(target: ComponentInstance, key: string) {
    const { state, props } = target
    if (state.hasOwnProperty(key)) {
      const value = state[key]
      return isValue(value) ? value.value : value
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
        default:
          break
      }
    }
  },
  set(target: ComponentInstance, key: string, value: any): boolean {
    const { state } = target
    if (state.hasOwnProperty(key)) {
      const binding = state[key]
      if (isValue(binding)) {
        binding.value = value
      } else {
        state[key] = value
      }
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
