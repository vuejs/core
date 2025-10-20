import {
  type VShowElement,
  vShowHidden,
  vShowOriginalDisplay,
  warn,
} from '@vue/runtime-dom'
import { renderEffect } from '../renderEffect'
import { isVaporComponent } from '../component'
import { type Block, DynamicFragment, VaporFragment } from '../block'
import { isArray } from '@vue/shared'

export function applyVShow(target: Block, source: () => any): void {
  if (isVaporComponent(target)) {
    return applyVShow(target.block, source)
  }

  if (isArray(target) && target.length === 1) {
    return applyVShow(target[0], source)
  }

  if (target instanceof DynamicFragment) {
    const update = target.update
    target.update = (render, key) => {
      update.call(target, render, key)
      setDisplay(target, source())
    }
  } else if (target instanceof VaporFragment && target.insert) {
    const insert = target.insert
    target.insert = (parent, anchor) => {
      insert.call(target, parent, anchor)
      setDisplay(target, source())
    }
  }

  renderEffect(() => setDisplay(target, source()))
}

function setDisplay(target: Block, value: unknown): void {
  if (isVaporComponent(target)) {
    return setDisplay(target, value)
  }
  if (isArray(target)) {
    if (target.length === 0) return
    if (target.length === 1) return setDisplay(target[0], value)
  }
  if (target instanceof DynamicFragment) {
    return setDisplay(target.nodes, value)
  }
  if (target instanceof VaporFragment && target.insert) {
    return setDisplay(target.nodes, value)
  }
  if (target instanceof Element) {
    const el = target as VShowElement
    if (!(vShowOriginalDisplay in el)) {
      el[vShowOriginalDisplay] =
        el.style.display === 'none' ? '' : el.style.display
    }
    el.style.display = value ? el[vShowOriginalDisplay]! : 'none'
    el[vShowHidden] = !value
  } else if (__DEV__) {
    warn(
      `v-show used on component with non-single-element root node ` +
        `and will be ignored.`,
    )
  }
}
