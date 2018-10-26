import { TestElement, logNodeOp, NodeOpTypes } from './nodeOps'

export function patchData(
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
}
