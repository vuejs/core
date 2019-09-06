import { ComponentInstance } from './component'
import { nextTick } from './scheduler'
import { instanceWatch } from './apiWatch'
import { EMPTY_OBJ } from '@vue/shared'

export const RenderProxyHandlers = {
  get(target: ComponentInstance, key: string) {
    const { renderContext, data, props, propsProxy } = target
    if (data !== EMPTY_OBJ && data.hasOwnProperty(key)) {
      return data[key]
    } else if (renderContext.hasOwnProperty(key)) {
      return renderContext[key]
    } else if (props.hasOwnProperty(key)) {
      // return the value from propsProxy for ref unwrapping and readonly
      return (propsProxy as any)[key]
    } else {
      switch (key) {
        case '$data':
          return data
        case '$props':
          return propsProxy
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
        case '$el':
          return target.vnode.el
        case '$options':
          return target.type
        default:
          // methods are only exposed when options are supported
          if (__FEATURE_OPTIONS__) {
            switch (key) {
              case '$forceUpdate':
                return target.update
              case '$nextTick':
                return nextTick
              case '$watch':
                return instanceWatch.bind(target)
            }
          }
          return target.user[key]
      }
    }
  },
  set(target: ComponentInstance, key: string, value: any): boolean {
    const { data, renderContext } = target
    if (data !== EMPTY_OBJ && data.hasOwnProperty(key)) {
      data[key] = value
    } else if (renderContext.hasOwnProperty(key)) {
      renderContext[key] = value
    } else if (key[0] === '$' && key.slice(1) in target) {
      // TODO warn attempt of mutating public property
      return false
    } else if (key in target.props) {
      // TODO warn attempt of mutating prop
      return false
    } else {
      target.user[key] = value
    }
    return true
  }
}
