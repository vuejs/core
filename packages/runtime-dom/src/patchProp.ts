import { patchClass } from './modules/class'
import { patchStyle } from './modules/style'
import { patchAttr } from './modules/attrs'
import { patchDOMProp } from './modules/props'
import { patchEvent } from './modules/events'
import { isOn, isString, isFunction } from '@vue/shared'
import { RendererOptions } from '@vue/runtime-core'

const nativeOnRE = /^on[a-z]/

export const patchProp: RendererOptions<Node, Element>['patchProp'] = (
  el,
  key,
  prevValue,
  nextValue,
  isSVG = false,
  prevChildren,
  parentComponent,
  parentSuspense,
  unmountChildren
) => {
  switch (key) {
    // special
    case 'class':
      patchClass(el, nextValue, isSVG)
      break
    case 'style':
      patchStyle(el, prevValue, nextValue)
      break
    default:
      if (isOn(key)) {
        // ignore v-model listeners
        if (!key.startsWith('onUpdate:')) {
          patchEvent(el, key, prevValue, nextValue, parentComponent)
        }
      } else if (
        isSVG
          ? // most keys must be set as attribute on svg elements to work
            // ...except innerHTML
            key === 'innerHTML' ||
            // or native onclick with function values
            (key in el && nativeOnRE.test(key) && isFunction(nextValue))
          : // for normal html elements, set as a property if it exists
            key in el &&
            // except native onclick with string values
            !(nativeOnRE.test(key) && isString(nextValue))
      ) {
        patchDOMProp(
          el,
          key,
          nextValue,
          prevChildren,
          parentComponent,
          parentSuspense,
          unmountChildren
        )
      } else {
        // special case for <input v-model type="checkbox"> with
        // :true-value & :false-value
        // store value as dom properties since non-string values will be
        // stringified.
        if (key === 'true-value') {
          ;(el as any)._trueValue = nextValue
        } else if (key === 'false-value') {
          ;(el as any)._falseValue = nextValue
        }
        patchAttr(el, key, nextValue, isSVG)
      }
      break
  }
}
