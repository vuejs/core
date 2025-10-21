import {
  MismatchTypes,
  type VShowElement,
  vShowHidden,
  vShowOriginalDisplay,
  warn,
  warnPropMismatch,
} from '@vue/runtime-dom'
import { renderEffect } from '../renderEffect'
import { isVaporComponent } from '../component'
import type { Block, TransitionBlock } from '../block'
import { isArray } from '@vue/shared'
import { isHydrating, logMismatchError } from '../dom/hydration'
import { DynamicFragment, VaporFragment } from '../fragment'

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

  const { $transition } = target as TransitionBlock
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
        // during initial render, the element is not yet inserted into the
        // DOM, and it is hidden, no need to trigger transition
        if (target.isConnected) {
          $transition.leave(target, () => {
            el.style.display = 'none'
          })
        } else {
          el.style.display = 'none'
        }
      }
    } else {
      if (
        (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
        isHydrating
      ) {
        if (!value && el.style.display !== 'none') {
          warnPropMismatch(
            el,
            'style',
            MismatchTypes.STYLE,
            `display: ${el.style.display}`,
            'display: none',
          )
          logMismatchError()

          el.style.display = 'none'
          el[vShowOriginalDisplay] = ''
        }
      } else {
        el.style.display = value ? el[vShowOriginalDisplay]! : 'none'
      }
    }

    el[vShowHidden] = !value
  } else if (__DEV__) {
    warn(
      `v-show used on component with non-single-element root node ` +
        `and will be ignored.`,
    )
  }
}
