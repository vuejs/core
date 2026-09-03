import {
  MismatchTypes,
  type VShowElement,
  logMismatchError,
  vShowHidden,
  vShowOriginalDisplay,
  warn,
  warnPropMismatch,
} from '@vue/runtime-dom'
import { setActiveSub } from '@vue/reactivity'
import { renderEffect } from '../renderEffect'
import { isVaporComponent } from '../component'
import type { Block, TransitionBlock } from '../block'
import { isArray } from '@vue/shared'
import { isHydrating } from '../dom/hydration'
import { isDynamicFragment, isFragment, isInteropFragment } from '../fragment'
import { isInteropEnabled } from '../vdomInteropState'

export function applyVShow(target: Block, source: () => any): void {
  if (isVaporComponent(target)) {
    return applyVShow(target.block, source)
  }

  if (isArray(target) && target.length === 1) {
    return applyVShow(target[0], source)
  }

  ;(target as TransitionBlock).$vshow = true

  if (isDynamicFragment(target)) {
    // write the display state onto a fresh branch before it is inserted
    ;(target.bm ||= []).push(nodes => setDisplayUntracked(nodes, source))
  } else if (isFragment(target) && target.insert) {
    const insert = target.insert
    target.insert = (...args) => {
      const res = insert.call(target, ...args)
      setDisplayUntracked(target, source)
      return res
    }
  }

  renderEffect(() => setDisplay(target, source()))
}

// Fragment operations may leave the caller's subscriber active. The source is
// already tracked by the render effect above, so avoid collecting it again.
function setDisplayUntracked(target: Block, source: () => any): void {
  const prevSub = setActiveSub()
  try {
    setDisplay(target, source())
  } finally {
    setActiveSub(prevSub)
  }
}

function setDisplay(
  target: Block,
  value: unknown,
  transition: TransitionBlock['$transition'] = undefined,
): void {
  if (isVaporComponent(target)) {
    return setDisplay(target.block, value, transition)
  }
  if (isArray(target)) {
    if (target.length === 0) return
    if (target.length === 1) return setDisplay(target[0], value, transition)
  }
  if (isFragment(target)) {
    if (isInteropEnabled && isInteropFragment(target) && target.$transition) {
      transition = target.$transition
    }
    return setDisplay(target.nodes, value, transition)
  }

  if (target instanceof Element) {
    const el = target as VShowElement
    const hidden = !value
    if (!(vShowOriginalDisplay in el)) {
      // First touch, before insertion: only record the display state and
      // mark the element as v-show-owned. The renderer owns enter on insert
      // (vdom's directive beforeMount/mounted role), so no transition runs.
      ;(target as TransitionBlock).$vshow = true
      el[vShowOriginalDisplay] =
        el.style.display === 'none' ? '' : el.style.display
      el[vShowHidden] = hidden
      writeDisplay(el, value)
      return
    }

    if (el[vShowHidden] === hidden) return
    el[vShowHidden] = hidden

    const { $transition = transition } = target as TransitionBlock
    if ($transition) {
      const prevSub = setActiveSub()
      try {
        if (value) {
          $transition.beforeEnter(target)
          el.style.display = el[vShowOriginalDisplay]!
          $transition.enter(target)
        } else if (target.isConnected) {
          $transition.leave(target, () => {
            el.style.display = 'none'
          })
        } else {
          // detached (e.g. deactivated): nothing to animate
          el.style.display = 'none'
        }
      } finally {
        setActiveSub(prevSub)
      }
    } else {
      writeDisplay(el, value)
    }
  } else if (__DEV__) {
    warn(
      `v-show used on component with non-single-element root node ` +
        `and will be ignored.`,
    )
  }
}

function writeDisplay(el: VShowElement, value: unknown): void {
  if ((__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) && isHydrating) {
    if (!value && el.style.display !== 'none') {
      const hasMismatch = warnPropMismatch(
        el,
        'style',
        MismatchTypes.STYLE,
        `display: ${el.style.display}`,
        'display: none',
      )
      if (hasMismatch) {
        logMismatchError()
        el.style.display = 'none'
        el[vShowOriginalDisplay] = ''
      }
    }
  } else {
    el.style.display = value ? el[vShowOriginalDisplay]! : 'none'
  }
}
