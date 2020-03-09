import { TestElement, logNodeOp, NodeOpTypes } from './nodeOps'
import { isOn } from '@vue/shared'

export function patchProp(
  el: TestElement,
  key: string,
  prevValue: any,
  nextValue: any
) {
  logNodeOp({
    type: NodeOpTypes.PATCH,
    targetNode: el,
    propKey: key,
    propPrevValue: prevValue,
    propNextValue: nextValue
  })
  el.props[key] = nextValue
  if (isOn(key)) {
    const event = key.slice(2).toLowerCase()
    ;(el.eventListeners || (el.eventListeners = {}))[event] = nextValue
  }
}
