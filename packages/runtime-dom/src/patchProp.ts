import { patchClass } from './modules/class'
import { patchStyle } from './modules/style'
import { patchAttr } from './modules/attrs'
import { patchDOMProp } from './modules/props'
import { patchEvent } from './modules/events'
import { isOn } from '@vue/shared'
import {
  ComponentInternalInstance,
  SuspenseBoundary,
  VNode
} from '@vue/runtime-core'

export function patchProp(
  el: Element,
  key: string,
  nextValue: any,
  prevValue: any,
  isSVG: boolean,
  prevChildren?: VNode[],
  parentComponent?: ComponentInternalInstance,
  parentSuspense?: SuspenseBoundary<Node, Element>,
  unmountChildren?: any
) {
  switch (key) {
    // special
    case 'class':
      patchClass(el, nextValue, isSVG)
      break
    case 'style':
      patchStyle(el, prevValue, nextValue)
      break
    case 'modelValue':
    case 'onUpdate:modelValue':
      // Do nothing. This is handled by v-model directives.
      break
    default:
      if (isOn(key)) {
        patchEvent(
          el,
          key.slice(2).toLowerCase(),
          prevValue,
          nextValue,
          parentComponent
        )
      } else if (!isSVG && key in el) {
        patchDOMProp(
          el,
          key,
          nextValue,
          prevChildren,
          parentComponent,
          parentSuspense,
          unmountChildren
        )
      } else if (key === 'true-value') {
        // special case for :true-value
        // store value as _trueValue since
        // non-string values will be stringified.
        ;(el as any)._trueValue = nextValue
      } else if (key === 'false-value') {
        // special case for :false-value
        // store value as _falseValue since
        // non-string values will be stringified.
        ;(el as any)._falseValue = nextValue
      } else {
        patchAttr(el, key, nextValue)
      }
      break
  }
}
