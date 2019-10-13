import { isArray, isPlainObject, objectToString } from '@vue/shared'
import { VNode, isVNode } from '../vnode'

// for converting {{ interpolation }} values to displayed strings.
export function toString(val: any): string | VNode {
  return val == null
    ? ''
    : isArray(val) || (isPlainObject(val) && val.toString === objectToString)
      ? isVNode(val)
        ? val
        : JSON.stringify(val, null, 2)
      : String(val)
}
