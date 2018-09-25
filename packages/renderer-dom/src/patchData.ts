import { VNode } from '@vue/core'
import { patchClass } from './modules/class'
import { patchStyle } from './modules/style'
import { patchAttr } from './modules/attrs'
import { patchDOMProp } from './modules/props'
import { patchEvent } from './modules/events'

export const onRE = /^on/
const domPropsRE = /^domProps/

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
      if (onRE.test(key)) {
        patchEvent(el, key.toLowerCase().slice(2), prevValue, nextValue)
      } else if (domPropsRE.test(key)) {
        patchDOMProp(
          el,
          key[8].toLowerCase() + key.slice(9),
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
