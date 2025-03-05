import {
  type VShowElement,
  vShowHidden,
  vShowOriginalDisplay,
  warn,
} from '@vue/runtime-dom'
import { renderEffect } from '../renderEffect'
import { isVaporComponent } from '../component'
import { type Block, DynamicFragment } from '../block'
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
  }

  renderEffect(() => setDisplay(target, source()))
}

function setDisplay(target: Block, value: unknown): void {
  if (isVaporComponent(target)) {
    return setDisplay(target, value)
  }
  if (isArray(target) && target.length === 1) {
    return setDisplay(target[0], value)
  }
  if (target instanceof DynamicFragment) {
    return setDisplay(target.nodes, value)
  }
  const { $transition } = target
  if (target instanceof Element) {
    const el = target as VShowElement
    if (!(vShowOriginalDisplay in el)) {
      el[vShowOriginalDisplay] =
        el.style.display === 'none' ? '' : el.style.display
    }
    if ($transition) {
      if (value) {
        $transition.beforeEnter(target)
        el.style.display = el[vShowOriginalDisplay]!
        $transition.enter(target)
      } else {
        $transition.leave(target, () => {
          el.style.display = 'none'
        })
      }
    } else {
      el.style.display = value ? el[vShowOriginalDisplay]! : 'none'
    }
    el[vShowHidden] = !value
  } else if (__DEV__) {
    warn(
      `v-show used on component with non-single-element root node ` +
        `and will be ignored.`,
    )
  }
}
