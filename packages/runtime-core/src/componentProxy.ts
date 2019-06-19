import { ComponentInstance } from './component'

export const RenderProxyHandlers = {
  get(target: ComponentInstance, key: string) {
    const { data, props } = target
    if (data.hasOwnProperty(key)) {
      return data[key]
    } else if (props.hasOwnProperty(key)) {
      return props[key]
    } else {
      switch (key) {
        case '$data':
          return data
        case '$props':
          return props
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
        case '$emit':
          return target.emit
        default:
          break
      }
    }
  },
  set(target: ComponentInstance, key: string, value: any): boolean {
    const { data } = target
    if (data.hasOwnProperty(key)) {
      data[key] = value
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
