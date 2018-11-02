import { VNode } from '@vue/runtime-core'
import { patchClass } from './modules/class'
import { patchStyle } from './modules/style'
import { patchAttr } from './modules/attrs'
import { patchDOMProp } from './modules/props'
import { patchEvent } from './modules/events'
import { isOn } from '@vue/shared'

// value, checked, selected & muted
// plus anything with upperCase letter in it are always patched as properties
const domPropsRE = /\W|^(?:value|checked|selected|muted)$/
const domPropsReplaceRE = /^domProps/

export function patchData(
  el: Element,
  key: string,
  prevValue: any,
  nextValue: any,
  prevVNode: VNode,
  nextVNode: VNode,
  isSVG: boolean,
  unmountChildren: any
) {
  switch (key) {
    // special
    case 'class':
      patchClass(el, nextValue, isSVG)
      break
    case 'style':
      patchStyle(el, prevValue, nextValue, nextVNode.data)
      break
    default:
      if (isOn(key)) {
        patchEvent(el, key.slice(2).toLowerCase(), prevValue, nextValue)
      } else if (domPropsRE.test(key)) {
        patchDOMProp(
          el,
          key.replace(domPropsReplaceRE, '').toLowerCase(),
          nextValue,
          prevVNode,
          unmountChildren
        )
      } else {
        patchAttr(el, key, nextValue, isSVG)
      }
      break
  }
}
